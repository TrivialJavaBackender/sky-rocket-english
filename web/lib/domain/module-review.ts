/**
 * Lane 3 — module reviews r7/r21 → Mastered (ARCHITECTURE.md §6.3). Pure
 * scheduling/grading transitions; repositories own `module_review` I/O.
 */
import { addDays, startOfDay } from './time';
import type { ReviewStage } from './types';

/** Pass threshold is 80% from PLAN §4 — deliberately not `checkpoint.pass_mark`, which is a separate mechanic (§6.3). */
export const MODULE_REVIEW_PASS_THRESHOLD = 80;

/** Closing a module (UC-14, module_quiz) schedules both r7 and r21 with taken_at=null. */
export function scheduleModuleReviews(now: Date): Array<{ stage: ReviewStage; dueAt: Date }> {
  return [
    { stage: 'r7', dueAt: startOfDay(addDays(now, 7)) },
    { stage: 'r21', dueAt: startOfDay(addDays(now, 21)) },
  ];
}

export function gradeModuleReview(score: number): { passed: boolean } {
  return { passed: score >= MODULE_REVIEW_PASS_THRESHOLD };
}

/** Module promotes to Mastered once both r7 and r21 are passed (either order). */
export function isModuleMastered(r7Passed: boolean | null | undefined, r21Passed: boolean | null | undefined): boolean {
  return r7Passed === true && r21Passed === true;
}
