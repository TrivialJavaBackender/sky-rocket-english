/**
 * Registry of what scripts/sync.ts ingests (ARCHITECTURE.md §4.1).
 *
 * Only the course roots live here now. Everything the sync used to read from
 * this file — which modules and checkpoints exist, what they are called, which
 * directory each maps to — is declared in courses/<slug>/course.yaml, together
 * with the blocks, the gates and the session protocol. Sync upserts that
 * skeleton itself, so registering a new course is this one line plus its YAML.
 *
 * A module or checkpoint whose directory doesn't exist yet is a warning + skip,
 * not an error: the course map is written up front and the packages arrive one
 * at a time (module-07..15 and most checkpoints are unwritten).
 */

/** Course roots, relative to the repo root. Each holds course.yaml + content/. */
export const COURSE_ROOTS: string[] = ['courses/en-c1', 'courses/de-a2', 'courses/de-a1'];
