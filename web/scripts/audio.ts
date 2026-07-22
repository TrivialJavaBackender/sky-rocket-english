/**
 * Course audio generator (ARCHITECTURE.md §4.8; `pnpm audio -- --course de-a2`).
 * Three phases in one command, because tts-mcp's Chatterbox model is loaded
 * once per process — running plan/synth/import as three separate invocations
 * would reload it three times for no benefit:
 *
 *   1. plan   — walk courses/<slug>/content/<dir>/ with the *same* zod
 *      schemas scripts/sync.ts validates against, pull the fixed set of
 *      audio-worthy strings (vocab terms + use cases, spotlight examples,
 *      watchout "good" lines, reading sentences), dedupe by
 *      normalizeAudioText, and write a tts-mcp-shaped phrases.json.
 *   2. synth  — spawn the tts-mcp CLI, which renders anything not already in
 *      its content-addressed cache and writes its own render manifest.
 *   3. import — copy the new blobs into web/public/audio, write this course's
 *      committed courses/<slug>/audio/manifest.json (scripts/sync.ts's input),
 *      and prune stale files.
 *
 * Clips are synthesized *per sentence*, not per paragraph: Chatterbox renders
 * its input in one autoregressive pass with no internal sentence splitting
 * (unlike Piper), and a 400+ character paragraph is exactly the shape that
 * makes an autoregressive TTS model drift or hallucinate mid-clip. Splitting
 * is exactly what lib/domain/audio-text.ts's splitSentences() does; the UI
 * queues a paragraph's sentence clips back-to-back so the *listener* still
 * hears one continuous paragraph (ARCHITECTURE.md §4.8).
 *
 * Addressing is by text, not by (module, position): a clip's identity is
 * sha256(normalizeAudioText(text)), so editing a sentence in YAML orphans the
 * old clip (next sync's warn+skip) rather than silently attaching new text to
 * an old recording. db/migrations/0009's header spells out why in more depth.
 *
 * Flags:
 *   --course <slug>   Limit to one course (default: every course whose
 *                      language is in AUDIO_LANGS).
 *   --module <slug>   Limit to one module within that course. The committed
 *                      manifest for every *other* module is preserved as-is
 *                      (see mergeWithExisting) — this is a partial re-run, not
 *                      a partial course.
 *   --skip-synth       Reuse the previous run's .build/tts-manifest.json
 *                      instead of invoking tts-mcp (useful once everything
 *                      needed is already in tts-mcp's own cache).
 *   --dry-run          Stop after the plan phase and print the report; no
 *                      synthesis, no writes to web/public or the manifest.
 *   --no-prune         Skip deleting orphaned .opus files under
 *                      web/public/audio/<lang>/ once every course is done.
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { COURSE_ROOTS } from '../content.config';
import { CourseSchema, courseModules, type Course, type CourseModuleEntry } from '../lib/course-schema';
import { AUDIO_LANGS, AUDIO_PROFILE, AUDIO_PUBLIC_DIR, WEB_PUBLIC_DIR, audioManifestPath, blobFsPath, hasAudio } from '../lib/audio/config';
import { MAX_SENTENCE_CHARS, normalizeAudioText, paragraphTexts, splitSentences } from '../lib/domain/audio-text';
import {
  AudioManifestSchema,
  ReadingPackageSchema,
  TheoryPackageSchema,
  VocabPackageSchema,
  type AudioManifest,
  type AudioManifestClip,
} from '../lib/content-schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─────────────────────────────── CLI flags ───────────────────────────────
// `--course de-a2` (space-separated value, not `--course=de-a2`) to match the
// plan's own usage example — every other flag here is a bare boolean.

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const COURSE_FILTER = argValue('--course');
const MODULE_FILTER = argValue('--module');
const SKIP_SYNTH = process.argv.includes('--skip-synth');
const DRY_RUN = process.argv.includes('--dry-run');
const NO_PRUNE = process.argv.includes('--no-prune');

const TTS_MCP_BIN = process.env.TTS_MCP_BIN?.trim() || path.join(os.homedir(), 'IdeaProjects', 'tts-mcp', '.venv', 'bin', 'tts-mcp');
const TTS_CACHE_DIR = process.env.TTS_CACHE_DIR?.trim() || path.join(os.homedir(), '.cache', 'tts-mcp');

// ─────────────────────────────── small helpers ───────────────────────────────
// Duplicated from scripts/sync.ts rather than imported: sync.ts doesn't
// export them, and every script in this directory already keeps its own copy
// of connectionString()-sized helpers rather than sharing a utils module.

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
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

// ─────────────────────────────── phase 1: plan ───────────────────────────────

/** One deduplicated string to synthesize, and every place in the content it came from. */
interface PlannedPhrase {
  text: string; // already normalizeAudioText'd
  refs: string[];
}

/**
 * Pulls exactly the fields the plan's coverage table names — vocab term +
 * every use case, spotlight examples, watchout "good" lines, and both
 * texts' sentences — into `planned`, keyed by normalized text so a phrase
 * repeated across modules (or within one) collapses into a single clip with
 * multiple refs. Nothing else is read: exercises.yaml would leak an answer
 * into audio, watchout.bad is deliberately-wrong German, and glosses/
 * collocations/flashcards are next iteration's work (plan's "Что озвучиваем").
 */
async function collectModulePhrases(mod: CourseModuleEntry, moduleDir: string, planned: Map<string, PlannedPhrase>, longSentences: string[]): Promise<void> {
  const add = (rawText: string, ref: string): void => {
    const text = normalizeAudioText(rawText);
    if (!text) return;
    const existing = planned.get(text);
    if (existing) existing.refs.push(ref);
    else planned.set(text, { text, refs: [ref] });
    if (text.length > MAX_SENTENCE_CHARS) {
      longSentences.push(`${ref} (${text.length} chars): ${text.slice(0, 80)}…`);
    }
  };

  const vocabPath = path.join(moduleDir, 'vocab.yaml');
  if (await pathExists(vocabPath)) {
    const vocabPkg = await readYamlFile(vocabPath, VocabPackageSchema);
    vocabPkg.entries.forEach((entry, i) => {
      const pos = i + 1;
      add(entry.term, `${mod.slug}|vocab|${pos}|term`);
      entry.use_cases.forEach((useCase, j) => add(useCase, `${mod.slug}|vocab|${pos}|use|${j}`));
    });
  } else {
    console.warn(`  ! ${mod.slug}: vocab.yaml missing, no vocab audio`);
  }

  const theoryPath = path.join(moduleDir, 'theory.yaml');
  if (await pathExists(theoryPath)) {
    const theoryPkg = await readYamlFile(theoryPath, TheoryPackageSchema);
    theoryPkg.spotlights.forEach((spotlight, spotlightIdx) => {
      spotlight.items.forEach((item, itemIdx) => {
        // A table-only item (no `example`) legitimately has nothing to say aloud.
        if (item.example) add(item.example, `${mod.slug}|theory|spotlight|${spotlightIdx + 1}|${itemIdx + 1}|example`);
      });
    });
    theoryPkg.watchouts.forEach((watchout, watchoutIdx) => {
      // Only the ✓ line — watchout.bad is incorrect German and must never be spoken.
      add(watchout.good, `${mod.slug}|theory|watchout|${watchoutIdx + 1}|good`);
    });
  } else {
    console.warn(`  ! ${mod.slug}: theory.yaml missing, no theory audio`);
  }

  const readings: Array<{ kind: 'text-main' | 'text-extra'; filename: string }> = [
    { kind: 'text-main', filename: 'text-main.yaml' },
    { kind: 'text-extra', filename: 'text-extra.yaml' },
  ];
  for (const { kind, filename } of readings) {
    const textPath = path.join(moduleDir, filename);
    if (!(await pathExists(textPath))) {
      console.warn(`  ! ${mod.slug}: ${filename} missing, no ${kind} audio`);
      continue;
    }
    const pkg = await readYamlFile(textPath, ReadingPackageSchema);
    const paragraphs = paragraphTexts(pkg.body, pkg.glosses);
    paragraphs.forEach((paragraphText, paraIdx) => {
      const sentences = splitSentences(paragraphText);
      sentences.forEach((sentence, sentIdx) => add(sentence, `${mod.slug}|${kind}|p${paraIdx + 1}|s${sentIdx + 1}`));
    });
  }
}

// ─────────────────────────────── phase 2: synth ───────────────────────────────

/**
 * Shape of tts-mcp's own `batch --out` manifest — an external tool's format,
 * not one of ours, so it's asserted rather than zod-validated. Only the
 * fields this script actually reads are declared.
 */
interface TtsMcpBatchManifest {
  engine: string;
  voice: string;
  entries: Array<{
    text: string;
    audio: Partial<Record<string, { key: string; path: string; duration_s: number; bytes: number }>>;
  }>;
}

function runSynth(phrasesPath: string, outManifestPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(TTS_MCP_BIN, ['batch', phrasesPath, '--profiles', AUDIO_PROFILE, '--out', outManifestPath], {
      env: { ...process.env, TTS_ENGINE: 'chatterbox' },
      stdio: 'inherit',
    });
    child.on('error', reject); // e.g. TTS_MCP_BIN not found
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tts-mcp batch exited with code ${code}`));
    });
  });
}

async function readTtsManifest(ttsManifestPath: string): Promise<TtsMcpBatchManifest> {
  const raw: unknown = JSON.parse(await readFile(ttsManifestPath, 'utf8'));
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as Record<string, unknown>).entries)) {
    throw new Error(`${ttsManifestPath} does not look like a tts-mcp batch manifest (missing "entries" array)`);
  }
  return raw as TtsMcpBatchManifest;
}

// ─────────────────────────────── phase 3: import ───────────────────────────────

/** Copies only if the destination is missing or a different size — re-running import after a partial run shouldn't re-copy everything that already landed. */
async function copyBlobIfNeeded(src: string, dest: string): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  const srcStat = await stat(src);
  if (await pathExists(dest)) {
    const destStat = await stat(dest);
    if (destStat.size === srcStat.size) return;
  }
  await copyFile(src, dest);
}

/**
 * `--module` re-runs only the targeted module(s), so the freshly built clip
 * list only carries their refs. Folding that into the *committed* manifest
 * means: drop every ref belonging to a targeted module from what's already on
 * disk (an edit may have removed a phrase entirely), then merge in the fresh
 * refs — everything from an untouched module passes through unchanged. A full
 * course run (`MODULE_FILTER` unset) never calls this: it already re-plans
 * every module directory that exists, so its output is complete on its own.
 */
async function mergeWithExisting(courseDir: string, targetSlugs: string[], freshClips: AudioManifestClip[]): Promise<AudioManifestClip[]> {
  const manifestPath = audioManifestPath(courseDir);
  if (!(await pathExists(manifestPath))) return freshClips;

  const parsed = AudioManifestSchema.safeParse(JSON.parse(await readFile(manifestPath, 'utf8')));
  if (!parsed.success) {
    console.warn(`  ! existing manifest ${manifestPath} failed validation, not merging — this run will only write the targeted module(s)`);
    return freshClips;
  }

  const targetSet = new Set(targetSlugs);
  const merged = new Map<string, AudioManifestClip>();
  for (const clip of parsed.data.clips) {
    const keptRefs = clip.refs.filter((r) => !targetSet.has(r.split('|')[0])).sort();
    if (keptRefs.length > 0) merged.set(clip.text_hash, { ...clip, refs: keptRefs });
  }
  for (const clip of freshClips) {
    const prior = merged.get(clip.text_hash);
    merged.set(clip.text_hash, prior ? { ...clip, refs: [...new Set([...prior.refs, ...clip.refs])].sort() } : clip);
  }
  return [...merged.values()];
}

async function importCourse(
  course: Course,
  courseDir: string,
  planned: Map<string, PlannedPhrase>,
  ttsManifestPath: string,
  targetModules: CourseModuleEntry[],
): Promise<{ missing: string[]; totalBytes: number }> {
  const ttsManifest = await readTtsManifest(ttsManifestPath);

  const outcomeByText = new Map<string, { key: string; path: string; duration_s: number; bytes: number }>();
  for (const entry of ttsManifest.entries) {
    const outcome = entry.audio[AUDIO_PROFILE];
    if (outcome) outcomeByText.set(normalizeAudioText(entry.text), outcome);
  }

  const missing: string[] = [];
  const freshClips: AudioManifestClip[] = [];
  let totalBytes = 0;

  for (const phrase of planned.values()) {
    const outcome = outcomeByText.get(phrase.text);
    if (!outcome) {
      missing.push(`refs=[${phrase.refs.join(', ')}] "${phrase.text.slice(0, 60)}${phrase.text.length > 60 ? '…' : ''}" — not in tts-mcp manifest`);
      continue;
    }
    const src = path.join(TTS_CACHE_DIR, 'blobs', outcome.path);
    if (!(await pathExists(src))) {
      missing.push(`refs=[${phrase.refs.join(', ')}] "${phrase.text.slice(0, 60)}${phrase.text.length > 60 ? '…' : ''}" — blob missing at ${src}`);
      continue;
    }
    await copyBlobIfNeeded(src, blobFsPath(outcome.path));

    freshClips.push({
      text: phrase.text,
      text_hash: sha256(phrase.text),
      refs: [...phrase.refs].sort(),
      audio: { [AUDIO_PROFILE]: { key: outcome.key, path: outcome.path, duration_ms: Math.round(outcome.duration_s * 1000), bytes: outcome.bytes } },
    });
    totalBytes += outcome.bytes;
  }

  const finalClips = MODULE_FILTER
    ? await mergeWithExisting(courseDir, targetModules.map((m) => m.slug), freshClips)
    : freshClips;
  finalClips.sort((a, b) => a.text_hash.localeCompare(b.text_hash));

  const manifest: AudioManifest = {
    schema_version: 1,
    lang: course.language,
    engine: ttsManifest.engine,
    voice: ttsManifest.voice,
    clips: finalClips,
  };
  const validated = AudioManifestSchema.parse(manifest); // asserts our own output is well-formed before it's committed

  const manifestPath = audioManifestPath(courseDir);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(validated, null, 2) + '\n', 'utf8');
  console.log(`[${course.slug}] wrote ${manifestPath} (${finalClips.length} clip(s))`);

  return { missing, totalBytes };
}

// ─────────────────────────────── pruning ───────────────────────────────
// Global per language, like scripts/sync.ts's audio_clip prune: a clip's key
// is (lang, text_hash, profile), not (course, ...), and a second course in the
// same language would legitimately reference blobs this course's own run
// didn't touch. Re-reads every course's *committed* manifest fresh from disk
// rather than trusting in-memory state, so this is correct even when only one
// course out of several ran this invocation.

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else files.push(full);
  }
  return files;
}

async function pruneStaleBlobs(langs: Set<string>): Promise<void> {
  for (const lang of langs) {
    const referenced = new Set<string>();
    for (const root of COURSE_ROOTS) {
      const manifestPath = audioManifestPath(path.join(REPO_ROOT, root));
      if (!(await pathExists(manifestPath))) continue;
      const parsed = AudioManifestSchema.safeParse(JSON.parse(await readFile(manifestPath, 'utf8')));
      if (!parsed.success || parsed.data.lang !== lang) continue;
      for (const clip of parsed.data.clips) {
        const outcome = clip.audio[AUDIO_PROFILE];
        if (outcome) referenced.add(outcome.path);
      }
    }

    const langDir = path.join(AUDIO_PUBLIC_DIR, lang);
    if (!(await pathExists(langDir))) continue;
    let removed = 0;
    for (const file of await walkFiles(langDir)) {
      const publicPath = '/' + path.relative(WEB_PUBLIC_DIR, file).split(path.sep).join('/');
      if (!referenced.has(publicPath)) {
        await rm(file);
        removed++;
      }
    }
    console.log(`[prune] ${lang}: ${referenced.size} clip(s) referenced across all courses, removed ${removed} stale file(s) under ${langDir}`);
  }
}

// ─────────────────────────────── report ───────────────────────────────

function printReport(courseSlug: string, planned: Map<string, PlannedPhrase>, longSentences: string[], missing: string[], totalBytes: number | null): void {
  const clipCountByModule = new Map<string, number>();
  for (const clip of planned.values()) {
    for (const moduleSlug of new Set(clip.refs.map((r) => r.split('|')[0]))) {
      clipCountByModule.set(moduleSlug, (clipCountByModule.get(moduleSlug) ?? 0) + 1);
    }
  }

  console.log(`\n[${courseSlug}] audio report`);
  for (const [slug, count] of [...clipCountByModule.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${slug}: ${count} clip(s)`);
  }
  console.log(`  total unique phrases: ${planned.size}`);
  if (totalBytes !== null) console.log(`  total audio weight: ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB`);
  if (missing.length > 0) {
    console.log(`  ! ${missing.length} phrase(s) missing audio:`);
    for (const m of missing) console.log(`    - ${m}`);
  }
  if (longSentences.length > 0) {
    console.log(`  ! ${longSentences.length} sentence(s) over ${MAX_SENTENCE_CHARS} chars — chatterbox risks a mid-clip dropout, consider rewriting:`);
    for (const s of longSentences) console.log(`    - ${s}`);
  }
}

// ─────────────────────────────── course driver ───────────────────────────────

async function runCourse(course: Course, courseDir: string): Promise<void> {
  const targetModules = courseModules(course).filter((m) => !MODULE_FILTER || m.slug === MODULE_FILTER);
  if (MODULE_FILTER && targetModules.length === 0) {
    console.warn(`! [${course.slug}] no module matches --module ${MODULE_FILTER}`);
    return;
  }

  const contentRoot = path.join(courseDir, 'content');
  const planned = new Map<string, PlannedPhrase>();
  const longSentences: string[] = [];

  for (const mod of targetModules) {
    const moduleDir = path.join(contentRoot, mod.dir);
    if (!(await pathExists(moduleDir))) {
      console.warn(`! [${course.slug}] module dir missing, skipping: ${mod.slug} (${moduleDir})`);
      continue;
    }
    await collectModulePhrases(mod, moduleDir, planned, longSentences);
  }

  if (planned.size === 0) {
    console.warn(`! [${course.slug}] nothing to synthesize — no module content found under ${contentRoot}`);
    return;
  }

  const buildDir = path.join(courseDir, 'audio', '.build');
  await mkdir(buildDir, { recursive: true });
  const phrasesPath = path.join(buildDir, 'phrases.json');
  const ttsManifestPath = path.join(buildDir, 'tts-manifest.json');

  // tts-mcp's `ref` is a single string per phrase; our own committed manifest
  // (built in importCourse, below) is what actually carries the full refs[]
  // per deduplicated text, so the first ref here is just a label for a human
  // skimming this intermediate file.
  const phrasesJson = [...planned.values()].map((p) => ({ text: p.text, ref: p.refs[0] }));
  await writeFile(phrasesPath, JSON.stringify(phrasesJson, null, 2) + '\n', 'utf8');

  if (DRY_RUN) {
    console.log(`[${course.slug}] --dry-run: wrote ${phrasesPath}, no synthesis or import`);
    printReport(course.slug, planned, longSentences, [], null);
    return;
  }

  if (!SKIP_SYNTH) {
    console.log(`[${course.slug}] synthesizing ${planned.size} unique phrase(s) via ${TTS_MCP_BIN}...`);
    await runSynth(phrasesPath, ttsManifestPath);
  } else if (!(await pathExists(ttsManifestPath))) {
    throw new Error(`--skip-synth given but no cached tts manifest at ${ttsManifestPath} — run once without --skip-synth first.`);
  } else {
    console.log(`[${course.slug}] --skip-synth: reusing ${ttsManifestPath}`);
  }

  const { missing, totalBytes } = await importCourse(course, courseDir, planned, ttsManifestPath, targetModules);
  printReport(course.slug, planned, longSentences, missing, totalBytes);
}

// ───────────────────────────────── main ─────────────────────────────────

async function resolveCourseTargets(): Promise<Array<{ course: Course; courseDir: string }>> {
  const targets: Array<{ course: Course; courseDir: string }> = [];
  for (const root of COURSE_ROOTS) {
    const courseDir = path.join(REPO_ROOT, root);
    const courseYamlPath = path.join(courseDir, 'course.yaml');
    if (!(await pathExists(courseYamlPath))) continue;

    const parsed = CourseSchema.safeParse(parseYaml(await readFile(courseYamlPath, 'utf8')));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
      throw new Error(`Invalid course skeleton ${courseYamlPath}:\n${issues}`);
    }
    const course = parsed.data;

    if (COURSE_FILTER) {
      if (course.slug === COURSE_FILTER) targets.push({ course, courseDir });
    } else if (hasAudio(course.language)) {
      targets.push({ course, courseDir });
    }
  }

  if (COURSE_FILTER && targets.length === 0) {
    throw new Error(`no course matches --course ${COURSE_FILTER}`);
  }
  // An explicit --course naming a language outside AUDIO_LANGS would commit a
  // manifest the rest of the architecture (hasAudio gating in the use-case
  // layer) never expects to exist — refuse rather than silently doing it.
  for (const { course } of targets) {
    if (COURSE_FILTER && !hasAudio(course.language)) {
      throw new Error(`course "${course.slug}" has language "${course.language}", not in AUDIO_LANGS (${AUDIO_LANGS.join(', ')}) — refusing to generate audio for it`);
    }
  }
  return targets;
}

async function main() {
  const targets = await resolveCourseTargets();
  if (targets.length === 0) {
    console.warn('No course matched — nothing to do.');
    return;
  }

  const touchedLangs = new Set<string>();
  for (const { course, courseDir } of targets) {
    await runCourse(course, courseDir);
    touchedLangs.add(course.language);
  }

  if (!DRY_RUN && !NO_PRUNE) {
    await pruneStaleBlobs(touchedLangs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
