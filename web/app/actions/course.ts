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
  // 'layout' scope, not the default 'page': the course label and the switcher
  // itself live in app/(app)/layout.tsx, so a page-only revalidation would leave
  // the nav still naming the course the learner just left.
  revalidatePath('/', 'layout');
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
