import type { ChoiceGivenAnswer, GradeResult, GrammarDrillContent } from '../../types';

/** grammar_drill (§5): choice interaction, `selected === answer`. */
export function gradeGrammarDrill(content: GrammarDrillContent, given: ChoiceGivenAnswer): GradeResult {
  return {
    isCorrect: given.selected === content.answer,
    correctAnswer: content.options[content.answer],
  };
}

/** Client-safe view before answering — strips `answer` (§5: server-only grading). */
export function toPublicGrammarDrill(content: GrammarDrillContent): Omit<GrammarDrillContent, 'answer'> {
  const { pre, post, prompt, options } = content;
  return { pre, post, prompt, options };
}
