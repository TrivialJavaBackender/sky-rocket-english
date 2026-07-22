// Minimal offline cache for synthesized audio clips (ARCHITECTURE.md §4.8,
// plan step 7). This worker has exactly one job — make an already-played (or
// explicitly downloaded) /audio/** clip available offline — and deliberately
// does nothing else: it never touches navigations, API routes, or exercise
// data. A service worker that reasoned about *those* would have to think
// about auth cookies, staleness, and per-user state; scoping it to one
// static, public, content-addressed path sidesteps all of that.
//
// Plain JS on purpose — this file ships to the browser exactly as written,
// with no build step.

const CACHE_NAME = 'srx-audio-v1';
const AUDIO_PREFIX = '/audio/';
// How many clips a prefetch batch fetches concurrently. Clips are tiny
// (single sentences/phrases, low tens of KB), so this is about not opening
// dozens of simultaneous connections on a flaky mobile network, not about
// memory.
const PREFETCH_CONCURRENCY = 4;

self.addEventListener('install', (event) => {
  // No pre-caching here on purpose: which clips exist is entirely
  // data-driven (the DB's audio_clip table), and nothing is worth a
  // learner's mobile data until they either play it or hit "Save audio
  // offline" — this worker only ever reacts, never anticipates.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      // Anything under a different cache name is a previous CACHE_NAME
      // version (bump the suffix, e.g. -v2, if the response shape stored
      // here ever changes) — never a cache some other part of the app owns,
      // since this worker is the only thing in the app that calls
      // caches.open() at all.
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Same-origin GET under /audio/ only. Everything else — HTML navigations,
  // /api or server-action POSTs, other origins — must fall through to the
  // network completely untouched: not calling respondWith() at all here is
  // what makes that guarantee, rather than a respondWith(fetch(request))
  // pass-through that would still put this worker in the critical path (and
  // in the blast radius) of every request the app makes.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(AUDIO_PREFIX)) {
    return;
  }
  event.respondWith(handleAudioRequest(event.request));
});

async function handleAudioRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  // ignoreVary: the one response ever stored under this URL is the only one
  // that will ever exist for it (content-addressed, immutable — see
  // lib/domain/audio-text.ts's header), so there is no real Vary axis to
  // respect even if the origin response happened to carry one.
  const cached = await cache.match(request.url, { ignoreVary: true });
  if (cached) return sliceForRange(cached, request);

  // Cache miss: fetch the *whole* file — a fresh request with no Range,
  // built from just the URL — regardless of what Range the caller asked
  // for. Caching a 206 would only ever satisfy the one byte range it was
  // fetched for; caching the full 200 once and slicing it per-request below
  // is what lets a later, differently-ranged request still be answered from
  // this same cache entry. (In practice every clip here is small enough
  // that "whole file" and "the range a media element asks for" are the same
  // download anyway.)
  let response;
  try {
    response = await fetch(new Request(request.url, { method: 'GET' }));
  } catch (err) {
    throw err; // offline and nothing cached — a network error is the correct outcome
  }
  if (!response.ok) return response; // 404/5xx: hand it straight through, nothing to cache

  // Best-effort: a write failure (quota, private browsing) must not break
  // *this* playback, which already has the response it needs in hand.
  cache.put(request.url, response.clone()).catch(() => {});
  return sliceForRange(response, request);
}

/**
 * Builds the actual response for `request` from a *full* cached/fetched
 * body — a plain 200 if it carried no Range header, otherwise a 206 sliced
 * to the requested bytes. Required, not optional: media elements always
 * probe with `Range: bytes=0-` to learn whether the server supports
 * seeking, and a 200-only cache would make every clip un-seekable (and, in
 * some browsers, fail to play from a service-worker response at all).
 */
async function sliceForRange(fullResponse, request) {
  const rangeHeader = request.headers.get('range');
  const contentType = fullResponse.headers.get('content-type') || 'audio/ogg';
  const buffer = await fullResponse.clone().arrayBuffer();
  const total = buffer.byteLength;

  const range = rangeHeader ? parseRange(rangeHeader, total) : null;
  if (!range) {
    // No Range header, or one this function doesn't recognize (multi-range
    // like "bytes=0-10,20-30" — something no <audio>/<video> element ever
    // actually sends). RFC 7233 explicitly allows answering any Range
    // request with a full 200 instead of a 206; it is always a safe
    // fallback, never a wrong answer.
    return new Response(buffer, { status: 200, headers: { 'Content-Type': contentType, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' } });
  }

  const sliced = buffer.slice(range.start, range.end + 1);
  return new Response(sliced, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(sliced.byteLength),
      'Content-Range': `bytes ${range.start}-${range.end}/${total}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Parses the single-range form ("bytes=0-", "bytes=0-499", "bytes=-500") every media element actually sends. Returns null for anything else (unparseable, or start past the end of the file) so the caller falls back to a full 200 — see sliceForRange. */
function parseRange(rangeHeader, totalLength) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return null;

  let start;
  let end;
  if (startStr === '') {
    // Suffix range, e.g. "bytes=-500" = the last 500 bytes.
    start = Math.max(totalLength - Number(endStr), 0);
    end = totalLength - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? totalLength - 1 : Math.min(Number(endStr), totalLength - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end) return null;
  return { start, end };
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'audio-prefetch' || !Array.isArray(data.urls)) return;
  event.waitUntil(prefetchUrls(data.urls, event.source));
});

/**
 * Backs DownloadModuleAudio's "Save audio offline". Reports progress back
 * to whichever client posted the request (`client.postMessage`, the mirror
 * image of how the page reached this handler) after each chunk, so a large
 * module's download can show a percentage instead of going silent until
 * everything finishes. One bad URL (offline mid-batch, a 404) is caught
 * per-item and does not stop the rest of the batch.
 */
async function prefetchUrls(urls, client) {
  const cache = await caches.open(CACHE_NAME);
  const total = urls.length;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += PREFETCH_CONCURRENCY) {
    const chunk = urls.slice(i, i + PREFETCH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (rawUrl) => {
        try {
          const absolute = new URL(rawUrl, self.location.origin);
          // Defensive even though every real caller only ever sends its own
          // AudioClipDTO.url values: this handler is reachable by any script
          // that can talk to this worker, so it re-checks the same
          // same-origin/audio-only rule the fetch listener enforces above.
          if (absolute.origin !== self.location.origin || !absolute.pathname.startsWith(AUDIO_PREFIX)) {
            failed += 1;
            return;
          }
          const already = await cache.match(absolute.toString(), { ignoreVary: true });
          if (!already) {
            const response = await fetch(absolute.toString());
            if (response.ok) await cache.put(absolute.toString(), response);
            else failed += 1;
          }
        } catch {
          failed += 1;
        } finally {
          completed += 1;
        }
      }),
    );
    client?.postMessage({ type: 'audio-prefetch-progress', completed, total, failed });
  }

  client?.postMessage({ type: 'audio-prefetch-done', total, failed });
}
