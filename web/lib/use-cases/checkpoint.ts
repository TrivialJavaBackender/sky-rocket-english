/**
 * UC-18 · Diagnostic + UC-19 · Block/final checkpoints. ARCHITECTURE.md §1.5.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as writingRepo from '../repositories/writing.repo';
import { checkpointStatusOnAttempt, moduleStatusOnPriorModuleCompleted } from '../domain/module-state';
import { startExerciseSet, computeSetProgress, type PublicExerciseDTO, type SetProgressDTO } from './exercise-set';
import type { CheckpointStatus } from '../domain/types';
import type { WritingTaskDTO } from '../repositories/writing.repo';

export interface CheckpointSetDTO {
  checkpointId: number;
  title: string;
  passMark: number | null;
  exercises: PublicExerciseDTO[];
  writingTask: WritingTaskDTO | null;
}

export async function getCheckpointSet(checkpointId: number): Promise<CheckpointSetDTO | null> {
  const checkpoint = await courseRepo.getCheckpointById(checkpointId);
  if (!checkpoint) return null;
  const [exercises, writingTask] = await Promise.all([
    startExerciseSet({ checkpointId, pool: 'core' }),
    writingRepo.getWritingTaskForCheckpoint(checkpointId),
  ]);
  return { checkpointId, title: checkpoint.title, passMark: checkpoint.passMark, exercises, writingTask };
}

export interface CheckpointPageDTO extends CheckpointSetDTO {
  slug: string;
  kind: 'diagnostic' | 'block' | 'final';
  status: CheckpointStatus;
  bestScore: number | null;
  /** How far into the current run the learner is, so a 40/60-item sitting can be resumed. */
  progress: SetProgressDTO;
}

export type GetCheckpointResult =
  | { kind: 'ok'; checkpoint: CheckpointPageDTO }
  | { kind: 'locked'; title: string }
  | { kind: 'not_found' };

/**
 * UC-18/19 page loader: resolve a checkpoint by slug and apply the same access
 * rule the course map displays, so the map and the page can never disagree.
 *
 * The effective status defaults exactly as `getCourseMap` defaults it: a
 * diagnostic with no attempt row is `available` (no gate — `pass_mark=null`,
 * §1.5), while a block/final checkpoint with no row is `locked` until
 * `closeModule` marks it available on block completion (session.ts). `passed`
 * and `failed` both stay open, matching the map's "retake available" label.
 */
export async function getCheckpointForUser(
  userId: number,
  courseSlug: string,
  checkpointSlug: string,
): Promise<GetCheckpointResult> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) return { kind: 'not_found' };
  const checkpoint = await courseRepo.getCheckpointBySlug(course.id, checkpointSlug);
  if (!checkpoint) return { kind: 'not_found' };

  const state = (await courseRepo.getUserCheckpointStates(userId, [checkpoint.id])).get(checkpoint.id);
  const status: CheckpointStatus = state?.status ?? (checkpoint.kind === 'diagnostic' ? 'available' : 'locked');
  if (status === 'locked') return { kind: 'locked', title: checkpoint.title };

  const set = await getCheckpointSet(checkpoint.id);
  if (!set) return { kind: 'not_found' };
  const progress = await computeSetProgress(userId, set.exercises, 'checkpoint');

  return {
    kind: 'ok',
    checkpoint: { ...set, slug: checkpoint.slug, kind: checkpoint.kind, status, bestScore: state?.bestScore ?? null, progress },
  };
}

export interface FinishCheckpointResult {
  score: number;
  status: CheckpointStatus;
}

/**
 * UC-18/19: score the attempt, apply the pass/fail gate (diagnostic has no
 * gate — `pass_mark=null` always grades `passed`, §1.5), and — for a
 * `block`-kind checkpoint that passes — unlock the first module of the next
 * block (D5's sequential rule extended across blocks).
 */
export async function finishCheckpoint(
  userId: number,
  checkpointId: number,
  correctCount: number,
  totalCount: number,
  now: Date = new Date(),
): Promise<FinishCheckpointResult> {
  const checkpoint = await courseRepo.getCheckpointById(checkpointId);
  if (!checkpoint) throw new Error(`Checkpoint not found: ${checkpointId}`);

  const score = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  const status = checkpointStatusOnAttempt(score, checkpoint.passMark);

  const existing = (await courseRepo.getUserCheckpointStates(userId, [checkpointId])).get(checkpointId);
  const bestScore = existing?.bestScore != null ? Math.max(existing.bestScore, score) : score;
  await courseRepo.upsertUserCheckpointState(userId, checkpointId, { status, bestScore, takenAt: now });

  if (status === 'passed' && checkpoint.kind === 'block' && checkpoint.blockId) {
    const block = await courseRepo.getBlockById(checkpoint.blockId);
    if (block) {
      const nextBlock = await courseRepo.getNextBlock(checkpoint.courseId, block.position);
      if (nextBlock) {
        const firstModule = await moduleRepo.getNextModuleInBlock(nextBlock.id, 0);
        if (firstModule) {
          const moduleState = await moduleRepo.getUserModuleState(userId, firstModule.id);
          const nextStatus = moduleStatusOnPriorModuleCompleted(moduleState?.status ?? 'locked');
          if (nextStatus !== (moduleState?.status ?? 'locked')) {
            await moduleRepo.upsertUserModuleState(userId, firstModule.id, { status: nextStatus });
          }
        }
      }
    }
  }

  return { score, status };
}
