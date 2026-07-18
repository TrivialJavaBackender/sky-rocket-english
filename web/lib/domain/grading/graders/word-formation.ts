import type { GradeResult, TextInputGivenAnswer, WordFormationContent } from '../../types';
import { normalize } from '../normalize';

/** word_formation (§5): text_input, `answers.map(normalize).includes(normalize(text))`. */
export function gradeWordFormation(content: WordFormationContent, given: TextInputGivenAnswer): GradeResult {
  const isCorrect = content.answers.map(normalize).includes(normalize(given.text));
  return { isCorrect, correctAnswer: content.answer_shown };
}

/** Client-safe view before answering — strips `answers`/`answer_shown` (§5: server-only grading). */
export function toPublicWordFormation(content: WordFormationContent): Pick<WordFormationContent, 'pre' | 'post' | 'prompt'> {
  const { pre, post, prompt } = content;
  return { pre, post, prompt };
}
