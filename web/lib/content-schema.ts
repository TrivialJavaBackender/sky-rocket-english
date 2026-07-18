import { z } from 'zod';

/**
 * Zod schemas for the content package format (content/en-c1/README.md).
 * scripts/sync.ts validates every YAML/CSV file against these before upsert
 * (ARCHITECTURE.md §4.7) — a malformed module fails the sync with a clear
 * error instead of writing partial/garbage rows. The runtime (stage 3) reuses
 * the exercise `content` union to type `exercise.content jsonb` when grading
 * (§5) — canon field names are the package's snake_case (§8, D3), not the
 * mockup's camelCase.
 */

// ───────────────────────────── meta.yaml ─────────────────────────────

export const MetaSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  standfirst: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  grammar_points: z.array(z.string().min(1)).min(1),
  texts: z.array(
    z.object({
      kind: z.enum(['main', 'extra']),
      title: z.string().min(1),
      word_count: z.number().int().positive(),
    }),
  ),
  production: z.object({
    mode: z.enum(['writing', 'speaking']),
    genre: z.string().min(1),
  }),
  cards: z.object({
    vocab: z.number().int().nonnegative(),
    grammar_cloze: z.number().int().nonnegative(),
    transformation: z.number().int().nonnegative(),
  }),
});
export type Meta = z.infer<typeof MetaSchema>;

// ───────────────────────────── vocab.yaml ─────────────────────────────

export const VocabEntrySchema = z.object({
  term: z.string().min(1),
  tag: z.string().optional(),
  definition: z.string().min(1),
  use_cases: z.array(z.string().min(1)).min(1),
  collocations: z.string().optional(),
  // Package field is `register`; DB column is vocab_entry.register_note (§4.2).
  register: z.string().optional(),
});
export type VocabEntry = z.infer<typeof VocabEntrySchema>;

export const VocabPackageSchema = z.object({
  entries: z.array(VocabEntrySchema).min(1),
});

// ───────────────────────────── theory.yaml ─────────────────────────────

export const SpotlightItemSchema = z.object({
  form: z.string().min(1),
  example: z.string().min(1),
  note: z.string().min(1),
});

export const SpotlightSchema = z.object({
  title: z.string().min(1),
  intro: z.string().min(1),
  items: z.array(SpotlightItemSchema).min(1),
});
export type Spotlight = z.infer<typeof SpotlightSchema>;

export const WatchoutSchema = z.object({
  title: z.string().min(1),
  bad: z.string().min(1),
  good: z.string().min(1),
  note: z.string().optional(),
});
export type Watchout = z.infer<typeof WatchoutSchema>;

export const TheoryPackageSchema = z.object({
  spotlights: z.array(SpotlightSchema).min(1),
  watchouts: z.array(WatchoutSchema).min(1),
});

// ───────────────────────── text-main.yaml / text-extra.yaml ─────────────────────────

export const TextSegmentSchema = z.union([
  z.object({ t: z.string() }),
  z.object({ g: z.string().min(1) }),
]);
export type TextSegment = z.infer<typeof TextSegmentSchema>;

export const GlossSchema = z.object({
  key: z.string().min(1),
  term: z.string().min(1),
  pos_label: z.string().optional(),
  definition: z.string().min(1),
  example: z.string().optional(),
});
export type Gloss = z.infer<typeof GlossSchema>;

export const ReadingPackageSchema = z.object({
  kind: z.enum(['main', 'extra']),
  kicker: z.string().optional(),
  title: z.string().min(1),
  meta: z.string().optional(),
  word_count: z.number().int().positive().optional(),
  body: z.array(z.array(TextSegmentSchema).min(1)).min(1),
  glosses: z.array(GlossSchema),
});
export type ReadingPackage = z.infer<typeof ReadingPackageSchema>;

// ───────────────────────────── exercises.yaml ─────────────────────────────
// Content shapes mirror the design player (docs/design/skyrocket/content.js)
// and the grading contracts in ARCHITECTURE.md §5.

export const McClozeContentSchema = z.object({
  pre: z.string(),
  post: z.string(),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(),
});
export type McClozeContent = z.infer<typeof McClozeContentSchema>;

export const GrammarDrillContentSchema = z.object({
  pre: z.string(),
  post: z.string(),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(),
});
export type GrammarDrillContent = z.infer<typeof GrammarDrillContentSchema>;

export const ReadingComprehensionContentSchema = z.object({
  passage: z.string().min(1),
  q: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(),
});
export type ReadingComprehensionContent = z.infer<typeof ReadingComprehensionContentSchema>;

export const OpenClozeContentSchema = z.object({
  pre: z.string(),
  post: z.string(),
  answers: z.array(z.string().min(1)).min(1),
  answer_shown: z.string().min(1),
});
export type OpenClozeContent = z.infer<typeof OpenClozeContentSchema>;

export const WordFormationContentSchema = z.object({
  pre: z.string(),
  post: z.string(),
  prompt: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1),
  answer_shown: z.string().min(1),
});
export type WordFormationContent = z.infer<typeof WordFormationContentSchema>;

export const KeyWordTransformationContentSchema = z.object({
  s1: z.string().min(1),
  key: z.string().min(1),
  pre: z.string(),
  post: z.string(),
  answers: z.array(z.string().min(1)).min(1),
  hint: z.string().optional(),
  answer_shown: z.string().min(1),
});
export type KeyWordTransformationContent = z.infer<typeof KeyWordTransformationContentSchema>;

export const ErrorCorrectionContentSchema = z.object({
  words: z.array(z.string().min(1)).min(2),
  wrong: z.number().int().nonnegative(),
  correction: z.string().min(1),
});
export type ErrorCorrectionContent = z.infer<typeof ErrorCorrectionContentSchema>;

export const CollocationMatchContentSchema = z.object({
  left: z.array(z.string().min(1)).min(2),
  right: z.array(z.string().min(1)).min(2),
  pairs: z.record(z.string(), z.number().int().nonnegative()),
});
export type CollocationMatchContent = z.infer<typeof CollocationMatchContentSchema>;

const exerciseCommonFields = {
  group: z.enum(['grammar', 'reading', 'vocab']),
  grammar_point: z.string().optional(),
  // Optional author-supplied stable key (§4.5 recommendation); falls back to
  // a content hash when absent.
  id: z.string().optional(),
  explanation: z.string().min(1),
};

export const ExerciseEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mc_cloze'), content: McClozeContentSchema, ...exerciseCommonFields }),
  z.object({ type: z.literal('grammar_drill'), content: GrammarDrillContentSchema, ...exerciseCommonFields }),
  z.object({
    type: z.literal('reading_comprehension'),
    content: ReadingComprehensionContentSchema,
    ...exerciseCommonFields,
  }),
  z.object({ type: z.literal('open_cloze'), content: OpenClozeContentSchema, ...exerciseCommonFields }),
  z.object({ type: z.literal('word_formation'), content: WordFormationContentSchema, ...exerciseCommonFields }),
  z.object({
    type: z.literal('key_word_transformation'),
    content: KeyWordTransformationContentSchema,
    ...exerciseCommonFields,
  }),
  z.object({ type: z.literal('error_correction'), content: ErrorCorrectionContentSchema, ...exerciseCommonFields }),
  z.object({ type: z.literal('collocation_match'), content: CollocationMatchContentSchema, ...exerciseCommonFields }),
]);
export type ExerciseEntry = z.infer<typeof ExerciseEntrySchema>;
export type ExerciseTypeCode = ExerciseEntry['type'];

export const ExercisesPackageSchema = z.object({
  core: z.array(ExerciseEntrySchema).min(1),
  review_pool: z.array(ExerciseEntrySchema),
});
export type ExercisesPackage = z.infer<typeof ExercisesPackageSchema>;

// ───────────────────────────── writing.yaml ─────────────────────────────

export const WritingPackageSchema = z.object({
  mode: z.enum(['writing', 'speaking']),
  genre: z.string().min(1),
  prompt: z.string().min(1),
  model_answer: z.string().optional(),
  checklist: z.array(z.string().min(1)).optional(),
});
export type WritingPackage = z.infer<typeof WritingPackageSchema>;

// ───────────────────────────── anki-*.csv ─────────────────────────────
// Header row is `#Field1,Field2,...` (Anki-import comment convention) —
// scripts/sync.ts strips the leading `#` before treating it as the header.

export const AnkiVocabRowSchema = z.object({
  Term: z.string().min(1),
  Definition: z.string().min(1),
  UseCase1: z.string(),
  UseCase2: z.string(),
  Collocations: z.string(),
  Register: z.string(),
  Tags: z.string(),
});
export type AnkiVocabRow = z.infer<typeof AnkiVocabRowSchema>;

export const AnkiGrammarRowSchema = z.object({
  Text: z.string().min(1),
  Hint: z.string(),
  Rule: z.string(),
  Tags: z.string(),
});
export type AnkiGrammarRow = z.infer<typeof AnkiGrammarRowSchema>;

export const AnkiTransformRowSchema = z.object({
  Prompt: z.string().min(1),
  Key: z.string(),
  Answer: z.string(),
  Note: z.string(),
  Tags: z.string(),
});
export type AnkiTransformRow = z.infer<typeof AnkiTransformRowSchema>;
