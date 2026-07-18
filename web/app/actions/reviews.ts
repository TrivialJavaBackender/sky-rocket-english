'use server';

/**
 * UC-17 module review completion (ARCHITECTURE.md §2, §9 stage 3). Review
 * Slot (UC-16) answers go through actions/exercises.ts::gradeAndRecord with
 * context='review_slot' — there's no separate "finish" step for lane 2,
 * each item resolves (or resets) as it's answered.
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as moduleReviewUseCase from '@/lib/use-cases/module-review';
import type { ReviewStage } from '@/lib/domain/types';

export async function finishModuleReview(moduleId: number, stage: ReviewStage, attempts: moduleReviewUseCase.ModuleReviewAttemptInput[]) {
  const userId = await getCurrentUserId();
  const result = await moduleReviewUseCase.finishModuleReview(userId, moduleId, stage, attempts);
  revalidatePath('/review');
  revalidatePath('/course');
  revalidatePath('/progress');
  revalidatePath('/');
  return result;
}
