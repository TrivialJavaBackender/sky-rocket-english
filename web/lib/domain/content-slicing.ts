/**
 * Content-agnostic slicing for dosed theory/vocab steps (PLAN.md §3,
 * ARCHITECTURE.md UC-06/UC-08). A step's config carries {"part":P,"of":N} /
 * {"batch":B,"of":N}; the module's ordered spotlights/vocab entries are cut
 * into N balanced contiguous slices at render time, so the same seeded step
 * matrix works for any module regardless of its content counts (5 spotlights
 * → 3+2, 45 lexemes → 15/15/15; a 1-spotlight module simply yields an empty
 * part 2, which the UI must tolerate).
 */

/** 1-based `part` of `of`; earlier parts absorb the remainder. Returns [start, end) indices. */
export function partBounds(len: number, part: number, of: number): { start: number; end: number } {
  const n = Math.max(1, Math.floor(of));
  const p = Math.min(Math.max(1, Math.floor(part)), n);
  const base = Math.floor(len / n);
  const remainder = len % n;
  const sizeOf = (i: number) => base + (i <= remainder ? 1 : 0);
  let start = 0;
  for (let i = 1; i < p; i++) start += sizeOf(i);
  return { start, end: start + sizeOf(p) };
}

export function slicePart<T>(items: T[], part: number, of: number): T[] {
  const { start, end } = partBounds(items.length, part, of);
  return items.slice(start, end);
}

/**
 * How many of the module's ordered vocab entries the learner has actually met
 * in a `vocab` step — the ceiling for what may enter the SRS deck.
 *
 * The deck used to be introduced whole by `flashcards_intro`, which sits in
 * Prime right after "Vocabulary 1 of 3": batches 2 and 3 started coming up in
 * daily review days before their step, as words the learner had never seen.
 * Reading the done-ness of the `vocab` steps keeps the two dosing schemes
 * (session batches, deck introduction) on the same clock, and stays correct
 * whichever order the steps get completed in.
 */
export function metVocabCount(steps: { kind: string; config: Record<string, unknown>; status: string }[], totalVocab: number): number {
  let met = 0;
  for (const step of steps) {
    if (step.kind !== 'vocab' || step.status !== 'done') continue;
    const batch = typeof step.config.batch === 'number' ? step.config.batch : 1;
    const of = typeof step.config.of === 'number' ? step.config.of : 1;
    met = Math.max(met, partBounds(totalVocab, batch, of).end);
  }
  return met;
}
