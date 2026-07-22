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
import { computeGoalStatus, computeSessionCells, type GoalStatus, type SessionCellState } from '../domain/session-gating';
import { partBounds, slicePart } from '../domain/content-slicing';
import { paragraphTexts } from '../domain/audio-text';
import {
  resolveAudio,
  attachVocabAudio,
  attachSpotlightAudio,
  attachWatchoutAudio,
  attachReadingAudio,
  paragraphSentences,
  vocabAudioTexts,
  spotlightAudioTexts,
  watchoutAudioTexts,
} from './audio';
import type { GlossDTO, GrammarSpotlightDTO, ReadingTextDTO, VocabEntryDTO, WatchoutDTO } from '../repositories/content.repo';
import type { AudioClipDTO } from './audio';
import type { ExerciseGroup, ModuleGoal, ProgressStatus, ReadingKind, SessionType, StepKind } from '../domain/types';

/** Compact step row inside a session's hub preview — enough for "what's in there" (incl. the Output writing task and extra text) without loading step content. */
export interface UnitStepPreviewDTO {
  kind: StepKind;
  title: string;
  detail: string | null;
  plannedMinutes: number;
  status: ProgressStatus;
}

export interface UnitSessionCellDTO {
  sessionType: SessionType;
  position: number;
  title: string;
  plannedMinutes: number;
  cell: SessionCellState;
  steps: UnitStepPreviewDTO[];
}

/** A module goal + its live status and the session that earns it — the hub's bottom-up goals-progress card (D12). */
export interface UnitGoalDTO extends ModuleGoal {
  status: GoalStatus;
  sessionPosition: number;
  sessionTitle: string;
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
  /** Per paragraph, the clips of whichever of its sentences were synthesized (ARCHITECTURE.md §4.8) — attached by getReadingWithGlosses/getUnit, absent if audio was never resolved for this instance. */
  paragraphAudio?: AudioClipDTO[][];
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
  goals: UnitGoalDTO[];
  sessions: UnitSessionCellDTO[];
  /** The current session's first not-done step — the hub's single "do this next" CTA. Null once every session is done. */
  continueTarget: { sessionType: SessionType; sessionPosition: number; sessionTitle: string; stepTitle: string } | null;
  spotlights: GrammarSpotlightDTO[];
  watchouts: WatchoutDTO[];
  reading: ReadingWithGlossesDTO | null;
  readingExtra: ReadingWithGlossesDTO | null;
  vocabTitle: string;
  vocabEntries: VocabEntryDTO[];
  launchers: UnitLauncherDTO[];
}

const LAUNCHER_COPY: Record<ExerciseGroup, { label: string; detail: (types: string) => string }> = {
  grammar: { label: 'Practise the spotlight', detail: (types) => `${types} — practice set` },
  reading: { label: 'Check the reading', detail: (types) => `${types} — practice set` },
  vocab: { label: 'Practise the vocabulary', detail: (types) => `${types} — practice set` },
};

/** Raw reading + glosses, no audio — shared by getReadingWithGlosses (its own scoped resolveAudio) and getUnit (folds into the hub's single combined resolveAudio call), so both routes split sentences exactly once and identically. */
interface RawReading {
  text: ReadingTextDTO;
  glossMap: Record<string, GlossDTO>;
  sentencesByParagraph: string[][];
}

async function fetchReadingRaw(moduleId: number, kind: ReadingKind): Promise<RawReading | null> {
  const text = await contentRepo.getReadingText(moduleId, kind);
  if (!text) return null;
  const glosses = await contentRepo.listGlossesForReadingText(text.id);
  const glossMap: Record<string, GlossDTO> = {};
  for (const g of glosses) glossMap[g.key] = g;
  const sentencesByParagraph = paragraphSentences(paragraphTexts(text.body, glossMap));
  return { text, glossMap, sentencesByParagraph };
}

function toReadingWithGlossesDTO(raw: RawReading): Omit<ReadingWithGlossesDTO, 'paragraphAudio'> {
  return { kind: raw.text.kind, kicker: raw.text.kicker, title: raw.text.title, meta: raw.text.meta, wordCount: raw.text.wordCount, paragraphs: raw.text.body, glosses: raw.glossMap };
}

export async function getReadingWithGlosses(moduleId: number, kind: ReadingKind, lang: string): Promise<ReadingWithGlossesDTO | null> {
  const raw = await fetchReadingRaw(moduleId, kind);
  if (!raw) return null;
  const clips = await resolveAudio(lang, raw.sentencesByParagraph.flat());
  return { ...toReadingWithGlossesDTO(raw), paragraphAudio: attachReadingAudio(raw.sentencesByParagraph, clips) };
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
export async function getModuleTheory(moduleId: number, lang: string): Promise<{ spotlights: GrammarSpotlightDTO[]; watchouts: WatchoutDTO[] }> {
  const [spotlights, watchouts] = await Promise.all([contentRepo.listSpotlightsForModule(moduleId), contentRepo.listWatchoutsForModule(moduleId)]);
  const clips = await resolveAudio(lang, [...spotlightAudioTexts(spotlights), ...watchoutAudioTexts(watchouts)]);
  return { spotlights: attachSpotlightAudio(spotlights, clips), watchouts: attachWatchoutAudio(watchouts, clips) };
}

export async function getModuleVocab(userId: number, moduleId: number, lang: string): Promise<VocabEntryDTO[]> {
  const entries = await contentRepo.listVocabForModule(userId, moduleId);
  const clips = await resolveAudio(lang, vocabAudioTexts(entries));
  return attachVocabAudio(entries, clips);
}

/** UC-06 dosed theory: step config {"part":P,"of":N} → the P-th balanced slice of the module's ordered spotlights and watchouts (PLAN.md §3: part 1 in Prime, part 2 in Workout). */
export async function getModuleTheorySlice(
  moduleId: number,
  part: number,
  of: number,
  lang: string,
): Promise<{ spotlights: GrammarSpotlightDTO[]; watchouts: WatchoutDTO[]; part: number; of: number }> {
  const { spotlights, watchouts } = await getModuleTheory(moduleId, lang);
  return { spotlights: slicePart(spotlights, part, of), watchouts: slicePart(watchouts, part, of), part, of };
}

/** UC-08 dosed vocabulary: step config {"batch":B,"of":N} → the B-th balanced slice of the module's ordered vocab entries (45 → 15/15/15), plus 1-based range labels for the UI. */
export async function getModuleVocabBatch(
  userId: number,
  moduleId: number,
  batch: number,
  of: number,
  lang: string,
): Promise<{ entries: VocabEntryDTO[]; rangeStart: number; rangeEnd: number; total: number; batch: number; of: number }> {
  const all = await getModuleVocab(userId, moduleId, lang);
  const { start, end } = partBounds(all.length, batch, of);
  return { entries: all.slice(start, end), rangeStart: start + 1, rangeEnd: end, total: all.length, batch, of };
}

export async function getUnit(userId: number, courseSlug: string, moduleSlug: string): Promise<UnitDTO | null> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) return null;
  const module = await moduleRepo.getModuleWithBlockAndCourseBySlug(course.id, moduleSlug);
  if (!module) return null;

  // UC-05: first entry into a module (upcoming → in_progress).
  //
  // Never write a row for a module the learner has no state for. `locked` is
  // the absence of a row, not a fact worth storing, and persisting it here was
  // actively harmful: ensureFirstModuleUnlocked skips a course as soon as *any*
  // user_module_state row exists for it, so one visit to a locked module URL
  // (D14 — the hub route isn't gated) pinned that course's first module at
  // `locked` permanently and it never became clickable on the map.
  const state = await moduleRepo.getUserModuleState(userId, module.id);
  if (state) {
    const nextStatus = moduleStatusOnFirstEntry(state.status);
    if (nextStatus !== state.status || !state.startedAt) {
      await moduleRepo.upsertUserModuleState(userId, module.id, { status: nextStatus, startedAt: state.startedAt ?? new Date() });
    }
  }

  const sessions = await moduleRepo.listSessionsForModule(userId, module.id);
  const cells = computeSessionCells(sessions);

  const allSteps = await moduleRepo.listStepsForModule(userId, module.id);
  const stepsBySession = new Map<number, UnitStepPreviewDTO[]>();
  for (const st of allSteps) {
    const list = stepsBySession.get(st.studySessionId) ?? [];
    list.push({ kind: st.kind, title: st.title, detail: st.detail, plannedMinutes: st.plannedMinutes, status: st.status });
    stepsBySession.set(st.studySessionId, list);
  }

  const sessionCells: UnitSessionCellDTO[] = sessions.map((s, i) => ({
    sessionType: s.sessionType,
    position: s.position,
    title: s.title,
    plannedMinutes: s.plannedMinutes,
    cell: cells[i],
    steps: stepsBySession.get(s.id) ?? [],
  }));

  const currentIdx = cells.indexOf('current');
  let continueTarget: UnitDTO['continueTarget'] = null;
  if (currentIdx !== -1) {
    const current = sessions[currentIdx];
    const nextStep = (stepsBySession.get(current.id) ?? []).find((st) => st.status !== 'done');
    continueTarget = { sessionType: current.sessionType, sessionPosition: current.position, sessionTitle: current.title, stepTitle: nextStep?.title ?? current.title };
  }

  const goals: UnitGoalDTO[] = module.goals.map((g) => {
    const target = sessions.find((s) => s.sessionType === g.achievedBy);
    return {
      ...g,
      status: computeGoalStatus(g.achievedBy, sessions, cells),
      sessionPosition: target?.position ?? sessions.length,
      sessionTitle: target?.title ?? 'Output',
    };
  });

  const [spotlights, watchouts, mainRaw, extraRaw, vocabEntries, launchers] = await Promise.all([
    contentRepo.listSpotlightsForModule(module.id),
    contentRepo.listWatchoutsForModule(module.id),
    fetchReadingRaw(module.id, 'main'),
    fetchReadingRaw(module.id, 'extra'),
    contentRepo.listVocabForModule(userId, module.id),
    buildLaunchers(module.id),
  ]);

  // ARCHITECTURE.md §4.8: the whole hub page shares one resolveAudio round
  // trip rather than one per section — every vocab term/use case, spotlight
  // example, watchout good line, and both texts' sentences collapse into a
  // single `text_hash IN (...)` query (bypassing getReadingWithGlosses'
  // per-call resolveAudio, which would otherwise cost two more).
  const clips = await resolveAudio(course.language, [
    ...vocabAudioTexts(vocabEntries),
    ...spotlightAudioTexts(spotlights),
    ...watchoutAudioTexts(watchouts),
    ...(mainRaw?.sentencesByParagraph.flat() ?? []),
    ...(extraRaw?.sentencesByParagraph.flat() ?? []),
  ]);

  const reading = mainRaw ? { ...toReadingWithGlossesDTO(mainRaw), paragraphAudio: attachReadingAudio(mainRaw.sentencesByParagraph, clips) } : null;
  const readingExtra = extraRaw ? { ...toReadingWithGlossesDTO(extraRaw), paragraphAudio: attachReadingAudio(extraRaw.sentencesByParagraph, clips) } : null;

  return {
    moduleId: module.id,
    courseSlug: module.courseSlug,
    blockSlug: module.blockSlug,
    blockName: module.blockName,
    blockPosition: module.blockPosition,
    moduleSlug: module.slug,
    title: module.title,
    standfirst: module.standfirst,
    goals,
    sessions: sessionCells,
    continueTarget,
    spotlights: attachSpotlightAudio(spotlights, clips),
    watchouts: attachWatchoutAudio(watchouts, clips),
    reading,
    readingExtra,
    vocabTitle: 'Vocabulary in focus',
    vocabEntries: attachVocabAudio(vocabEntries, clips),
    launchers,
  };
}
