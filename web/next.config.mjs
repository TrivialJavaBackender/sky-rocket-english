/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Audio clips are content-addressed and immutable (ARCHITECTURE.md
        // §4.8 — the filename is a hash of engine+voice+text): the browser
        // caching one forever can never later see stale bytes at that same
        // URL, so `immutable` is a fact here, not an optimistic guess.
        source: '/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          // Neither Next's static handler nor Netlify's CDN knows the .opus
          // extension, and both fall back to application/octet-stream. Media
          // elements then have to sniff the container to decide whether they
          // can play it at all — declaring the type is what makes playback
          // deterministic across browsers.
          { key: 'Content-Type', value: 'audio/ogg' },
        ],
      },
      {
        // The opposite policy, deliberately: the service worker script is
        // the one file in this app that MUST be re-checked on every load —
        // caching it would let a bug fix to sw.js take up to a year to
        // reach a returning visitor. `Service-Worker-Allowed: /` lets it
        // control the whole origin from its default '/' scope explicitly;
        // harmless beyond /audio/** since its own fetch handler ignores
        // everything else anyway.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
