/**
 * UC-13 · Session runner + UC-14 · Module close (ARCHITECTURE.md §1.3).
 * getSession/advanceStep drive the generic "walk through session_step by
 * position" flow; closeModule is the module_quiz outcome (score already
 * computed by the exercise-set use-case) — it schedules the r7/r21 module
 * reviews, applies the D5 sequential module unlock, and flips the block
 * checkpoint to `available` once every module in the block is completed+.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as activityRepo from '../repositories/activity.repo';
import * as reviewRepo from '../repositories/review.repo';
import { moduleStatusOnPriorModuleCompleted, moduleStatusOnQuizClose } from '../domain/module-state';
import { scheduleModuleReviews as domainScheduleModuleReviews } from '../domain/module-review';
import type { SessionStepDTO, StudySessionDTO } from '../repositories/module.repo';
import type { SessionType } from '../domain/types';

export interface SessionDTO extends StudySessionDTO {
  /** Added in stage 4 (frontend) — the session-runner page's breadcrumb/header needs the module's title; `module` was already fetched here for its id, so surfacing the title too avoids a second lookup from the page. */
  moduleTitle: string;
  moduleSlug: string;
  steps: SessionStepDTO[];
}

export async function getSession(userId: number, courseSlug: string, moduleSlug: string, sessionType: SessionType, now: Date = new Date()): Promise<SessionDTO | null> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) return null;
  const module = await moduleRepo.getModuleBySlug(course.id, moduleSlug);
  if (!module) return null;
  const session = await moduleRepo.getSession(module.id, sessionType, userId);
  if (!session) return null;

  // First open of this session: not_started → in_progress (UC-13).
  if (session.status === 'not_started') {
    await moduleRepo.upsertUserSessionState(userId, session.id, { status: 'in_progress', startedAt: now });
    session.status = 'in_progress';
    session.startedAt = now;
  }

  const steps = await moduleRepo.listStepsForSession(userId, session.id);
  return { ...session, moduleTitle: module.title, moduleSlug: module.slug, steps };
}

export interface AdvanceStepResult {
  sessionClosed: boolean;
  moduleId: number;
  nextSessionOpened: SessionType | null;
}

/** Marks one step done, logs its planned minutes to daily_activity, and — once every step in the session is done — closes the session and opens the next one. */
export async function advanceStep(userId: number, stepId: number, now: Date = new Date()): Promise<AdvanceStepResult> {
  const step = await moduleRepo.getSessionStepById(userId, stepId);
  if (!step) throw new Error(`Session step not found: ${stepId}`);

  await moduleRepo.upsertUserStepState(userId, stepId, { status: 'done', completedAt: now });
  await activityRepo.bumpDailyActivity(userId, { minutes: step.plannedMinutes }, now);

  const allSteps = await moduleRepo.listStepsForSession(userId, step.studySessionId);
  const allDone = allSteps.every((s) => s.id === stepId || s.status === 'done');
  if (!allDone) return { sessionClosed: false, moduleId: 0, nextSessionOpened: null };

  const session = await moduleRepo.getSessionById(userId, step.studySessionId);
  if (!session) return { sessionClosed: true, moduleId: 0, nextSessionOpened: null };

  await moduleRepo.upsertUserSessionState(userId, session.id, { status: 'done', completedAt: now });

  const next = await moduleRepo.getNextSessionInModule(userId, session.moduleId, session.position);
  if (next && next.status === 'not_started') {
    await moduleRepo.upsertUserSessionState(userId, next.id, { status: 'in_progress', startedAt: now });
  }

  return { sessionClosed: true, moduleId: session.moduleId, nextSessionOpened: next?.sessionType ?? null };
}

/**
 * UC-14: module_quiz step finished with `quizScore` (0-100, already computed
 * by the caller from the graded attempts). Module → completed, r7/r21
 * scheduled, D5 sequential unlock of the next module in the block, and the
 * block checkpoint flips to `available` if this was the block's last module.
 */
export async function closeModule(userId: number, moduleId: number, quizScore: number, now: Date = new Date()): Promise<void> {
  await moduleRepo.upsertUserModuleState(userId, moduleId, { status: moduleStatusOnQuizClose(), completedAt: now, quizScore });

  const reviews = domainScheduleModuleReviews(now);
  await reviewRepo.scheduleModuleReviews(userId, moduleId, reviews);

  const module = await moduleRepo.getModuleById(moduleId);
  if (!module) return;

  const next = await moduleRepo.getNextModuleInBlock(module.blockId, module.position);
  if (next) {
    const nextState = await moduleRepo.getUserModuleState(userId, next.id);
    const nextStatus = moduleStatusOnPriorModuleCompleted(nextState?.status ?? 'locked');
    if (nextStatus !== (nextState?.status ?? 'locked')) {
      await moduleRepo.upsertUserModuleState(userId, next.id, { status: nextStatus });
    }
  }

  const blockDone = await moduleRepo.isBlockFullyCompleted(userId, module.blockId);
  if (blockDone) {
    const checkpoint = await courseRepo.getCheckpointForBlock(module.blockId);
    if (checkpoint) {
      const states = await courseRepo.getUserCheckpointStates(userId, [checkpoint.id]);
      if ((states.get(checkpoint.id)?.status ?? 'locked') === 'locked') {
        await courseRepo.markCheckpointAvailable(userId, checkpoint.id);
      }
    }
  }
}
