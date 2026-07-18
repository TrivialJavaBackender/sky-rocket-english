/**
 * Exercises (all 8 types), attempts, and the error map (ARCHITECTURE §5,
 * §1.2 UC-09, §1.6 UC-20). `content`/`given_answer` are returned as-is
 * (`Prisma.JsonValue`) — the domain grading layer validates/narrows shapes.
 */
import { prisma } from '../db';
import { idToNumber } from '../serialize';
import type { AttemptContext, ErrorSource, ExerciseGroup, ExercisePool, ExerciseTypeCode } from '../domain/types';
import type { Prisma } from '@prisma/client';

export interface ExerciseDTO {
  id: number;
  moduleId: number | null;
  checkpointId: number | null;
  typeCode: ExerciseTypeCode;
  pool: ExercisePool;
  groupKey: ExerciseGroup | null;
  grammarPointId: number | null;
  readingTextId: number | null;
  content: Prisma.JsonValue;
  explanation: string;
  position: number;
}

function mapExercise(e: {
  id: bigint;
  module_id: bigint | null;
  checkpoint_id: bigint | null;
  type_code: string;
  pool: string;
  group_key: string | null;
  grammar_point_id: bigint | null;
  reading_text_id: bigint | null;
  content: Prisma.JsonValue;
  explanation: string;
  position: number;
}): ExerciseDTO {
  return {
    id: idToNumber(e.id),
    moduleId: e.module_id === null ? null : idToNumber(e.module_id),
    checkpointId: e.checkpoint_id === null ? null : idToNumber(e.checkpoint_id),
    typeCode: e.type_code as ExerciseTypeCode,
    pool: e.pool as ExercisePool,
    groupKey: e.group_key as ExerciseGroup | null,
    grammarPointId: e.grammar_point_id === null ? null : idToNumber(e.grammar_point_id),
    readingTextId: e.reading_text_id === null ? null : idToNumber(e.reading_text_id),
    content: e.content,
    explanation: e.explanation,
    position: e.position,
  };
}

/** type_code → human label (e.g. 'grammar_drill' → 'Grammar drill'), from the exercise_type reference seed (0001). Used to build launcher detail strings ("Grammar drill · error correction · key-word transformation — 3 items"). */
export async function getExerciseTypeLabels(): Promise<Map<ExerciseTypeCode, string>> {
  const rows = await prisma.exercise_type.findMany();
  return new Map(rows.map((r) => [r.code as ExerciseTypeCode, r.label]));
}

export async function getExerciseById(id: number): Promise<ExerciseDTO | null> {
  const row = await prisma.exercise.findUnique({ where: { id } });
  return row ? mapExercise(row) : null;
}

export interface ExercisePickFilter {
  pool?: ExercisePool;
  types?: ExerciseTypeCode[];
  groupKey?: ExerciseGroup;
  limit?: number;
}

/** UC-09 exercise-set gathering: filters by pool/types/group_key — mirrors session_step.config `{"types":[...]}` / `{"group_key":"vocab"}` / `{"count":10,"pool":"review"}` (§1.2, §2 session_step). */
export async function listExercisesForModule(moduleId: number, filter: ExercisePickFilter = {}): Promise<ExerciseDTO[]> {
  const rows = await prisma.exercise.findMany({
    where: {
      module_id: moduleId,
      ...(filter.pool ? { pool: filter.pool } : {}),
      ...(filter.types ? { type_code: { in: filter.types } } : {}),
      ...(filter.groupKey ? { group_key: filter.groupKey } : {}),
    },
    orderBy: { position: 'asc' },
    ...(filter.limit ? { take: filter.limit } : {}),
  });
  return rows.map(mapExercise);
}

export async function listExercisesForCheckpoint(checkpointId: number, filter: ExercisePickFilter = {}): Promise<ExerciseDTO[]> {
  const rows = await prisma.exercise.findMany({
    where: {
      checkpoint_id: checkpointId,
      ...(filter.pool ? { pool: filter.pool } : {}),
      ...(filter.types ? { type_code: { in: filter.types } } : {}),
    },
    orderBy: { position: 'asc' },
    ...(filter.limit ? { take: filter.limit } : {}),
  });
  return rows.map(mapExercise);
}

export interface ExerciseAttemptDTO {
  id: number;
  userId: number;
  exerciseId: number;
  context: AttemptContext;
  givenAnswer: Prisma.JsonValue | null;
  isCorrect: boolean;
  timeMs: number | null;
  answeredAt: Date;
}

export async function createExerciseAttempt(
  userId: number,
  exerciseId: number,
  context: AttemptContext,
  givenAnswer: unknown,
  isCorrect: boolean,
  timeMs?: number | null,
): Promise<ExerciseAttemptDTO> {
  const row = await prisma.exercise_attempt.create({
    data: {
      user_id: userId,
      exercise_id: exerciseId,
      context,
      given_answer: givenAnswer as Prisma.InputJsonValue,
      is_correct: isCorrect,
      time_ms: timeMs ?? null,
    },
  });
  return {
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    exerciseId: idToNumber(row.exercise_id),
    context: row.context as AttemptContext,
    givenAnswer: row.given_answer,
    isCorrect: row.is_correct,
    timeMs: row.time_ms,
    answeredAt: row.answered_at,
  };
}

export async function countAttemptsInWindow(userId: number, since: Date): Promise<number> {
  return prisma.exercise_attempt.count({ where: { user_id: userId, answered_at: { gte: since } } });
}

export async function getExerciseAttemptById(id: number): Promise<ExerciseAttemptDTO | null> {
  const row = await prisma.exercise_attempt.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    exerciseId: idToNumber(row.exercise_id),
    context: row.context as AttemptContext,
    givenAnswer: row.given_answer,
    isCorrect: row.is_correct,
    timeMs: row.time_ms,
    answeredAt: row.answered_at,
  };
}

// ───────────────────────── error map (UC-20, harvest from UC-09/UC-10) ─────────────────────────

export interface ErrorMapEntryDTO {
  id: number;
  userId: number;
  moduleId: number | null;
  source: ErrorSource;
  sourceAttemptId: number | null;
  sourceSubmissionId: number | null;
  errorText: string;
  ruleNote: string | null;
  flashcardId: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export async function createErrorMapEntry(input: {
  userId: number;
  moduleId?: number | null;
  source: ErrorSource;
  sourceAttemptId?: number | null;
  sourceSubmissionId?: number | null;
  errorText: string;
  ruleNote?: string | null;
  flashcardId?: number | null;
}): Promise<ErrorMapEntryDTO> {
  const row = await prisma.error_map_entry.create({
    data: {
      user_id: input.userId,
      module_id: input.moduleId ?? null,
      source: input.source,
      source_attempt_id: input.sourceAttemptId ?? null,
      source_submission_id: input.sourceSubmissionId ?? null,
      error_text: input.errorText,
      rule_note: input.ruleNote ?? null,
      flashcard_id: input.flashcardId ?? null,
    },
  });
  return {
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    moduleId: row.module_id === null ? null : idToNumber(row.module_id),
    source: row.source as ErrorSource,
    sourceAttemptId: row.source_attempt_id === null ? null : idToNumber(row.source_attempt_id),
    sourceSubmissionId: row.source_submission_id === null ? null : idToNumber(row.source_submission_id),
    errorText: row.error_text,
    ruleNote: row.rule_note,
    flashcardId: row.flashcard_id === null ? null : idToNumber(row.flashcard_id),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listErrorMapEntries(userId: number, limit = 50): Promise<ErrorMapEntryDTO[]> {
  const rows = await prisma.error_map_entry.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: limit });
  return rows.map((row) => ({
    id: idToNumber(row.id),
    userId: idToNumber(row.user_id),
    moduleId: row.module_id === null ? null : idToNumber(row.module_id),
    source: row.source as ErrorSource,
    sourceAttemptId: row.source_attempt_id === null ? null : idToNumber(row.source_attempt_id),
    sourceSubmissionId: row.source_submission_id === null ? null : idToNumber(row.source_submission_id),
    errorText: row.error_text,
    ruleNote: row.rule_note,
    flashcardId: row.flashcard_id === null ? null : idToNumber(row.flashcard_id),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}
