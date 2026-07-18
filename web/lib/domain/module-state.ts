/**
 * Status machines for module / checkpoint (ARCHITECTURE.md §6.5, §1.5).
 * Pure transition functions — callers own the actual `user_module_state` /
 * `user_checkpoint_state` reads/writes.
 *
 * Module: locked → upcoming → in_progress → completed → mastered.
 * Checkpoint: locked → available → passed/failed.
 */
import type { CheckpointStatus, ModuleStatus } from './types';

/** UC-05 first entry into a module: upcoming → in_progress (locked/completed/mastered pass through unchanged — re-entering a finished module doesn't regress it). */
export function moduleStatusOnFirstEntry(current: ModuleStatus): ModuleStatus {
  return current === 'upcoming' ? 'in_progress' : current;
}

/** UC-14 module quiz close: always → completed (both fresh and re-taken quizzes land here; mastery is a separate, later promotion via r7/r21). */
export function moduleStatusOnQuizClose(): ModuleStatus {
  return 'completed';
}

/** UC-17: both r7 and r21 module reviews passed → mastered. */
export function moduleStatusOnMastery(): ModuleStatus {
  return 'mastered';
}

/**
 * D5 (MVP rule): modules unlock sequentially within their block — finishing
 * module N opens module N+1 (locked → upcoming). A module that's already
 * past `locked` is left alone (idempotent — re-running this after the
 * learner has already started N+1 must not roll it back to upcoming).
 */
export function moduleStatusOnPriorModuleCompleted(current: ModuleStatus): ModuleStatus {
  return current === 'locked' ? 'upcoming' : current;
}

/** Block checkpoint (§1.5): available once every module in the block is completed/mastered. */
export function checkpointStatusOnModulesGate(current: CheckpointStatus, allModulesCompletedOrBetter: boolean): CheckpointStatus {
  if (current !== 'locked') return current;
  return allModulesCompletedOrBetter ? 'available' : 'locked';
}

/**
 * Checkpoint attempt outcome. Diagnostic checkpoints have `pass_mark=null`
 * and are always "passed" formally — they're a gap map, not a gate (§1.5,
 * UC-18).
 */
export function checkpointStatusOnAttempt(score: number, passMark: number | null): CheckpointStatus {
  if (passMark === null) return 'passed';
  return score >= passMark ? 'passed' : 'failed';
}
