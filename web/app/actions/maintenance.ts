'use server';

/** Testing/dev affordance backing the Progress screen's "Danger zone" card — see lib/use-cases/maintenance.ts. */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as maintenanceUseCase from '@/lib/use-cases/maintenance';

export async function resetAllProgress() {
  const userId = await getCurrentUserId();
  await maintenanceUseCase.resetAllProgress(userId);
  revalidatePath('/');
  revalidatePath('/course');
  revalidatePath('/progress');
  revalidatePath('/review');
  revalidatePath('/flashcards');
}
