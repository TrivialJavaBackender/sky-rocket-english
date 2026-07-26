/**
 * Words of a reading body. Counts glossed segments too (`{ g: … }`, which the
 * player renders as a word) and drops tokens with no letter, so menu prices and
 * `·` separators do not inflate the count.
 */
export function countReadingWords(body: unknown): number {
  const segments = (body as Array<Array<Record<string, string>>>).flat();
  return segments
    .map((s) => s.t ?? s.g ?? '')
    .join(' ')
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w)).length;
}
