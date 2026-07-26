/**
 * Offline validator + counter for content packages (`/gen-module` Фаза 1–2).
 *
 * Does everything `pnpm sync` does to *reject* a bad package — the same zod
 * schemas, including the language-specific open_cloze determinacy rule — but
 * touches no database. That matters when several sub-agents write modules in
 * parallel: they used to fight over one sync run and one DB, and a half-written
 * neighbour directory failed everybody's validation. Here each agent validates
 * only its own package, and the main agent runs `pnpm sync` once at the end.
 *
 * It also prints every number the module profile (PLAN.md §6) requires to match
 * exactly, so the counts and the schema check are one command instead of two.
 * Text length is one of those numbers, but it isn't just printed: it's a gate —
 * the word count is derived, not authored, so main/extra body length is
 * checked against the [min, max] range in course.yaml's content_profile, and a
 * text outside that range fails the run the same way a schema violation does.
 *
 * Usage:
 *   pnpm validate-content de-a1 module-06 module-07 checkpoint-a
 *   pnpm validate-content de-a1                 # every content dir of the course
 *
 * Exit code 1 if any package fails the schema or falls outside content_profile,
 * so it works as a gate.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';

import {
  MetaSchema,
  VocabPackageSchema,
  TheoryPackageSchema,
  ReadingPackageSchema,
  makeExercisesPackageSchema,
  WritingPackageSchema,
} from '../lib/content-schema';
import { countReadingWords } from '../lib/word-count';

/** `course.yaml`'s optional length gate (lib/course-schema.ts's CourseSchema). */
type ContentProfile = {
  text_main: [number, number];
  text_extra: [number, number];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

async function readYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parseYaml(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `    ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`${path.relative(REPO_ROOT, filePath)}:\n${issues}`);
  }
  return result.data;
}

/** `model_answer` is optional in the schema — say so rather than crashing. */
function describeModel(writing: z.infer<typeof WritingPackageSchema>): string {
  if (!writing.model_answer) return '— (нет)';
  const words = writing.model_answer.trim().split(/\s+/).filter(Boolean).length;
  const target = writing.word_target ? ` · target ${JSON.stringify(writing.word_target)}` : '';
  const off =
    writing.word_target && (words < writing.word_target[0] || words > writing.word_target[1])
      ? '  ✗ вне границ'
      : '';
  return `${words} words${target}${off}`;
}

/** Longest run of identical consecutive answers, to catch "always B" keys. */
function maxRun(values: number[]): number {
  let run = 1;
  let best = values.length ? 1 : 0;
  for (let i = 1; i < values.length; i++) {
    run = values[i] === values[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function byType(items: Array<{ type: string }>): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, x) => {
    acc[x.type] = (acc[x.type] ?? 0) + 1;
    return acc;
  }, {});
}

function fmtCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
}

async function reportModule(
  dir: string,
  language: string,
  contentProfile: ContentProfile | undefined,
): Promise<number> {
  const meta = await readYamlFile(path.join(dir, 'meta.yaml'), MetaSchema);
  const vocab = await readYamlFile(path.join(dir, 'vocab.yaml'), VocabPackageSchema);
  const theory = await readYamlFile(path.join(dir, 'theory.yaml'), TheoryPackageSchema);
  const main = await readYamlFile(path.join(dir, 'text-main.yaml'), ReadingPackageSchema);
  const extra = await readYamlFile(path.join(dir, 'text-extra.yaml'), ReadingPackageSchema);
  const exercises = await readYamlFile(
    path.join(dir, 'exercises.yaml'),
    makeExercisesPackageSchema(language),
  );
  const writing = await readYamlFile(path.join(dir, 'writing.yaml'), WritingPackageSchema);

  const review = exercises.review_pool ?? [];
  console.log(
    `  vocab ${vocab.entries.length} · grammar_points ${meta.grammar_points.length} · ` +
      `spotlights ${theory.spotlights.map((s) => s.items.length).join('+')} ` +
      `(${theory.spotlights.reduce((n, s) => n + s.items.length, 0)} items) · ` +
      `watchouts ${theory.watchouts.length} · cloze_cards ${theory.cloze_cards.length}`,
  );
  console.log(`  core ${exercises.core.length}: ${fmtCounts(byType(exercises.core))}`);
  console.log(`  review_pool ${review.length}: ${fmtCounts(byType(review))}`);

  // The word count is derived (lib/word-count.ts), never authored, so there is
  // no declaration left to reconcile it against. What's worth checking instead
  // is the text's actual length against the range course.yaml declares
  // (content_profile) — that range is the gate; a course without one yet just
  // gets the raw count printed, no verdict.
  let outOfProfile = 0;
  for (const [kind, pkg] of [['main', main], ['extra', extra]] as const) {
    const words = countReadingWords(pkg.body);
    const range = contentProfile?.[kind === 'main' ? 'text_main' : 'text_extra'];
    if (!range) {
      console.log(`  text-${kind} ${words} words`);
      continue;
    }
    const inRange = words >= range[0] && words <= range[1];
    if (!inRange) outOfProfile++;
    console.log(
      `  text-${kind} ${words} words  ${inRange ? '✓' : '✗ ВНЕ ПРОФИЛЯ'} [${range[0]}, ${range[1]}]`,
    );
  }

  for (const type of ['mc_cloze', 'grammar_drill', 'reading_comprehension']) {
    const keys = exercises.core
      .filter((x) => x.type === type)
      .map((x) => (x.content as { answer: number }).answer);
    if (!keys.length) continue;
    const positions = new Set(keys).size;
    console.log(
      `  ${type} keys [${keys.join(',')}] maxRun=${maxRun(keys)} distinct=${positions}` +
        (maxRun(keys) >= 3 ? '  ✗ серия 3+' : ''),
    );
  }

  console.log(`  writing: ${writing.mode} · model_answer ${describeModel(writing)}`);
  return outOfProfile;
}

async function reportCheckpoint(dir: string, language: string): Promise<void> {
  const exercises = await readYamlFile(
    path.join(dir, 'exercises.yaml'),
    makeExercisesPackageSchema(language),
  );
  const writingPath = path.join(dir, 'writing.yaml');
  const writing = existsSync(writingPath)
    ? await readYamlFile(writingPath, WritingPackageSchema)
    : null;

  const review = exercises.review_pool ?? [];
  console.log(`  core ${exercises.core.length}: ${fmtCounts(byType(exercises.core))}`);
  console.log(`  review_pool ${review.length}${review.length ? '  ✗ должен быть пуст' : ' ✓'}`);

  // A checkpoint has no grammar_point column, so the owning module rides the
  // explanation prefix ("M03 · …"). An unprefixed item loses its debrief bucket.
  const owners: Record<string, number> = {};
  for (const x of exercises.core) {
    const owner = /^(M\d{2})/.exec(x.explanation)?.[1] ?? '(без префикса)';
    owners[owner] = (owners[owner] ?? 0) + 1;
  }
  console.log(
    `  по модулям: ${Object.entries(owners)
      .sort()
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
  );

  const keys = exercises.core
    .filter((x) => x.type === 'mc_cloze' || x.type === 'grammar_drill')
    .map((x) => (x.content as { answer: number }).answer);
  if (keys.length) {
    console.log(
      `  mc+drill keys [${keys.join(',')}] maxRun=${maxRun(keys)} distinct=${new Set(keys).size}` +
        (maxRun(keys) >= 3 ? '  ✗ серия 3+' : ''),
    );
  }

  if (writing) {
    console.log(`  writing: ${writing.mode} · model_answer ${describeModel(writing)}`);
  }
}

async function main(): Promise<void> {
  const [slug, ...dirs] = process.argv.slice(2);
  if (!slug) {
    console.error('Usage: pnpm validate-content <course-slug> [dir…]');
    process.exit(2);
  }

  const courseDir = path.join(REPO_ROOT, 'courses', slug);
  const courseYaml = parseYaml(await readFile(path.join(courseDir, 'course.yaml'), 'utf8')) as {
    language: string;
    content_profile?: ContentProfile;
  };
  const language = courseYaml.language;
  const contentProfile = courseYaml.content_profile;

  const contentRoot = path.join(courseDir, 'content');
  const targets = dirs.length ? dirs : (await readdir(contentRoot)).sort();

  console.log(`${slug} (language: ${language}) — ${targets.length} пакет(ов)\n`);
  let failed = 0;
  let outOfProfile = 0;
  for (const name of targets) {
    const dir = path.join(contentRoot, name);
    console.log(`${name}:`);
    try {
      if (existsSync(path.join(dir, 'meta.yaml'))) {
        outOfProfile += await reportModule(dir, language, contentProfile);
      } else {
        await reportCheckpoint(dir, language);
      }
      console.log('  схема ✓');
    } catch (err) {
      failed++;
      console.log(`  схема ✗\n${err instanceof Error ? err.message : String(err)}`);
    }
    console.log('');
  }

  if (failed) {
    console.error(`${failed} пакет(ов) не прошли схему.`);
  }
  if (outOfProfile) {
    console.error(`${outOfProfile} текст(ов) вне профиля длины (content_profile).`);
  }
  if (failed || outOfProfile) {
    process.exit(1);
  }
  console.log('Все пакеты валидны. Скелет и БД не затронуты — их синкает pnpm sync.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
