/**
 * Pure date helpers (ARCHITECTURE.md §6.1), ported from
 * ../concurrency/web/lib/leitner.ts. All "day-granularity" due dates (review
 * queue +2/+7/+21, module reviews +7/+21) are anchored to startOfDay so
 * "due today" is a stable boolean regardless of what time of day the user
 * studies. Flashcard SRS short learning steps (10 min, etc.) are the
 * exception — those use addMinutes and stay precise to the minute, same as
 * real SRS tools (Anki), because a whole-day granularity would make "Again"
 * useless as a same-session retry.
 */

const MS_PER_MINUTE = 60_000;

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MS_PER_MINUTE);
}

/** True calendar-day equality, independent of time-of-day. */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * First sync of a module can introduce 60+ flashcards at once (45 vocab + 10
 * grammar cloze + 8 transformation). Dropping them all with due_at=now would
 * dump the whole deck into day 1's queue. Round-robin them across the next 7
 * days instead, so the daily queue stays manageable (port of
 * spreadInitialDueDate from ../concurrency/web/lib/leitner.ts, §6.4).
 */
export function spreadInitialDueDate(index: number, now: Date = new Date()): Date {
  const tomorrow = startOfDay(addDays(now, 1));
  return addDays(tomorrow, index % 7);
}
