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
  /** Where the card comes from — the player labels every card with it, so a mixed-language deck is readable (§7.2). */
  origin: { courseSlug: string; courseName: string; moduleSlug: string; moduleTitle: string } | null;
}

/** module → block → course, the join every course-scoped card query needs. */
const CARD_ORIGIN_INCLUDE = {
  module: { include: { block: { include: { course: true } } } },
} as const;

function mapOrigin(f: { module: { slug: string; title: string; block: { course: { slug: string; name: string } } } | null }): DueCardDTO['origin'] {
  if (!f.module) return null;
  return { courseSlug: f.module.block.course.slug, courseName: f.module.block.course.name, moduleSlug: f.module.slug, moduleTitle: f.module.title };
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

/** Scopes a due-card query to one course (its modules' cards only) — lane 1 is now per-course, never a mixed-language pile. */
function dueCardWhere(userId: number, now: Date, courseSlug?: string) {
  return {
    user_id: userId,
    due_at: { lte: now },
    flashcard: { archived: false, ...(courseSlug ? { module: { block: { course: { slug: courseSlug } } } } : {}) },
  };
}

/**
 * Due cards, oldest first. Day-granularity due dates mean a whole day's cards
 * share one `due_at`, so ordering by it alone left the intra-day order up to
 * the planner — which is what interleaved the German and English decks. The
 * module/card tiebreakers make a run reproducible and keep one module's words
 * together.
 */
export async function listDueCards(userId: number, now: Date, limit = 50, courseSlug?: string): Promise<DueCardDTO[]> {
  const rows = await prisma.card_state.findMany({
    where: dueCardWhere(userId, now, courseSlug),
    include: { flashcard: { include: CARD_ORIGIN_INCLUDE } },
    orderBy: [{ due_at: 'asc' }, { flashcard: { module_id: 'asc' } }, { flashcard_id: 'asc' }],
    take: limit,
  });
  return rows.map((r) => ({ ...mapCardState(r), flashcard: mapFlashcard(r.flashcard), origin: mapOrigin(r.flashcard) }));
}

export async function countDueCards(userId: number, now: Date, courseSlug?: string): Promise<number> {
  return prisma.card_state.count({ where: dueCardWhere(userId, now, courseSlug) });
}

export interface DueCardCourseBreakdownDTO {
  courseSlug: string;
  courseName: string;
  levelLabel: string;
  cardsDue: number;
  byNoteType: Record<NoteType, number>;
}

/**
 * Due-card counts grouped by course — the review hub renders one lane-1 row
 * per course. Counted with a grouped aggregate rather than by paging rows, so
 * the number is the true backlog and not capped by whatever page size the
 * caller happens to use.
 */
export async function countDueCardsByCourse(userId: number, now: Date): Promise<DueCardCourseBreakdownDTO[]> {
  const rows = await prisma.card_state.findMany({
    where: dueCardWhere(userId, now),
    select: { flashcard: { select: { note_type: true, module: { select: { block: { select: { course: { select: { slug: true, name: true, level_label: true, position: true } } } } } } } } },
  });

  const byCourse = new Map<string, DueCardCourseBreakdownDTO & { position: number }>();
  for (const row of rows) {
    const course = row.flashcard.module?.block.course;
    if (!course) continue;
    let entry = byCourse.get(course.slug);
    if (!entry) {
      entry = { courseSlug: course.slug, courseName: course.name, levelLabel: course.level_label, cardsDue: 0, byNoteType: { vocab: 0, vocab_reverse: 0 }, position: course.position };
      byCourse.set(course.slug, entry);
    }
    entry.cardsDue += 1;
    const noteType = row.flashcard.note_type as NoteType;
    entry.byNoteType[noteType] = (entry.byNoteType[noteType] ?? 0) + 1;
  }
  return [...byCourse.values()].sort((a, b) => a.position - b.position).map(({ position: _position, ...rest }) => rest);
}

/**
 * Flashcard ids of `moduleId` that don't yet have a card_state row for this
 * user and whose word the learner has already met — the pool
 * `flashcards_intro` (UC-15 note) may introduce.
 *
 * `metVocabCount` is the 1-based ceiling on `vocab_entry.position` (see
 * `metVocabCount` in domain/content-slicing.ts): pass 0 and nothing lexical is
 * eligible. Cards with no vocab entry (a gloss added to the deck, a manual or
 * harvested card) are never gated — they exist only because the learner asked
 * for them.
 *
 * Ordered by word then direction so `spreadInitialDueDate`'s round-robin is
 * reproducible and lands the two directions of one word on different days,
 * instead of asking the same word twice in a row.
 */
export async function listUnintroducedFlashcardIds(userId: number, moduleId: number, metVocabCount: number): Promise<number[]> {
  const rows = await prisma.flashcard.findMany({
    where: {
      module_id: moduleId,
      archived: false,
      card_state: { none: { user_id: userId } },
      OR: [{ vocab_entry_id: null }, { vocab_entry: { position: { lte: metVocabCount } } }],
    },
    select: { id: true },
    orderBy: [{ vocab_entry: { position: 'asc' } }, { note_type: 'asc' }, { id: 'asc' }],
  });
  return rows.map((r) => idToNumber(r.id));
}

/**
 * Modules `catchUpModuleIntroductions` (UC-15) has to re-examine: any module
 * with a completed `vocab` step (its batch may still be waiting to enter the
 * deck) plus any module whose deck was already started (it may have gained
 * cards since — the reverse side of every word, after 0005).
 *
 * The first half is what makes batch dosing self-healing: finishing
 * "Vocabulary 2 of 3" is enough for that batch to reach the deck on the next
 * visit to `/review` or `/flashcards`, with no per-step write of its own.
 */
export async function listModuleIdsNeedingIntroCatchUp(userId: number): Promise<number[]> {
  const [vocabSteps, startedDecks] = await Promise.all([
    prisma.session_step.findMany({
      where: { kind: 'vocab', user_step_state: { some: { user_id: userId, status: 'done' } } },
      select: { study_session: { select: { module_id: true } } },
    }),
    prisma.flashcard.findMany({
      where: { module_id: { not: null }, card_state: { some: { user_id: userId } } },
      select: { module_id: true },
      distinct: ['module_id'],
    }),
  ]);

  const ids = new Set<number>();
  for (const s of vocabSteps) ids.add(idToNumber(s.study_session.module_id));
  for (const f of startedDecks) {
    if (f.module_id !== null) ids.add(idToNumber(f.module_id));
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
