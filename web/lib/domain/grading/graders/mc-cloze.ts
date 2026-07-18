import type { ChoiceGivenAnswer, GradeResult, McClozeContent } from '../../types';

/** mc_cloze (§5): choice interaction, `selected === answer`. */
export function gradeMcCloze(content: McClozeContent, given: ChoiceGivenAnswer): GradeResult {
  return {
    isCorrect: given.selected === content.answer,
    correctAnswer: content.options[content.answer],
  };
}

/** Client-safe view before answering — `answer` (the correct index) must never reach the page before grading (§5: server-only grading). */
export function toPublicMcCloze(content: McClozeContent): Omit<McClozeContent, 'answer'> {
  const { pre, post, options } = content;
  return { pre, post, options };
}
