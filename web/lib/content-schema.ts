import { z } from 'zod';
import { isDeterminateGap, OPEN_CLASS_ANSWER_THRESHOLD } from './content-gap-words';

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

// A goal is either a bare string (legacy; sync maps it to achieved_by: output)
// or an object naming the session that earns it (§8 D12 — drives the unit
// hub's goals-progress card).
export const GoalSchema = z.union([
  z.string().min(1),
  z.object({
    text: z.string().min(1),
    achieved_by: z.enum(['prime', 'input', 'workout', 'output']),
  }),
]);
export type Goal = z.infer<typeof GoalSchema>;

export const MetaSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  standfirst: z.string().min(1),
  goals: z.array(GoalSchema).min(1),
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

// Authored grammar-cloze card: `text` uses Anki cloze syntax ({{c1::…}}) and
// becomes the card front; `rule` is the back. The only flashcard content not
// derivable from other package files — vocab cards come from vocab.yaml and
// transformation cards from the core key_word_transformation exercises.
export const ClozeCardSchema = z.object({
  text: z.string().min(1),
  // Required, not optional: sync derives these into open_cloze exercises
  // (clozeCardToExercise), where the gapped span is always a lexically chosen
  // verb phrase — "She ___ here since 2019" stays ambiguous until the base
  // form fixes it. The derivation builds its content object directly instead
  // of parsing it, so OpenClozeContentSchema's determinacy rule never sees
  // these; enforcing the hint here is what keeps that path honest.
  hint: z.string().min(1),
  rule: z.string().min(1),
});
export type ClozeCard = z.infer<typeof ClozeCardSchema>;

export const TheoryPackageSchema = z.object({
  spotlights: z.array(SpotlightSchema).min(1),
  watchouts: z.array(WatchoutSchema).min(1),
  cloze_cards: z.array(ClozeCardSchema).min(1),
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

export const OpenClozeContentSchema = z
  .object({
    pre: z.string(),
    post: z.string(),
    // Base form shown before answering, as in a coursebook's "(work)". Optional:
    // classic open cloze gives no prompt, but the drills derived from
    // theory.cloze_cards need one — "She ___ here since 2019" has several
    // grammatical answers until you fix the verb.
    hint: z.string().optional(),
    answers: z.array(z.string().min(1)).min(1),
    answer_shown: z.string().min(1),
  })
  // Determinacy rule (content/en-c1/README.md): a gap the learner cannot
  // recover is a guessing game, not a test. Closed-class and fixed-frame
  // answers are forced by the sentence; a lexical content word is not, so it
  // needs either a base-form `hint` or an exhaustive `answers` set.
  .superRefine((content, ctx) => {
    if (content.hint) return;
    if (isDeterminateGap(content.answers)) return;
    if (content.answers.length >= OPEN_CLASS_ANSWER_THRESHOLD) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hint'],
      message:
        `open_cloze answer "${content.answer_shown}" is a content word, so "${content.pre}___${content.post}" ` +
        `has more than one defensible answer. Add \`hint\` with the dictionary base form (e.g. hint: know for "knowing"), ` +
        `or list every member of the class in \`answers\` if grammar pins the class but not the word ` +
        `(≥${OPEN_CLASS_ANSWER_THRESHOLD} entries). If the word really is recoverable from a fixed frame, ` +
        `add its head to FIXED_FRAME_HEADS in lib/content-gap-words.ts.`,
    });
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
