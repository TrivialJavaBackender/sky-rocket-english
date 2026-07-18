/**
 * Domain types (ARCHITECTURE.md §2, §5, §6). Pure type definitions — no
 * imports from @prisma/client (layering rule in §2): Postgres enums are
 * mirrored here as plain string-literal unions. Their values are identical
 * to the Prisma enum values at runtime, so repositories can pass a Prisma
 * enum straight through without a cast; domain code never imports Prisma to
 * get there.
 *
 * Exercise content shapes are re-exported from lib/content-schema.ts (zod
 * inferred types) rather than redefined — that module is the single source
 * of truth for the package/DB `content jsonb` shape (§4.7, §8 D3) and has no
 * I/O of its own, so depending on it from domain doesn't violate "domain
 * has no I/O".
 */

import type {
  McClozeContent,
  GrammarDrillContent,
  ReadingComprehensionContent,
  OpenClozeContent,
  WordFormationContent,
  KeyWordTransformationContent,
  ErrorCorrectionContent,
  CollocationMatchContent,
  ExerciseTypeCode,
} from '../content-schema';

export type {
  McClozeContent,
  GrammarDrillContent,
  ReadingComprehensionContent,
  OpenClozeContent,
  WordFormationContent,
  KeyWordTransformationContent,
  ErrorCorrectionContent,
  CollocationMatchContent,
  ExerciseTypeCode,
};

export type ExerciseContent =
  | McClozeContent
  | GrammarDrillContent
  | ReadingComprehensionContent
  | OpenClozeContent
  | WordFormationContent
  | KeyWordTransformationContent
  | ErrorCorrectionContent
  | CollocationMatchContent;

// ───────────────────────── given_answer shapes (§5 table) ─────────────────────────

/** mc_cloze, grammar_drill, reading_comprehension — `interaction: choice`. */
export interface ChoiceGivenAnswer {
  selected: number;
}

/** open_cloze, word_formation, key_word_transformation — `interaction: text_input`. */
export interface TextInputGivenAnswer {
  text: string;
}

/** error_correction — `interaction: word_tap`. */
export interface WordTapGivenAnswer {
  tapped: number;
}

/** collocation_match — `interaction: match`. Client reports its own miss count (§5: "first-try misses count"); server independently re-validates the pairing itself. */
export interface MatchGivenAnswer {
  pairs: Record<string, number>;
  misses: number;
}

export type GivenAnswer = ChoiceGivenAnswer | TextInputGivenAnswer | WordTapGivenAnswer | MatchGivenAnswer;

export interface GradeResult {
  isCorrect: boolean;
  /** Human-readable "what the correct answer was", for the feedback panel (mirrors mockup's `fbAnswer`). */
  correctAnswer: string;
}

// ───────────────────────── status enums (mirror Postgres enums) ─────────────────────────

export type ModuleStatus = 'locked' | 'upcoming' | 'in_progress' | 'completed' | 'mastered';
export type CheckpointStatus = 'locked' | 'available' | 'passed' | 'failed';
export type ProgressStatus = 'not_started' | 'in_progress' | 'done';
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';
export type VocabStatus = 'new' | 'learning' | 'known' | 'in_use';
export type GrammarStatus = 'introduced' | 'practising' | 'reliable';
export type ReviewStage = 'r7' | 'r21';
export type AttemptContext = 'session' | 'review_slot' | 'module_quiz' | 'module_review' | 'checkpoint' | 'practice';

/** card_review_log.rating: 1=Again 2=Hard 3=Good 4=Easy (§6.4). */
export type Rating = 1 | 2 | 3 | 4;

export type SessionType = 'prime' | 'input' | 'workout' | 'output';
export type StepKind =
  | 'opener'
  | 'theory'
  | 'reading'
  | 'vocab'
  | 'exercise_set'
  | 'review_slot'
  | 'harvest'
  | 'production'
  | 'self_check'
  | 'module_quiz'
  | 'flashcards_intro';
export type ReadingKind = 'main' | 'extra';
export type TaskMode = 'writing' | 'speaking';
export type FlashcardSource = 'content' | 'error_harvest' | 'gloss' | 'manual';
export type NoteType = 'vocab' | 'grammar_cloze' | 'transformation';
export type ExerciseGroup = 'grammar' | 'reading' | 'vocab';
export type ExercisePool = 'core' | 'review';
export type ErrorSource = 'exercise' | 'writing' | 'manual';
