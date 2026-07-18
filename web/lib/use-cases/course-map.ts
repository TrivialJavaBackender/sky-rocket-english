/**
 * UC-02 · Course map (ARCHITECTURE.md §1.1, §7 `/course`). Read-only.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import { blockPct } from '../domain/progress';
import type { CheckpointStatus, ModuleStatus } from '../domain/types';

export interface CourseMapModuleDTO {
  slug: string;
  title: string;
  position: number;
  status: ModuleStatus;
}

export interface CourseMapCheckpointDTO {
  slug: string;
  title: string;
  status: CheckpointStatus;
  passMark: number | null;
  bestScore: number | null;
}

export interface CourseMapBlockDTO {
  slug: string;
  name: string;
  color: string;
  tint: string;
  position: number;
  pct: number;
  /** Visually "locked" — no module in this block has been unlocked yet (prior block's checkpoint not passed). */
  locked: boolean;
  modules: CourseMapModuleDTO[];
  checkpoint: CourseMapCheckpointDTO | null;
}

export interface CourseMapDTO {
  courseSlug: string;
  courseName: string;
  levelLabel: string;
  diagnostic: CourseMapCheckpointDTO | null;
  blocks: CourseMapBlockDTO[];
}

export async function getCourseMap(userId: number, courseSlug?: string): Promise<CourseMapDTO> {
  const course = courseSlug ? await courseRepo.getCourseBySlug(courseSlug) : await courseRepo.ensureActiveEnrollment(userId);
  if (!course) throw new Error(`Course not found: ${courseSlug ?? '(active)'}`);
  await moduleRepo.ensureFirstModuleUnlocked(userId, course.id);

  const [blocks, modules, checkpoints] = await Promise.all([
    courseRepo.listBlocksForCourse(course.id),
    moduleRepo.listModulesForCourse(course.id),
    courseRepo.listCheckpointsForCourse(course.id),
  ]);
  const [moduleStates, checkpointStates] = await Promise.all([
    moduleRepo.getUserModuleStates(userId, modules.map((m) => m.id)),
    courseRepo.getUserCheckpointStates(userId, checkpoints.map((c) => c.id)),
  ]);

  const diagnosticCp = checkpoints.find((c) => c.kind === 'diagnostic') ?? null;
  const diagnostic: CourseMapCheckpointDTO | null = diagnosticCp
    ? {
        slug: diagnosticCp.slug,
        title: diagnosticCp.title,
        // Diagnostic has no gate (pass_mark=null, §1.5) — always available even with no attempt yet.
        status: checkpointStates.get(diagnosticCp.id)?.status ?? 'available',
        passMark: diagnosticCp.passMark,
        bestScore: checkpointStates.get(diagnosticCp.id)?.bestScore ?? null,
      }
    : null;

  const blockDtos: CourseMapBlockDTO[] = blocks.map((b) => {
    const blockModules = modules.filter((m) => m.blockSlug === b.slug).sort((a, c) => a.position - c.position);
    const modDtos: CourseMapModuleDTO[] = blockModules.map((m) => ({
      slug: m.slug,
      title: m.title,
      position: m.position,
      status: moduleStates.get(m.id)?.status ?? 'locked',
    }));
    const masteredOrCompleted = modDtos.filter((m) => m.status === 'completed' || m.status === 'mastered').length;

    const cp = checkpoints.find((c) => c.blockId === b.id && c.kind === 'block') ?? null;
    const cpState = cp ? checkpointStates.get(cp.id) : undefined;

    return {
      slug: b.slug,
      name: b.name,
      color: b.color,
      tint: b.tint,
      position: b.position,
      pct: blockPct(masteredOrCompleted, modDtos.length),
      locked: modDtos.every((m) => m.status === 'locked'),
      modules: modDtos,
      checkpoint: cp
        ? { slug: cp.slug, title: cp.title, status: cpState?.status ?? 'locked', passMark: cp.passMark, bestScore: cpState?.bestScore ?? null }
        : null,
    };
  });

  return { courseSlug: course.slug, courseName: course.name, levelLabel: course.levelLabel, diagnostic, blocks: blockDtos };
}
