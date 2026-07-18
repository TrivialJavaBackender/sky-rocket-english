'use server';

/**
 * Lane 1 mutations — UC-15 grading, UC-07 add-to-deck, UC-21 manual card,
 * `flashcards_intro` step (ARCHITECTURE.md §2, §9 stage 3).
 */
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import * as flashcardsUseCase from '@/lib/use-cases/flashcards';
import * as sessionUseCase from '@/lib/use-cases/session';
import type { NoteType, Rating } from '@/lib/domain/types';
import type { FlashcardFieldsDTO } from '@/lib/repositories/srs.repo';

export async function reviewFlashcard(flashcardId: number, rating: Rating) {
  const userId = await getCurrentUserId();
  const result = await flashcardsUseCase.reviewFlashcard(userId, flashcardId, rating);
  revalidatePath('/');
  revalidatePath('/review');
  revalidatePath('/progress');
  return result;
}

export async function addGlossToDeck(glossId: number, moduleId: number) {
  const userId = await getCurrentUserId();
  const result = await flashcardsUseCase.addGlossToDeck(userId, glossId, moduleId);
  revalidatePath('/flashcards');
  return result;
}

export async function createManualFlashcard(moduleId: number | null, noteType: NoteType, fields: FlashcardFieldsDTO) {
  const userId = await getCurrentUserId();
  const result = await flashcardsUseCase.createManualFlashcard(userId, { moduleId, noteType, fields });
  revalidatePath('/flashcards');
  return result;
}

/** The `flashcards_intro` session step: introduce the module's deck, then mark the step done. */
export async function completeFlashcardsIntro(moduleId: number, stepId: number) {
  const userId = await getCurrentUserId();
  const result = await flashcardsUseCase.introduceModuleFlashcards(userId, moduleId);
  await sessionUseCase.advanceStep(userId, stepId);
  revalidatePath('/');
  revalidatePath('/flashcards');
  return result;
}
