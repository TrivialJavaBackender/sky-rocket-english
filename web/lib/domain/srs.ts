/**
 * Lane 1 — flashcard SRS (ARCHITECTURE.md §6.4). `card_state` is algorithm-
 * agnostic by design (0001 DDL comment: "SM-2 / FSRS both fit"); this is the
 * MVP choice: a small SM-2 variant with 4 ratings (Again/Hard/Good/Easy).
 *
 * The mockup's button captions (Again 10 min / Hard 2 d / Good 4 d / Easy
 * 8 d) are presentational hints, not literal outputs of this algorithm
 * (§6.4, §8 D2-adjacent note in §1.4) — actual computed intervals depend on
 * `ease`/`interval_days`/phase and will diverge from those static labels.
 *
 * `new`/`learning`/`relearning` all use short, sub-day steps (graduation
 * happens on Good/Easy). `review` is the long-term phase where interval
 * grows multiplicatively by `ease`. This is a pure function — `reviewCard`
 * takes the current state + a rating and returns the next state; no I/O.
 */
import { addDays, addMinutes } from './time';
import type { CardPhase, Rating } from './types';

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const AGAIN_STEP_MINUTES = 10;
const HARD_STEP_DAYS = 0.5;
const GRADUATE_DAYS = 1;

export interface CardStateInput {
  phase: CardPhase;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface CardStateOutput {
  phase: CardPhase;
  dueAt: Date;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date;
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dueFromIntervalDays(now: Date, intervalDays: number): Date {
  return intervalDays < 1 ? addMinutes(now, intervalDays * 24 * 60) : addDays(now, Math.round(intervalDays));
}

/** SM-2 step for a card currently in a short phase (new/learning/relearning) — not yet graduated to long-term review. */
function reviewShortPhase(state: CardStateInput, rating: Rating, now: Date): CardStateOutput {
  const base = { ease: state.ease, reps: state.reps, lapses: state.lapses };
  switch (rating) {
    case 1: // Again — repeat the shortest step, stay ungraduated.
      return {
        ...base,
        phase: 'learning',
        intervalDays: AGAIN_STEP_MINUTES / (24 * 60),
        dueAt: addMinutes(now, AGAIN_STEP_MINUTES),
        lastReviewedAt: now,
      };
    case 2: // Hard — a longer step, still not graduated.
      return {
        ...base,
        phase: 'learning',
        intervalDays: HARD_STEP_DAYS,
        dueAt: dueFromIntervalDays(now, HARD_STEP_DAYS),
        lastReviewedAt: now,
      };
    case 3: // Good — graduate to `review` with a 1-day interval.
      return {
        ...base,
        reps: state.reps + 1,
        phase: 'review',
        intervalDays: GRADUATE_DAYS,
        dueAt: addDays(now, GRADUATE_DAYS),
        lastReviewedAt: now,
      };
    case 4: { // Easy — graduate straight to `review`, interval taken from ease.
      const interval = Math.max(GRADUATE_DAYS, state.ease);
      return {
        ...base,
        reps: state.reps + 1,
        phase: 'review',
        intervalDays: round2(interval),
        dueAt: addDays(now, Math.round(interval)),
        lastReviewedAt: now,
      };
    }
  }
}

/** SM-2 step for a card already in the long-term `review` phase. */
function reviewLongPhase(state: CardStateInput, rating: Rating, now: Date): CardStateOutput {
  const currentInterval = state.intervalDays > 0 ? state.intervalDays : 1;
  switch (rating) {
    case 1: { // Again — lapse into relearning, ease penalty, lapses++.
      const ease = clampEase(state.ease - 0.2);
      return {
        phase: 'relearning',
        intervalDays: AGAIN_STEP_MINUTES / (24 * 60),
        dueAt: addMinutes(now, AGAIN_STEP_MINUTES),
        ease,
        reps: state.reps,
        lapses: state.lapses + 1,
        lastReviewedAt: now,
      };
    }
    case 2: { // Hard — small growth, ease penalty.
      const interval = round2(currentInterval * 1.2);
      const ease = clampEase(state.ease - 0.15);
      return { phase: 'review', intervalDays: interval, dueAt: addDays(now, Math.round(interval)), ease, reps: state.reps + 1, lapses: state.lapses, lastReviewedAt: now };
    }
    case 3: { // Good — standard growth.
      const interval = round2(currentInterval * state.ease);
      return {
        phase: 'review',
        intervalDays: interval,
        dueAt: addDays(now, Math.round(interval)),
        ease: state.ease,
        reps: state.reps + 1,
        lapses: state.lapses,
        lastReviewedAt: now,
      };
    }
    case 4: { // Easy — bigger growth, ease bonus (no upper clamp — "ease in [1.3, 2.5+]", §6.4).
      const interval = round2(currentInterval * state.ease * 1.3);
      const ease = round2(state.ease + 0.15);
      return { phase: 'review', intervalDays: interval, dueAt: addDays(now, Math.round(interval)), ease, reps: state.reps + 1, lapses: state.lapses, lastReviewedAt: now };
    }
  }
}

export function reviewCard(state: CardStateInput, rating: Rating, now: Date = new Date()): CardStateOutput {
  const inShortPhase = state.phase === 'new' || state.phase === 'learning' || state.phase === 'relearning';
  return inShortPhase ? reviewShortPhase(state, rating, now) : reviewLongPhase(state, rating, now);
}

/** Initial per-card state for a brand-new flashcard entering the deck (flashcards_intro, UC-15 note). */
export function newCardState(): CardStateInput {
  return { phase: 'new', intervalDays: 0, ease: DEFAULT_EASE, reps: 0, lapses: 0 };
}
