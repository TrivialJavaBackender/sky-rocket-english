/**
 * UC-01 · Dashboard / Today (ARCHITECTURE.md §1.1, §7 `/`). Read-only —
 * bootstraps course enrollment + the first-module unlock as a side effect
 * (both idempotent), everything else is aggregation across the three lanes.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as srsRepo from '../repositories/srs.repo';
import * as reviewRepo from '../repositories/review.repo';
import * as activityRepo from '../repositories/activity.repo';
import { addDays } from '../domain/time';
import { computeStreak } from '../domain/progress';
import type { ProgressStatus, SessionType, StepKind } from '../domain/types';

/** A review_slot item this many days past due counts as "backlog", not just "due today" — drives the overdue banner (UC-01). MVP heuristic, not specified numerically in ARCHITECTURE §1.1. */
const OVERDUE_GRACE_DAYS = 2;
/** Streak lookback window — long enough for any realistic streak, short enough to keep the query cheap. */
const STREAK_LOOKBACK_DAYS = 400;

export interface TodayStepDTO {
  title: string;
  detail: string | null;
  kind: StepKind;
  status: ProgressStatus;
}

export type TodayState = 'session-due' | 'nothing-due' | 'overdue-reviews';

export interface TodayDTO {
  now: Date;
  courseSlug: string;
  courseName: string;
  levelLabel: string;
  streakDays: number;
  cardsDueCount: number;
  queueDueCount: number;
  overdueReviewCount: number;
  todayState: TodayState;
  overdueMessage: string | null;
  currentModule: { slug: string; title: string } | null;
  currentSession: { sessionType: SessionType; position: number; title: string; plannedMinutes: number } | null;
  steps: TodayStepDTO[];
}

export async function getToday(userId: number, now: Date = new Date()): Promise<TodayDTO> {
  const course = await courseRepo.ensureActiveEnrollment(userId);
  await moduleRepo.ensureFirstModuleUnlocked(userId, course.id);
  await moduleRepo.ensureOptionalModulesUnlocked(userId, course.id);

  const [activeDates, cardsDueCount, queueDueCount, overdueReviewCount, currentModule] = await Promise.all([
    activityRepo.listActiveDates(userId, addDays(now, -STREAK_LOOKBACK_DAYS)),
    srsRepo.countDueCards(userId, now),
    reviewRepo.countDueReviewQueueItems(userId, now),
    reviewRepo.countDueReviewQueueItems(userId, addDays(now, -OVERDUE_GRACE_DAYS)),
    moduleRepo.findCurrentModuleForCourse(userId, course.id),
  ]);

  let currentSession: TodayDTO['currentSession'] = null;
  let steps: TodayStepDTO[] = [];
  if (currentModule) {
    const sessions = await moduleRepo.listSessionsForModule(userId, currentModule.id);
    const active = sessions.find((s) => s.status !== 'done') ?? sessions[sessions.length - 1] ?? null;
    if (active) {
      currentSession = { sessionType: active.sessionType, position: active.position, title: active.title, plannedMinutes: active.plannedMinutes };
      const allSteps = await moduleRepo.listStepsForSession(userId, active.id);
      steps = allSteps.filter((s) => s.status !== 'done').map((s) => ({ title: s.title, detail: s.detail, kind: s.kind, status: s.status }));
    }
  }

  const streakDays = computeStreak(activeDates, now);
  const nothingDue = cardsDueCount === 0 && queueDueCount === 0 && steps.length === 0;
  const todayState: TodayState = nothingDue ? 'nothing-due' : overdueReviewCount > 0 ? 'overdue-reviews' : 'session-due';

  return {
    now,
    courseSlug: course.slug,
    courseName: course.name,
    levelLabel: course.levelLabel,
    streakDays,
    cardsDueCount,
    queueDueCount,
    overdueReviewCount,
    todayState,
    overdueMessage:
      overdueReviewCount > 0
        ? 'Retention slips fastest in the first missed week — clearing the backlog first keeps everything else on schedule.'
        : null,
    currentModule: currentModule ? { slug: currentModule.slug, title: currentModule.title } : null,
    currentSession,
    steps,
  };
}
