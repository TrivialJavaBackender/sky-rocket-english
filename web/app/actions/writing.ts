'use server';

/**
 * UC-10 Writing production, UC-11 Speaking production, UC-12 Self-check
 * (ARCHITECTURE.md §2, §9 stage 3).
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as writingUseCase from '@/lib/use-cases/writing';
import * as sessionUseCase from '@/lib/use-cases/session';

/** `stepId`, if given, marks the `production` step done in the same call. */
export async function submitWriting(writingTaskId: number, bodyMd: string, durationMin?: number, attachmentUrl?: string, stepId?: number) {
  const userId = await getCurrentUserId();
  const submission = await writingUseCase.submitWriting(userId, writingTaskId, bodyMd, durationMin ?? null, attachmentUrl ?? null);
  if (stepId) await sessionUseCase.advanceStep(userId, stepId);
  revalidatePath('/');
  revalidatePath('/progress');
  return submission;
}

/** `stepId`, if given, marks the `self_check` step done in the same call. */
export async function submitSelfCheck(submissionId: number, checklistTicks: Record<string, boolean>, stepId?: number) {
  const userId = await getCurrentUserId();
  await writingUseCase.submitSelfCheck(submissionId, checklistTicks);
  if (stepId) await sessionUseCase.advanceStep(userId, stepId);
  revalidatePath('/');
}
