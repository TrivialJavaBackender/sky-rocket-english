/**
 * Registry of what scripts/sync.ts ingests (ARCHITECTURE.md §4.1).
 * Sync only walks modules/checkpoints listed here — same rule as the
 * reference project: a new content package requires an explicit entry, so
 * an unfinished directory never gets picked up by accident. A listed
 * module/checkpoint whose directory doesn't exist yet is a warning + skip,
 * not an error (module-02..15 and all checkpoints are unwritten as of
 * module-01's ship).
 *
 * `slug` here must match the `module.slug` / `checkpoint.slug` rows already
 * seeded by db/migrations/0002_seed_en_c1_skeleton.sql — sync only *updates*
 * those rows and fills their content, it never creates course structure.
 */

export interface ModuleEntry {
  /** module.slug in the DB, e.g. 'm01'. */
  slug: string;
  /** Directory name under the course root, e.g. 'module-01'. */
  dir: string;
}

export interface CheckpointEntry {
  /** checkpoint.slug in the DB, e.g. 'cp-a'. */
  slug: string;
  /** Directory name under the course root, e.g. 'checkpoint-a'. */
  dir: string;
}

export interface CourseEntry {
  /** course.slug in the DB, e.g. 'en-c1'. */
  slug: string;
  /** Course content root, relative to the repo root. */
  root: string;
  modules: ModuleEntry[];
  checkpoints: CheckpointEntry[];
}

export const COURSES: CourseEntry[] = [
  {
    slug: 'en-c1',
    root: 'content/en-c1',
    modules: Array.from({ length: 15 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { slug: `m${n}`, dir: `module-${n}` };
    }),
    checkpoints: [
      { slug: 'diagnostic', dir: 'diagnostic' },
      { slug: 'cp-a', dir: 'checkpoint-a' },
      { slug: 'cp-b', dir: 'checkpoint-b' },
      { slug: 'cp-c', dir: 'checkpoint-c' },
      { slug: 'final', dir: 'final' },
    ],
  },
];
