/**
 * Writing/speaking tasks + submissions (ARCHITECTURE §1.2 UC-10..12).
 */
import { prisma } from '../db';
import { idToNumber } from '../serialize';
import type { TaskMode } from '../domain/types';
import type { Prisma } from '@prisma/client';

export interface WritingTaskDTO {
  id: number;
  moduleId: number | null;
  checkpointId: number | null;
  mode: TaskMode;
  genre: string;
  promptMd: string;
  modelAnswerMd: string | null;
  checklist: string[];
  /** Target length [min, max]; null when the task sets none (speaking, or a course that declines to). */
  wordTarget: [number, number] | null;
}

function mapTask(t: { id: bigint; module_id: bigint | null; checkpoint_id: bigint | null; mode: string; genre: string; prompt_md: string; model_answer_md: string | null; checklist: Prisma.JsonValue; word_min: number | null; word_max: number | null }): WritingTaskDTO {
  return {
    id: idToNumber(t.id),
    moduleId: t.module_id === null ? null : idToNumber(t.module_id),
    checkpointId: t.checkpoint_id === null ? null : idToNumber(t.checkpoint_id),
    mode: t.mode as TaskMode,
    genre: t.genre,
    promptMd: t.prompt_md,
    modelAnswerMd: t.model_answer_md,
    checklist: Array.isArray(t.checklist) ? (t.checklist as string[]) : [],
    wordTarget: t.word_min !== null && t.word_max !== null ? [t.word_min, t.word_max] : null,
  };
}

export async function getWritingTaskForModule(moduleId: number): Promise<WritingTaskDTO | null> {
  const row = await prisma.writing_task.findFirst({ where: { module_id: moduleId } });
  return row ? mapTask(row) : null;
}

export async function getWritingTaskForCheckpoint(checkpointId: number): Promise<WritingTaskDTO | null> {
  const row = await prisma.writing_task.findFirst({ where: { checkpoint_id: checkpointId } });
  return row ? mapTask(row) : null;
}

export async function getWritingTaskById(id: number): Promise<WritingTaskDTO | null> {
  const row = await prisma.writing_task.findUnique({ where: { id } });
  return row ? mapTask(row) : null;
}

export interface WritingSubmissionDTO {
  id: number;
  userId: number;
  writingTaskId: number;
  bodyMd: string;
  durationMin: number | null;
  selfCheck: Prisma.JsonValue | null;
  attachmentUrl: string | null;
  submittedAt: Date;
}

function mapSubmission(s: { id: bigint; user_id: bigint; writing_task_id: bigint; body_md: string; duration_min: number | null; self_check: Prisma.JsonValue | null; attachment_url: string | null; submitted_at: Date }): WritingSubmissionDTO {
  return {
    id: idToNumber(s.id),
    userId: idToNumber(s.user_id),
    writingTaskId: idToNumber(s.writing_task_id),
    bodyMd: s.body_md,
    durationMin: s.duration_min,
    selfCheck: s.self_check,
    attachmentUrl: s.attachment_url,
    submittedAt: s.submitted_at,
  };
}

export async function createWritingSubmission(input: {
  userId: number;
  writingTaskId: number;
  bodyMd: string;
  durationMin?: number | null;
  attachmentUrl?: string | null;
}): Promise<WritingSubmissionDTO> {
  const row = await prisma.writing_submission.create({
    data: {
      user_id: input.userId,
      writing_task_id: input.writingTaskId,
      body_md: input.bodyMd,
      duration_min: input.durationMin ?? null,
      attachment_url: input.attachmentUrl ?? null,
    },
  });
  return mapSubmission(row);
}

export async function getLatestSubmission(userId: number, writingTaskId: number): Promise<WritingSubmissionDTO | null> {
  const row = await prisma.writing_submission.findFirst({
    where: { user_id: userId, writing_task_id: writingTaskId },
    orderBy: { submitted_at: 'desc' },
  });
  return row ? mapSubmission(row) : null;
}

export async function updateSubmissionSelfCheck(submissionId: number, selfCheck: Record<string, boolean>): Promise<void> {
  await prisma.writing_submission.update({ where: { id: submissionId }, data: { self_check: selfCheck as unknown as Prisma.InputJsonValue } });
}
