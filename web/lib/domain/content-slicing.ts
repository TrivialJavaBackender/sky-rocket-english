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
