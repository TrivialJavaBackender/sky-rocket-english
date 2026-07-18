/**
 * Course / block / checkpoint structure + the user's course enrollment
 * (UC-01..UC-04, UC-03 switcher, UC-18/19 checkpoints). Only file (with the
 * other lib/repositories/* modules) allowed to import Prisma (ARCHITECTURE §2).
 */
import { prisma } from '../db';
import { idToNumber, decimalToNumber } from '../serialize';
import type { CheckpointStatus } from '../domain/types';

export interface CourseDTO {
  id: number;
  slug: string;
  language: string;
  name: string;
  levelLabel: string;
  position: number;
  isActive: boolean;
}

export interface BlockDTO {
  id: number;
  courseId: number;
  slug: string;
  name: string;
  color: string;
  tint: string;
  position: number;
}

export interface CheckpointDTO {
  id: number;
  courseId: number;
  blockId: number | null;
  kind: 'diagnostic' | 'block' | 'final';
  slug: string;
  title: string;
  passMark: number | null;
  plannedMinutes: number;
  position: number;
}

export interface UserCheckpointStateDTO {
  checkpointId: number;
  status: CheckpointStatus;
  bestScore: number | null;
  takenAt: Date | null;
}

function mapCourse(c: { id: bigint; slug: string; language: string; name: string; level_label: string; position: number; is_active: boolean }): CourseDTO {
  return {
    id: idToNumber(c.id),
    slug: c.slug,
    language: c.language,
    name: c.name,
    levelLabel: c.level_label,
    position: c.position,
    isActive: c.is_active,
  };
}

function mapBlock(b: { id: bigint; course_id: bigint; slug: string; name: string; color: string; tint: string; position: number }): BlockDTO {
  return {
    id: idToNumber(b.id),
    courseId: idToNumber(b.course_id),
    slug: b.slug,
    name: b.name,
    color: b.color,
    tint: b.tint,
    position: b.position,
  };
}

function mapCheckpoint(cp: {
  id: bigint;
  course_id: bigint;
  block_id: bigint | null;
  kind: string;
  slug: string;
  title: string;
  pass_mark: number | null;
  planned_minutes: number;
  position: number;
}): CheckpointDTO {
  return {
    id: idToNumber(cp.id),
    courseId: idToNumber(cp.course_id),
    blockId: cp.block_id === null ? null : idToNumber(cp.block_id),
    kind: cp.kind as CheckpointDTO['kind'],
    slug: cp.slug,
    title: cp.title,
    passMark: cp.pass_mark,
    plannedMinutes: cp.planned_minutes,
    position: cp.position,
  };
}

export async function listCourses(): Promise<CourseDTO[]> {
  const rows = await prisma.course.findMany({ where: { is_active: true }, orderBy: { position: 'asc' } });
  return rows.map(mapCourse);
}

export async function getCourseBySlug(slug: string): Promise<CourseDTO | null> {
  const row = await prisma.course.findUnique({ where: { slug } });
  return row ? mapCourse(row) : null;
}

/**
 * The learner's currently-active course. Falls back to the lowest-position
 * active course when no `user_course` row exists yet (fresh user, before
 * `ensureActiveEnrollment` has ever run) — the caller (course-switch
 * use-case, or getToday on first visit) is responsible for creating the
 * enrollment row.
 */
export async function getActiveCourseForUser(userId: number): Promise<CourseDTO | null> {
  const enrollment = await prisma.user_course.findFirst({
    where: { user_id: userId, is_active: true },
    include: { course: true },
  });
  if (enrollment) return mapCourse(enrollment.course);
  const fallback = await prisma.course.findFirst({ where: { is_active: true }, orderBy: { position: 'asc' } });
  return fallback ? mapCourse(fallback) : null;
}

/**
 * getActiveCourseForUser plus persistence: if the learner has no
 * `user_course` row yet, enrolls them in the default course (lowest
 * `position`) and marks it active. Called from the entry-point use-cases
 * (getToday, getCourseMap) so every subsequent read sees a real enrollment.
 */
export async function ensureActiveEnrollment(userId: number): Promise<CourseDTO> {
  const enrollment = await prisma.user_course.findFirst({ where: { user_id: userId, is_active: true }, include: { course: true } });
  if (enrollment) return mapCourse(enrollment.course);
  const fallback = await prisma.course.findFirst({ where: { is_active: true }, orderBy: { position: 'asc' } });
  if (!fallback) throw new Error('No active course seeded — is 0002_seed_en_c1_skeleton.sql applied?');
  await setActiveCourse(userId, idToNumber(fallback.id));
  return mapCourse(fallback);
}

/** Marks `courseId` the sole active course for the user (UC-03), creating the enrollment row on first switch. */
export async function setActiveCourse(userId: number, courseId: number): Promise<void> {
  await prisma.$transaction([
    prisma.user_course.updateMany({ where: { user_id: userId }, data: { is_active: false } }),
    prisma.user_course.upsert({
      where: { user_id_course_id: { user_id: userId, course_id: courseId } },
      create: { user_id: userId, course_id: courseId, is_active: true },
      update: { is_active: true },
    }),
  ]);
}

export async function listBlocksForCourse(courseId: number): Promise<BlockDTO[]> {
  const rows = await prisma.block.findMany({ where: { course_id: courseId }, orderBy: { position: 'asc' } });
  return rows.map(mapBlock);
}

export async function listCheckpointsForCourse(courseId: number): Promise<CheckpointDTO[]> {
  const rows = await prisma.checkpoint.findMany({ where: { course_id: courseId }, orderBy: { position: 'asc' } });
  return rows.map(mapCheckpoint);
}

export async function getCheckpointBySlug(courseId: number, slug: string): Promise<CheckpointDTO | null> {
  const row = await prisma.checkpoint.findUnique({ where: { course_id_slug: { course_id: courseId, slug } } });
  return row ? mapCheckpoint(row) : null;
}

export async function getCheckpointById(id: number): Promise<CheckpointDTO | null> {
  const row = await prisma.checkpoint.findUnique({ where: { id } });
  return row ? mapCheckpoint(row) : null;
}

/** The block immediately after `afterPosition` in course order — UC-19: passing block checkpoint N unlocks block N+1's first module. */
export async function getNextBlock(courseId: number, afterPosition: number): Promise<BlockDTO | null> {
  const row = await prisma.block.findFirst({ where: { course_id: courseId, position: { gt: afterPosition } }, orderBy: { position: 'asc' } });
  return row ? mapBlock(row) : null;
}

export async function getBlockById(id: number): Promise<BlockDTO | null> {
  const row = await prisma.block.findUnique({ where: { id } });
  return row ? mapBlock(row) : null;
}

/** The `kind='block'` checkpoint gating a given block (§1.5) — used by session.closeModule to flip it to `available` once every module in the block is completed+. */
export async function getCheckpointForBlock(blockId: number): Promise<CheckpointDTO | null> {
  const row = await prisma.checkpoint.findFirst({ where: { block_id: blockId, kind: 'block' } });
  return row ? mapCheckpoint(row) : null;
}

/** All user_checkpoint_state rows for a course's checkpoints, keyed by checkpoint id. Checkpoints with no row yet are implicitly 'locked' — callers should default missing entries. */
export async function getUserCheckpointStates(userId: number, checkpointIds: number[]): Promise<Map<number, UserCheckpointStateDTO>> {
  if (checkpointIds.length === 0) return new Map();
  const rows = await prisma.user_checkpoint_state.findMany({
    where: { user_id: userId, checkpoint_id: { in: checkpointIds.map(BigInt) } },
  });
  const map = new Map<number, UserCheckpointStateDTO>();
  for (const r of rows) {
    map.set(idToNumber(r.checkpoint_id), {
      checkpointId: idToNumber(r.checkpoint_id),
      status: r.status as CheckpointStatus,
      bestScore: decimalToNumber(r.best_score),
      takenAt: r.taken_at,
    });
  }
  return map;
}

export async function upsertUserCheckpointState(
  userId: number,
  checkpointId: number,
  patch: { status: CheckpointStatus; bestScore?: number | null; takenAt?: Date | null },
): Promise<void> {
  await prisma.user_checkpoint_state.upsert({
    where: { user_id_checkpoint_id: { user_id: userId, checkpoint_id: checkpointId } },
    create: {
      user_id: userId,
      checkpoint_id: checkpointId,
      status: patch.status,
      best_score: patch.bestScore ?? null,
      taken_at: patch.takenAt ?? null,
    },
    update: {
      status: patch.status,
      ...(patch.bestScore !== undefined ? { best_score: patch.bestScore } : {}),
      ...(patch.takenAt !== undefined ? { taken_at: patch.takenAt } : {}),
    },
  });
}

/** Unlocks every block-checkpoint's modules gate check needs "are all modules in this block completed+" — computed by module.repo, this just flips available. */
export async function markCheckpointAvailable(userId: number, checkpointId: number): Promise<void> {
  await prisma.user_checkpoint_state.upsert({
    where: { user_id_checkpoint_id: { user_id: userId, checkpoint_id: checkpointId } },
    create: { user_id: userId, checkpoint_id: checkpointId, status: 'available' },
    update: { status: 'available' },
  });
}
