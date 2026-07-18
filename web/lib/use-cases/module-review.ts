/**
 * UC-17 · Lane 3 module reviews (r7/r21 → Mastered). ARCHITECTURE.md §1.4, §6.3.
 *
 * Per-attempt grading during a module_review quiz goes through
 * exercise-set.gradeAndRecord(context='module_review') like any other
 * exercise — but §5's "open a review_queue_item on a miss" rule explicitly
 * excludes `module_review` from its per-attempt trigger set (only
 * session/module_quiz/practice qualify). Instead §6.3 makes that a
 * review-level decision: only once the *whole* review fails do its missed
 * items return to lane 2. finishModuleReview is where that happens — the
 * caller accumulates each gradeAndRecord result across the quiz and passes
 * them here at the end.
 */
import * as reviewRepo from '../repositories/review.repo';
import * as moduleRepo from '../repositories/module.repo';
import { gradeModuleReview, isModuleMastered } from '../domain/module-review';
import { moduleStatusOnMastery } from '../domain/module-state';
import { scheduleNewReviewQueueItem } from '../domain/review-queue';
import { startExerciseSet, type PublicExerciseDTO } from './exercise-set';
import type { ReviewStage } from '../domain/types';

/** Quiz content for a module review: 10 fresh variants from the module's review pool (same pool as the module_quiz, §1.4 UC-17). */
export async function getModuleReviewSet(moduleId: number, count = 10): Promise<PublicExerciseDTO[]> {
  return startExerciseSet({ moduleId, pool: 'review', limit: count });
}

export interface ModuleReviewAttemptInput {
  exerciseId: number;
  attemptId: number;
  isCorrect: boolean;
}

export interface ModuleReviewOutcome {
  score: number;
  passed: boolean;
  mastered: boolean;
}

export async function finishModuleReview(
  userId: number,
  moduleId: number,
  stage: ReviewStage,
  attempts: ModuleReviewAttemptInput[],
  now: Date = new Date(),
): Promise<ModuleReviewOutcome> {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const { passed } = gradeModuleReview(score);

  await reviewRepo.recordModuleReviewResult(userId, moduleId, stage, score, passed);

  // §6.3: a failed review returns its weak topics to Lane 2.
  if (!passed) {
    for (const a of attempts.filter((x) => !x.isCorrect)) {
      const schedule = scheduleNewReviewQueueItem(now);
      await reviewRepo.openReviewQueueItem(userId, a.exerciseId, schedule.dueAt, a.attemptId);
    }
  }

  const reviews = await reviewRepo.getModuleReviews(userId, moduleId);
  const r7 = reviews.find((r) => r.stage === 'r7');
  const r21 = reviews.find((r) => r.stage === 'r21');
  const mastered = isModuleMastered(r7?.passed, r21?.passed);
  if (mastered) {
    await moduleRepo.upsertUserModuleState(userId, moduleId, { status: moduleStatusOnMastery(), masteredAt: now });
  }

  return { score, passed, mastered };
}
