/**
 * Lane 2 — exercise re-queue, stages +2/+7/+21 days (ARCHITECTURE.md §6.2).
 * Pure transition functions; repositories/use-cases own the actual
 * `review_queue_item` reads/writes and the `review_queue_open_uniq` partial
 * unique (one open item per (user, exercise)).
 */
import { addDays, startOfDay } from './time';

const STAGE_DUE_DAYS: Record<1 | 2 | 3, number> = { 1: 2, 2: 7, 3: 21 };
const MAX_STAGE = 3;

/** A wrong answer outside review_slot context opens a new stage-1 item, due in 2 days (§6.2, §5). */
export function scheduleNewReviewQueueItem(now: Date): { stage: 1; dueAt: Date } {
  return { stage: 1, dueAt: startOfDay(addDays(now, STAGE_DUE_DAYS[1])) };
}

export interface ReviewQueueTransition {
  stage: 1 | 2 | 3;
  dueAt: Date;
  /** true once stage 3 is answered correctly — caller sets resolved_at=now and stops rescheduling. */
  resolved: boolean;
}

/**
 * A review_slot attempt against an open item. Correct at stage<3 advances
 * one stage (1→2→3) with the next due date; correct at stage 3 closes the
 * item. Incorrect on any stage resets to stage 1 / +2 days — "the topic
 * isn't learned yet" (§6.2).
 */
export function advanceReviewQueueItem(currentStage: 1 | 2 | 3, wasCorrect: boolean, now: Date): ReviewQueueTransition {
  if (!wasCorrect) {
    return { stage: 1, dueAt: startOfDay(addDays(now, STAGE_DUE_DAYS[1])), resolved: false };
  }
  if (currentStage >= MAX_STAGE) {
    return { stage: currentStage, dueAt: now, resolved: true };
  }
  const nextStage = (currentStage + 1) as 2 | 3;
  return { stage: nextStage, dueAt: startOfDay(addDays(now, STAGE_DUE_DAYS[nextStage])), resolved: false };
}
