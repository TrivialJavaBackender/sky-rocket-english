import type { GradeResult, OpenClozeContent, TextInputGivenAnswer } from '../../types';
import { normalize } from '../normalize';

/** open_cloze (§5): text_input, `answers.map(normalize).includes(normalize(text))`. */
export function gradeOpenCloze(content: OpenClozeContent, given: TextInputGivenAnswer): GradeResult {
  const isCorrect = content.answers.map(normalize).includes(normalize(given.text));
  return { isCorrect, correctAnswer: content.answer_shown };
}

/** Client-safe view before answering — strips `answers`/`answer_shown` (§5: server-only grading). */
export function toPublicOpenCloze(content: OpenClozeContent): Pick<OpenClozeContent, 'pre' | 'post'> {
  const { pre, post } = content;
  return { pre, post };
}
