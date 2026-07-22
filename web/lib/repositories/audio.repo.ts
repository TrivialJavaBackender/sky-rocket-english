/**
 * Audio clip lookup (ARCHITECTURE.md §4.8) — the only file allowed to touch
 * Prisma for audio_clip. A clip is addressed by content, not position: the
 * app never knows a clip's own tts-mcp key or voice, only whether *this
 * exact string* (after normalizeAudioText) has already been synthesized —
 * the same normalizer the generator (scripts/audio.ts) and the sync gate
 * (scripts/sync.ts) use, so a clip found here is guaranteed to be the
 * current text's own recording, never a stale one left over from an edited
 * sentence (see db/migrations/0009_audio_clip.sql's header for the full
 * reasoning).
 */
import { createHash } from 'node:crypto';
import { prisma } from '../db';
import { normalizeAudioText } from '../domain/audio-text';
import { AUDIO_PROFILE, hasAudio } from '../audio/config';

/**
 * A synthesized clip, ready for an <audio> element or the service worker
 * cache. Deliberately thin — no `id`, `clip_key` or `voice`: those are the
 * row's own provenance/debugging fields, not anything a PlayButton needs in
 * order to play it.
 */
export interface AudioClipDTO {
  url: string;
  durationMs: number;
  bytes: number;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Resolves every clip matching `texts` in one round trip, keyed by
 * normalizeAudioText(text) rather than the caller's raw string — so a
 * caller looks its own text up with `map.get(normalizeAudioText(s))` and
 * never has to re-derive a hash itself.
 *
 * Short-circuits before ever reaching Postgres for a language outside
 * AUDIO_LANGS or an empty/all-blank `texts`: an en-c1 page must cost zero
 * audio queries, not just render zero buttons (ARCHITECTURE.md §4.8, plan's
 * "адресация аудио по тексту" decision).
 */
export async function listClips(lang: string, texts: string[]): Promise<Map<string, AudioClipDTO>> {
  if (texts.length === 0 || !hasAudio(lang)) return new Map();

  const hashToText = new Map<string, string>();
  for (const raw of texts) {
    const text = normalizeAudioText(raw);
    if (text) hashToText.set(sha256(text), text);
  }
  if (hashToText.size === 0) return new Map();

  const rows = await prisma.audio_clip.findMany({
    where: { lang, profile: AUDIO_PROFILE, text_hash: { in: [...hashToText.keys()] } },
  });

  const result = new Map<string, AudioClipDTO>();
  for (const row of rows) {
    const text = hashToText.get(row.text_hash);
    if (!text) continue; // defensive only: every text_hash queried came from this same map's keys
    result.set(text, { url: row.path, durationMs: row.duration_ms, bytes: row.bytes });
  }
  return result;
}
