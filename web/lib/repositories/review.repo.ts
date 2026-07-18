/**
 * Lane 2 (review_queue_item, +2/+7/+21) and Lane 3 (module_review, r7/r21)
 * repositories (ARCHITECTURE §1.4 UC-16/17, §6.2/§6.3).
 *
 * review_queue_open_uniq is a *partial* unique index (`where resolved_at is
 * null`) — Prisma introspection doesn't expose partial indexes as @@unique
 * (see web/prisma/schema.prisma comment + ARCHITECTURE §2 note), so "one
 * open item per (user, exercise)" is enforced here as find-then-write
 * instead of a typed `upsert()`. Single-user traffic makes the race window
 * a non-issue in practice.
 */
import { prisma } from '../db';
import { idToNumber, decimalToNumber } from '../serialize';
import type { ReviewStage } from '../domain/types';

export interface ReviewQueueItemDTO {
  id: number;
  userId: number;
  exerciseId: number;
  stage: 1 | 2 | 3;
  dueAt: Date;
  resolvedAt: Date | null;
  moduleId: number | null;
  moduleTitle: string | null;
  moduleSlug: string | null;
}

function mapReviewQueueItem(row: {
  id: bigint;
  user_id: bigint;
  exercise_id: bigint;
  stage: number;
  due_at: Date;
  resolved_at: Date | null;
  exercise: { module_id: bigint | null; module: { id: bigint; title: string; slug: string } | null };
}): ReviewQueueItemDTO {
  return {
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    exerciseId: idToNumber(row.exercise_id),
    stage: row.stage as 1 | 2 | 3,
    dueAt: row.due_at,
    resolvedAt: row.resolved_at,
    moduleId: row.exercise.module?.id != null ? idToNumber(row.exercise.module.id) : null,
    moduleTitle: row.exercise.module?.title ?? null,
    moduleSlug: row.exercise.module?.slug ?? null,
  };
}

export async function findOpenReviewQueueItem(userId: number, exerciseId: number): Promise<{ id: number; stage: 1 | 2 | 3 } | null> {
  const row = await prisma.review_queue_item.findFirst({
    where: { user_id: userId, exercise_id: exerciseId, resolved_at: null },
  });
  return row ? { id: idToNumber(row.id), stage: row.stage as 1 | 2 | 3 } : null;
}

/** Opens a new stage-1 item, or is a no-op if one is already open for this (user, exercise) — enforces review_queue_open_uniq at the application level. */
export async function openReviewQueueItem(userId: number, exerciseId: number, dueAt: Date, sourceAttemptId: number): Promise<void> {
  const existing = await findOpenReviewQueueItem(userId, exerciseId);
  if (existing) return;
  await prisma.review_queue_item.create({
    data: { user_id: userId, exercise_id: exerciseId, stage: 1, due_at: dueAt, source_attempt_id: sourceAttemptId },
  });
}

/** Applies a review_slot outcome: advance stage/due, or close (resolved_at) when domain.advanceReviewQueueItem says so. */
export async function applyReviewQueueTransition(
  itemId: number,
  transition: { stage: 1 | 2 | 3; dueAt: Date; resolved: boolean },
  resolvedAttemptId: number,
): Promise<void> {
  await prisma.review_queue_item.update({
    where: { id: itemId },
    data: {
      stage: transition.stage,
      due_at: transition.dueAt,
      resolved_attempt_id: resolvedAttemptId,
      resolved_at: transition.resolved ? new Date() : null,
    },
  });
}

export async function listDueReviewQueueItems(userId: number, now: Date, limit = 10): Promise<ReviewQueueItemDTO[]> {
  const rows = await prisma.review_queue_item.findMany({
    where: { user_id: userId, resolved_at: null, due_at: { lte: now } },
    include: { exercise: { include: { module: true } } },
    orderBy: { due_at: 'asc' },
    take: limit,
  });
  return rows.map(mapReviewQueueItem);
}

export async function countDueReviewQueueItems(userId: number, now: Date): Promise<number> {
  return prisma.review_queue_item.count({ where: { user_id: userId, resolved_at: null, due_at: { lte: now } } });
}

// ───────────────────────── module_review (Lane 3) ─────────────────────────

export interface ModuleReviewDTO {
  id: number;
  userId: number;
  moduleId: number;
  moduleTitle: string;
  moduleSlug: string;
  stage: ReviewStage;
  dueAt: Date;
  takenAt: Date | null;
  score: number | null;
  passed: boolean | null;
}

function mapModuleReview(row: {
  id: bigint;
  user_id: bigint;
  module_id: bigint;
  stage: string;
  due_at: Date;
  taken_at: Date | null;
  score: unknown;
  passed: boolean | null;
  module: { title: string; slug: string };
}): ModuleReviewDTO {
  return {
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    moduleId: idToNumber(row.module_id),
    moduleTitle: row.module.title,
    moduleSlug: row.module.slug,
    stage: row.stage as ReviewStage,
    dueAt: row.due_at,
    takenAt: row.taken_at,
    score: decimalToNumber(row.score as never),
    passed: row.passed,
  };
}

/** UC-14 module close: creates both r7 and r21 rows (idempotent — re-closing a module via re-take doesn't duplicate, per @@unique(user_id, module_id, stage)). */
export async function scheduleModuleReviews(userId: number, moduleId: number, rows: Array<{ stage: ReviewStage; dueAt: Date }>): Promise<void> {
  for (const r of rows) {
    await prisma.module_review.upsert({
      where: { user_id_module_id_stage: { user_id: userId, module_id: moduleId, stage: r.stage } },
      create: { user_id: userId, module_id: moduleId, stage: r.stage, due_at: r.dueAt },
      update: { due_at: r.dueAt, taken_at: null, score: null, passed: null },
    });
  }
}

export async function getModuleReviews(userId: number, moduleId: number): Promise<ModuleReviewDTO[]> {
  const rows = await prisma.module_review.findMany({ where: { user_id: userId, module_id: moduleId }, include: { module: true } });
  return rows.map(mapModuleReview);
}

export async function listDueModuleReviews(userId: number, now: Date): Promise<ModuleReviewDTO[]> {
  const rows = await prisma.module_review.findMany({
    where: { user_id: userId, taken_at: null, due_at: { lte: now } },
    include: { module: true },
    orderBy: { due_at: 'asc' },
  });
  return rows.map(mapModuleReview);
}

export async function listUpcomingModuleReviews(userId: number, limit = 10): Promise<ModuleReviewDTO[]> {
  const rows = await prisma.module_review.findMany({
    where: { user_id: userId, taken_at: null },
    include: { module: true },
    orderBy: { due_at: 'asc' },
    take: limit,
  });
  return rows.map(mapModuleReview);
}

export async function recordModuleReviewResult(userId: number, moduleId: number, stage: ReviewStage, score: number, passed: boolean): Promise<void> {
  await prisma.module_review.update({
    where: { user_id_module_id_stage: { user_id: userId, module_id: moduleId, stage } },
    data: { taken_at: new Date(), score, passed },
  });
}
