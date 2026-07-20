/**
 * Lane 1 — flashcards + per-user SRS scheduling state (ARCHITECTURE §1.4
 * UC-15, §1.2 UC-07/UC-09 harvest, §1.6 UC-21 manual). Flashcard creation
 * lives here (not content.repo/exercise.repo) because every creation path
 * (gloss add-to-deck, error harvest, manual) is immediately paired with
 * seeding its `card_state` row — the two are one transaction in practice.
 */
import { prisma } from '../db';
import { idToNumber, decimalToNumber } from '../serialize';
import type { CardPhase, FlashcardSource, NoteType, Rating } from '../domain/types';
import type { Prisma } from '@prisma/client';

export interface FlashcardFieldsDTO {
  front: string;
  main: string;
  cases: string[];
  extra: string;
}

export interface FlashcardDTO {
  id: number;
  moduleId: number | null;
  noteType: NoteType;
  fields: FlashcardFieldsDTO;
  source: FlashcardSource;
  vocabEntryId: number | null;
  archived: boolean;
}

function mapFlashcard(f: { id: bigint; module_id: bigint | null; note_type: string; fields: Prisma.JsonValue; source: string; vocab_entry_id: bigint | null; archived: boolean }): FlashcardDTO {
  const fields = f.fields as unknown as Partial<FlashcardFieldsDTO>;
  return {
    id: idToNumber(f.id),
    moduleId: f.module_id === null ? null : idToNumber(f.module_id),
    noteType: f.note_type as NoteType,
    fields: { front: fields.front ?? '', main: fields.main ?? '', cases: fields.cases ?? [], extra: fields.extra ?? '' },
    source: f.source as FlashcardSource,
    vocabEntryId: f.vocab_entry_id === null ? null : idToNumber(f.vocab_entry_id),
    archived: f.archived,
  };
}

export async function getFlashcardById(id: number): Promise<FlashcardDTO | null> {
  const row = await prisma.flashcard.findUnique({ where: { id } });
  return row ? mapFlashcard(row) : null;
}

export async function listFlashcardsForModule(moduleId: number): Promise<FlashcardDTO[]> {
  const rows = await prisma.flashcard.findMany({ where: { module_id: moduleId, archived: false } });
  return rows.map(mapFlashcard);
}

export async function createFlashcard(input: {
  moduleId?: number | null;
  noteType: NoteType;
  fields: FlashcardFieldsDTO;
  source: FlashcardSource;
  vocabEntryId?: number | null;
  sourceExerciseId?: number | null;
  sourceGlossId?: number | null;
  createdByUserId?: number | null;
}): Promise<FlashcardDTO> {
  const row = await prisma.flashcard.create({
    data: {
      module_id: input.moduleId ?? null,
      note_type: input.noteType,
      fields: input.fields as unknown as Prisma.InputJsonValue,
      source: input.source,
      vocab_entry_id: input.vocabEntryId ?? null,
      source_exercise_id: input.sourceExerciseId ?? null,
      source_gloss_id: input.sourceGlossId ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    },
  });
  return mapFlashcard(row);
}

// ───────────────────────── card_state / card_review_log ─────────────────────────

export interface CardStateDTO {
  userId: number;
  flashcardId: number;
  phase: CardPhase;
  dueAt: Date;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date | null;
}

export interface DueCardDTO extends CardStateDTO {
  flashcard: FlashcardDTO;
}

function mapCardState(row: {
  user_id: bigint;
  flashcard_id: bigint;
  phase: string;
  due_at: Date;
  interval_days: unknown;
  ease: unknown;
  reps: number;
  lapses: number;
  last_reviewed_at: Date | null;
}): CardStateDTO {
  return {
    userId: idToNumber(row.user_id),
    flashcardId: idToNumber(row.flashcard_id),
    phase: row.phase as CardPhase,
    dueAt: row.due_at,
    intervalDays: decimalToNumber(row.interval_days as never) ?? 0,
    ease: decimalToNumber(row.ease as never) ?? 2.5,
    reps: row.reps,
    lapses: row.lapses,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export async function getCardState(userId: number, flashcardId: number): Promise<CardStateDTO | null> {
  const row = await prisma.card_state.findUnique({ where: { user_id_flashcard_id: { user_id: userId, flashcard_id: flashcardId } } });
  return row ? mapCardState(row) : null;
}

export async function listDueCards(userId: number, now: Date, limit = 50): Promise<DueCardDTO[]> {
  const rows = await prisma.card_state.findMany({
    where: { user_id: userId, due_at: { lte: now }, flashcard: { archived: false } },
    include: { flashcard: true },
    orderBy: { due_at: 'asc' },
    take: limit,
  });
  return rows.map((r) => ({ ...mapCardState(r), flashcard: mapFlashcard(r.flashcard) }));
}

export async function countDueCards(userId: number, now: Date): Promise<number> {
  return prisma.card_state.count({ where: { user_id: userId, due_at: { lte: now }, flashcard: { archived: false } } });
}

/** Flashcard ids of `moduleId` that don't yet have a card_state row for this user — the pool `flashcards_intro` (UC-15 note) needs to introduce. */
export async function listUnintroducedFlashcardIds(userId: number, moduleId: number): Promise<number[]> {
  const rows = await prisma.flashcard.findMany({
    where: { module_id: moduleId, archived: false, card_state: { none: { user_id: userId } } },
    select: { id: true },
  });
  return rows.map((r) => idToNumber(r.id));
}

/** Modules whose deck this user has already started — the set `catchUpModuleIntroductions` (UC-15) tops up when a module gains new cards. */
export async function listModuleIdsWithIntroducedCards(userId: number): Promise<number[]> {
  const rows = await prisma.card_state.findMany({
    where: { user_id: userId, flashcard: { module_id: { not: null } } },
    select: { flashcard: { select: { module_id: true } } },
    distinct: ['flashcard_id'],
  });
  const ids = new Set<number>();
  for (const r of rows) {
    if (r.flashcard.module_id !== null) ids.add(idToNumber(r.flashcard.module_id));
  }
  return [...ids];
}

export async function createCardState(userId: number, flashcardId: number, dueAt: Date): Promise<void> {
  await prisma.card_state.upsert({
    where: { user_id_flashcard_id: { user_id: userId, flashcard_id: flashcardId } },
    create: { user_id: userId, flashcard_id: flashcardId, phase: 'new', due_at: dueAt },
    update: {},
  });
}

export async function applyCardReview(
  userId: number,
  flashcardId: number,
  rating: Rating,
  prevPhase: CardPhase,
  next: { phase: CardPhase; dueAt: Date; intervalDays: number; ease: number; reps: number; lapses: number; lastReviewedAt: Date },
): Promise<void> {
  await prisma.$transaction([
    prisma.card_state.upsert({
      where: { user_id_flashcard_id: { user_id: userId, flashcard_id: flashcardId } },
      create: {
        user_id: userId,
        flashcard_id: flashcardId,
        phase: next.phase,
        due_at: next.dueAt,
        interval_days: next.intervalDays,
        ease: next.ease,
        reps: next.reps,
        lapses: next.lapses,
        last_reviewed_at: next.lastReviewedAt,
      },
      update: {
        phase: next.phase,
        due_at: next.dueAt,
        interval_days: next.intervalDays,
        ease: next.ease,
        reps: next.reps,
        lapses: next.lapses,
        last_reviewed_at: next.lastReviewedAt,
      },
    }),
    prisma.card_review_log.create({
      data: { user_id: userId, flashcard_id: flashcardId, rating, prev_phase: prevPhase, new_due_at: next.dueAt },
    }),
  ]);
}

export interface RetentionWindowStats {
  totalFirstTryReviews: number;
  firstTryHits: number;
}

/** 30-day first-try retention for the Progress screen (§1.1 UC-04): every review counts once (card_review_log has one row per grading event; "first-try" here means each logged review, not deduped by card). */
export async function getRetentionStats(userId: number, since: Date): Promise<RetentionWindowStats> {
  const total = await prisma.card_review_log.count({ where: { user_id: userId, reviewed_at: { gte: since } } });
  const hits = await prisma.card_review_log.count({ where: { user_id: userId, reviewed_at: { gte: since }, rating: { gt: 1 } } });
  return { totalFirstTryReviews: total, firstTryHits: hits };
}
