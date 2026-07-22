/**
 * Text handling shared by the audio pipeline (ARCHITECTURE.md §4.8): the
 * extractor (scripts/audio.ts), the sync gate (scripts/sync.ts) and the
 * reading-related pages all need to agree on "what string does this clip
 * belong to", and disagreeing by even one whitespace character would mean a
 * clip the generator produced can never be found by a lookup built from
 * slightly different text. Isomorphic and dependency-free on purpose — no
 * `node:*` imports — so a client component (ReadingText, VocabStudio) can
 * import it directly instead of trusting a server-computed prop to match.
 *
 * `TextSegment` is re-exported from lib/content-schema.ts rather than
 * redefined, same reasoning as lib/domain/types.ts: that module has no I/O of
 * its own, so depending on it here doesn't pull anything into a client bundle
 * that a "no node imports" module shouldn't carry.
 */

import type { TextSegment } from '../content-schema';

export type { TextSegment };

/**
 * Mirrors tts-mcp's `normalize_text()` (core/text.py) exactly: NFC + collapse
 * whitespace + trim, case untouched. This is the *only* place either side of
 * the pipeline is allowed to decide what counts as "the same text" — both
 * `text_hash` (this app's lookup key) and tts-mcp's own `content_key` are
 * computed from this function's output, so a drift here would silently split
 * one sentence into two cache entries.
 */
export function normalizeAudioText(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Joins one paragraph's `{t}`/`{g:key}` segments into the plain text a reader
 * (or a TTS engine) actually sees. `glossTerm` resolves a gloss key to its
 * headword; an unknown key falls back to the key itself rather than vanishing,
 * so a dangling gloss reference degrades to visible (if odd) text instead of
 * silently eating a word — the same fallback the inline join in the session
 * page used before this module existed.
 */
export function flattenParagraph(segments: readonly TextSegment[], glossTerm: (key: string) => string | undefined): string {
  return segments.map((seg) => ('t' in seg ? seg.t : (glossTerm(seg.g) ?? seg.g))).join('');
}

/**
 * Flattens every paragraph of a reading body. `glosses` accepts either shape
 * a caller already has on hand, rather than making every caller reshape its
 * own data first: the array straight out of a YAML package (content-schema's
 * `GlossSchema`, read by scripts/audio.ts) or the `key → row` map
 * `content.repo.ts` builds for page rendering (`Record<string, GlossDTO>`).
 * Both carry `term` per key, which is all flattening needs.
 */
export function paragraphTexts(
  body: readonly (readonly TextSegment[])[],
  glosses: Record<string, { term: string }> | readonly { key: string; term: string }[],
): string[] {
  const glossTerm = Array.isArray(glosses)
    ? new Map(glosses.map((g) => [g.key, g.term] as const))
    : new Map(Object.entries(glosses as Record<string, { term: string }>).map(([key, g]) => [key, g.term] as const));
  return body.map((paragraph) => flattenParagraph(paragraph, (key) => glossTerm.get(key)));
}

/** Sentences longer than this are still returned whole (see splitSentences) — a caller prints them in its coverage report as "rewrite this paragraph" bait, since chatterbox's one-shot rendering degrades on long input. */
export const MAX_SENTENCE_CHARS = 400;

// '.' is the only terminator that is ever ambiguous in German — it also
// closes abbreviations ("bzw.") and sits inside ordinals/times ("3.", "10.30").
// '!', '?' and the single-character ellipsis '…' never do, so any run
// containing one of them (or a run of 2+ terminators, e.g. "?!" or "...") is
// an unconditional boundary; only a *lone* '.' goes through the checks below.
const SENTENCE_TERMINATORS = new Set(['.', '!', '?', '…']);

// Quotes/brackets that close the sentence they trail rather than open the
// next one. German double quotes invert the Anglophone convention — „…“ opens
// low and closes with what looks like an opening curly quote in English — so
// '“' ("“") is the common case here, not '”'. The rest (guillemet,
// parenthesis, straight quote, both single-quote glyphs) cover styles that
// don't appear in today's content but would silently misplace the boundary if
// they showed up and weren't handled.
const TRAILING_CLOSERS = new Set(['“', '»', ')', '"', '‘', '’']);

// The two-token German correlatives ("z. B.", "u. a.", "d. h.") are each half
// an independent abbreviation from this function's point of view — it meets
// "z." and "B." as two separate lone-dot decisions, not one two-word pattern —
// so both halves are listed individually alongside the single-token ones.
const ABBREVIATION_HEADS = new Set(['z', 'B', 'u', 'a', 'd', 'h', 'bzw', 'usw', 'ca', 'Dr', 'Nr', 'Hr', 'Fr', 'St']);

function isLetter(ch: string): boolean {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
}
function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** True if the word immediately before `dotIndex` is a known abbreviation head, so the dot at `dotIndex` does not end the sentence. */
function precedingAbbreviation(text: string, dotIndex: number): boolean {
  let start = dotIndex;
  while (start > 0 && isLetter(text[start - 1])) start--;
  return start < dotIndex && ABBREVIATION_HEADS.has(text.slice(start, dotIndex));
}

/**
 * True if `dotIndex` sits right after a standalone number ("10.30", "am 3."),
 * not the tail of an alphanumeric token like a level name ("A1."). The digit
 * run alone isn't enough evidence — it must also be preceded by a
 * non-letter (or start of string), or "Niveau A1." would wrongly count "1" as
 * a bare number and swallow the period.
 */
function precedingNumberToken(text: string, dotIndex: number): boolean {
  let start = dotIndex;
  while (start > 0 && isDigit(text[start - 1])) start--;
  return start < dotIndex && (start === 0 || !isLetter(text[start - 1]));
}

/**
 * Splits a normalized German paragraph into sentences on `.!?…`, holding back
 * on a lone '.' that is really an abbreviation or a number/date, keeping a
 * trailing closing quote/bracket with the sentence it closes rather than
 * letting it drift onto the front of the next one, and *not* breaking a
 * quoted question/exclamation away from the reporting clause that follows it
 * ("„Woher kommst du?“, fragt sie." is one sentence, not two — a comma can
 * never legitimately follow a real sentence end, so its presence is
 * unambiguous evidence this terminator was internal to a quotation).
 *
 * Otherwise deliberately does not read ahead past the terminator (e.g.
 * checking for a following capital letter): the abbreviation/number lists
 * above and the reporting-clause comma are the entire rule, so the same
 * input always yields the same cut points, in the generator and anywhere
 * else this module is imported.
 *
 * A sentence over MAX_SENTENCE_CHARS is still returned whole, never sliced
 * further — this function has no license to invent a boundary the text
 * itself doesn't have.
 */
export function splitSentences(text: string): string[] {
  const normalized = normalizeAudioText(text);
  if (!normalized) return [];

  const sentences: string[] = [];
  let cutStart = 0;
  let i = 0;
  while (i < normalized.length) {
    if (!SENTENCE_TERMINATORS.has(normalized[i])) {
      i++;
      continue;
    }

    let runEnd = i + 1;
    while (runEnd < normalized.length && SENTENCE_TERMINATORS.has(normalized[runEnd])) runEnd++;

    const isLoneDot = runEnd - i === 1 && normalized[i] === '.';
    if (isLoneDot && (precedingAbbreviation(normalized, i) || precedingNumberToken(normalized, i))) {
      i = runEnd; // not a boundary — resume scanning right after this dot
      continue;
    }

    let end = runEnd;
    while (end < normalized.length && TRAILING_CLOSERS.has(normalized[end])) end++;

    if (normalized[end] === ',') {
      i = end; // "…?“, sagt sie." — a reporting-clause comma, not a boundary
      continue;
    }

    const sentence = normalized.slice(cutStart, end).trim();
    if (sentence) sentences.push(sentence);
    cutStart = end;
    i = end;
  }

  const rest = normalized.slice(cutStart).trim();
  if (rest) sentences.push(rest);
  return sentences;
}
