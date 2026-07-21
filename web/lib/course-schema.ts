import { z } from 'zod';

/**
 * Zod schema for courses/<slug>/course.yaml — the declarative course skeleton
 * (docs/CONTENT-PACKAGE-SCHEMA.md §course.yaml, ARCHITECTURE.md §4.1).
 *
 * This file replaces what db/migrations/0002 + 0004 used to seed by hand: the
 * course map (blocks → modules), its gates (checkpoints) and the weekly session
 * protocol. scripts/sync.ts upserts all of it by natural key, so adding a course
 * or editing the protocol is a YAML edit, not a migration.
 *
 * Positions are implicit in array order — writing them out invites the array and
 * the numbers to disagree. Module planned_minutes is likewise derived (the sum of
 * the protocol's session minutes) rather than restated per module.
 */

// step_kind / session_type enums in db/migrations/0001_init.sql. Adding a value
// here without adding it to the enum fails the sync at insert time, which is the
// intended direction: the DB owns the catalogue of step kinds.
export const SESSION_TYPES = ['prime', 'input', 'workout', 'output'] as const;
export const STEP_KINDS = [
  'opener',
  'theory',
  'reading',
  'vocab',
  'exercise_set',
  'review_slot',
  'harvest',
  'production',
  'self_check',
  'module_quiz',
  'flashcards_intro',
] as const;

export const SessionStepSchema = z.object({
  kind: z.enum(STEP_KINDS),
  title: z.string().min(1),
  detail: z.string().min(1).optional(),
  minutes: z.number().int().positive(),
  // Read at render time by lib/domain/content-slicing.ts: {part,of} / {batch,of}
  // slice theory and vocab, {types}/{group_key} pick an exercise set, {count} and
  // {pool} size a quiz. Left open — a config key the app doesn't know is ignored,
  // not fatal.
  config: z.record(z.string(), z.unknown()).default({}),
});
export type SessionStepEntry = z.infer<typeof SessionStepSchema>;

export const StudySessionSchema = z.object({
  type: z.enum(SESSION_TYPES),
  title: z.string().min(1),
  planned_minutes: z.number().int().positive(),
  steps: z.array(SessionStepSchema).min(1),
});
export type StudySessionEntry = z.infer<typeof StudySessionSchema>;

export const CourseModuleSchema = z.object({
  slug: z.string().min(1),
  /** Directory under the course's content/ root, e.g. 'module-01'. */
  dir: z.string().min(1),
  title: z.string().min(1),
  standfirst: z.string().min(1),
});
export type CourseModuleEntry = z.infer<typeof CourseModuleSchema>;

export const CourseBlockSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb hex colour'),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb hex colour'),
  /**
   * Outside the linear gate: modules open immediately, finishing them unlocks
   * nothing, and the block carries no checkpoint. For refresher material the
   * course offers but does not require — see db/migrations/0008.
   */
  optional: z.boolean().default(false),
  modules: z.array(CourseModuleSchema).min(1),
});
export type CourseBlockEntry = z.infer<typeof CourseBlockSchema>;

export const CourseCheckpointSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['diagnostic', 'block', 'final']),
  /** Block slug this checkpoint gates — required for block/final, absent for diagnostic. */
  block: z.string().min(1).optional(),
  dir: z.string().min(1),
  title: z.string().min(1),
  /** Percentage needed to pass; null for the diagnostic, which gates nothing. */
  pass_mark: z.number().int().min(0).max(100).nullable().default(null),
  planned_minutes: z.number().int().positive(),
});
export type CourseCheckpointEntry = z.infer<typeof CourseCheckpointSchema>;

export const CourseSchema = z
  .object({
    slug: z.string().min(1),
    /** ISO 639-1 code — selects the open_cloze word lists in lib/content-gap-words/. */
    language: z.string().min(2),
    name: z.string().min(1),
    level_label: z.string().min(1),
    position: z.number().int().positive().default(1),
    blocks: z.array(CourseBlockSchema).min(1),
    checkpoints: z.array(CourseCheckpointSchema),
    protocol: z.array(StudySessionSchema).min(1),
  })
  // Mirrors the checkpoint_block_by_kind check constraint in 0001_init.sql, but
  // fails at parse time with the file name attached rather than mid-transaction.
  .superRefine((course, ctx) => {
    const blockSlugs = new Set(course.blocks.map((b) => b.slug));
    const optionalBlocks = new Set(course.blocks.filter((b) => b.optional).map((b) => b.slug));

    // Every course needs at least one gated block, or there is no entry module
    // for ensureFirstModuleUnlocked to open and the learner lands on an empty map.
    if (optionalBlocks.size === course.blocks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks'],
        message: 'every block is optional — a course needs at least one required block to open on',
      });
    }

    course.checkpoints.forEach((cp, i) => {
      // An optional block is never completed on the way anywhere, so a checkpoint
      // behind it would sit at `locked` forever and seal the rest of the course.
      if (cp.block && optionalBlocks.has(cp.block)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checkpoints', i, 'block'],
          message: `block "${cp.block}" is optional and gates nothing — it cannot carry a checkpoint`,
        });
      }
      if (cp.kind === 'diagnostic' && cp.block) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checkpoints', i, 'block'],
          message: 'a diagnostic checkpoint gates no block — drop `block`',
        });
      }
      if (cp.kind !== 'diagnostic' && !cp.block) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checkpoints', i, 'block'],
          message: `a ${cp.kind} checkpoint must name the block it gates`,
        });
      }
      if (cp.block && !blockSlugs.has(cp.block)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checkpoints', i, 'block'],
          message: `unknown block "${cp.block}" — declared blocks are ${[...blockSlugs].join(', ')}`,
        });
      }
    });

    const seenSession = new Set<string>();
    course.protocol.forEach((s, i) => {
      if (seenSession.has(s.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['protocol', i, 'type'],
          message: `session type "${s.type}" appears twice — study_session is unique per (module, session_type)`,
        });
      }
      seenSession.add(s.type);

      // A session advertises one length to the learner and its steps add up to
      // another only by accident. The course's total hour budget is built on
      // planned_minutes, so a drift here silently falsifies the plan.
      const stepSum = s.steps.reduce((sum, step) => sum + step.minutes, 0);
      if (stepSum !== s.planned_minutes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['protocol', i, 'planned_minutes'],
          message:
            `session "${s.title}" declares ${s.planned_minutes} min but its steps add up to ${stepSum}. ` +
            `Fix whichever is wrong — the course's hour budget is computed from planned_minutes.`,
        });
      }
    });

    const seenModule = new Set<string>();
    course.blocks.forEach((b, bi) =>
      b.modules.forEach((m, mi) => {
        if (seenModule.has(m.slug)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['blocks', bi, 'modules', mi, 'slug'],
            message: `module slug "${m.slug}" is used twice in the course`,
          });
        }
        seenModule.add(m.slug);
      }),
    );
  });
export type Course = z.infer<typeof CourseSchema>;

/** A module's planned length is the protocol it runs through — never restated per module. */
export function modulePlannedMinutes(course: Course): number {
  return course.protocol.reduce((sum, s) => sum + s.planned_minutes, 0);
}

/** Flattens blocks → modules, carrying the owning block slug, in course order. */
export function courseModules(course: Course): Array<CourseModuleEntry & { blockSlug: string }> {
  return course.blocks.flatMap((b) => b.modules.map((m) => ({ ...m, blockSlug: b.slug })));
}
