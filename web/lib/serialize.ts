/**
 * DTO boundary for lib/repositories/*: Postgres `bigint` primary keys come
 * back from Prisma as JS `BigInt`, which doesn't serialize to JSON and is
 * awkward in RSC → client props. Safe to collapse to `number` here because
 * this app is single-user scale — ids stay well under 2^53 (ARCHITECTURE §3.4, D7).
 */
export function idToNumber(id: bigint | number): number {
  return typeof id === 'bigint' ? Number(id) : id;
}

/** Shallow-maps every `bigint` field of an object/array to `number`. One level deep by design — repositories should call this per-DTO, not recursively guess shapes. */
export function serializeIds<T extends Record<string, unknown>>(row: T): { [K in keyof T]: T[K] extends bigint ? number : T[K] } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out as { [K in keyof T]: T[K] extends bigint ? number : T[K] };
}

/**
 * Same rationale as idToNumber, but for `numeric(...)` columns (interval_days,
 * ease, score, quiz_score, best_score): Prisma returns these as
 * `Prisma.Decimal` (decimal.js), which is also awkward in RSC → client props
 * and in domain math. Safe to collapse to `number` at this single-user scale.
 */
export function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}
