import type { ErrorCorrectionContent, GradeResult, WordTapGivenAnswer } from '../../types';

/** error_correction (§5): word_tap, `tapped === wrong`; feedback is the `correction` string. */
export function gradeErrorCorrection(content: ErrorCorrectionContent, given: WordTapGivenAnswer): GradeResult {
  return {
    isCorrect: given.tapped === content.wrong,
    correctAnswer: content.correction,
  };
}

/** Client-safe view before answering — strips `wrong`/`correction` (§5: server-only grading). */
export function toPublicErrorCorrection(content: ErrorCorrectionContent): Pick<ErrorCorrectionContent, 'words'> {
  const { words } = content;
  return { words };
}
