import { z } from 'zod';
import { isDeterminateGap, OPEN_CLASS_ANSWER_THRESHOLD } from './content-gap-words';

/**
 * Zod schemas for the content package format (docs/CONTENT-PACKAGE-SCHEMA.md).
 * scripts/sync.ts validates every YAML file against these before upsert
 * (ARCHITECTURE.md §4.7) — a malformed module fails the sync with a clear
 * error instead of writing partial/garbage rows. The runtime (stage 3) reuses
 * the exercise `content` union to type `exercise.content jsonb` when grading
 * (§5) — canon field names are the package's snake_case (§8, D3), not the
 * mockup's camelCase.
 *
 * The schemas are language-agnostic with one exception: the open_cloze
 * determinacy rule needs to know which words a sentence forces, so anything
 * downstream of it is built by `makeExercisesPackageSchema(language)` rather
 * than exported as a ready value.
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
  production: z.object({
    mode: z.enum(['writing', 'speaking']),
    genre: z.string().min(1),
  }),
  // Legacy bookkeeping from before migration 0005: the deck is derived from
  // vocab.yaml, so these counts inform nothing and no course is required to
  // restate them. Optional rather than removed — the en-c1 packages still
  // carry them and rewriting six modules to drop a dead field is churn.
  cards: z
    .object({
      vocab: z.number().int().nonnegative(),
      grammar_cloze: z.number().int().nonnegative().optional(),
      transformation: z.number().int().nonnegative().optional(),
    })
    .optional(),
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

/**
 * A grammar table inside a spotlight item — conjugations, the three genders,
 * case endings. Paradigms are two-dimensional, and squeezing them into a
 * dot-separated string ("ich -e · du -st · er/sie/es -t") made the reader
 * reconstruct the grid in their head, which is exactly the work a table is
 * supposed to remove. `headers[0]` is usually empty: it labels the row-name
 * column (the pronoun, the gender).
 */
export const SpotlightTableSchema = z
  .object({
    headers: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string()).min(2)).min(1),
  })
  .superRefine((table, ctx) => {
    table.rows.forEach((row, i) => {
      if (row.length !== table.headers.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows', i],
          message: `row has ${row.length} cells but there are ${table.headers.length} headers — a ragged table renders misaligned`,
        });
      }
    });
  });
export type SpotlightTable = z.infer<typeof SpotlightTableSchema>;

export const SpotlightItemSchema = z
  .object({
    form: z.string().min(1),
    // Optional when `table` carries the examples — a paradigm table repeats
    // itself if every cell is also restated in an example line.
    example: z.string().min(1).optional(),
    note: z.string().min(1),
    table: SpotlightTableSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (!item.example && !item.table) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['example'],
        message: 'a spotlight item needs either `example` or `table` — `form` + `note` alone show the learner no German',
      });
    }
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

const OpenClozeShape = z.object({
  pre: z.string(),
  post: z.string(),
  // Base form shown before answering, as in a coursebook's "(work)". Optional:
  // classic open cloze gives no prompt, but the drills derived from
  // theory.cloze_cards need one — "She ___ here since 2019" has several
  // grammatical answers until you fix the verb.
  hint: z.string().optional(),
  answers: z.array(z.string().min(1)).min(1),
  answer_shown: z.string().min(1),
});
export type OpenClozeContent = z.infer<typeof OpenClozeShape>;

// Determinacy rule (docs/CONTENT-PACKAGE-SCHEMA.md): a gap the learner cannot
// recover is a guessing game, not a test. Closed-class and fixed-frame answers
// are forced by the sentence; a lexical content word is not, so it needs either
// a base-form `hint` or an exhaustive `answers` set. Which words count as forced
// is language-specific, hence the factory.
export const makeOpenClozeContentSchema = (language: string) =>
  OpenClozeShape.superRefine((content, ctx) => {
    if (content.hint) return;
    if (isDeterminateGap(content.answers, language)) return;
    if (content.answers.length >= OPEN_CLASS_ANSWER_THRESHOLD) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hint'],
      message:
        `open_cloze answer "${content.answer_shown}" is a content word, so "${content.pre}___${content.post}" ` +
        `has more than one defensible answer. Add \`hint\` with the dictionary base form (e.g. hint: know for "knowing"), ` +
        `or list every member of the class in \`answers\` if grammar pins the class but not the word ` +
        `(≥${OPEN_CLASS_ANSWER_THRESHOLD} entries). If the word really is recoverable from a fixed frame, ` +
        `add its head to FIXED_FRAME_HEADS in lib/content-gap-words/${language}.ts.`,
    });
  });

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

export const makeExerciseEntrySchema = (language: string) =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('mc_cloze'), content: McClozeContentSchema, ...exerciseCommonFields }),
    z.object({ type: z.literal('grammar_drill'), content: GrammarDrillContentSchema, ...exerciseCommonFields }),
    z.object({
      type: z.literal('reading_comprehension'),
      content: ReadingComprehensionContentSchema,
      ...exerciseCommonFields,
    }),
    z.object({
      type: z.literal('open_cloze'),
      content: makeOpenClozeContentSchema(language),
      ...exerciseCommonFields,
    }),
    z.object({ type: z.literal('word_formation'), content: WordFormationContentSchema, ...exerciseCommonFields }),
    z.object({
      type: z.literal('key_word_transformation'),
      content: KeyWordTransformationContentSchema,
      ...exerciseCommonFields,
    }),
    z.object({ type: z.literal('error_correction'), content: ErrorCorrectionContentSchema, ...exerciseCommonFields }),
    z.object({ type: z.literal('collocation_match'), content: CollocationMatchContentSchema, ...exerciseCommonFields }),
  ]);

// The determinacy refinement narrows nothing, so the inferred entry type is the
// same for every language — callers that only need the shape can use these.
export type ExerciseEntry = z.infer<ReturnType<typeof makeExerciseEntrySchema>>;
export type ExerciseTypeCode = ExerciseEntry['type'];

export const makeExercisesPackageSchema = (language: string) =>
  z.object({
    core: z.array(makeExerciseEntrySchema(language)).min(1),
    review_pool: z.array(makeExerciseEntrySchema(language)),
  });
export type ExercisesPackage = z.infer<ReturnType<typeof makeExercisesPackageSchema>>;

// ───────────────────────────── writing.yaml ─────────────────────────────

export const WritingPackageSchema = z
  .object({
    mode: z.enum(['writing', 'speaking']),
    genre: z.string().min(1),
    prompt: z.string().min(1),
    // Target length as [min, max]. Optional: speaking tasks have no word count,
    // and the editor shows a plain counter rather than inventing a target when
    // it is absent. Before this existed the editor hardcoded the CAE 220–260
    // band and contradicted every A2 prompt (migration 0007).
    word_target: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    model_answer: z.string().optional(),
    checklist: z.array(z.string().min(1)).optional(),
  })
  .superRefine((pkg, ctx) => {
    if (pkg.word_target && pkg.word_target[0] > pkg.word_target[1]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['word_target'],
        message: `word_target is [min, max] — got [${pkg.word_target[0]}, ${pkg.word_target[1]}]`,
      });
    }
    if (pkg.mode === 'speaking' && pkg.word_target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['word_target'],
        message: 'a speaking task has no word count — drop word_target',
      });
    }
  });
export type WritingPackage = z.infer<typeof WritingPackageSchema>;

// ───────────────────────────── audio/manifest.json ─────────────────────────────
// Committed output of scripts/audio.ts, read back by scripts/sync.ts
// (ARCHITECTURE.md §4.8). Not a module content package — one manifest per
// course, at courses/<slug>/audio/manifest.json, covering every module's
// vocab/theory/reading audio in one file so a single content_hash-style gate
// (course.audio_manifest_hash) can skip the whole course in 0 queries.

export const AudioClipRenderSchema = z.object({
  key: z.string().min(1),
  // '/audio/de/a3/<key>.opus' — served straight from web/public, and joined
  // onto lib/audio/config.ts's WEB_PUBLIC_DIR to find the blob on disk.
  path: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  bytes: z.number().int().positive(),
});
export type AudioClipRender = z.infer<typeof AudioClipRenderSchema>;

export const AudioManifestClipSchema = z.object({
  // Normalized text (normalizeAudioText) — the source of both text_hash and
  // what was actually sent to tts-mcp, kept for debugging and coverage
  // reports rather than re-derived from text_hash (which is one-way).
  text: z.string().min(1),
  text_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'expected a lowercase 64-char hex sha256(normalizeAudioText(text))'),
  // Every "field|kind|position|..." locator this text came from (a term can
  // repeat as both a vocab entry and inside a use_case) — debugging and the
  // per-module coverage count in scripts/audio.ts's report, never read back
  // by sync.
  refs: z.array(z.string().min(1)).min(1),
  // Keyed by profile name — today only AUDIO_PROFILE ('normal') is ever
  // populated, but this carries tts-mcp's own per-profile manifest shape
  // through unflattened rather than assuming there is exactly one.
  audio: z.record(z.string(), AudioClipRenderSchema),
});
export type AudioManifestClip = z.infer<typeof AudioManifestClipSchema>;

export const AudioManifestSchema = z.object({
  schema_version: z.literal(1),
  lang: z.string().min(2),
  engine: z.string().min(1),
  voice: z.string().min(1),
  clips: z.array(AudioManifestClipSchema),
});
export type AudioManifest = z.infer<typeof AudioManifestSchema>;
