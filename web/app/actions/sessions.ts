'use server';

/**
 * UC-13 session runner + UC-14 module close + UC-08 vocab priority
 * (ARCHITECTURE.md §2, §9 stage 3).
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as sessionUseCase from '@/lib/use-cases/session';
import * as unitUseCase from '@/lib/use-cases/unit';

export async function advanceStep(stepId: number) {
  const userId = await getCurrentUserId();
  const result = await sessionUseCase.advanceStep(userId, stepId);
  revalidatePath('/');
  return result;
}

/** UC-14: module_quiz finished with `quizScore` (0-100, computed by the caller from graded attempts). `stepId`, if given, is also marked done in the same call — the module_quiz step and module closure are always paired in the UI. */
export async function closeModule(moduleId: number, quizScore: number, stepId?: number) {
  const userId = await getCurrentUserId();
  await sessionUseCase.closeModule(userId, moduleId, quizScore);
  if (stepId) await sessionUseCase.advanceStep(userId, stepId);
  revalidatePath('/course');
  revalidatePath('/');
  revalidatePath('/progress');
}

/** UC-08 (D6): mark a vocab entry as priority in the Vocabulary studio step. */
export async function markVocabPriority(vocabEntryId: number) {
  const userId = await getCurrentUserId();
  await unitUseCase.markVocabPriority(userId, vocabEntryId);
  revalidatePath('/');
}
