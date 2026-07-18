import type { CollocationMatchContent, GradeResult, MatchGivenAnswer } from '../../types';

/**
 * collocation_match (§5): match interaction. Correct iff the submitted
 * left→right mapping exactly equals `content.pairs` AND there were zero
 * first-try misses (mockap rule: "First-try misses count"). The client
 * reports `misses` (single-user, trusted per §5), but the mapping itself is
 * independently re-checked here rather than trusted blindly.
 */
export function gradeCollocationMatch(content: CollocationMatchContent, given: MatchGivenAnswer): GradeResult {
  const mappingCorrect = pairsEqual(given.pairs, content.pairs);
  const isCorrect = mappingCorrect && given.misses === 0;
  const correctAnswer = Object.entries(content.pairs)
    .map(([leftIdx, rightIdx]) => `${content.left[Number(leftIdx)]} → ${content.right[rightIdx]}`)
    .join('; ');
  return { isCorrect, correctAnswer };
}

/** Client-safe view before answering — strips `pairs` (§5: server-only grading). */
export function toPublicCollocationMatch(content: CollocationMatchContent): Pick<CollocationMatchContent, 'left' | 'right'> {
  const { left, right } = content;
  return { left, right };
}

function pairsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}
