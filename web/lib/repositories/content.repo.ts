/**
 * Module theory/reading/vocabulary content + per-user vocab/grammar status
 * (ARCHITECTURE §1.2 UC-06..08, §1.6 UC-23 promotion).
 */
import { prisma } from '../db';
import { idToNumber } from '../serialize';
import type { GrammarStatus, ReadingKind, VocabStatus } from '../domain/types';
import type { AudioClipDTO } from './audio.repo';
import type { Prisma } from '@prisma/client';

export interface GrammarSpotlightDTO {
  id: number;
  title: string;
  intro: string | null;
  items: Array<{
    form: string;
    example?: string;
    note: string;
    /** Paradigm grid (conjugation, genders, case endings); see content-schema SpotlightTableSchema. */
    table?: { headers: string[]; rows: string[][] };
    /** Clip for `example` (ARCHITECTURE.md §4.8), attached by lib/use-cases/audio.ts's attachSpotlightAudio — absent until that runs, null when the item has no example or no clip exists yet. */
    audio?: AudioClipDTO | null;
  }>;
  position: number;
}

export interface WatchoutDTO {
  id: number;
  title: string;
  badExample: string;
  goodExample: string;
  note: string | null;
  position: number;
  /** Clip for `goodExample` only — never for `badExample`, which is deliberately-wrong German (ARCHITECTURE.md §4.8). Attached by attachWatchoutAudio. */
  goodAudio?: AudioClipDTO | null;
}

export interface GrammarPointDTO {
  id: number;
  moduleId: number;
  title: string;
  position: number;
  status: GrammarStatus;
  successCount: number;
}

export interface ReadingTextDTO {
  id: number;
  moduleId: number;
  kind: ReadingKind;
  kicker: string | null;
  title: string;
  meta: string | null;
  body: Array<Array<{ t: string } | { g: string }>>;
  wordCount: number | null;
}

export interface GlossDTO {
  id: number;
  readingTextId: number;
  key: string;
  term: string;
  posLabel: string | null;
  definition: string;
  example: string | null;
}

export interface VocabEntryDTO {
  id: number;
  moduleId: number;
  term: string;
  tag: string | null;
  definition: string;
  useCases: string[];
  collocations: string | null;
  registerNote: string | null;
  position: number;
  status: VocabStatus;
  /** Clips for `term` and each `useCases[i]`, by position — attached by attachVocabAudio (ARCHITECTURE.md §4.8). */
  audio?: { term: AudioClipDTO | null; useCases: (AudioClipDTO | null)[] };
}

export async function listSpotlightsForModule(moduleId: number): Promise<GrammarSpotlightDTO[]> {
  const rows = await prisma.grammar_spotlight.findMany({ where: { module_id: moduleId }, orderBy: { position: 'asc' } });
  return rows.map((r) => ({
    id: idToNumber(r.id),
    title: r.title,
    intro: r.intro,
    items: (r.items as unknown as GrammarSpotlightDTO['items']) ?? [],
    position: r.position,
  }));
}

export async function listWatchoutsForModule(moduleId: number): Promise<WatchoutDTO[]> {
  const rows = await prisma.watchout.findMany({ where: { module_id: moduleId }, orderBy: { position: 'asc' } });
  return rows.map((r) => ({ id: idToNumber(r.id), title: r.title, badExample: r.bad_example, goodExample: r.good_example, note: r.note, position: r.position }));
}

export async function listGrammarPointsForModule(userId: number, moduleId: number): Promise<GrammarPointDTO[]> {
  const rows = await prisma.grammar_point.findMany({
    where: { module_id: moduleId },
    include: { user_grammar_state: { where: { user_id: userId } } },
    orderBy: { position: 'asc' },
  });
  return rows.map((r) => {
    const state = r.user_grammar_state[0];
    return {
      id: idToNumber(r.id),
      moduleId: idToNumber(r.module_id),
      title: r.title,
      position: r.position,
      status: (state?.status as GrammarStatus) ?? 'introduced',
      successCount: state?.success_count ?? 0,
    };
  });
}

export async function getGrammarPointById(grammarPointId: number): Promise<GrammarPointDTO | null> {
  const row = await prisma.grammar_point.findUnique({ where: { id: grammarPointId } });
  if (!row) return null;
  return { id: idToNumber(row.id), moduleId: idToNumber(row.module_id), title: row.title, position: row.position, status: 'introduced', successCount: 0 };
}

/** Bumps success_count and recomputes status (domain.nextGrammarStatus) — called from exercise-set use-case on a correct grammar-tagged attempt (UC-23). */
export async function upsertUserGrammarState(userId: number, grammarPointId: number, patch: { status: GrammarStatus; successCount: number }): Promise<void> {
  await prisma.user_grammar_state.upsert({
    where: { user_id_grammar_point_id: { user_id: userId, grammar_point_id: grammarPointId } },
    create: { user_id: userId, grammar_point_id: grammarPointId, status: patch.status, success_count: patch.successCount },
    update: { status: patch.status, success_count: patch.successCount },
  });
}

export async function getUserGrammarState(userId: number, grammarPointId: number): Promise<{ status: GrammarStatus; successCount: number }> {
  const row = await prisma.user_grammar_state.findUnique({ where: { user_id_grammar_point_id: { user_id: userId, grammar_point_id: grammarPointId } } });
  return { status: (row?.status as GrammarStatus) ?? 'introduced', successCount: row?.success_count ?? 0 };
}

function mapReadingText(r: { id: bigint; module_id: bigint; kind: string; kicker: string | null; title: string; meta: string | null; body: Prisma.JsonValue; word_count: number | null }): ReadingTextDTO {
  return {
    id: idToNumber(r.id),
    moduleId: idToNumber(r.module_id),
    kind: r.kind as ReadingKind,
    kicker: r.kicker,
    title: r.title,
    meta: r.meta,
    body: r.body as unknown as ReadingTextDTO['body'],
    wordCount: r.word_count,
  };
}

export async function getReadingText(moduleId: number, kind: ReadingKind): Promise<ReadingTextDTO | null> {
  const row = await prisma.reading_text.findFirst({ where: { module_id: moduleId, kind }, orderBy: { position: 'asc' } });
  return row ? mapReadingText(row) : null;
}

export async function getReadingTextById(id: number): Promise<ReadingTextDTO | null> {
  const row = await prisma.reading_text.findUnique({ where: { id } });
  return row ? mapReadingText(row) : null;
}

export async function listGlossesForReadingText(readingTextId: number): Promise<GlossDTO[]> {
  const rows = await prisma.gloss.findMany({ where: { reading_text_id: readingTextId } });
  return rows.map((g) => ({
    id: idToNumber(g.id),
    readingTextId: idToNumber(g.reading_text_id),
    key: g.key,
    term: g.term,
    posLabel: g.pos_label,
    definition: g.definition,
    example: g.example,
  }));
}

export async function getGlossById(glossId: number): Promise<GlossDTO | null> {
  const g = await prisma.gloss.findUnique({ where: { id: glossId } });
  if (!g) return null;
  return { id: idToNumber(g.id), readingTextId: idToNumber(g.reading_text_id), key: g.key, term: g.term, posLabel: g.pos_label, definition: g.definition, example: g.example };
}

export async function listVocabForModule(userId: number, moduleId: number): Promise<VocabEntryDTO[]> {
  const rows = await prisma.vocab_entry.findMany({
    where: { module_id: moduleId },
    include: { user_vocab_state: { where: { user_id: userId } } },
    orderBy: { position: 'asc' },
  });
  return rows.map((r) => {
    const state = r.user_vocab_state[0];
    return {
      id: idToNumber(r.id),
      moduleId: idToNumber(r.module_id),
      term: r.term,
      tag: r.tag,
      definition: r.definition,
      useCases: Array.isArray(r.use_cases) ? (r.use_cases as string[]) : [],
      collocations: r.collocations,
      registerNote: r.register_note,
      position: r.position,
      status: (state?.status as VocabStatus) ?? 'new',
    };
  });
}

export async function getVocabEntryById(vocabEntryId: number): Promise<VocabEntryDTO | null> {
  const r = await prisma.vocab_entry.findUnique({ where: { id: vocabEntryId } });
  if (!r) return null;
  return {
    id: idToNumber(r.id),
    moduleId: idToNumber(r.module_id),
    term: r.term,
    tag: r.tag,
    definition: r.definition,
    useCases: Array.isArray(r.use_cases) ? (r.use_cases as string[]) : [],
    collocations: r.collocations,
    registerNote: r.register_note,
    position: r.position,
    status: 'new',
  };
}

export async function getUserVocabState(userId: number, vocabEntryId: number): Promise<VocabStatus> {
  const row = await prisma.user_vocab_state.findUnique({ where: { user_id_vocab_entry_id: { user_id: userId, vocab_entry_id: vocabEntryId } } });
  return (row?.status as VocabStatus) ?? 'new';
}

export async function upsertUserVocabState(userId: number, vocabEntryId: number, status: VocabStatus, inUseSubmissionId?: number | null): Promise<void> {
  await prisma.user_vocab_state.upsert({
    where: { user_id_vocab_entry_id: { user_id: userId, vocab_entry_id: vocabEntryId } },
    create: { user_id: userId, vocab_entry_id: vocabEntryId, status, in_use_submission_id: inUseSubmissionId ?? null },
    update: { status, ...(inUseSubmissionId !== undefined ? { in_use_submission_id: inUseSubmissionId } : {}) },
  });
}

/** For UC-23 writing-usage detection: every vocab term for the module the submission's writing_task belongs to, with the learner's current status. */
export async function listVocabForModuleOfWritingTask(userId: number, writingTaskId: number): Promise<VocabEntryDTO[]> {
  const task = await prisma.writing_task.findUnique({ where: { id: writingTaskId } });
  if (!task?.module_id) return [];
  return listVocabForModule(userId, idToNumber(task.module_id));
}
