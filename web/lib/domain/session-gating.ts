/**
 * Hard sequential session gating inside a module (ARCHITECTURE.md §8 D11):
 * the four sessions unlock strictly in `position` order — the first non-done
 * session is `current`, everything after it is `locked`, done sessions stay
 * revisitable. Pure functions over ordered session states; the use-case layer
 * applies them (getUnit ribbon cells, getSession lock check).
 */
import type { ProgressStatus, SessionType } from './types';

export type SessionCellState = 'done' | 'current' | 'locked';

/** `sessions` must be ordered by `position`. All-done modules yield all-'done' cells (no current). */
export function computeSessionCells(sessions: Array<{ status: ProgressStatus }>): SessionCellState[] {
  const firstNotDone = sessions.findIndex((s) => s.status !== 'done');
  return sessions.map((s, i) => (s.status === 'done' ? 'done' : i === firstNotDone ? 'current' : 'locked'));
}

export function isSessionOpen(cell: SessionCellState): boolean {
  return cell !== 'locked';
}

export type GoalStatus = 'todo' | 'in_progress' | 'achieved';

/**
 * D12: each module goal names the session that earns it (`achieved_by` in
 * meta.yaml). The goal is achieved once that session is done, in progress
 * while it is the current session, and todo while it is still locked.
 */
export function computeGoalStatus(achievedBy: SessionType, sessions: Array<{ sessionType: SessionType }>, cells: SessionCellState[]): GoalStatus {
  const idx = sessions.findIndex((s) => s.sessionType === achievedBy);
  if (idx === -1) return 'todo';
  return cells[idx] === 'done' ? 'achieved' : cells[idx] === 'current' ? 'in_progress' : 'todo';
}
