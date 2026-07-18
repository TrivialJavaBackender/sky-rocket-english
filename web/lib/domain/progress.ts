/**
 * Aggregates for the Progress screen (ARCHITECTURE.md §1.1 UC-04, §6) and
 * the background vocab/grammar promotion rules (§1.6 UC-23). Pure functions
 * over counts/dates the repository layer has already fetched — no I/O here.
 */
import { addDays, startOfDay } from './time';
import type { GrammarStatus, VocabStatus } from './types';

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** "Known or In use" share of the vocab ladder (New → Learning → Known → In use). */
export function vocabKnownPlusPct(known: number, inUse: number, total: number): number {
  return pct(known + inUse, total);
}

/** "Reliable" share of the construction ladder (Introduced → Practising → Reliable). */
export function grammarReliablePct(reliable: number, total: number): number {
  return pct(reliable, total);
}

/** 30-day flashcard first-try retention: rating!=1 (Again) counted as a "first-try hit" among reviews in the window. */
export function retentionPct(firstTryHits: number, totalFirstTryReviews: number): number {
  return pct(firstTryHits, totalFirstTryReviews);
}

/** Block progress bar: modules completed-or-better ÷ modules in the block. */
export function blockPct(masteredOrCompleted: number, totalModules: number): number {
  return pct(masteredOrCompleted, totalModules);
}

/**
 * Current streak in days, counting back from `today`. A streak "survives"
 * if today just hasn't been logged *yet* (the day isn't over) — so it walks
 * back from yesterday when today has no activity, rather than zeroing out
 * mid-day.
 */
export function computeStreak(activeDates: Date[], today: Date = new Date()): number {
  const activeDays = new Set(activeDates.map((d) => startOfDay(d).getTime()));
  let cursor = startOfDay(today);
  if (!activeDays.has(cursor.getTime())) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (activeDays.has(cursor.getTime())) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive active days ever, independent of "today" — Progress screen's "longest: N days" sub-label. */
export function computeLongestStreak(activeDates: Date[]): number {
  const days = [...new Set(activeDates.map((d) => startOfDay(d).getTime()))].sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let prev: number | null = null;
  for (const d of days) {
    current = prev !== null && d - prev === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    prev = d;
  }
  return longest;
}

// ───────────────────────── UC-23: background promotion ─────────────────────────

/** ≥5 successful applications promotes a construction (PLAN §4, ARCHITECTURE §1.6 UC-23). */
const GRAMMAR_RELIABLE_THRESHOLD = 5;

export function nextGrammarStatus(successCount: number): GrammarStatus {
  if (successCount >= GRAMMAR_RELIABLE_THRESHOLD) return 'reliable';
  if (successCount >= 1) return 'practising';
  return 'introduced';
}

/** A flashcard's SRS interval reaching "mature" (Anki convention: ≥21 days) marks its vocab entry Known. */
export const VOCAB_MATURE_INTERVAL_DAYS = 21;

export function nextVocabStatusOnCardMaturity(current: VocabStatus, intervalDays: number): VocabStatus {
  if (current !== 'new' && current !== 'learning') return current;
  return intervalDays >= VOCAB_MATURE_INTERVAL_DAYS ? 'known' : current;
}

/** D6 (MVP): "mark as priority" in the vocab studio = new → learning (brings it into focus). */
export function nextVocabStatusOnPriorityMark(current: VocabStatus): VocabStatus {
  return current === 'new' ? 'learning' : current;
}

/**
 * A term found in the learner's own writing/speaking submission promotes
 * straight to `in_use`, regardless of its prior rung. Demonstrated use in
 * one's own production is stronger evidence of internalisation than SRS
 * maturity, so this doesn't require passing through `known` first — it can
 * leapfrog it (idempotent: already-`in_use` stays `in_use`).
 */
export function nextVocabStatusOnUsageInWriting(): VocabStatus {
  return 'in_use';
}
