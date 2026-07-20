/**
 * Lane 1 — flashcards (ARCHITECTURE.md §1.4 UC-15, §1.2 UC-07 add-to-deck,
 * §1.6 UC-21 manual/harvest creation, §1.3 `flashcards_intro` step).
 */
import * as srsRepo from '../repositories/srs.repo';
import * as contentRepo from '../repositories/content.repo';
import * as activityRepo from '../repositories/activity.repo';
import { newCardState, reviewCard } from '../domain/srs';
import { spreadInitialDueDate } from '../domain/time';
import { nextVocabStatusOnCardMaturity } from '../domain/progress';
import type { CardPhase, NoteType, Rating } from '../domain/types';
import type { FlashcardFieldsDTO } from '../repositories/srs.repo';

export interface DueCardViewDTO {
  flashcardId: number;
  noteType: NoteType;
  fields: FlashcardFieldsDTO;
  phase: CardPhase;
}

export async function getDueCards(userId: number, now: Date = new Date(), limit = 50): Promise<DueCardViewDTO[]> {
  const rows = await srsRepo.listDueCards(userId, now, limit);
  return rows.map((r) => ({ flashcardId: r.flashcardId, noteType: r.flashcard.noteType, fields: r.flashcard.fields, phase: r.phase }));
}

export async function countDueCards(userId: number, now: Date = new Date()): Promise<number> {
  return srsRepo.countDueCards(userId, now);
}

/**
 * `flashcards_intro` step (Prime session, §1.3): every not-yet-introduced
 * flashcard of the module joins the deck as `phase='new'`, due dates
 * round-robined across the next 7 days (§6.4 spreadInitialDueDate) so a
 * ~60-card module doesn't dump the whole deck into day 1's queue.
 */
export async function introduceModuleFlashcards(userId: number, moduleId: number, now: Date = new Date()): Promise<{ introduced: number }> {
  const ids = await srsRepo.listUnintroducedFlashcardIds(userId, moduleId);
  for (const [i, flashcardId] of ids.entries()) {
    await srsRepo.createCardState(userId, flashcardId, spreadInitialDueDate(i, now));
  }
  return { introduced: ids.length };
}

/**
 * Tops up the deck of every module the learner has already introduced.
 *
 * `introduceModuleFlashcards` runs once per module, from the `flashcards_intro`
 * step of its Prime session, so cards added to a module afterwards would never
 * reach the deck. That went from theoretical to real in 0005, when every vocab
 * entry gained a `vocab_reverse` card: without this, the reverse side of an
 * already-studied module would sit in `flashcard` forever with no `card_state`.
 * Editing a shipped module's vocab has the same shape, so this stays useful
 * beyond the migration.
 *
 * Cheap when there is nothing to do — one indexed query per started module,
 * and `listUnintroducedFlashcardIds` returns empty once a deck is complete.
 */
export async function catchUpModuleIntroductions(userId: number, now: Date = new Date()): Promise<{ introduced: number }> {
  const moduleIds = await srsRepo.listModuleIdsWithIntroducedCards(userId);
  let introduced = 0;
  for (const moduleId of moduleIds) {
    const result = await introduceModuleFlashcards(userId, moduleId, now);
    introduced += result.introduced;
  }
  return { introduced };
}

export interface ReviewFlashcardResult {
  nextPhase: CardPhase;
  nextDueAt: Date;
}

/** UC-15: grade one flashcard (Again/Hard/Good/Easy) — updates card_state (SM-2, §6.4), logs card_review_log, bumps daily_activity, and promotes the linked vocab entry to Known once the card matures. */
export async function reviewFlashcard(userId: number, flashcardId: number, rating: Rating, now: Date = new Date()): Promise<ReviewFlashcardResult> {
  const current = (await srsRepo.getCardState(userId, flashcardId)) ?? { userId, flashcardId, ...newCardState(), dueAt: now, lastReviewedAt: null };
  const next = reviewCard({ phase: current.phase, intervalDays: current.intervalDays, ease: current.ease, reps: current.reps, lapses: current.lapses }, rating, now);

  await srsRepo.applyCardReview(userId, flashcardId, rating, current.phase, next);
  await activityRepo.bumpDailyActivity(userId, { cardsReviewed: 1 }, now);

  const flashcard = await srsRepo.getFlashcardById(flashcardId);
  if (flashcard?.vocabEntryId) {
    const currentStatus = await contentRepo.getUserVocabState(userId, flashcard.vocabEntryId);
    const nextStatus = nextVocabStatusOnCardMaturity(currentStatus, next.intervalDays);
    if (nextStatus !== currentStatus) {
      await contentRepo.upsertUserVocabState(userId, flashcard.vocabEntryId, nextStatus);
    }
  }

  return { nextPhase: next.phase, nextDueAt: next.dueAt };
}

/** UC-07: "Add to deck" on a reading gloss — creates a vocab-note flashcard from the gloss's term/definition/example. */
export async function addGlossToDeck(userId: number, glossId: number, moduleId: number, now: Date = new Date()): Promise<{ flashcardId: number }> {
  const gloss = await contentRepo.getGlossById(glossId);
  if (!gloss) throw new Error(`Gloss not found: ${glossId}`);

  const fields: FlashcardFieldsDTO = {
    front: gloss.term,
    main: gloss.definition,
    cases: gloss.example ? [gloss.example] : [],
    extra: gloss.posLabel ?? '',
  };
  const flashcard = await srsRepo.createFlashcard({
    moduleId,
    noteType: 'vocab',
    fields,
    source: 'gloss',
    sourceGlossId: gloss.id,
    createdByUserId: userId,
  });
  await srsRepo.createCardState(userId, flashcard.id, now);
  return { flashcardId: flashcard.id };
}

/** UC-21: manual flashcard, not tied to any content package row. */
export async function createManualFlashcard(
  userId: number,
  input: { moduleId?: number | null; noteType: NoteType; fields: FlashcardFieldsDTO },
  now: Date = new Date(),
): Promise<{ flashcardId: number }> {
  const flashcard = await srsRepo.createFlashcard({
    moduleId: input.moduleId ?? null,
    noteType: input.noteType,
    fields: input.fields,
    source: 'manual',
    createdByUserId: userId,
  });
  await srsRepo.createCardState(userId, flashcard.id, now);
  return { flashcardId: flashcard.id };
}
