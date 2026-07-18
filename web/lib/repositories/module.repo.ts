/**
 * Module structure + the weekly session protocol (study_session/session_step)
 * and their per-user progress rows. (ARCHITECTURE §1.2, §1.3 — UC-05..UC-14).
 */
import { prisma } from '../db';
import { idToNumber, decimalToNumber } from '../serialize';
import type { ModuleStatus, ProgressStatus, SessionType, StepKind } from '../domain/types';
import type { Prisma } from '@prisma/client';

export interface ModuleDTO {
  id: number;
  blockId: number;
  slug: string;
  title: string;
  standfirst: string | null;
  goals: string[];
  plannedMinutes: number;
  position: number;
}

export interface StudySessionDTO {
  id: number;
  moduleId: number;
  sessionType: SessionType;
  position: number;
  title: string;
  plannedMinutes: number;
  status: ProgressStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface SessionStepDTO {
  id: number;
  studySessionId: number;
  position: number;
  kind: StepKind;
  title: string;
  detail: string | null;
  plannedMinutes: number;
  config: Record<string, unknown>;
  status: ProgressStatus;
  completedAt: Date | null;
}

function mapModule(m: { id: bigint; block_id: bigint; slug: string; title: string; standfirst: string | null; goals: Prisma.JsonValue; planned_minutes: number; position: number }): ModuleDTO {
  return {
    id: idToNumber(m.id),
    blockId: idToNumber(m.block_id),
    slug: m.slug,
    title: m.title,
    standfirst: m.standfirst,
    goals: Array.isArray(m.goals) ? (m.goals as string[]) : [],
    plannedMinutes: m.planned_minutes,
    position: m.position,
  };
}

export async function getModuleBySlug(courseId: number, moduleSlug: string): Promise<ModuleDTO | null> {
  const row = await prisma.module.findFirst({ where: { slug: moduleSlug, block: { course_id: courseId } } });
  return row ? mapModule(row) : null;
}

export async function getModuleById(moduleId: number): Promise<ModuleDTO | null> {
  const row = await prisma.module.findUnique({ where: { id: moduleId } });
  return row ? mapModule(row) : null;
}

/** Module + its block (slug/name/color) + course slug — for the unit header kicker and breadcrumbs. */
export async function getModuleWithBlockAndCourse(
  moduleId: number,
): Promise<(ModuleDTO & { blockSlug: string; blockName: string; blockColor: string; blockPosition: number; courseSlug: string }) | null> {
  const row = await prisma.module.findUnique({ where: { id: moduleId }, include: { block: { include: { course: true } } } });
  if (!row) return null;
  return {
    ...mapModule(row),
    blockSlug: row.block.slug,
    blockName: row.block.name,
    blockColor: row.block.color,
    blockPosition: row.block.position,
    courseSlug: row.block.course.slug,
  };
}

/** Same shape as getModuleWithBlockAndCourse, looked up by (courseSlug, moduleSlug) in one query — the unit page's primary lookup. */
export async function getModuleWithBlockAndCourseBySlug(
  courseId: number,
  moduleSlug: string,
): Promise<(ModuleDTO & { blockSlug: string; blockName: string; blockColor: string; blockPosition: number; courseSlug: string }) | null> {
  const row = await prisma.module.findFirst({
    where: { slug: moduleSlug, block: { course_id: courseId } },
    include: { block: { include: { course: true } } },
  });
  if (!row) return null;
  return {
    ...mapModule(row),
    blockSlug: row.block.slug,
    blockName: row.block.name,
    blockColor: row.block.color,
    blockPosition: row.block.position,
    courseSlug: row.block.course.slug,
  };
}

export async function listModulesForCourse(courseId: number): Promise<Array<ModuleDTO & { blockSlug: string; blockPosition: number }>> {
  const rows = await prisma.module.findMany({
    where: { block: { course_id: courseId } },
    include: { block: true },
    orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
  });
  return rows.map((r) => ({ ...mapModule(r), blockSlug: r.block.slug, blockPosition: r.block.position }));
}

export interface UserModuleStateDTO {
  status: ModuleStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  quizScore: number | null;
  masteredAt: Date | null;
}

export async function getUserModuleStates(userId: number, moduleIds: number[]): Promise<Map<number, UserModuleStateDTO>> {
  if (moduleIds.length === 0) return new Map();
  const rows = await prisma.user_module_state.findMany({ where: { user_id: userId, module_id: { in: moduleIds } } });
  const map = new Map<number, UserModuleStateDTO>();
  for (const r of rows) {
    map.set(idToNumber(r.module_id), {
      status: r.status as ModuleStatus,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      quizScore: decimalToNumber(r.quiz_score),
      masteredAt: r.mastered_at,
    });
  }
  return map;
}

export async function getUserModuleState(userId: number, moduleId: number): Promise<UserModuleStateDTO | null> {
  const row = await prisma.user_module_state.findUnique({ where: { user_id_module_id: { user_id: userId, module_id: moduleId } } });
  if (!row) return null;
  return { status: row.status as ModuleStatus, startedAt: row.started_at, completedAt: row.completed_at, quizScore: decimalToNumber(row.quiz_score), masteredAt: row.mastered_at };
}

export async function upsertUserModuleState(
  userId: number,
  moduleId: number,
  patch: { status: ModuleStatus; startedAt?: Date | null; completedAt?: Date | null; quizScore?: number | null; masteredAt?: Date | null },
): Promise<void> {
  await prisma.user_module_state.upsert({
    where: { user_id_module_id: { user_id: userId, module_id: moduleId } },
    create: {
      user_id: userId,
      module_id: moduleId,
      status: patch.status,
      started_at: patch.startedAt ?? null,
      completed_at: patch.completedAt ?? null,
      quiz_score: patch.quizScore ?? null,
      mastered_at: patch.masteredAt ?? null,
    },
    update: {
      status: patch.status,
      ...(patch.startedAt !== undefined ? { started_at: patch.startedAt } : {}),
      ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}),
      ...(patch.quizScore !== undefined ? { quiz_score: patch.quizScore } : {}),
      ...(patch.masteredAt !== undefined ? { mastered_at: patch.masteredAt } : {}),
    },
  });
}

/** Finds the module the learner is actively working through: prefers `in_progress`, else the earliest `upcoming` module in course order. Drives UC-01 Today. */
export async function findCurrentModuleForCourse(userId: number, courseId: number): Promise<ModuleDTO | null> {
  const inProgress = await prisma.user_module_state.findFirst({
    where: { user_id: userId, status: 'in_progress', module: { block: { course_id: courseId } } },
    include: { module: true },
    orderBy: { started_at: 'desc' },
  });
  if (inProgress) return mapModule(inProgress.module);

  const upcoming = await prisma.module.findFirst({
    where: { block: { course_id: courseId }, user_module_state: { some: { user_id: userId, status: 'upcoming' } } },
    include: { block: true },
    orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
  });
  if (upcoming) return mapModule(upcoming);

  // Nobody has a state row yet (brand-new enrollment) — the very first module of the course.
  const first = await prisma.module.findFirst({ where: { block: { course_id: courseId } }, include: { block: true }, orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }] });
  return first ? mapModule(first) : null;
}

/**
 * 0002_seed_en_c1_skeleton.sql seeds course/block/module/session structure
 * but deliberately no `user_module_state` rows (progress is per-user, not
 * content). §6.5: "the course's first module starts `upcoming`". A brand
 * new user has zero user_module_state rows for the course, so this creates
 * exactly one: the first module (lowest block position, lowest module
 * position) → upcoming. No-op once any row exists for the course.
 */
export async function ensureFirstModuleUnlocked(userId: number, courseId: number): Promise<void> {
  const anyState = await prisma.user_module_state.findFirst({ where: { user_id: userId, module: { block: { course_id: courseId } } } });
  if (anyState) return;
  const first = await prisma.module.findFirst({
    where: { block: { course_id: courseId } },
    orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
  });
  if (!first) return;
  await prisma.user_module_state.upsert({
    where: { user_id_module_id: { user_id: userId, module_id: first.id } },
    create: { user_id: userId, module_id: first.id, status: 'upcoming' },
    update: {},
  });
}

// ───────────────────────── study_session / session_step ─────────────────────────

function mapSession(s: {
  id: bigint;
  module_id: bigint;
  session_type: string;
  position: number;
  title: string;
  planned_minutes: number;
  user_session_state: { status: string; started_at: Date | null; completed_at: Date | null }[];
}): StudySessionDTO {
  const state = s.user_session_state[0];
  return {
    id: idToNumber(s.id),
    moduleId: idToNumber(s.module_id),
    sessionType: s.session_type as SessionType,
    position: s.position,
    title: s.title,
    plannedMinutes: s.planned_minutes,
    status: (state?.status as ProgressStatus) ?? 'not_started',
    startedAt: state?.started_at ?? null,
    completedAt: state?.completed_at ?? null,
  };
}

function mapStep(s: {
  id: bigint;
  study_session_id: bigint;
  position: number;
  kind: string;
  title: string;
  detail: string | null;
  planned_minutes: number;
  config: Prisma.JsonValue;
  user_step_state: { status: string; completed_at: Date | null }[];
}): SessionStepDTO {
  const state = s.user_step_state[0];
  return {
    id: idToNumber(s.id),
    studySessionId: idToNumber(s.study_session_id),
    position: s.position,
    kind: s.kind as StepKind,
    title: s.title,
    detail: s.detail,
    plannedMinutes: s.planned_minutes,
    config: (s.config as Record<string, unknown>) ?? {},
    status: (state?.status as ProgressStatus) ?? 'not_started',
    completedAt: state?.completed_at ?? null,
  };
}

export async function listSessionsForModule(userId: number, moduleId: number): Promise<StudySessionDTO[]> {
  const rows = await prisma.study_session.findMany({
    where: { module_id: moduleId },
    include: { user_session_state: { where: { user_id: userId } } },
    orderBy: { position: 'asc' },
  });
  return rows.map(mapSession);
}

export async function getSession(moduleId: number, sessionType: SessionType, userId: number): Promise<StudySessionDTO | null> {
  const row = await prisma.study_session.findUnique({
    where: { module_id_session_type: { module_id: moduleId, session_type: sessionType } },
    include: { user_session_state: { where: { user_id: userId } } },
  });
  return row ? mapSession(row) : null;
}

export async function listStepsForSession(userId: number, studySessionId: number): Promise<SessionStepDTO[]> {
  const rows = await prisma.session_step.findMany({
    where: { study_session_id: studySessionId },
    include: { user_step_state: { where: { user_id: userId } } },
    orderBy: { position: 'asc' },
  });
  return rows.map(mapStep);
}

export async function getSessionStepById(userId: number, stepId: number): Promise<SessionStepDTO | null> {
  const row = await prisma.session_step.findUnique({ where: { id: stepId }, include: { user_step_state: { where: { user_id: userId } } } });
  return row ? mapStep(row) : null;
}

export async function getSessionById(userId: number, studySessionId: number): Promise<StudySessionDTO | null> {
  const row = await prisma.study_session.findUnique({ where: { id: studySessionId }, include: { user_session_state: { where: { user_id: userId } } } });
  return row ? mapSession(row) : null;
}

/** The next session in the same module by `position` (Prime→Input→Workout→Output) — UC-13 "close session N, open session N+1". */
export async function getNextSessionInModule(userId: number, moduleId: number, afterPosition: number): Promise<StudySessionDTO | null> {
  const row = await prisma.study_session.findFirst({
    where: { module_id: moduleId, position: { gt: afterPosition } },
    include: { user_session_state: { where: { user_id: userId } } },
    orderBy: { position: 'asc' },
  });
  return row ? mapSession(row) : null;
}

/** The next module in the same block by `position` — D5 sequential unlock rule (§6.5). */
export async function getNextModuleInBlock(blockId: number, afterPosition: number): Promise<ModuleDTO | null> {
  const row = await prisma.module.findFirst({ where: { block_id: blockId, position: { gt: afterPosition } }, orderBy: { position: 'asc' } });
  return row ? mapModule(row) : null;
}

export async function upsertUserSessionState(
  userId: number,
  studySessionId: number,
  patch: { status: ProgressStatus; startedAt?: Date | null; completedAt?: Date | null },
): Promise<void> {
  await prisma.user_session_state.upsert({
    where: { user_id_study_session_id: { user_id: userId, study_session_id: studySessionId } },
    create: { user_id: userId, study_session_id: studySessionId, status: patch.status, started_at: patch.startedAt ?? null, completed_at: patch.completedAt ?? null },
    update: { status: patch.status, ...(patch.startedAt !== undefined ? { started_at: patch.startedAt } : {}), ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}) },
  });
}

export async function upsertUserStepState(userId: number, stepId: number, patch: { status: ProgressStatus; completedAt?: Date | null }): Promise<void> {
  await prisma.user_step_state.upsert({
    where: { user_id_session_step_id: { user_id: userId, session_step_id: stepId } },
    create: { user_id: userId, session_step_id: stepId, status: patch.status, completed_at: patch.completedAt ?? null },
    update: { status: patch.status, ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}) },
  });
}

/** True once every module in `blockId` has `status` completed or mastered — gates the block checkpoint (§1.5, §6.5). */
export async function isBlockFullyCompleted(userId: number, blockId: number): Promise<boolean> {
  const modules = await prisma.module.findMany({ where: { block_id: blockId }, select: { id: true } });
  if (modules.length === 0) return false;
  const states = await prisma.user_module_state.findMany({
    where: { user_id: userId, module_id: { in: modules.map((m) => m.id) }, status: { in: ['completed', 'mastered'] } },
  });
  return states.length === modules.length;
}
