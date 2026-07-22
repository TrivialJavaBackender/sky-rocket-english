/**
 * Shared audio-pipeline constants (ARCHITECTURE.md §4.8). scripts/audio.ts
 * (generates + writes blobs) and scripts/sync.ts (checks a blob exists before
 * syncing its row) both resolve paths from here rather than each hardcoding
 * `web/public/audio`, so the two can never quietly drift onto different
 * directories.
 *
 * `AUDIO_PROFILE`/`AUDIO_LANGS` are the single source of truth for the
 * decisions in the plan's motivation doc (owner-approved 2026-07): one voice
 * profile, no speed picker in the UI, and audio only for German courses — an
 * `en-c1` page must be able to short-circuit to zero audio queries just by
 * checking `hasAudio(course.language)` before it ever reaches a repository.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDIO_PROFILE = 'normal' as const;

/** Courses whose language matches one of these get audio; everything else (en-c1 today) resolves to an empty map with no query. */
export const AUDIO_LANGS = ['de'] as const;
export type AudioLang = (typeof AUDIO_LANGS)[number];

export function hasAudio(lang: string): lang is AudioLang {
  return (AUDIO_LANGS as readonly string[]).includes(lang);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file sits at web/lib/audio/ — two levels up is web/'s own root.
const WEB_ROOT = path.resolve(__dirname, '..', '..');

/** Next.js's static root — public/<manifest path> is a clip's on-disk location (path.join tolerates the manifest path's leading '/'; see blobFsPath). */
export const WEB_PUBLIC_DIR = path.join(WEB_ROOT, 'public');

/** Root every course's audio blobs live under, sharded lang/xx/key.opus — what scripts/audio.ts walks to prune files no manifest references any more. */
export const AUDIO_PUBLIC_DIR = path.join(WEB_PUBLIC_DIR, 'audio');

/**
 * Absolute filesystem location of a clip from its manifest/DB `path` value
 * (e.g. '/audio/de/a3/<key>.opus'). Joins from WEB_PUBLIC_DIR, not
 * AUDIO_PUBLIC_DIR — the manifest path already spells out the 'audio/'
 * segment, and joining onto AUDIO_PUBLIC_DIR too would double it.
 */
export function blobFsPath(manifestPath: string): string {
  return path.join(WEB_PUBLIC_DIR, manifestPath);
}

/** Where a course's committed, sync-facing manifest lives (ARCHITECTURE.md §4.8) — courses/<slug>/audio/manifest.json, given that course's own root directory. */
export function audioManifestPath(courseDir: string): string {
  return path.join(courseDir, 'audio', 'manifest.json');
}
