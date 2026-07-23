/**
 * Audio attach layer (ARCHITECTURE.md §4.8) — the boundary between the audio
 * repository and every other use-case that renders spoken content. A caller
 * gathers exactly the strings it's about to show (the `*AudioTexts` helpers
 * below), resolves them in one round trip via `resolveAudio`, then slots
 * clips back onto its DTOs *by position* (the `attach*Audio` helpers) — a
 * paragraph's Nth clip gets the Nth entry of its `AudioClipDTO[]`, never
 * a text string a client component would have to re-hash to find its own
 * clip. That's the plan's "в пропсы клиента не должны уезжать тексты-ключи":
 * once attached, a DTO carries clip objects addressed by array position, not
 * by the clip/term text itself.
 */
import * as audioRepo from '../repositories/audio.repo';
import { normalizeAudioText, readingClipTexts } from '../domain/audio-text';
import type { GrammarSpotlightDTO, VocabEntryDTO, WatchoutDTO } from '../repositories/content.repo';
import type { AudioClipDTO } from '../repositories/audio.repo';

export type { AudioClipDTO } from '../repositories/audio.repo';

/**
 * One round trip for every distinct string a caller is about to render. The
 * language gate (only AUDIO_LANGS get queried at all) lives in
 * audioRepo.listClips, not duplicated here — a single source of truth so
 * this function's "en-c1 costs zero queries" guarantee can never drift from
 * the repository's own check.
 */
export async function resolveAudio(lang: string, texts: string[]): Promise<Map<string, AudioClipDTO>> {
  return audioRepo.listClips(lang, texts);
}

function lookup(clips: Map<string, AudioClipDTO>, text: string | null | undefined): AudioClipDTO | null {
  if (!text) return null;
  return clips.get(normalizeAudioText(text)) ?? null;
}

// ─────────────────────────────── vocab ───────────────────────────────

/** Every string a module's vocab entries need a clip for — term plus each use case, across every entry, for one shared resolveAudio call. */
export function vocabAudioTexts(entries: readonly VocabEntryDTO[]): string[] {
  return entries.flatMap((e) => [e.term, ...e.useCases]);
}

/** Attaches `{term, useCases[]}` by position — VocabStudio plays `audio.useCases[i]` for `entry.useCases[i]`, never by re-matching text on the client. */
export function attachVocabAudio(entries: readonly VocabEntryDTO[], clips: Map<string, AudioClipDTO>): VocabEntryDTO[] {
  return entries.map((e) => ({ ...e, audio: { term: lookup(clips, e.term), useCases: e.useCases.map((u) => lookup(clips, u)) } }));
}

// ─────────────────────────────── theory ───────────────────────────────

/** Every spotlight item's `example` — a table-only item (paradigm grid, no example) contributes nothing to synthesize. */
export function spotlightAudioTexts(spotlights: readonly GrammarSpotlightDTO[]): string[] {
  return spotlights.flatMap((s) => s.items.flatMap((item) => (item.example ? [item.example] : [])));
}

/** Attaches a clip to every item that has an `example`; a table-only item keeps `audio: null`. */
export function attachSpotlightAudio(spotlights: readonly GrammarSpotlightDTO[], clips: Map<string, AudioClipDTO>): GrammarSpotlightDTO[] {
  return spotlights.map((s) => ({ ...s, items: s.items.map((item) => ({ ...item, audio: lookup(clips, item.example) })) }));
}

/** Only the ✓ line — `badExample` is deliberately-wrong German and must never be requested or spoken (ARCHITECTURE.md §4.8). */
export function watchoutAudioTexts(watchouts: readonly WatchoutDTO[]): string[] {
  return watchouts.map((w) => w.goodExample);
}

/** Attaches `goodAudio` only — there is no `badAudio` field, by design (see watchoutAudioTexts). */
export function attachWatchoutAudio(watchouts: readonly WatchoutDTO[], clips: Map<string, AudioClipDTO>): WatchoutDTO[] {
  return watchouts.map((w) => ({ ...w, goodAudio: lookup(clips, w.goodExample) }));
}

// ─────────────────────────────── reading ───────────────────────────────

/**
 * Cuts each paragraph's flattened plain text (paragraphTexts' output) into
 * clip texts through the same READING_CLIP_GRANULARITY knob scripts/audio.ts
 * used to decide what to synthesize, so a lookup built from this always lands
 * on the generator's own clip boundaries — today one clip per paragraph, but
 * the shape stays per-paragraph-array either way.
 */
export function paragraphClipTexts(paragraphTextsList: readonly string[]): string[][] {
  return paragraphTextsList.map((p) => readingClipTexts(p));
}

/**
 * Per paragraph, the clips of whichever of its texts were actually found —
 * never a sparse/null-padded array. A gap (one text not yet synthesized) is
 * silently skipped rather than surfaced, so the playback queue still plays
 * what exists back-to-back; a paragraph with nothing synthesized at all comes
 * back `[]`, which the PlayButton/queue read as "no button". Under
 * READING_CLIP_GRANULARITY='paragraph' each inner array is 0 or 1 long.
 */
export function attachReadingAudio(clipsByParagraph: readonly string[][], clips: Map<string, AudioClipDTO>): AudioClipDTO[][] {
  return clipsByParagraph.map((texts) => {
    const found: AudioClipDTO[] = [];
    for (const s of texts) {
      const clip = lookup(clips, s);
      if (clip) found.push(clip);
    }
    return found;
  });
}
