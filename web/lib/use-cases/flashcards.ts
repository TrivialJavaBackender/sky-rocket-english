/**
 * Lane 1 — flashcards (ARCHITECTURE.md §1.4 UC-15, §1.2 UC-07 add-to-deck,
 * §1.6 UC-21 manual/harvest creation, §1.3 `flashcards_intro` step).
 */
import * as srsRepo from '../repositories/srs.repo';
import * as contentRepo from '../repositories/content.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as activityRepo from '../repositories/activity.repo';
import { newCardState, previewIntervals, reviewCard } from '../domain/srs';
import { spreadInitialDueDate } from '../domain/time';
import { metVocabCount } from '../domain/content-slicing';
import { nextVocabStatusOnCardMaturity } from '../domain/progress';
import type { CardPhase, NoteType, Rating } from '../domain/types';
import type { FlashcardFieldsDTO } from '../repositories/srs.repo';

export interface DueCardViewDTO {
  flashcardId: number;
  noteType: NoteType;
  fields: FlashcardFieldsDTO;
  phase: CardPhase;
  /** Course + module the word belongs to — the deck spans courses, and an English-metalanguage German card is otherwise unidentifiable. */
  origin: { courseSlug: string; courseName: string; moduleSlug: string; moduleTitle: string } | null;
  /** Real interval each rating would schedule for this card, computed by the same SM-2 step that grading runs. */
  ratingIntervals: Record<Rating, string>;
}

export interface DueCardsViewDTO {
  cards: DueCardViewDTO[];
  /** Full backlog for the scope, which may exceed `cards.length` — the player says so instead of claiming "queue clear". */
  totalDue: number;
  courseName: string | null;
}

/** One review run: enough to matter, small enough to finish. The rest of the backlog stays scheduled and is reported as `totalDue`. */
const REVIEW_RUN_SIZE = 50;

export async function getDueCards(userId: number, now: Date = new Date(), limit = REVIEW_RUN_SIZE, courseSlug?: string): Promise<DueCardsViewDTO> {
  const [rows, totalDue] = await Promise.all([srsRepo.listDueCards(userId, now, limit, courseSlug), srsRepo.countDueCards(userId, now, courseSlug)]);
  const cards = rows.map((r) => ({
    flashcardId: r.flashcardId,
    noteType: r.flashcard.noteType,
    fields: r.flashcard.fields,
    phase: r.phase,
    origin: r.origin,
    ratingIntervals: previewIntervals({ phase: r.phase, intervalDays: r.intervalDays, ease: r.ease, reps: r.reps, lapses: r.lapses }, now),
  }));
  return { cards, totalDue, courseName: courseSlug ? (rows[0]?.origin?.courseName ?? null) : null };
}

export async function countDueCards(userId: number, now: Date = new Date(), courseSlug?: string): Promise<number> {
  return srsRepo.countDueCards(userId, now, courseSlug);
}

/**
 * Cards of `moduleId` join the deck as `phase='new'`, due dates round-robined
 * across the next 7 days (§6.4 spreadInitialDueDate) so a module doesn't dump
 * its whole deck into day 1's queue.
 *
 * Only words the learner has already met in a `vocab` step are eligible. The
 * step matrix doses 45 lexemes as 15/15/15 across Prime and Input, but
 * `flashcards_intro` sits in Prime and used to introduce all of them at once —
 * two thirds of the deck were words never seen, arriving in daily review days
 * before their session. Deriving the ceiling from step state (rather than
 * writing it down at intro time) makes this idempotent and self-healing: it is
 * safe to call on every visit, and each later `vocab` step widens the ceiling
 * on its own.
 */
export async function introduceModuleFlashcards(userId: number, moduleId: number, now: Date = new Date()): Promise<{ introduced: number }> {
  const [steps, vocabTotal] = await Promise.all([moduleRepo.listStepsForModule(userId, moduleId), contentRepo.countVocabForModule(moduleId)]);
  const met = metVocabCount(steps, vocabTotal);

  const ids = await srsRepo.listUnintroducedFlashcardIds(userId, moduleId, met);
  for (const [i, flashcardId] of ids.entries()) {
    await srsRepo.createCardState(userId, flashcardId, spreadInitialDueDate(i, now));
  }
  return { introduced: ids.length };
}

/**
 * Tops up the deck of every module whose eligible pool may have grown.
 *
 * Two things widen that pool after the `flashcards_intro` step: finishing a
 * later `vocab` step (batch 2 or 3 of the module's lexemes becomes eligible —
 * this is the mechanism batch dosing rides on) and the module gaining cards
 * outright, as in 0005 when every vocab entry got a `vocab_reverse` side.
 * Without this pass, either kind would sit in `flashcard` forever with no
 * `card_state`.
 *
 * Cheap when there is nothing to do — one indexed query per started module,
 * and `listUnintroducedFlashcardIds` returns empty once a deck is complete.
 */
export async function catchUpModuleIntroductions(userId: number, now: Date = new Date()): Promise<{ introduced: number }> {
  const moduleIds = await srsRepo.listModuleIdsNeedingIntroCatchUp(userId);
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
