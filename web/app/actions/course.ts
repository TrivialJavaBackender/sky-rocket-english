'use server';

/**
 * UC-03 course switcher + UC-18/19 checkpoints (ARCHITECTURE.md §2, §9
 * stage 3). Checkpoints gate course/block structure, same conceptual area
 * as the switcher, hence sharing this action file per the §2 file list.
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as courseSwitchUseCase from '@/lib/use-cases/course-switch';
import * as checkpointUseCase from '@/lib/use-cases/checkpoint';

export async function switchCourse(courseSlug: string) {
  const userId = await getCurrentUserId();
  const course = await courseSwitchUseCase.switchCourse(userId, courseSlug);
  revalidatePath('/');
  revalidatePath('/course');
  revalidatePath('/progress');
  return course;
}

export async function finishCheckpoint(checkpointId: number, correctCount: number, totalCount: number) {
  const userId = await getCurrentUserId();
  const result = await checkpointUseCase.finishCheckpoint(userId, checkpointId, correctCount, totalCount);
  revalidatePath('/course');
  revalidatePath('/');
  revalidatePath('/progress');
  return result;
}
