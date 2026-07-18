/**
 * Single grading entry point (ARCHITECTURE.md §5): `gradeAttempt(type_code,
 * content, given) -> { isCorrect, correctAnswer }`. This is the only place
 * that dispatches on `type_code` to a grader — server actions and use-cases
 * call this, never a grader directly, so a new exercise type only touches
 * this file + one new grader.
 */
import type { ExerciseContent, ExerciseTypeCode, GivenAnswer, GradeResult } from '../types';
import { gradeMcCloze, toPublicMcCloze } from './graders/mc-cloze';
import { gradeGrammarDrill, toPublicGrammarDrill } from './graders/grammar-drill';
import { gradeReadingComprehension, toPublicReadingComprehension } from './graders/reading-comprehension';
import { gradeOpenCloze, toPublicOpenCloze } from './graders/open-cloze';
import { gradeWordFormation, toPublicWordFormation } from './graders/word-formation';
import { gradeKeyWordTransformation, toPublicKeyWordTransformation } from './graders/key-word-transformation';
import { gradeErrorCorrection, toPublicErrorCorrection } from './graders/error-correction';
import { gradeCollocationMatch, toPublicCollocationMatch } from './graders/collocation-match';

export { normalize } from './normalize';
export type { ExerciseTypeCode, ExerciseContent, GivenAnswer, GradeResult };

export function gradeAttempt(typeCode: ExerciseTypeCode, content: ExerciseContent, given: GivenAnswer): GradeResult {
  switch (typeCode) {
    case 'mc_cloze':
      return gradeMcCloze(content as Parameters<typeof gradeMcCloze>[0], given as Parameters<typeof gradeMcCloze>[1]);
    case 'grammar_drill':
      return gradeGrammarDrill(content as Parameters<typeof gradeGrammarDrill>[0], given as Parameters<typeof gradeGrammarDrill>[1]);
    case 'reading_comprehension':
      return gradeReadingComprehension(
        content as Parameters<typeof gradeReadingComprehension>[0],
        given as Parameters<typeof gradeReadingComprehension>[1],
      );
    case 'open_cloze':
      return gradeOpenCloze(content as Parameters<typeof gradeOpenCloze>[0], given as Parameters<typeof gradeOpenCloze>[1]);
    case 'word_formation':
      return gradeWordFormation(content as Parameters<typeof gradeWordFormation>[0], given as Parameters<typeof gradeWordFormation>[1]);
    case 'key_word_transformation':
      return gradeKeyWordTransformation(
        content as Parameters<typeof gradeKeyWordTransformation>[0],
        given as Parameters<typeof gradeKeyWordTransformation>[1],
      );
    case 'error_correction':
      return gradeErrorCorrection(content as Parameters<typeof gradeErrorCorrection>[0], given as Parameters<typeof gradeErrorCorrection>[1]);
    case 'collocation_match':
      return gradeCollocationMatch(
        content as Parameters<typeof gradeCollocationMatch>[0],
        given as Parameters<typeof gradeCollocationMatch>[1],
      );
  }
}

/**
 * Strips the correct-answer field(s) out of `content` before it ever reaches
 * the client (§5: grading is server-only — the initial exercise-set payload
 * must not leak `answer`/`answers`/`wrong`/`pairs` in the page source).
 * gradeAttempt above always re-reads the *full* content from the DB, never
 * trusting anything the client echoes back.
 */
export function toPublicContent(typeCode: ExerciseTypeCode, content: ExerciseContent): unknown {
  switch (typeCode) {
    case 'mc_cloze':
      return toPublicMcCloze(content as Parameters<typeof toPublicMcCloze>[0]);
    case 'grammar_drill':
      return toPublicGrammarDrill(content as Parameters<typeof toPublicGrammarDrill>[0]);
    case 'reading_comprehension':
      return toPublicReadingComprehension(content as Parameters<typeof toPublicReadingComprehension>[0]);
    case 'open_cloze':
      return toPublicOpenCloze(content as Parameters<typeof toPublicOpenCloze>[0]);
    case 'word_formation':
      return toPublicWordFormation(content as Parameters<typeof toPublicWordFormation>[0]);
    case 'key_word_transformation':
      return toPublicKeyWordTransformation(content as Parameters<typeof toPublicKeyWordTransformation>[0]);
    case 'error_correction':
      return toPublicErrorCorrection(content as Parameters<typeof toPublicErrorCorrection>[0]);
    case 'collocation_match':
      return toPublicCollocationMatch(content as Parameters<typeof toPublicCollocationMatch>[0]);
  }
}
