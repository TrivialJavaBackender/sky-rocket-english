/**
 * Content sync (ARCHITECTURE.md §4): walks courses/<slug>/, upserts the course
 * skeleton from its course.yaml, then validates every module/checkpoint package
 * under courses/<slug>/content/ against lib/content-schema.ts and upserts into
 * the content tables.
 *
 * Idempotent via a two-level sha256 hash (§4.4): a module-level gate hash
 * (raw bytes of every file in the package) skips untouched modules with
 * zero queries; a per-entity hash makes each row's own +added/~updated/
 * =unchanged/-removed count. Rows are keyed by stable natural keys — for
 * exercise/writing_task/flashcard that's the `ident` column added in
 * db/migrations/0003_content_natural_keys.sql (§4.5) — so ids never churn
 * on re-sync and user progress (exercise_attempt, review_queue_item,
 * card_state, module_review) survives content edits and reordering.
 *
 * Uses `pg` directly (not Prisma) — DDL-adjacent bulk upserts run over
 * DIRECT_URL, same as scripts/migrate.ts (ARCHITECTURE §3.3), and several
 * natural keys here are *partial* unique indexes (`where module_id is not
 * null`), which Prisma Client cannot target with a typed upsert.
 *
 * Only the course roots registered in content.config.ts are walked (§4.1); the
 * modules and checkpoints themselves come from each course.yaml. A module or
 * checkpoint directory that doesn't exist yet is a warning + skip, not an error,
 * since a course's map is written long before all its packages are.
 */

import 'dotenv/config';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { COURSE_ROOTS } from '../content.config';
import {
  CourseSchema,
  courseModules,
  modulePlannedMinutes,
  type Course,
  type CourseCheckpointEntry,
  type CourseModuleEntry,
} from '../lib/course-schema';
import {
  MetaSchema,
  VocabPackageSchema,
  TheoryPackageSchema,
  ReadingPackageSchema,
  makeExercisesPackageSchema,
  WritingPackageSchema,
  AudioManifestSchema,
  type Meta,
  type VocabEntry,
  type Spotlight,
  type Watchout,
  type ClozeCard,
  type ReadingPackage,
  type Gloss,
  type ExerciseEntry,
  type KeyWordTransformationContent,
  type WritingPackage,
  type AudioManifestClip,
} from '../lib/content-schema';
import { AUDIO_PROFILE, audioManifestPath, blobFsPath } from '../lib/audio/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─────────────────────────────── helpers ───────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
function sha1(input: string): string {
  return createHash('sha1').update(input, 'utf8').digest('hex');
}

/** Deterministic JSON.stringify (recursively sorted object keys) for stable per-entity hashing. */
function canonical(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

interface Counter {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
}
function newCounter(): Counter {
  return { added: 0, updated: 0, unchanged: 0, removed: 0 };
}
function fmtCounter(c: Counter): string {
  return `+${c.added} ~${c.updated} =${c.unchanged} -${c.removed}`;
}

async function readYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parseYaml(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid content package ${filePath}:\n${issues}`);
  }
  return result.data;
}

/** Module/checkpoint gate hash: sha256 over the raw bytes of every package file, sorted by filename (§4.4). */
async function computePackageHash(dir: string, extensions: string[]): Promise<string> {
  const files = (await readdir(dir)).filter((f) => extensions.some((ext) => f.endsWith(ext))).sort();
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(await readFile(path.join(dir, f)));
  }
  return hash.digest('hex');
}

/** Deletes rows of `table` scoped to `ownerId` whose `keyColumn` isn't in `seen`. Empty `seen` deletes everything in scope. */
async function pruneByNotIn(
  client: Client,
  table: string,
  ownerColumn: string,
  ownerId: number,
  keyColumn: string,
  seen: Set<string>,
  counter: Counter,
): Promise<void> {
  const result = await client.query(
    `delete from ${table} where ${ownerColumn} = $1 and ${keyColumn}::text <> all($2::text[])`,
    [ownerId, [...seen]],
  );
  counter.removed += result.rowCount ?? 0;
}

// ───────────────────────── exercise ident (§4.5) ─────────────────────────

function computeExerciseIdent(entry: ExerciseEntry): string {
  if (entry.id) return entry.id;
  const c = entry.content as Record<string, unknown>;
  let keyText: string;
  switch (entry.type) {
    case 'mc_cloze':
    case 'grammar_drill':
    case 'open_cloze':
    case 'word_formation':
      keyText = `${(c.pre as string) ?? ''}${(c.post as string) ?? ''}${(c.prompt as string) ?? ''}`;
      break;
    case 'key_word_transformation':
      keyText = `${c.s1 as string}${c.key as string}`;
      break;
    case 'error_correction':
      keyText = (c.words as string[]).join('');
      break;
    case 'collocation_match':
      keyText = (c.left as string[]).join('') + (c.right as string[]).join('');
      break;
    case 'reading_comprehension':
      keyText = `${c.passage as string}${c.q as string}`;
      break;
  }
  return sha1(`${entry.type}|${keyText}`);
}

/**
 * theory.yaml carries `cloze_cards` — authored sentences with exactly one gap
 * in Anki's cloze syntax. Until 2026-07 sync derived them into
 * note_type=grammar_cloze flashcards, which put a *task* into the SRS deck and
 * leaked the raw {{c1::…}} markup into the player, so the answer sat in plain
 * sight on the front of the card. They are drills, not atoms to recall, so they
 * are synced as open_cloze exercises in the module's review pool instead: the
 * same authored content, but actually gradeable, and a miss opens a lane-2
 * re-queue item like any other exercise. `hint` becomes the base-form prompt —
 * without it several answers are grammatical.
 */
function clozeCardToExercise(card: ClozeCard): ExerciseEntry | null {
  const match = /^([\s\S]*?)\{\{c1::(.+?)\}\}([\s\S]*)$/.exec(card.text);
  if (!match) return null;
  const [, pre, answer, post] = match;
  return {
    type: 'open_cloze',
    group: 'grammar',
    // Explicit ident: computeExerciseIdent keys open_cloze on pre+post, which
    // could collide with an authored item from exercises.yaml, and
    // (module_id, ident) is unique.
    id: `theory-cloze-${sha1(card.text).slice(0, 12)}`,
    content: { pre, post, hint: card.hint, answers: [answer], answer_shown: answer },
    explanation: card.rule,
  };
}

// ───────────────────────────── upserts: grammar_point ─────────────────────────────

async function upsertGrammarPoint(
  client: Client,
  moduleId: number,
  title: string,
  position: number,
  counter: Counter,
): Promise<number> {
  const hash = sha256(canonical({ title, position }));
  const existing = await client.query<{ id: number; content_hash: string | null }>(
    'select id, content_hash from grammar_point where module_id = $1 and title = $2',
    [moduleId, title],
  );
  if (existing.rowCount === 0) {
    const ins = await client.query<{ id: number }>(
      'insert into grammar_point (module_id, title, position, content_hash) values ($1,$2,$3,$4) returning id',
      [moduleId, title, position, hash],
    );
    counter.added++;
    return ins.rows[0].id;
  }
  if (existing.rows[0].content_hash !== hash) {
    await client.query('update grammar_point set position = $1, content_hash = $2 where id = $3', [
      position,
      hash,
      existing.rows[0].id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
  return existing.rows[0].id;
}

// ───────────────────────────── upserts: grammar_spotlight / watchout ─────────────────────────────

async function upsertSpotlight(client: Client, moduleId: number, s: Spotlight, position: number, counter: Counter): Promise<void> {
  const hash = sha256(canonical({ title: s.title, intro: s.intro, items: s.items }));
  const existing = await client.query<{ id: number; content_hash: string | null }>(
    'select id, content_hash from grammar_spotlight where module_id = $1 and position = $2',
    [moduleId, position],
  );
  if (existing.rowCount === 0) {
    await client.query(
      'insert into grammar_spotlight (module_id, title, intro, items, position, content_hash) values ($1,$2,$3,$4,$5,$6)',
      [moduleId, s.title, s.intro, JSON.stringify(s.items), position, hash],
    );
    counter.added++;
  } else if (existing.rows[0].content_hash !== hash) {
    await client.query('update grammar_spotlight set title=$1, intro=$2, items=$3, content_hash=$4 where id=$5', [
      s.title,
      s.intro,
      JSON.stringify(s.items),
      hash,
      existing.rows[0].id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

async function upsertWatchout(client: Client, moduleId: number, w: Watchout, position: number, counter: Counter): Promise<void> {
  const hash = sha256(canonical({ title: w.title, bad: w.bad, good: w.good, note: w.note ?? null }));
  const existing = await client.query<{ id: number; content_hash: string | null }>(
    'select id, content_hash from watchout where module_id = $1 and position = $2',
    [moduleId, position],
  );
  if (existing.rowCount === 0) {
    await client.query(
      'insert into watchout (module_id, title, bad_example, good_example, note, position, content_hash) values ($1,$2,$3,$4,$5,$6,$7)',
      [moduleId, w.title, w.bad, w.good, w.note ?? null, position, hash],
    );
    counter.added++;
  } else if (existing.rows[0].content_hash !== hash) {
    await client.query(
      'update watchout set title=$1, bad_example=$2, good_example=$3, note=$4, content_hash=$5 where id=$6',
      [w.title, w.bad, w.good, w.note ?? null, hash, existing.rows[0].id],
    );
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

// ───────────────────────────── upserts: reading_text / gloss ─────────────────────────────

async function upsertReadingText(client: Client, moduleId: number, pkg: ReadingPackage, position: number, counter: Counter): Promise<number> {
  const hash = sha256(
    canonical({ kicker: pkg.kicker ?? null, title: pkg.title, meta: pkg.meta ?? null, word_count: pkg.word_count ?? null, body: pkg.body }),
  );
  const existing = await client.query<{ id: number; content_hash: string | null }>(
    'select id, content_hash from reading_text where module_id = $1 and kind = $2 and position = $3',
    [moduleId, pkg.kind, position],
  );
  if (existing.rowCount === 0) {
    const ins = await client.query<{ id: number }>(
      `insert into reading_text (module_id, kind, kicker, title, meta, body, word_count, position, content_hash)
       values ($1,$2::reading_kind,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [moduleId, pkg.kind, pkg.kicker ?? null, pkg.title, pkg.meta ?? null, JSON.stringify(pkg.body), pkg.word_count ?? null, position, hash],
    );
    counter.added++;
    return ins.rows[0].id;
  }
  if (existing.rows[0].content_hash !== hash) {
    await client.query('update reading_text set kicker=$1, title=$2, meta=$3, body=$4, word_count=$5, content_hash=$6 where id=$7', [
      pkg.kicker ?? null,
      pkg.title,
      pkg.meta ?? null,
      JSON.stringify(pkg.body),
      pkg.word_count ?? null,
      hash,
      existing.rows[0].id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
  return existing.rows[0].id;
}

/** No content_hash column on gloss (0001 DDL) — compares fields directly. */
async function upsertGloss(client: Client, readingTextId: number, g: Gloss, counter: Counter): Promise<void> {
  const existing = await client.query<{ id: number; term: string; pos_label: string | null; definition: string; example: string | null }>(
    'select id, term, pos_label, definition, example from gloss where reading_text_id = $1 and key = $2',
    [readingTextId, g.key],
  );
  if (existing.rowCount === 0) {
    await client.query(
      'insert into gloss (reading_text_id, key, term, pos_label, definition, example) values ($1,$2,$3,$4,$5,$6)',
      [readingTextId, g.key, g.term, g.pos_label ?? null, g.definition, g.example ?? null],
    );
    counter.added++;
    return;
  }
  const row = existing.rows[0];
  const changed =
    row.term !== g.term || row.pos_label !== (g.pos_label ?? null) || row.definition !== g.definition || row.example !== (g.example ?? null);
  if (changed) {
    await client.query('update gloss set term=$1, pos_label=$2, definition=$3, example=$4 where id=$5', [
      g.term,
      g.pos_label ?? null,
      g.definition,
      g.example ?? null,
      row.id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

async function pruneReadingTexts(client: Client, moduleId: number, seenKeys: Set<string>, counter: Counter): Promise<void> {
  const rows = await client.query<{ id: number; kind: string; position: number }>(
    'select id, kind, position from reading_text where module_id = $1',
    [moduleId],
  );
  for (const r of rows.rows) {
    if (!seenKeys.has(`${r.kind}:${r.position}`)) {
      await client.query('delete from reading_text where id = $1', [r.id]);
      counter.removed++;
    }
  }
}

// ───────────────────────────── upserts: vocab_entry ─────────────────────────────

async function upsertVocabEntry(client: Client, moduleId: number, v: VocabEntry, position: number, counter: Counter): Promise<number> {
  const hash = sha256(
    canonical({ tag: v.tag ?? null, definition: v.definition, use_cases: v.use_cases, collocations: v.collocations ?? null, register: v.register ?? null, position }),
  );
  const existing = await client.query<{ id: number; content_hash: string | null }>(
    'select id, content_hash from vocab_entry where module_id = $1 and term = $2',
    [moduleId, v.term],
  );
  if (existing.rowCount === 0) {
    const ins = await client.query<{ id: number }>(
      `insert into vocab_entry (module_id, term, tag, definition, use_cases, collocations, register_note, position, content_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [moduleId, v.term, v.tag ?? null, v.definition, JSON.stringify(v.use_cases), v.collocations ?? null, v.register ?? null, position, hash],
    );
    counter.added++;
    return ins.rows[0].id;
  }
  if (existing.rows[0].content_hash !== hash) {
    await client.query(
      'update vocab_entry set tag=$1, definition=$2, use_cases=$3, collocations=$4, register_note=$5, position=$6, content_hash=$7 where id=$8',
      [v.tag ?? null, v.definition, JSON.stringify(v.use_cases), v.collocations ?? null, v.register ?? null, position, hash, existing.rows[0].id],
    );
    counter.updated++;
  } else {
    counter.unchanged++;
  }
  return existing.rows[0].id;
}

// ───────────────────────────── upserts: exercise ─────────────────────────────

interface ExerciseOwner {
  column: 'module_id' | 'checkpoint_id';
  id: number;
}

async function upsertExercise(
  client: Client,
  owner: ExerciseOwner,
  entry: ExerciseEntry,
  pool: 'core' | 'review',
  position: number,
  grammarPointIdByTitle: Map<string, number>,
  mainReadingTextId: number | null,
  counter: Counter,
  seenIdents: Set<string>,
): Promise<void> {
  const ident = computeExerciseIdent(entry);
  seenIdents.add(ident);

  let grammarPointId: number | null = null;
  if (entry.grammar_point) {
    grammarPointId = grammarPointIdByTitle.get(entry.grammar_point) ?? null;
    if (grammarPointId === null) {
      console.warn(`  ! exercise ident=${ident.slice(0, 10)} references unknown grammar_point "${entry.grammar_point}"`);
    }
  }
  const readingTextId = entry.type === 'reading_comprehension' ? mainReadingTextId : null;

  const hash = sha256(
    canonical({ type: entry.type, group: entry.group, grammar_point: entry.grammar_point ?? null, content: entry.content, explanation: entry.explanation, pool, position }),
  );

  const moduleId = owner.column === 'module_id' ? owner.id : null;
  const checkpointId = owner.column === 'checkpoint_id' ? owner.id : null;

  const existing = await client.query<{ id: number; content_hash: string | null }>(
    `select id, content_hash from exercise where ${owner.column} = $1 and ident = $2`,
    [owner.id, ident],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `insert into exercise (module_id, checkpoint_id, type_code, pool, group_key, grammar_point_id, reading_text_id, content, explanation, position, content_hash, ident)
       values ($1,$2,$3,$4::exercise_pool,$5::exercise_group,$6,$7,$8,$9,$10,$11,$12)`,
      [moduleId, checkpointId, entry.type, pool, entry.group, grammarPointId, readingTextId, JSON.stringify(entry.content), entry.explanation, position, hash, ident],
    );
    counter.added++;
  } else if (existing.rows[0].content_hash !== hash) {
    await client.query(
      `update exercise set type_code=$1, pool=$2::exercise_pool, group_key=$3::exercise_group, grammar_point_id=$4, reading_text_id=$5, content=$6, explanation=$7, position=$8, content_hash=$9
       where id=$10`,
      [entry.type, pool, entry.group, grammarPointId, readingTextId, JSON.stringify(entry.content), entry.explanation, position, hash, existing.rows[0].id],
    );
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

// ───────────────────────────── upserts: writing_task ─────────────────────────────

function computeWritingIdent(pkg: WritingPackage, position: number, isCheckpoint: boolean): string {
  return isCheckpoint ? `${pkg.genre}|${position}` : pkg.genre;
}

async function upsertWritingTask(
  client: Client,
  owner: ExerciseOwner,
  pkg: WritingPackage,
  ident: string,
  counter: Counter,
): Promise<void> {
  const checklist = pkg.checklist ?? [];
  const [wordMin, wordMax] = pkg.word_target ?? [null, null];
  const hash = sha256(
    canonical({ mode: pkg.mode, genre: pkg.genre, prompt: pkg.prompt, model_answer: pkg.model_answer ?? null, checklist, word_target: pkg.word_target ?? null }),
  );
  const moduleId = owner.column === 'module_id' ? owner.id : null;
  const checkpointId = owner.column === 'checkpoint_id' ? owner.id : null;

  const existing = await client.query<{ id: number; content_hash: string | null }>(
    `select id, content_hash from writing_task where ${owner.column} = $1 and ident = $2`,
    [owner.id, ident],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `insert into writing_task (module_id, checkpoint_id, mode, genre, prompt_md, model_answer_md, checklist, word_min, word_max, position, content_hash, ident)
       values ($1,$2,$3::task_mode,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [moduleId, checkpointId, pkg.mode, pkg.genre, pkg.prompt, pkg.model_answer ?? null, JSON.stringify(checklist), wordMin, wordMax, 1, hash, ident],
    );
    counter.added++;
  } else if (existing.rows[0].content_hash !== hash) {
    await client.query(
      'update writing_task set mode=$1::task_mode, genre=$2, prompt_md=$3, model_answer_md=$4, checklist=$5, word_min=$6, word_max=$7, content_hash=$8 where id=$9',
      [pkg.mode, pkg.genre, pkg.prompt, pkg.model_answer ?? null, JSON.stringify(checklist), wordMin, wordMax, hash, existing.rows[0].id],
    );
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

// ───────────────────────────── upserts: flashcard ─────────────────────────────

type NoteType = 'vocab' | 'vocab_reverse';
interface FlashcardFields {
  front: string;
  main: string;
  cases: string[];
  extra: string;
}

/**
 * ident = tag|note_type|keyPart. §4.5 states the ident formula without the
 * module tag, but flashcard_ident_uniq (0003) is a *global* unique index —
 * without the tag prefix, identical Terms/Texts across two modules would
 * collide. The same section notes "the en-c1::mNN tag gives uniqueness
 * between modules", which only holds if the tag is actually part of the
 * key — so it's folded in here. Documented as a resolved inconsistency in
 * the stage-2 report.
 */
function computeFlashcardIdent(tag: string, noteType: NoteType, keyPart: string): string {
  return `${tag}|${noteType}|${keyPart}`;
}

async function upsertFlashcard(
  client: Client,
  moduleId: number,
  noteType: NoteType,
  ident: string,
  fields: FlashcardFields,
  vocabEntryId: number | null,
  counter: Counter,
): Promise<void> {
  const hash = sha256(canonical({ note_type: noteType, fields, vocab_entry_id: vocabEntryId }));
  const existing = await client.query<{ id: number; content_hash: string | null; archived: boolean }>(
    'select id, content_hash, archived from flashcard where ident = $1',
    [ident],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `insert into flashcard (module_id, note_type, fields, source, vocab_entry_id, archived, content_hash, ident)
       values ($1,$2::note_type,$3,'content',$4,false,$5,$6)`,
      [moduleId, noteType, JSON.stringify(fields), vocabEntryId, hash, ident],
    );
    counter.added++;
    return;
  }
  const row = existing.rows[0];
  if (row.content_hash !== hash || row.archived) {
    await client.query('update flashcard set module_id=$1, fields=$2, vocab_entry_id=$3, archived=false, content_hash=$4 where id=$5', [
      moduleId,
      JSON.stringify(fields),
      vocabEntryId,
      hash,
      row.id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

async function archiveRemovedFlashcards(client: Client, moduleId: number, seenIdents: Set<string>, counter: Counter): Promise<void> {
  const result = await client.query(
    `update flashcard set archived = true where module_id = $1 and archived = false and ident <> all($2::text[])`,
    [moduleId, [...seenIdents]],
  );
  counter.removed += result.rowCount ?? 0;
}

function vocabExtra(entry: VocabEntry): string {
  const parts: string[] = [];
  if (entry.collocations?.trim()) parts.push(`Collocations: ${entry.collocations}`);
  if (entry.register?.trim()) parts.push(`Register: ${entry.register}`);
  return parts.join('\n');
}

/** Recognition: term on the front, definition + use cases on the back. */
function vocabFlashcardFields(entry: VocabEntry): FlashcardFields {
  return { front: entry.term, main: entry.definition, cases: entry.use_cases.slice(0, 2), extra: vocabExtra(entry) };
}

/**
 * Production: definition on the front, term on the back. Use cases stay on the
 * back — they contain the term, so showing them up front would give the answer
 * away; there they confirm the recalled word in context.
 */
function vocabReverseFlashcardFields(entry: VocabEntry): FlashcardFields {
  return { front: entry.definition, main: entry.term, cases: entry.use_cases.slice(0, 2), extra: vocabExtra(entry) };
}

// ───────────────────────────── module driver ─────────────────────────────

/**
 * A module whose `dir` no longer exists but which still carries synced content —
 * the slug was repointed at new material, or the package was removed. Leaving the
 * old rows in place is the one case where "skip" is wrong: the module would keep
 * serving content the repository no longer describes, under whatever title the
 * skeleton now gives it.
 *
 * Flashcards are archived rather than deleted, exactly as in the normal path, so
 * the learner's `card_state` survives. Everything else is module-owned and goes.
 */
async function clearOrphanedModuleContent(client: Client, courseSlug: string, moduleSlug: string): Promise<boolean> {
  const row = await client.query<{ id: number }>(
    `select m.id from module m join block b on b.id = m.block_id join course c on c.id = b.course_id
     where c.slug = $1 and m.slug = $2 and m.content_hash is not null`,
    [courseSlug, moduleSlug],
  );
  if (row.rows.length === 0) return false;
  const moduleId = row.rows[0].id;

  for (const table of ['grammar_point', 'grammar_spotlight', 'watchout', 'reading_text', 'vocab_entry', 'exercise', 'writing_task']) {
    await client.query(`delete from ${table} where module_id = $1`, [moduleId]);
  }
  await client.query('update flashcard set archived = true where module_id = $1 and archived = false', [moduleId]);
  await client.query('update module set content_hash = null where id = $1', [moduleId]);
  return true;
}

async function syncModule(client: Client, course: Course, mod: CourseModuleEntry, contentRoot: string): Promise<void> {
  const moduleDir = path.join(contentRoot, mod.dir);
  if (!(await pathExists(moduleDir))) {
    const cleared = await clearOrphanedModuleContent(client, course.slug, mod.slug);
    console.warn(
      cleared
        ? `! module dir missing: ${mod.slug} — cleared content synced from a previous package (${moduleDir})`
        : `! module dir missing, skipping: ${mod.slug} (${moduleDir})`,
    );
    return;
  }

  const moduleRow = await client.query<{ id: number; content_hash: string | null }>(
    `select m.id, m.content_hash from module m join block b on b.id = m.block_id join course c on c.id = b.course_id
     where c.slug = $1 and m.slug = $2`,
    [course.slug, mod.slug],
  );
  if (moduleRow.rowCount === 0) {
    console.warn(`! module row not found in DB for ${mod.slug} — did syncCourseSkeleton run?`);
    return;
  }
  const moduleId = moduleRow.rows[0].id;
  const storedHash = moduleRow.rows[0].content_hash;

  const moduleHash = await computePackageHash(moduleDir, ['.yaml']);
  if (storedHash === moduleHash) {
    console.log(`[${mod.slug}] unchanged (module content_hash matches) — 0 queries`);
    return;
  }

  // Parse + validate every file up front — a malformed package fails before any write.
  const meta = await readYamlFile(path.join(moduleDir, 'meta.yaml'), MetaSchema);
  const vocabPkg = await readYamlFile(path.join(moduleDir, 'vocab.yaml'), VocabPackageSchema);
  const theoryPkg = await readYamlFile(path.join(moduleDir, 'theory.yaml'), TheoryPackageSchema);
  const textMain = await readYamlFile(path.join(moduleDir, 'text-main.yaml'), ReadingPackageSchema);
  const textExtra = await readYamlFile(path.join(moduleDir, 'text-extra.yaml'), ReadingPackageSchema);
  const exercisesPkg = await readYamlFile(path.join(moduleDir, 'exercises.yaml'), makeExercisesPackageSchema(course.language));
  const writingPkg = await readYamlFile(path.join(moduleDir, 'writing.yaml'), WritingPackageSchema);

  const counters = {
    grammar_point: newCounter(),
    grammar_spotlight: newCounter(),
    watchout: newCounter(),
    reading_text: newCounter(),
    gloss: newCounter(),
    vocab_entry: newCounter(),
    exercise: newCounter(),
    writing_task: newCounter(),
    flashcard: newCounter(),
  };

  await client.query('BEGIN');
  try {
    // module.goals jsonb is stored normalized as [{text, achieved_by}] (§8 D12);
    // bare-string goals default to achieved_by: output (earned when the module closes).
    await client.query('update module set title=$1, standfirst=$2, goals=$3, content_hash=$4 where id=$5', [
      meta.title,
      meta.standfirst,
      JSON.stringify(meta.goals.map((g) => (typeof g === 'string' ? { text: g, achieved_by: 'output' } : g))),
      moduleHash,
      moduleId,
    ]);

    // grammar_point (needed for exercise.grammar_point_id)
    const grammarPointIdByTitle = new Map<string, number>();
    const seenGrammarPoints = new Set<string>();
    for (const [i, title] of meta.grammar_points.entries()) {
      const id = await upsertGrammarPoint(client, moduleId, title, i + 1, counters.grammar_point);
      grammarPointIdByTitle.set(title, id);
      seenGrammarPoints.add(title);
    }
    await pruneByNotIn(client, 'grammar_point', 'module_id', moduleId, 'title', seenGrammarPoints, counters.grammar_point);

    // grammar_spotlight, watchout
    const seenSpotlights = new Set<string>();
    for (const [i, s] of theoryPkg.spotlights.entries()) {
      await upsertSpotlight(client, moduleId, s, i + 1, counters.grammar_spotlight);
      seenSpotlights.add(String(i + 1));
    }
    await pruneByNotIn(client, 'grammar_spotlight', 'module_id', moduleId, 'position', seenSpotlights, counters.grammar_spotlight);

    const seenWatchouts = new Set<string>();
    for (const [i, w] of theoryPkg.watchouts.entries()) {
      await upsertWatchout(client, moduleId, w, i + 1, counters.watchout);
      seenWatchouts.add(String(i + 1));
    }
    await pruneByNotIn(client, 'watchout', 'module_id', moduleId, 'position', seenWatchouts, counters.watchout);

    // reading_text + gloss
    let mainReadingTextId: number | null = null;
    const seenReadingKeys = new Set<string>();
    for (const pkg of [textMain, textExtra]) {
      const id = await upsertReadingText(client, moduleId, pkg, 1, counters.reading_text);
      if (pkg.kind === 'main') mainReadingTextId = id;
      seenReadingKeys.add(`${pkg.kind}:1`);

      const seenGlossKeys = new Set<string>();
      for (const g of pkg.glosses) {
        await upsertGloss(client, id, g, counters.gloss);
        seenGlossKeys.add(g.key);
      }
      await pruneByNotIn(client, 'gloss', 'reading_text_id', id, 'key', seenGlossKeys, counters.gloss);
    }
    await pruneReadingTexts(client, moduleId, seenReadingKeys, counters.reading_text);

    // vocab_entry
    const vocabEntryIdByTerm = new Map<string, number>();
    const seenTerms = new Set<string>();
    for (const [i, v] of vocabPkg.entries.entries()) {
      const id = await upsertVocabEntry(client, moduleId, v, i + 1, counters.vocab_entry);
      vocabEntryIdByTerm.set(v.term, id);
      seenTerms.add(v.term);
    }
    await pruneByNotIn(client, 'vocab_entry', 'module_id', moduleId, 'term', seenTerms, counters.vocab_entry);

    // exercise (core, then review_pool — position numbering restarts per pool)
    const owner: ExerciseOwner = { column: 'module_id', id: moduleId };
    const seenExerciseIdents = new Set<string>();
    let corePos = 1;
    for (const entry of exercisesPkg.core) {
      await upsertExercise(client, owner, entry, 'core', corePos++, grammarPointIdByTitle, mainReadingTextId, counters.exercise, seenExerciseIdents);
    }
    let reviewPos = 1;
    for (const entry of exercisesPkg.review_pool) {
      await upsertExercise(client, owner, entry, 'review', reviewPos++, grammarPointIdByTitle, mainReadingTextId, counters.exercise, seenExerciseIdents);
    }
    // theory.cloze_cards ride the same review pool — they feed module quizzes
    // and r7/r21 reviews, and land in lane 2 when missed.
    for (const card of theoryPkg.cloze_cards) {
      const entry = clozeCardToExercise(card);
      if (entry === null) {
        console.warn(`  ! cloze card has no {{c1::…}} gap, skipped: ${card.text.slice(0, 60)}`);
        continue;
      }
      await upsertExercise(client, owner, entry, 'review', reviewPos++, grammarPointIdByTitle, mainReadingTextId, counters.exercise, seenExerciseIdents);
    }
    await pruneByNotIn(client, 'exercise', 'module_id', moduleId, 'ident', seenExerciseIdents, counters.exercise);

    // writing_task (one per module)
    const writingIdent = computeWritingIdent(writingPkg, 1, false);
    await upsertWritingTask(client, owner, writingPkg, writingIdent, counters.writing_task);
    await pruneByNotIn(client, 'writing_task', 'module_id', moduleId, 'ident', new Set([writingIdent]), counters.writing_task);

    // flashcard — vocabulary only, two cards per entry (0005): `vocab` is
    // recognition (term → definition), `vocab_reverse` is production
    // (definition → term). They are separate rows, not one note shown from
    // either side, because each direction needs its own SRS schedule — knowing
    // a word when you see it says little about producing it.
    //
    // Grammar cloze and transformation notes are gone from the deck: the first
    // now syncs as open_cloze exercises (above), the second always duplicated
    // an exercise that already exists in the module. Both are tasks, and tasks
    // belong to lane 2. archiveRemovedFlashcards retires their rows on the
    // next sync, leaving card_state intact.
    const tag = `${course.slug}::${mod.slug}`;
    const seenFlashcardIdents = new Set<string>();
    for (const entry of vocabPkg.entries) {
      const vocabEntryId = vocabEntryIdByTerm.get(entry.term) ?? null;
      const ident = computeFlashcardIdent(tag, 'vocab', entry.term);
      await upsertFlashcard(client, moduleId, 'vocab', ident, vocabFlashcardFields(entry), vocabEntryId, counters.flashcard);
      seenFlashcardIdents.add(ident);

      const reverseIdent = computeFlashcardIdent(tag, 'vocab_reverse', entry.term);
      await upsertFlashcard(client, moduleId, 'vocab_reverse', reverseIdent, vocabReverseFlashcardFields(entry), vocabEntryId, counters.flashcard);
      seenFlashcardIdents.add(reverseIdent);
    }
    await archiveRemovedFlashcards(client, moduleId, seenFlashcardIdents, counters.flashcard);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  const summary = Object.entries(counters)
    .map(([k, c]) => `${k} ${fmtCounter(c)}`)
    .join(' | ');
  console.log(`[${mod.slug}] ${summary}`);
}

// ───────────────────────────── course skeleton ─────────────────────────────
/**
 * Upserts the course map from courses/<slug>/course.yaml (§4.1): course → block
 * → module → checkpoint, plus the weekly protocol (study_session → session_step)
 * replicated onto every module.
 *
 * This reverses the original rule that sync never creates structure. It used to
 * live in db/migrations/0002 + 0004, which meant a second course — or moving one
 * step by three minutes — required a migration. Everything here is keyed by the
 * natural keys 0001_init.sql already declares unique, so re-running is a no-op
 * and nothing downstream (attempts, card_state, review queues) sees churn.
 *
 * Steps are upserted on (study_session_id, position) rather than deleted and
 * reinserted the way 0004 did: delete cascades user_step_state, so a protocol
 * edit used to wipe the learner's place in the week. Only steps past the new end
 * of a session are pruned.
 */
async function syncCourseSkeleton(client: Client, course: Course, courseYamlBytes: Buffer): Promise<void> {
  const skeletonHash = createHash('sha256').update(courseYamlBytes).digest('hex');

  const existing = await client.query<{ id: number; skeleton_hash: string | null }>(
    'select id, skeleton_hash from course where slug = $1',
    [course.slug],
  );
  if (existing.rowCount !== 0 && existing.rows[0].skeleton_hash === skeletonHash) {
    console.log(`[${course.slug}] skeleton unchanged — 0 queries`);
    return;
  }

  const counters = {
    block: newCounter(),
    module: newCounter(),
    checkpoint: newCounter(),
    study_session: newCounter(),
    session_step: newCounter(),
  };

  await client.query('BEGIN');
  try {
    const courseRow = await client.query<{ id: number }>(
      `insert into course (slug, language, name, level_label, position, skeleton_hash)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (slug) do update set
         language = excluded.language, name = excluded.name,
         level_label = excluded.level_label, position = excluded.position,
         skeleton_hash = excluded.skeleton_hash
       returning id`,
      [course.slug, course.language, course.name, course.level_label, course.position, skeletonHash],
    );
    const courseId = courseRow.rows[0].id;

    // Blocks. Both (course_id, slug) and (course_id, position) are unique, so a
    // reorder would collide mid-statement — park positions out of range first.
    await client.query('update block set position = position + 1000 where course_id = $1', [courseId]);
    const blockIdBySlug = new Map<string, number>();
    for (const [i, block] of course.blocks.entries()) {
      const row = await client.query<{ id: number; inserted: boolean }>(
        `insert into block (course_id, slug, name, color, tint, position, optional)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (course_id, slug) do update set
           name = excluded.name, color = excluded.color,
           tint = excluded.tint, position = excluded.position,
           optional = excluded.optional
         returning id, (xmax = 0) as inserted`,
        [courseId, block.slug, block.name, block.color, block.tint, i + 1, block.optional],
      );
      blockIdBySlug.set(block.slug, row.rows[0].id);
      row.rows[0].inserted ? counters.block.added++ : counters.block.updated++;
    }
    await pruneByNotIn(client, 'block', 'course_id', courseId, 'slug', new Set(blockIdBySlug.keys()), counters.block);

    // Modules. Same position dance, scoped per block. title/standfirst here are
    // the pre-content map; syncModule overwrites them from meta.yaml once the
    // package exists.
    //
    // Caveat: moving a module to a different block is a delete + insert, since
    // the natural key is (block_id, slug) — its progress rows go with it. That is
    // a deliberate restructure of the course, not an edit, so it is left loud
    // rather than papered over.
    const plannedMinutes = modulePlannedMinutes(course);
    const moduleIdBySlug = new Map<string, number>();
    for (const blockId of blockIdBySlug.values()) {
      await client.query('update module set position = position + 1000 where block_id = $1', [blockId]);
    }
    for (const block of course.blocks) {
      const blockId = blockIdBySlug.get(block.slug)!;
      const seen = new Set<string>();
      for (const [i, mod] of block.modules.entries()) {
        const row = await client.query<{ id: number; inserted: boolean }>(
          `insert into module (block_id, slug, title, standfirst, position, planned_minutes)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (block_id, slug) do update set
             title = excluded.title, standfirst = excluded.standfirst,
             position = excluded.position, planned_minutes = excluded.planned_minutes
           returning id, (xmax = 0) as inserted`,
          [blockId, mod.slug, mod.title, mod.standfirst, i + 1, plannedMinutes],
        );
        moduleIdBySlug.set(mod.slug, row.rows[0].id);
        seen.add(mod.slug);
        row.rows[0].inserted ? counters.module.added++ : counters.module.updated++;
      }
      await pruneByNotIn(client, 'module', 'block_id', blockId, 'slug', seen, counters.module);
    }

    // Checkpoints. position is not unique here, so no parking needed.
    const seenCheckpoints = new Set<string>();
    for (const [i, cp] of course.checkpoints.entries()) {
      const blockId = cp.block ? (blockIdBySlug.get(cp.block) ?? null) : null;
      const row = await client.query<{ inserted: boolean }>(
        `insert into checkpoint (course_id, block_id, kind, slug, title, pass_mark, planned_minutes, position)
         values ($1, $2, $3::checkpoint_kind, $4, $5, $6, $7, $8)
         on conflict (course_id, slug) do update set
           block_id = excluded.block_id, kind = excluded.kind, title = excluded.title,
           pass_mark = excluded.pass_mark, planned_minutes = excluded.planned_minutes,
           position = excluded.position
         returning (xmax = 0) as inserted`,
        [courseId, blockId, cp.kind, cp.slug, cp.title, cp.pass_mark, cp.planned_minutes, i],
      );
      seenCheckpoints.add(cp.slug);
      row.rows[0].inserted ? counters.checkpoint.added++ : counters.checkpoint.updated++;
    }
    await pruneByNotIn(client, 'checkpoint', 'course_id', courseId, 'slug', seenCheckpoints, counters.checkpoint);

    // The protocol, replicated onto every module.
    for (const moduleId of moduleIdBySlug.values()) {
      const seenTypes = new Set<string>();
      for (const [i, session] of course.protocol.entries()) {
        const sessionRow = await client.query<{ id: number; inserted: boolean }>(
          `insert into study_session (module_id, session_type, position, title, planned_minutes)
           values ($1, $2::session_type, $3, $4, $5)
           on conflict (module_id, session_type) do update set
             position = excluded.position, title = excluded.title,
             planned_minutes = excluded.planned_minutes
           returning id, (xmax = 0) as inserted`,
          [moduleId, session.type, i + 1, session.title, session.planned_minutes],
        );
        const sessionId = sessionRow.rows[0].id;
        seenTypes.add(session.type);
        sessionRow.rows[0].inserted ? counters.study_session.added++ : counters.study_session.updated++;

        for (const [j, step] of session.steps.entries()) {
          const stepRow = await client.query<{ inserted: boolean }>(
            `insert into session_step (study_session_id, position, kind, title, detail, planned_minutes, config)
             values ($1, $2, $3::step_kind, $4, $5, $6, $7::jsonb)
             on conflict (study_session_id, position) do update set
               kind = excluded.kind, title = excluded.title, detail = excluded.detail,
               planned_minutes = excluded.planned_minutes, config = excluded.config
             returning (xmax = 0) as inserted`,
            [sessionId, j + 1, step.kind, step.title, step.detail ?? null, step.minutes, JSON.stringify(step.config)],
          );
          stepRow.rows[0].inserted ? counters.session_step.added++ : counters.session_step.updated++;
        }
        // Only steps that fell off the end of the session go; everything still
        // in range was updated in place, so user_step_state survives.
        const pruned = await client.query(
          'delete from session_step where study_session_id = $1 and position > $2',
          [sessionId, session.steps.length],
        );
        counters.session_step.removed += pruned.rowCount ?? 0;
      }
      const prunedSessions = await client.query(
        `delete from study_session where module_id = $1 and session_type::text <> all($2::text[])`,
        [moduleId, [...seenTypes]],
      );
      counters.study_session.removed += prunedSessions.rowCount ?? 0;
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  console.log(
    `[${course.slug}] skeleton: block ${fmtCounter(counters.block)} | module ${fmtCounter(counters.module)} | ` +
      `checkpoint ${fmtCounter(counters.checkpoint)} | study_session ${fmtCounter(counters.study_session)} | ` +
      `session_step ${fmtCounter(counters.session_step)}`,
  );
}

// ───────────────────────────── audio manifest ─────────────────────────────
/**
 * Upserts audio_clip from courses/<slug>/audio/manifest.json (ARCHITECTURE.md
 * §4.8), scripts/audio.ts's committed output. No manifest yet is a warning +
 * skip, exactly like a missing module package — en-c1 has no audio and never
 * will, and de-a2's own audio arrives after its content does.
 *
 * `audio_manifest_hash` gates the same way `course.skeleton_hash` does
 * (sha256 of the file's raw bytes): a match skips every upsert. But the
 * *global* per-language prune in main() still needs this course's full set of
 * (text_hash, profile) keys even on that fast path — a clip is not owned by
 * this course (0009's header), so if course A's manifest is unchanged while
 * course B's (same language) changed, the prune at the end of main() must
 * still see A's keys or it would delete A's still-current rows. That set is
 * built from the manifest already sitting in memory, so populating it costs
 * nothing extra even when every DB write below is skipped.
 */
async function syncAudioManifest(client: Client, course: Course, courseDir: string, seen: Map<string, Set<string>>): Promise<void> {
  const manifestPath = audioManifestPath(courseDir);
  if (!(await pathExists(manifestPath))) {
    console.warn(`! no audio manifest, skipping: ${course.slug} (${manifestPath})`);
    return;
  }

  const raw = await readFile(manifestPath);
  const manifestHash = createHash('sha256').update(raw).digest('hex');
  const parsed = AudioManifestSchema.safeParse(JSON.parse(raw.toString('utf8')));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid audio manifest ${manifestPath}:\n${issues}`);
  }
  const manifest = parsed.data;
  if (manifest.lang !== course.language) {
    console.warn(`  ! audio manifest lang "${manifest.lang}" does not match course.language "${course.language}" for ${course.slug} — syncing under the manifest's own lang`);
  }

  // Always contribute this course's keys to `seen`, gate or no gate (see
  // docstring) — cheap, since `manifest` is already parsed in memory.
  const seenForLang = seen.get(manifest.lang) ?? new Set<string>();
  for (const clip of manifest.clips) {
    if (clip.audio[AUDIO_PROFILE]) seenForLang.add(`${clip.text_hash}|${AUDIO_PROFILE}`);
  }
  seen.set(manifest.lang, seenForLang);

  const existing = await client.query<{ audio_manifest_hash: string | null }>('select audio_manifest_hash from course where slug = $1', [course.slug]);
  if (existing.rowCount !== 0 && existing.rows[0].audio_manifest_hash === manifestHash) {
    console.log(`[${course.slug}] audio unchanged — 0 queries`);
    return;
  }

  const counter = newCounter();
  for (const clip of manifest.clips) {
    const outcome = clip.audio[AUDIO_PROFILE];
    if (!outcome) continue; // this clip's manifest entry doesn't carry AUDIO_PROFILE — nothing this app plays
    const blobPath = blobFsPath(outcome.path);
    if (!(await pathExists(blobPath))) {
      // Better a missing ▶ button than a 404 in the player — matches the rest
      // of this file's "no file, no row" rule (e.g. syncModule's gloss/exercise checks).
      console.warn(`  ! audio blob missing on disk, skipping row: ${outcome.path}`);
      continue;
    }
    await upsertAudioClip(client, manifest.lang, manifest.voice, clip, outcome, counter);
  }

  await client.query('update course set audio_manifest_hash = $1 where slug = $2', [manifestHash, course.slug]);
  console.log(`[${course.slug}] audio ${fmtCounter(counter)}`);
}

/** No content_hash column on audio_clip (0009 DDL) — compares fields directly, same as upsertGloss. */
async function upsertAudioClip(
  client: Client,
  lang: string,
  voice: string,
  clip: AudioManifestClip,
  outcome: { key: string; path: string; duration_ms: number; bytes: number },
  counter: Counter,
): Promise<void> {
  const existing = await client.query<{ id: number; clip_key: string; path: string; duration_ms: number; bytes: number; voice: string; source_text: string }>(
    'select id, clip_key, path, duration_ms, bytes, voice, source_text from audio_clip where lang = $1 and text_hash = $2 and profile = $3',
    [lang, clip.text_hash, AUDIO_PROFILE],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `insert into audio_clip (lang, text_hash, profile, clip_key, path, duration_ms, bytes, voice, source_text)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [lang, clip.text_hash, AUDIO_PROFILE, outcome.key, outcome.path, outcome.duration_ms, outcome.bytes, voice, clip.text],
    );
    counter.added++;
    return;
  }
  const row = existing.rows[0];
  // A voice change (0009's header: replacing reference_de.wav regenerates the
  // whole course) keeps the same (lang, text_hash, profile) key but produces
  // a new clip_key/path/voice — so this row updates in place rather than
  // being reached only through insert.
  const changed =
    row.clip_key !== outcome.key ||
    row.path !== outcome.path ||
    row.duration_ms !== outcome.duration_ms ||
    row.bytes !== outcome.bytes ||
    row.voice !== voice ||
    row.source_text !== clip.text;
  if (changed) {
    await client.query('update audio_clip set clip_key=$1, path=$2, duration_ms=$3, bytes=$4, voice=$5, source_text=$6 where id=$7', [
      outcome.key,
      outcome.path,
      outcome.duration_ms,
      outcome.bytes,
      voice,
      clip.text,
      row.id,
    ]);
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

/**
 * Deletes audio_clip rows for `lang` whose (text_hash, profile) isn't in
 * `seenKeys` — global per language, not per course, because a clip's natural
 * key carries no course reference (0009's header: two German courses can
 * share one recorded sentence). Only ever called from main() for a language
 * at least one manifest was actually read for this run (§ syncAudioManifest
 * docstring) — a course whose manifest doesn't exist yet must never cause
 * another course's rows in the same language to be swept away.
 */
async function pruneAudioClips(client: Client, lang: string, seenKeys: Set<string>, counter: Counter): Promise<void> {
  const result = await client.query(`delete from audio_clip where lang = $1 and (text_hash || '|' || profile) <> all($2::text[])`, [lang, [...seenKeys]]);
  counter.removed += result.rowCount ?? 0;
}

// ───────────────────────────── checkpoint driver ─────────────────────────────
// Checkpoints only carry exercises.yaml (+ optional writing.yaml) — no
// vocab/theory/reading/flashcards (docs/CONTENT-PACKAGE-SCHEMA.md). A course's
// checkpoints are usually written after the block's modules, so a missing
// directory here is routine.

async function syncCheckpoint(
  client: Client,
  course: Course,
  cp: CourseCheckpointEntry,
  contentRoot: string,
): Promise<void> {
  const cpDir = path.join(contentRoot, cp.dir);
  if (!(await pathExists(cpDir))) {
    console.warn(`! checkpoint dir missing, skipping: ${cp.slug} (${cpDir})`);
    return;
  }

  const cpRow = await client.query<{ id: number; content_hash: string | null }>(
    `select ck.id, ck.content_hash from checkpoint ck join course c on c.id = ck.course_id where c.slug = $1 and ck.slug = $2`,
    [course.slug, cp.slug],
  );
  if (cpRow.rowCount === 0) {
    console.warn(`! checkpoint row not found in DB for ${cp.slug} — did syncCourseSkeleton run?`);
    return;
  }
  const checkpointId = cpRow.rows[0].id;
  const storedHash = cpRow.rows[0].content_hash;

  const cpHash = await computePackageHash(cpDir, ['.yaml']);
  if (storedHash === cpHash) {
    console.log(`[${cp.slug}] unchanged — 0 queries`);
    return;
  }

  const exercisesPkg = await readYamlFile(path.join(cpDir, 'exercises.yaml'), makeExercisesPackageSchema(course.language));
  const writingPath = path.join(cpDir, 'writing.yaml');
  const writingPkg = (await pathExists(writingPath)) ? await readYamlFile(writingPath, WritingPackageSchema) : null;

  const counters = { exercise: newCounter(), writing_task: newCounter() };
  const owner: ExerciseOwner = { column: 'checkpoint_id', id: checkpointId };

  await client.query('BEGIN');
  try {
    await client.query('update checkpoint set content_hash = $1 where id = $2', [cpHash, checkpointId]);

    const seenIdents = new Set<string>();
    let corePos = 1;
    for (const entry of exercisesPkg.core) {
      await upsertExercise(client, owner, entry, 'core', corePos++, new Map(), null, counters.exercise, seenIdents);
    }
    let reviewPos = 1;
    for (const entry of exercisesPkg.review_pool) {
      await upsertExercise(client, owner, entry, 'review', reviewPos++, new Map(), null, counters.exercise, seenIdents);
    }
    await pruneByNotIn(client, 'exercise', 'checkpoint_id', checkpointId, 'ident', seenIdents, counters.exercise);

    if (writingPkg) {
      const ident = computeWritingIdent(writingPkg, 1, true);
      await upsertWritingTask(client, owner, writingPkg, ident, counters.writing_task);
      await pruneByNotIn(client, 'writing_task', 'checkpoint_id', checkpointId, 'ident', new Set([ident]), counters.writing_task);
    } else {
      await pruneByNotIn(client, 'writing_task', 'checkpoint_id', checkpointId, 'ident', new Set(), counters.writing_task);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  console.log(`[${cp.slug}] exercise ${fmtCounter(counters.exercise)} | writing_task ${fmtCounter(counters.writing_task)}`);
}

// ───────────────────────────────── main ─────────────────────────────────

function connectionString(): string {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DIRECT_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }
  return url;
}

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  // lang -> set of "text_hash|profile" seen across every course's audio
  // manifest this run — accumulated here (not inside syncAudioManifest) so
  // the prune below can act once, globally per language, after every course
  // has had a chance to contribute (§ syncAudioManifest docstring).
  const audioSeenByLang = new Map<string, Set<string>>();
  try {
    for (const root of COURSE_ROOTS) {
      const courseDir = path.join(REPO_ROOT, root);
      const courseYamlPath = path.join(courseDir, 'course.yaml');
      if (!(await pathExists(courseYamlPath))) {
        console.warn(`! no course.yaml, skipping: ${root}`);
        continue;
      }

      // Read the bytes once: they are both the parse source and the gate hash.
      const courseYamlBytes = await readFile(courseYamlPath);
      const parsed = CourseSchema.safeParse(parseYaml(courseYamlBytes.toString('utf8')));
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
        throw new Error(`Invalid course skeleton ${courseYamlPath}:\n${issues}`);
      }
      const course = parsed.data;

      await syncCourseSkeleton(client, course, courseYamlBytes);
      await syncAudioManifest(client, course, courseDir, audioSeenByLang);

      const contentRoot = path.join(courseDir, 'content');
      for (const mod of courseModules(course)) {
        await syncModule(client, course, mod, contentRoot);
      }
      for (const cp of course.checkpoints) {
        await syncCheckpoint(client, course, cp, contentRoot);
      }
    }

    for (const [lang, seenKeys] of audioSeenByLang) {
      const counter = newCounter();
      await pruneAudioClips(client, lang, seenKeys, counter);
      if (counter.removed > 0) console.log(`[audio:${lang}] pruned ${fmtCounter(counter)}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
