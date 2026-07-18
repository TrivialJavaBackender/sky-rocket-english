import type { ChoiceGivenAnswer, GradeResult, ReadingComprehensionContent } from '../../types';

/** reading_comprehension (§5): choice interaction, `selected === answer`. */
export function gradeReadingComprehension(content: ReadingComprehensionContent, given: ChoiceGivenAnswer): GradeResult {
  return {
    isCorrect: given.selected === content.answer,
    correctAnswer: content.options[content.answer],
  };
}

/** Client-safe view before answering — strips `answer` (§5: server-only grading). */
export function toPublicReadingComprehension(content: ReadingComprehensionContent): Omit<ReadingComprehensionContent, 'answer'> {
  const { passage, q, options } = content;
  return { passage, q, options };
}
