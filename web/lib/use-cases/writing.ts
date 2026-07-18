/**
 * UC-10 · Writing production, UC-11 · Speaking production, UC-12 ·
 * Self-check (ARCHITECTURE.md §1.2). D8 (audio storage) is out of scope for
 * this stage — `attachmentUrl` is accepted as an opaque string/null and
 * passed straight through; the upload flow itself belongs to stage 4/a
 * follow-up task.
 */
import * as writingRepo from '../repositories/writing.repo';
import * as contentRepo from '../repositories/content.repo';
import { nextVocabStatusOnUsageInWriting } from '../domain/progress';
import { normalize } from '../domain/grading/normalize';
import type { WritingTaskDTO, WritingSubmissionDTO } from '../repositories/writing.repo';

export async function getWritingTaskForModule(moduleId: number): Promise<WritingTaskDTO | null> {
  return writingRepo.getWritingTaskForModule(moduleId);
}

export interface SelfCheckViewDTO {
  task: WritingTaskDTO;
  latestSubmission: WritingSubmissionDTO | null;
}

export async function getSelfCheckView(userId: number, writingTaskId: number): Promise<SelfCheckViewDTO | null> {
  const task = await writingRepo.getWritingTaskById(writingTaskId);
  if (!task) return null;
  const latestSubmission = await writingRepo.getLatestSubmission(userId, writingTaskId);
  return { task, latestSubmission };
}

/**
 * UC-23 (best-effort heuristic, no NLP): a vocab term found as a
 * case-insensitive substring of the learner's own submission text is
 * treated as "used in production" and promoted to `in_use`. Cheap and
 * occasionally over-eager (matches inside unrelated words), but a
 * reasonable MVP signal — a human self-check pass (UC-12) is the real
 * quality gate, this just drives the ladder badge.
 */
async function promoteUsedVocab(userId: number, writingTaskId: number, bodyMd: string, submissionId: number): Promise<void> {
  const entries = await contentRepo.listVocabForModuleOfWritingTask(userId, writingTaskId);
  const normalizedBody = normalize(bodyMd);
  for (const entry of entries) {
    if (entry.status === 'in_use') continue;
    if (normalizedBody.includes(normalize(entry.term))) {
      await contentRepo.upsertUserVocabState(userId, entry.id, nextVocabStatusOnUsageInWriting(), submissionId);
    }
  }
}

export async function submitWriting(
  userId: number,
  writingTaskId: number,
  bodyMd: string,
  durationMin?: number | null,
  attachmentUrl?: string | null,
): Promise<WritingSubmissionDTO> {
  const submission = await writingRepo.createWritingSubmission({ userId, writingTaskId, bodyMd, durationMin, attachmentUrl });
  await promoteUsedVocab(userId, writingTaskId, bodyMd, submission.id);
  return submission;
}

export async function submitSelfCheck(submissionId: number, checklistTicks: Record<string, boolean>): Promise<void> {
  await writingRepo.updateSubmissionSelfCheck(submissionId, checklistTicks);
}
