/**
 * UC-05 · Unit overview + shared reading/gloss lookup reused by the session
 * runner (UC-06, UC-07). ARCHITECTURE.md §1.2, §7
 * `/course/[courseSlug]/module/[moduleSlug]`.
 *
 * §8 D3: the DB stores reading segments as `{t}` / `{g:key}` (normalized —
 * glosses live in their own table), unlike the mockup's inline gloss
 * objects. This use-case returns the raw paragraphs *and* a separate
 * `key → gloss` dictionary; the client `ReadingText` island does the join
 * on tap, so glosses aren't duplicated into every paragraph payload.
 */
import * as courseRepo from '../repositories/course.repo';
import * as moduleRepo from '../repositories/module.repo';
import * as contentRepo from '../repositories/content.repo';
import * as exerciseRepo from '../repositories/exercise.repo';
import { moduleStatusOnFirstEntry } from '../domain/module-state';
import { nextVocabStatusOnPriorityMark } from '../domain/progress';
import type { GlossDTO, GrammarSpotlightDTO, ReadingTextDTO, VocabEntryDTO, WatchoutDTO } from '../repositories/content.repo';
import type { ExerciseGroup, ReadingKind } from '../domain/types';

export interface UnitSessionCellDTO {
  sessionType: 'prime' | 'input' | 'workout' | 'output';
  position: number;
  title: string;
  plannedMinutes: number;
  cell: 'done' | 'current' | 'todo';
}

export interface UnitLauncherDTO {
  key: ExerciseGroup;
  label: string;
  detail: string;
  itemCount: number;
}

export interface ReadingWithGlossesDTO {
  kind: ReadingKind;
  kicker: string | null;
  title: string;
  meta: string | null;
  wordCount: number | null;
  paragraphs: ReadingTextDTO['body'];
  glosses: Record<string, GlossDTO>;
}

export interface UnitDTO {
  /** Added in stage 4 (frontend) — the unit page's client islands (UnitLaunchers) need the numeric id to pre-fetch per-group exercise sets server-side; nothing upstream of getUnit needed it before. */
  moduleId: number;
  courseSlug: string;
  blockSlug: string;
  blockName: string;
  blockPosition: number;
  moduleSlug: string;
  title: string;
  standfirst: string | null;
  goals: string[];
  sessions: UnitSessionCellDTO[];
  spotlights: GrammarSpotlightDTO[];
  watchouts: WatchoutDTO[];
  reading: ReadingWithGlossesDTO | null;
  vocabTitle: string;
  vocabEntries: VocabEntryDTO[];
  launchers: UnitLauncherDTO[];
}

const LAUNCHER_COPY: Record<ExerciseGroup, { label: string; detail: (types: string) => string }> = {
  grammar: { label: 'Practise the spotlight', detail: (types) => `${types} — practice set` },
  reading: { label: 'Check the reading', detail: (types) => `${types} — practice set` },
  vocab: { label: 'Practise the vocabulary', detail: (types) => `${types} — practice set` },
};

export async function getReadingWithGlosses(moduleId: number, kind: ReadingKind): Promise<ReadingWithGlossesDTO | null> {
  const text = await contentRepo.getReadingText(moduleId, kind);
  if (!text) return null;
  const glosses = await contentRepo.listGlossesForReadingText(text.id);
  const glossMap: Record<string, GlossDTO> = {};
  for (const g of glosses) glossMap[g.key] = g;
  return { kind: text.kind, kicker: text.kicker, title: text.title, meta: text.meta, wordCount: text.wordCount, paragraphs: text.body, glosses: glossMap };
}

async function buildLaunchers(moduleId: number): Promise<UnitLauncherDTO[]> {
  const typeLabels = await exerciseRepo.getExerciseTypeLabels();
  const groups: ExerciseGroup[] = ['grammar', 'reading', 'vocab'];
  const launchers: UnitLauncherDTO[] = [];
  for (const key of groups) {
    const exs = await exerciseRepo.listExercisesForModule(moduleId, { pool: 'core', groupKey: key });
    if (exs.length === 0) continue;
    const labels = [...new Set(exs.map((e) => typeLabels.get(e.typeCode) ?? e.typeCode))];
    launchers.push({ key, label: LAUNCHER_COPY[key].label, detail: LAUNCHER_COPY[key].detail(`${labels.join(' · ')} · ${exs.length} items`), itemCount: exs.length });
  }
  return launchers;
}

/** UC-08 (D6, §8): "mark as priority" in the vocab studio = new → learning, bringing the lexeme into active focus. */
export async function markVocabPriority(userId: number, vocabEntryId: number): Promise<void> {
  const current = await contentRepo.getUserVocabState(userId, vocabEntryId);
  const next = nextVocabStatusOnPriorityMark(current);
  if (next !== current) {
    await contentRepo.upsertUserVocabState(userId, vocabEntryId, next);
  }
}

/**
 * Added in stage 4 (frontend) — thin proxies so the session-runner page
 * (UC-06/UC-08's `theory`/`vocab` steps) can reach this content through the
 * use-case layer rather than importing `lib/repositories/content.repo`
 * directly from `app/` (ARCHITECTURE.md §2 layering: UI → use-cases →
 * repositories). getUnit already fetches the same rows for the unit
 * overview; these exist because a session step needs them addressably on
 * their own, without getUnit's extra work (session-cell/launcher building,
 * the first-entry module-state write).
 */
export async function getModuleTheory(moduleId: number): Promise<{ spotlights: GrammarSpotlightDTO[]; watchouts: WatchoutDTO[] }> {
  const [spotlights, watchouts] = await Promise.all([contentRepo.listSpotlightsForModule(moduleId), contentRepo.listWatchoutsForModule(moduleId)]);
  return { spotlights, watchouts };
}

export async function getModuleVocab(userId: number, moduleId: number): Promise<VocabEntryDTO[]> {
  return contentRepo.listVocabForModule(userId, moduleId);
}

export async function getUnit(userId: number, courseSlug: string, moduleSlug: string): Promise<UnitDTO | null> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) return null;
  const module = await moduleRepo.getModuleWithBlockAndCourseBySlug(course.id, moduleSlug);
  if (!module) return null;

  // UC-05: first entry into a module (upcoming → in_progress).
  const state = await moduleRepo.getUserModuleState(userId, module.id);
  const currentStatus = state?.status ?? 'locked';
  const nextStatus = moduleStatusOnFirstEntry(currentStatus);
  if (nextStatus !== currentStatus || !state?.startedAt) {
    await moduleRepo.upsertUserModuleState(userId, module.id, { status: nextStatus, startedAt: state?.startedAt ?? new Date() });
  }

  const sessions = await moduleRepo.listSessionsForModule(userId, module.id);
  const firstNotDoneIdx = sessions.findIndex((s) => s.status !== 'done');
  const sessionCells: UnitSessionCellDTO[] = sessions.map((s, i) => ({
    sessionType: s.sessionType,
    position: s.position,
    title: s.title,
    plannedMinutes: s.plannedMinutes,
    cell: s.status === 'done' ? 'done' : i === (firstNotDoneIdx === -1 ? sessions.length - 1 : firstNotDoneIdx) ? 'current' : 'todo',
  }));

  const [spotlights, watchouts, reading, vocabEntries, launchers] = await Promise.all([
    contentRepo.listSpotlightsForModule(module.id),
    contentRepo.listWatchoutsForModule(module.id),
    getReadingWithGlosses(module.id, 'main'),
    contentRepo.listVocabForModule(userId, module.id),
    buildLaunchers(module.id),
  ]);

  return {
    moduleId: module.id,
    courseSlug: module.courseSlug,
    blockSlug: module.blockSlug,
    blockName: module.blockName,
    blockPosition: module.blockPosition,
    moduleSlug: module.slug,
    title: module.title,
    standfirst: module.standfirst,
    goals: module.goals,
    sessions: sessionCells,
    spotlights,
    watchouts,
    reading,
    vocabTitle: 'Vocabulary in focus',
    vocabEntries,
    launchers,
  };
}
