/**
 * daily_activity — streak/heatmap source, upserted by any productive step
 * (ARCHITECTURE §1.6 UC-22).
 */
import { prisma } from '../db';
import { startOfDay } from '../domain/time';

export interface DailyActivityDelta {
  exercisesDone?: number;
  cardsReviewed?: number;
  minutes?: number;
}

/** Adds `delta` to today's row for the user, creating it if this is the first productive action today. All deltas are non-negative increments — never an overwrite. */
export async function bumpDailyActivity(userId: number, delta: DailyActivityDelta, now: Date = new Date()): Promise<void> {
  const date = startOfDay(now);
  const exercisesDone = delta.exercisesDone ?? 0;
  const cardsReviewed = delta.cardsReviewed ?? 0;
  const minutes = delta.minutes ?? 0;
  await prisma.daily_activity.upsert({
    where: { user_id_activity_date: { user_id: userId, activity_date: date } },
    create: { user_id: userId, activity_date: date, exercises_done: exercisesDone, cards_reviewed: cardsReviewed, minutes },
    update: {
      exercises_done: { increment: exercisesDone },
      cards_reviewed: { increment: cardsReviewed },
      minutes: { increment: minutes },
    },
  });
}

/** Distinct active calendar days in the window — domain.computeStreak turns this into a streak count. */
export async function listActiveDates(userId: number, since: Date): Promise<Date[]> {
  const rows = await prisma.daily_activity.findMany({
    where: { user_id: userId, activity_date: { gte: since } },
    select: { activity_date: true },
  });
  return rows.map((r) => r.activity_date);
}

export async function getTodayActivity(userId: number, now: Date = new Date()): Promise<{ exercisesDone: number; cardsReviewed: number; minutes: number } | null> {
  const row = await prisma.daily_activity.findUnique({ where: { user_id_activity_date: { user_id: userId, activity_date: startOfDay(now) } } });
  return row ? { exercisesDone: row.exercises_done, cardsReviewed: row.cards_reviewed, minutes: row.minutes } : null;
}
