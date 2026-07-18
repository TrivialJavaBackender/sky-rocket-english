import type { GivenAnswer } from '@/lib/domain/types';

/**
 * Shared contract for the 8 exercise-type components (ARCHITECTURE.md §5,
 * §7.2). `phase`/`isCorrect`/`correctAnswer` come from the parent
 * ExercisePlayer, which owns the single grading round-trip
 * (`gradeAndRecord`) — a type component never grades itself, only collects
 * the learner's answer and calls `onSubmit` once it's complete.
 */
export interface ExerciseTypeProps<TContent> {
  content: TContent;
  phase: 'ans' | 'chk';
  isCorrect: boolean | null;
  /** Human-readable correct answer/mapping from the server (§5 `correctAnswer`) — shape varies by type (option text, `answer_shown`, a "left → right" mapping string, or a correction note). Null until graded. */
  correctAnswer: string | null;
  onSubmit: (given: GivenAnswer) => void;
}
