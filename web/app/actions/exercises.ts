'use server';

/**
 * UC-09 exercise grading + UC-20/21 harvest (ARCHITECTURE.md §2, §9 stage 3).
 * Thin wrappers: resolve the user, call the use-case, revalidate. No
 * business logic lives here — that's exercise-set.ts / domain/grading/*.
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as exerciseSetUseCase from '@/lib/use-cases/exercise-set';
import type { AttemptContext, GivenAnswer } from '@/lib/domain/types';

export async function gradeAndRecord(exerciseId: number, context: AttemptContext, given: GivenAnswer, timeMs?: number) {
  const userId = await getCurrentUserId();
  const result = await exerciseSetUseCase.gradeAndRecord(userId, exerciseId, context, given, new Date(), timeMs);
  revalidatePath('/');
  revalidatePath('/review');
  revalidatePath('/progress');
  return result;
}

export async function harvestError(attemptId: number) {
  const userId = await getCurrentUserId();
  const result = await exerciseSetUseCase.harvestError(userId, attemptId);
  revalidatePath('/review');
  revalidatePath('/progress');
  return result;
}
