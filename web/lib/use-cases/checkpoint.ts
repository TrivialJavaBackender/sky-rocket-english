/**
 * UC-18 · Diagnostic + UC-19 · Block/final checkpoints. ARCHITECTURE.md §1.5.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as writingRepo from '../repositories/writing.repo';
import { checkpointStatusOnAttempt, moduleStatusOnPriorModuleCompleted } from '../domain/module-state';
import { startExerciseSet, type PublicExerciseDTO } from './exercise-set';
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
