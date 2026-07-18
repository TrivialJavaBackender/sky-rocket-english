/**
 * UC-04 · Progress screen (ARCHITECTURE.md §1.1, §7 `/progress`).
 */
import * as courseRepo from '../repositories/course.repo';
import * as progressRepo from '../repositories/progress.repo';
import * as srsRepo from '../repositories/srs.repo';
import * as activityRepo from '../repositories/activity.repo';
import * as reviewRepo from '../repositories/review.repo';
import { addDays } from '../domain/time';
import { blockPct, computeLongestStreak, computeStreak, grammarReliablePct, retentionPct, vocabKnownPlusPct } from '../domain/progress';

const RETENTION_WINDOW_DAYS = 30;
const STREAK_LOOKBACK_DAYS = 400;

export interface ProgressStatDTO {
  bigLabel: string;
  label: string;
  subLabel: string;
}

export interface ProgressBlockDTO {
  slug: string;
  name: string;
  color: string;
  pct: number;
}

export interface ProgressUpcomingDTO {
  dateLabel: string;
  when: Date;
  title: string;
}

export interface ProgressDTO {
  courseSlug: string;
  /** Added in stage 4 (frontend) — the course-completed banner needs these; every other Progress consumer already had them via getCourseMap on a different page. */
  courseName: string;
  levelLabel: string;
  stats: ProgressStatDTO[];
  blocks: ProgressBlockDTO[];
  upcoming: ProgressUpcomingDTO[];
  courseCompleted: boolean;
}

export async function getProgress(userId: number, courseSlug?: string, now: Date = new Date()): Promise<ProgressDTO> {
  const course = courseSlug ? await courseRepo.getCourseBySlug(courseSlug) : await courseRepo.ensureActiveEnrollment(userId);
  if (!course) throw new Error(`Course not found: ${courseSlug ?? '(active)'}`);

  const [vocabStats, grammarStats, retention, activeDates, blocks, blockProgress, masteredStats, upcomingModuleReviews, dueQueueItems, checkpoints] = await Promise.all([
    progressRepo.getVocabStats(userId, course.id),
    progressRepo.getGrammarStats(userId, course.id),
    srsRepo.getRetentionStats(userId, addDays(now, -RETENTION_WINDOW_DAYS)),
    activityRepo.listActiveDates(userId, addDays(now, -STREAK_LOOKBACK_DAYS)),
    courseRepo.listBlocksForCourse(course.id),
    progressRepo.getBlockProgress(userId, course.id),
    progressRepo.getMasteredModuleStats(userId, course.id),
    reviewRepo.listUpcomingModuleReviews(userId, 5),
    reviewRepo.listDueReviewQueueItems(userId, now, 5),
    courseRepo.listCheckpointsForCourse(course.id),
  ]);

  const streakDays = computeStreak(activeDates, now);
  const longestStreakDays = computeLongestStreak(activeDates);

  const stats: ProgressStatDTO[] = [
    { bigLabel: `${vocabKnownPlusPct(vocabStats.knownPlusInUse, 0, vocabStats.total)}%`, label: 'lexis Known or In use', subLabel: `${vocabStats.knownPlusInUse} / ${vocabStats.total} lexemes` },
    { bigLabel: `${grammarReliablePct(grammarStats.reliable, grammarStats.total)}%`, label: 'constructions Reliable', subLabel: `${grammarStats.reliable} / ${grammarStats.total} constructions` },
    { bigLabel: `${retentionPct(retention.firstTryHits, retention.totalFirstTryReviews)}%`, label: '30-day retention', subLabel: 'flashcard first-try rate' },
    { bigLabel: `${streakDays}`, label: 'day streak', subLabel: `longest: ${longestStreakDays} days` },
  ];

  const blockProgressByBlock = new Map(blockProgress.map((b) => [b.blockId, b]));
  const blockDtos: ProgressBlockDTO[] = blocks.map((b) => {
    const p = blockProgressByBlock.get(b.id);
    return { slug: b.slug, name: b.name, color: b.color, pct: blockPct(p?.completedOrBetter ?? 0, p?.totalModules ?? 0) };
  });

  const upcoming: ProgressUpcomingDTO[] = [
    ...upcomingModuleReviews.map((r) => ({ dateLabel: r.dueAt.toDateString(), when: r.dueAt, title: `${r.moduleTitle} · ${r.stage === 'r7' ? '+7-day' : '+21-day'} review quiz` })),
    ...dueQueueItems.map((i) => ({ dateLabel: i.dueAt.toDateString(), when: i.dueAt, title: `Re-queue · ${i.moduleTitle ?? 'exercise'}` })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  const finalCheckpoint = checkpoints.find((c) => c.kind === 'final') ?? null;
  const finalState = finalCheckpoint ? (await courseRepo.getUserCheckpointStates(userId, [finalCheckpoint.id])).get(finalCheckpoint.id) : undefined;
  const courseCompleted = masteredStats.total > 0 && masteredStats.mastered === masteredStats.total && finalState?.status === 'passed';

  return { courseSlug: course.slug, courseName: course.name, levelLabel: course.levelLabel, stats, blocks: blockDtos, upcoming, courseCompleted };
}
