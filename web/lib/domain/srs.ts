/**
 * Lane 1 — flashcard SRS (ARCHITECTURE.md §6.4). `card_state` is algorithm-
 * agnostic by design (0001 DDL comment: "SM-2 / FSRS both fit"); this is the
 * MVP choice: a small SM-2 variant with 4 ratings (Again/Hard/Good/Easy).
 *
 * The mockup's button captions (Again 10 min / Hard 2 d / Good 4 d / Easy
 * 8 d) were static presentational hints and diverged from what the algorithm
 * actually schedules, which read as the SRS misbehaving. `previewIntervals`
 * now runs the same pure step for all four ratings so the player can label
 * each button with its real next interval.
 *
 * `new`/`learning`/`relearning` all use short, sub-day steps (graduation
 * happens on Good/Easy). `review` is the long-term phase where interval
 * grows multiplicatively by `ease`. This is a pure function — `reviewCard`
 * takes the current state + a rating and returns the next state; no I/O.
 */
import { addDays, addMinutes, startOfDay } from './time';
import type { CardPhase, Rating } from './types';

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const AGAIN_STEP_MINUTES = 10;
/**
 * Hard on an ungraduated card used to schedule 0.5 d, which put the card back
 * 12 h later — usually the next morning, indistinguishable from a fresh new
 * card and enough to make the daily queue look like it never drained. A short
 * same-session step is what Hard means in a learning phase.
 */
const HARD_STEP_MINUTES = 30;
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

/**
 * Day-granularity due date, anchored to startOfDay like the other two lanes
 * (time.ts header). `addDays(now, n)` kept the time of day, so a card graded
 * at 22:00 only came back after 22:00 — study earlier the next day and it
 * silently rolled into the day after, arriving in a clump. Anchoring makes
 * "due today" the stable boolean the rest of the app already assumes.
 */
function dueAfterDays(now: Date, intervalDays: number): Date {
  return startOfDay(addDays(now, Math.max(1, Math.round(intervalDays))));
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
    case 2: // Hard — a longer same-session step, still not graduated.
      return {
        ...base,
        phase: 'learning',
        intervalDays: round2(HARD_STEP_MINUTES / (24 * 60)),
        dueAt: addMinutes(now, HARD_STEP_MINUTES),
        lastReviewedAt: now,
      };
    case 3: // Good — graduate to `review` with a 1-day interval.
      return {
        ...base,
        reps: state.reps + 1,
        phase: 'review',
        intervalDays: GRADUATE_DAYS,
        dueAt: dueAfterDays(now, GRADUATE_DAYS),
        lastReviewedAt: now,
      };
    case 4: { // Easy — graduate straight to `review`, interval taken from ease.
      const interval = Math.max(GRADUATE_DAYS, state.ease);
      return {
        ...base,
        reps: state.reps + 1,
        phase: 'review',
        intervalDays: round2(interval),
        dueAt: dueAfterDays(now, interval),
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
      return { phase: 'review', intervalDays: interval, dueAt: dueAfterDays(now, interval), ease, reps: state.reps + 1, lapses: state.lapses, lastReviewedAt: now };
    }
    case 3: { // Good — standard growth.
      const interval = round2(currentInterval * state.ease);
      return {
        phase: 'review',
        intervalDays: interval,
        dueAt: dueAfterDays(now, interval),
        ease: state.ease,
        reps: state.reps + 1,
        lapses: state.lapses,
        lastReviewedAt: now,
      };
    }
    case 4: { // Easy — bigger growth, ease bonus (no upper clamp — "ease in [1.3, 2.5+]", §6.4).
      const interval = round2(currentInterval * state.ease * 1.3);
      const ease = round2(state.ease + 0.15);
      return { phase: 'review', intervalDays: interval, dueAt: dueAfterDays(now, interval), ease, reps: state.reps + 1, lapses: state.lapses, lastReviewedAt: now };
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

/**
 * Human label for a scheduled step. Sub-day steps are measured from `dueAt`
 * rather than from `intervalDays`, which `card_state` stores as decimal(8,2) —
 * 30 min rounds to 0.02 d and reads back as 29 min. Day-granularity steps use
 * `intervalDays`, since their `dueAt` is anchored to midnight and the wall
 * clock distance to it is not the interval the learner was promised.
 */
export function formatIntervalLabel(next: CardStateOutput, now: Date): string {
  if (next.intervalDays < 1) {
    const minutes = Math.max(1, Math.round((next.dueAt.getTime() - now.getTime()) / 60_000));
    return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
  }
  const days = Math.max(1, Math.round(next.intervalDays));
  return days < 30 ? `${days} d` : `${Math.round(days / 30)} mo`;
}

/**
 * What each of the four buttons would schedule for this exact card — the same
 * pure step the grading path runs, so the player's captions cannot drift from
 * the algorithm the way the static mockup hints did.
 */
export function previewIntervals(state: CardStateInput, now: Date = new Date()): Record<Rating, string> {
  const label = (rating: Rating) => formatIntervalLabel(reviewCard(state, rating, now), now);
  return { 1: label(1), 2: label(2), 3: label(3), 4: label(4) };
}
