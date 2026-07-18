/**
 * Content sync (ARCHITECTURE.md §4): walks content/<course>/module-NN/ and
 * content/<course>/<checkpoint>/ directories, validates every YAML/CSV file against
 * lib/content-schema.ts, and upserts into the content tables.
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
 * Only what's registered in content.config.ts is walked (§4.1) — a module
 * or checkpoint directory that doesn't exist yet is a warning + skip, not
 * an error, since most of the 15-module roadmap is unwritten.
 */

import 'dotenv/config';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parse as parseCsv } from 'csv-parse/sync';
import { z } from 'zod';
import { COURSES, type CheckpointEntry, type ModuleEntry } from '../content.config';
import {
  MetaSchema,
  VocabPackageSchema,
  TheoryPackageSchema,
  ReadingPackageSchema,
  ExercisesPackageSchema,
  WritingPackageSchema,
  AnkiVocabRowSchema,
  AnkiGrammarRowSchema,
  AnkiTransformRowSchema,
  type Meta,
  type VocabEntry,
  type Spotlight,
  type Watchout,
  type ReadingPackage,
  type Gloss,
  type ExerciseEntry,
  type WritingPackage,
  type AnkiVocabRow,
  type AnkiGrammarRow,
  type AnkiTransformRow,
} from '../lib/content-schema';

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

/**
 * Anki-import CSVs open with `#separator:Comma` / `#html:false` comment
 * lines, then a `#Field1,Field2,...` header (also `#`-prefixed). Strip the
 * leading `#` off the header line only, so csv-parse's `comment: '#'`
 * option skips the other two lines and auto-detects columns from the header.
 */
async function readCsvFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith('#') && l.includes(','));
  if (headerIdx === -1) throw new Error(`CSV header row not found in ${filePath}`);
  lines[headerIdx] = lines[headerIdx].slice(1);
  const content = lines.join('\n');
  const records = parseCsv(content, {
    columns: true,
    skip_empty_lines: true,
    comment: '#',
  }) as Record<string, string>[];

  return records.map((row, i) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const issues = result.error.issues.map((iss) => `  ${iss.path.join('.')}: ${iss.message}`).join('\n');
      throw new Error(`Invalid CSV row ${i + 1} in ${filePath}:\n${issues}`);
    }
    return result.data;
  });
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
  const hash = sha256(canonical({ mode: pkg.mode, genre: pkg.genre, prompt: pkg.prompt, model_answer: pkg.model_answer ?? null, checklist }));
  const moduleId = owner.column === 'module_id' ? owner.id : null;
  const checkpointId = owner.column === 'checkpoint_id' ? owner.id : null;

  const existing = await client.query<{ id: number; content_hash: string | null }>(
    `select id, content_hash from writing_task where ${owner.column} = $1 and ident = $2`,
    [owner.id, ident],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `insert into writing_task (module_id, checkpoint_id, mode, genre, prompt_md, model_answer_md, checklist, position, content_hash, ident)
       values ($1,$2,$3::task_mode,$4,$5,$6,$7,$8,$9,$10)`,
      [moduleId, checkpointId, pkg.mode, pkg.genre, pkg.prompt, pkg.model_answer ?? null, JSON.stringify(checklist), 1, hash, ident],
    );
    counter.added++;
  } else if (existing.rows[0].content_hash !== hash) {
    await client.query(
      'update writing_task set mode=$1::task_mode, genre=$2, prompt_md=$3, model_answer_md=$4, checklist=$5, content_hash=$6 where id=$7',
      [pkg.mode, pkg.genre, pkg.prompt, pkg.model_answer ?? null, JSON.stringify(checklist), hash, existing.rows[0].id],
    );
    counter.updated++;
  } else {
    counter.unchanged++;
  }
}

// ───────────────────────────── upserts: flashcard ─────────────────────────────

type NoteType = 'vocab' | 'grammar_cloze' | 'transformation';
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

function vocabFlashcardFields(row: AnkiVocabRow): FlashcardFields {
  const cases = [row.UseCase1, row.UseCase2].filter((s) => s?.trim().length > 0);
  const extraParts: string[] = [];
  if (row.Collocations?.trim()) extraParts.push(`Collocations: ${row.Collocations}`);
  if (row.Register?.trim()) extraParts.push(`Register: ${row.Register}`);
  return { front: row.Term, main: row.Definition, cases, extra: extraParts.join('\n') };
}
function grammarClozeFlashcardFields(row: AnkiGrammarRow): FlashcardFields {
  return { front: row.Text, main: row.Rule, cases: [], extra: row.Hint?.trim() ? `Hint: ${row.Hint}` : '' };
}
function transformFlashcardFields(row: AnkiTransformRow): FlashcardFields {
  const extra = [`Key: ${row.Key}`, row.Note?.trim() || null].filter((x): x is string => Boolean(x)).join(' · ');
  return { front: row.Prompt, main: row.Answer, cases: [], extra };
}

// ───────────────────────────── module driver ─────────────────────────────

async function syncModule(client: Client, courseSlug: string, mod: ModuleEntry, contentRoot: string): Promise<void> {
  const moduleDir = path.join(contentRoot, mod.dir);
  if (!(await pathExists(moduleDir))) {
    console.warn(`! module dir missing, skipping: ${mod.slug} (${moduleDir})`);
    return;
  }

  const moduleRow = await client.query<{ id: number; content_hash: string | null }>(
    `select m.id, m.content_hash from module m join block b on b.id = m.block_id join course c on c.id = b.course_id
     where c.slug = $1 and m.slug = $2`,
    [courseSlug, mod.slug],
  );
  if (moduleRow.rowCount === 0) {
    console.warn(`! module row not found in DB for ${mod.slug} — is 0002_seed_en_c1_skeleton.sql applied?`);
    return;
  }
  const moduleId = moduleRow.rows[0].id;
  const storedHash = moduleRow.rows[0].content_hash;

  const moduleHash = await computePackageHash(moduleDir, ['.yaml', '.csv']);
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
  const exercisesPkg = await readYamlFile(path.join(moduleDir, 'exercises.yaml'), ExercisesPackageSchema);
  const writingPkg = await readYamlFile(path.join(moduleDir, 'writing.yaml'), WritingPackageSchema);
  const vocabCsv = await readCsvFile(path.join(moduleDir, 'anki-vocab.csv'), AnkiVocabRowSchema);
  const grammarCsv = await readCsvFile(path.join(moduleDir, 'anki-grammar.csv'), AnkiGrammarRowSchema);
  const transformCsv = await readCsvFile(path.join(moduleDir, 'anki-transform.csv'), AnkiTransformRowSchema);

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
    await client.query('update module set title=$1, standfirst=$2, goals=$3, content_hash=$4 where id=$5', [
      meta.title,
      meta.standfirst,
      JSON.stringify(meta.goals),
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
    await pruneByNotIn(client, 'exercise', 'module_id', moduleId, 'ident', seenExerciseIdents, counters.exercise);

    // writing_task (one per module)
    const writingIdent = computeWritingIdent(writingPkg, 1, false);
    await upsertWritingTask(client, owner, writingPkg, writingIdent, counters.writing_task);
    await pruneByNotIn(client, 'writing_task', 'module_id', moduleId, 'ident', new Set([writingIdent]), counters.writing_task);

    // flashcard (from the three Anki CSVs)
    const tag = `en-c1::${mod.slug}`;
    const seenFlashcardIdents = new Set<string>();
    for (const row of vocabCsv) {
      const ident = computeFlashcardIdent(tag, 'vocab', row.Term);
      await upsertFlashcard(client, moduleId, 'vocab', ident, vocabFlashcardFields(row), vocabEntryIdByTerm.get(row.Term) ?? null, counters.flashcard);
      seenFlashcardIdents.add(ident);
    }
    for (const row of grammarCsv) {
      const ident = computeFlashcardIdent(tag, 'grammar_cloze', sha1(row.Text));
      await upsertFlashcard(client, moduleId, 'grammar_cloze', ident, grammarClozeFlashcardFields(row), null, counters.flashcard);
      seenFlashcardIdents.add(ident);
    }
    for (const row of transformCsv) {
      const ident = computeFlashcardIdent(tag, 'transformation', sha1(row.Prompt + row.Key));
      await upsertFlashcard(client, moduleId, 'transformation', ident, transformFlashcardFields(row), null, counters.flashcard);
      seenFlashcardIdents.add(ident);
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

// ───────────────────────────── checkpoint driver ─────────────────────────────
// Checkpoints only carry exercises.yaml (+ optional writing.yaml) — no
// vocab/theory/reading/flashcards (content/en-c1/README.md). No checkpoint
// package exists yet as of module-01's ship; this path is exercised only
// once diagnostic/checkpoint-*/final directories are written.

async function syncCheckpoint(client: Client, courseSlug: string, cp: CheckpointEntry, contentRoot: string): Promise<void> {
  const cpDir = path.join(contentRoot, cp.dir);
  if (!(await pathExists(cpDir))) {
    console.warn(`! checkpoint dir missing, skipping: ${cp.slug} (${cpDir})`);
    return;
  }

  const cpRow = await client.query<{ id: number; content_hash: string | null }>(
    `select ck.id, ck.content_hash from checkpoint ck join course c on c.id = ck.course_id where c.slug = $1 and ck.slug = $2`,
    [courseSlug, cp.slug],
  );
  if (cpRow.rowCount === 0) {
    console.warn(`! checkpoint row not found in DB for ${cp.slug} — is 0002_seed_en_c1_skeleton.sql applied?`);
    return;
  }
  const checkpointId = cpRow.rows[0].id;
  const storedHash = cpRow.rows[0].content_hash;

  const cpHash = await computePackageHash(cpDir, ['.yaml']);
  if (storedHash === cpHash) {
    console.log(`[${cp.slug}] unchanged — 0 queries`);
    return;
  }

  const exercisesPkg = await readYamlFile(path.join(cpDir, 'exercises.yaml'), ExercisesPackageSchema);
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
  try {
    for (const course of COURSES) {
      const courseRow = await client.query<{ id: number }>('select id from course where slug = $1', [course.slug]);
      if (courseRow.rowCount === 0) {
        console.warn(`! course not seeded, skipping: ${course.slug} — is 0002_seed_en_c1_skeleton.sql applied?`);
        continue;
      }
      const contentRoot = path.join(REPO_ROOT, course.root);
      for (const mod of course.modules) {
        await syncModule(client, course.slug, mod, contentRoot);
      }
      for (const cp of course.checkpoints) {
        await syncCheckpoint(client, course.slug, cp, contentRoot);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
