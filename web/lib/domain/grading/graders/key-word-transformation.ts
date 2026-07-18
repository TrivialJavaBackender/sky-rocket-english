import type { GradeResult, KeyWordTransformationContent, TextInputGivenAnswer } from '../../types';
import { normalize } from '../normalize';

/**
 * key_word_transformation (§5): text_input, multi-answer — `answers[]` holds
 * every accepted phrasing (e.g. "been in this job for" / "been doing this
 * job for"), matched the same normalized way as open_cloze/word_formation.
 */
export function gradeKeyWordTransformation(content: KeyWordTransformationContent, given: TextInputGivenAnswer): GradeResult {
  const isCorrect = content.answers.map(normalize).includes(normalize(given.text));
  return { isCorrect, correctAnswer: content.answer_shown };
}

/** Client-safe view before answering — strips `answers`/`answer_shown` (§5: server-only grading). */
export function toPublicKeyWordTransformation(content: KeyWordTransformationContent): Pick<KeyWordTransformationContent, 's1' | 'key' | 'pre' | 'post' | 'hint'> {
  const { s1, key, pre, post, hint } = content;
  return { s1, key, pre, post, hint };
}
