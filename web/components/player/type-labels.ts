import type { ExerciseTypeCode } from '@/lib/domain/types';

/**
 * type_code -> display label, mirroring the `exercise_type` reference seed
 * (db/migrations/0001_init.sql) verbatim. This is fixed system vocabulary —
 * the 8 interaction kinds are structural, not per-course editorial content
 * — so it's fine to mirror client-side (same footing as StatusTag's status
 * labels), unlike block/module names/colors (§8 D4), which always come from
 * a DB read and are never hardcoded here.
 */
export const EXERCISE_TYPE_LABELS: Record<ExerciseTypeCode, string> = {
  mc_cloze: 'Multiple-choice cloze',
  open_cloze: 'Open cloze',
  word_formation: 'Word formation',
  key_word_transformation: 'Key-word transformation',
  grammar_drill: 'Grammar drill',
  error_correction: 'Error correction',
  collocation_match: 'Collocation match',
  reading_comprehension: 'Reading comprehension',
};
