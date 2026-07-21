import { DETERMINATE_GAP_WORDS as EN } from './en';
import { DETERMINATE_GAP_WORDS as DE } from './de';

/**
 * Language dispatcher for the open_cloze determinacy rule
 * (docs/CONTENT-PACKAGE-SCHEMA.md). The rule itself is universal — a gap the
 * learner cannot recover is a guessing game — but what counts as recoverable is
 * language-specific, so each course brings its own word lists keyed by
 * course.yaml's `language`.
 */

const BY_LANGUAGE: Record<string, ReadonlySet<string>> = { en: EN, de: DE };

/** ISO 639-1 codes that have curated word lists. */
export const SUPPORTED_GAP_LANGUAGES = Object.keys(BY_LANGUAGE);

export function determinateGapWords(language: string): ReadonlySet<string> {
  const set = BY_LANGUAGE[language];
  if (!set) {
    throw new Error(
      `No open_cloze word list for language "${language}". Add lib/content-gap-words/${language}.ts ` +
        `and register it here (have: ${SUPPORTED_GAP_LANGUAGES.join(', ')}).`,
    );
  }
  return set;
}

/** True when every token of every accepted answer is recoverable from the frame. */
export function isDeterminateGap(answers: readonly string[], language: string): boolean {
  const words = determinateGapWords(language);
  return answers.every((answer) =>
    answer
      .toLowerCase()
      // Sentence punctuation only — the apostrophe is part of the word here
      // (needn't, shouldn't), so it survives; a quoted answer loses its wrapper.
      .replace(/[.,!?;:"]/g, '')
      .split(/\s+/)
      .map((token) => token.replace(/^'+|'+$/g, ''))
      .filter(Boolean)
      .every((token) => words.has(token)),
  );
}

/**
 * How many accepted answers count as "the whole semantic class is open".
 * Some gaps are pinned by grammar to a class rather than a word — the
 * subjunctive trigger in "It is ___ that every child have a safe route"
 * takes essential, vital, imperative, crucial, important or necessary, and a
 * base-form hint would simply be the answer. Listing the class exhaustively
 * is the fix there, so a generous `answers` set stands in for a hint.
 */
export const OPEN_CLASS_ANSWER_THRESHOLD = 4;
