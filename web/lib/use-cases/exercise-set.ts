/**
 * UC-09 · Exercise set player + UC-16 · Review Slot + UC-20/21 · harvest
 * (ARCHITECTURE.md §5, §1.2, §1.4, §1.6). `gradeAndRecord` is the single
 * write path for every exercise answer regardless of where it's launched
 * from (session step, launcher, review slot, module quiz, checkpoint) — the
 * `context` argument is what varies.
 */
import * as exerciseRepo from '../repositories/exercise.repo';
import * as reviewRepo from '../repositories/review.repo';
import * as contentRepo from '../repositories/content.repo';
import * as srsRepo from '../repositories/srs.repo';
import * as activityRepo from '../repositories/activity.repo';
import { gradeAttempt, toPublicContent } from '../domain/grading';
import { advanceReviewQueueItem, scheduleNewReviewQueueItem } from '../domain/review-queue';
import { nextGrammarStatus } from '../domain/progress';
import type {
  AttemptContext,
  CollocationMatchContent,
  ErrorCorrectionContent,
  ExerciseContent,
  ExerciseGroup,
  ExercisePool,
  ExerciseTypeCode,
  GivenAnswer,
  GrammarDrillContent,
  KeyWordTransformationContent,
  McClozeContent,
  NoteType,
  OpenClozeContent,
  ReadingComprehensionContent,
  WordFormationContent,
} from '../domain/types';

export interface PublicExerciseDTO {
  id: number;
  typeCode: ExerciseTypeCode;
  /** Answer-stripped content (§5) — safe to serialize straight into a client island. */
  content: unknown;
  moduleId: number | null;
  checkpointId: number | null;
}

function toPublicExercise(e: { id: number; typeCode: ExerciseTypeCode; content: unknown; moduleId: number | null; checkpointId: number | null }): PublicExerciseDTO {
  return { id: e.id, typeCode: e.typeCode, content: toPublicContent(e.typeCode, e.content as ExerciseContent), moduleId: e.moduleId, checkpointId: e.checkpointId };
}

export interface StartExerciseSetParams {
  moduleId?: number;
  checkpointId?: number;
  types?: ExerciseTypeCode[];
  groupKey?: ExerciseGroup;
  pool?: ExercisePool;
  limit?: number;
}

/** Gathers the queue for a session_step's exercise_set config (`{"types":[...]}` / `{"group_key":"vocab"}` / module_quiz's `{"count":10,"pool":"review"}`), a unit launcher, or a checkpoint. */
export async function startExerciseSet(params: StartExerciseSetParams): Promise<PublicExerciseDTO[]> {
  const filter = { types: params.types, groupKey: params.groupKey, pool: params.pool ?? ('core' as ExercisePool), limit: params.limit };
  const rows =
    params.checkpointId != null
      ? await exerciseRepo.listExercisesForCheckpoint(params.checkpointId, filter)
      : params.moduleId != null
        ? await exerciseRepo.listExercisesForModule(params.moduleId, filter)
        : [];
  return rows.map(toPublicExercise);
}

export interface SetProgressDTO {
  /** Per-item correctness for the run in progress; null = not yet answered. Index-aligned with the set. */
  results: Array<boolean | null>;
  /** First unanswered index — where "Resume" should reopen the player. */
  resumeIndex: number;
  answered: number;
  total: number;
}

/**
 * UC-09: how far into this set the learner already is, so an interrupted run
 * can be resumed instead of restarted. Every answer is already persisted as an
 * `exercise_attempt`; what was missing was reading them back, since the player
 * held its position only in component state and lost it on close.
 *
 * Distinguishing the *current* run from earlier ones is done by attempt count
 * rather than by timestamps, which needs no extra table: take the minimum
 * attempt count across the whole set (0 on a first run, N after N complete
 * runs) and treat anything above that minimum as answered in the run in
 * progress. A finished set has a flat count everywhere, so it correctly reports
 * zero progress and the next launch starts a clean retake.
 *
 * Known edge: if a set is re-synced with *new* items added, the newcomers sit
 * at 0 while the rest sit at N, so the older items read as already answered for
 * one run. It self-corrects after that run and never loses data.
 */
export async function computeSetProgress(
  userId: number,
  exercises: PublicExerciseDTO[],
  context: AttemptContext,
): Promise<SetProgressDTO> {
  const total = exercises.length;
  const empty: SetProgressDTO = { results: exercises.map(() => null), resumeIndex: 0, answered: 0, total };
  if (total === 0) return empty;

  const tallies = await exerciseRepo.getAttemptTallies(userId, exercises.map((e) => e.id), context);
  const counts = exercises.map((e) => tallies.get(e.id)?.count ?? 0);
  const base = Math.min(...counts);

  const results = exercises.map((e, i) => (counts[i] > base ? (tallies.get(e.id)?.lastIsCorrect ?? null) : null));
  const answered = results.filter((r) => r !== null).length;
  if (answered === 0) return empty;

  const firstUnanswered = results.findIndex((r) => r === null);
  return { results, resumeIndex: firstUnanswered === -1 ? 0 : firstUnanswered, answered, total };
}

export interface ReviewSlotItemDTO {
  queueItemId: number;
  exercise: PublicExerciseDTO;
}

/** UC-16: the specific exercises behind due review_queue_item rows — a re-attempt of the *same* exercise, not a fresh pick. */
export async function startReviewSlot(userId: number, now: Date = new Date(), limit = 10): Promise<ReviewSlotItemDTO[]> {
  const items = await reviewRepo.listDueReviewQueueItems(userId, now, limit);
  const out: ReviewSlotItemDTO[] = [];
  for (const item of items) {
    const ex = await exerciseRepo.getExerciseById(item.exerciseId);
    if (!ex) continue;
    out.push({ queueItemId: item.id, exercise: toPublicExercise(ex) });
  }
  return out;
}

export interface GradeAndRecordResult {
  attemptId: number;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

/**
 * The single grading write path (§5). Always re-reads the *full* content
 * from the DB by `exerciseId` — `given` is trusted only as "what the
 * learner submitted", never as the source of truth for correctness.
 */
export async function gradeAndRecord(
  userId: number,
  exerciseId: number,
  context: AttemptContext,
  given: GivenAnswer,
  now: Date = new Date(),
  timeMs?: number,
): Promise<GradeAndRecordResult> {
  const exercise = await exerciseRepo.getExerciseById(exerciseId);
  if (!exercise) throw new Error(`Exercise not found: ${exerciseId}`);

  const result = gradeAttempt(exercise.typeCode, exercise.content as ExerciseContent, given);
  const attempt = await exerciseRepo.createExerciseAttempt(userId, exerciseId, context, given, result.isCorrect, timeMs ?? null);

  // Lane 2 (§5, §6.2): review_slot attempts advance/reset their queue item;
  // a fresh miss outside review_slot opens a new one.
  if (context === 'review_slot') {
    const open = await reviewRepo.findOpenReviewQueueItem(userId, exerciseId);
    if (open) {
      const transition = advanceReviewQueueItem(open.stage, result.isCorrect, now);
      await reviewRepo.applyReviewQueueTransition(open.id, transition, attempt.id);
    }
  } else if (!result.isCorrect && (context === 'session' || context === 'module_quiz' || context === 'practice')) {
    const schedule = scheduleNewReviewQueueItem(now);
    await reviewRepo.openReviewQueueItem(userId, exerciseId, schedule.dueAt, attempt.id);
  }

  // UC-23: a correct answer on a grammar-tagged exercise nudges the construction toward Reliable.
  if (result.isCorrect && exercise.grammarPointId) {
    const state = await contentRepo.getUserGrammarState(userId, exercise.grammarPointId);
    const successCount = state.successCount + 1;
    await contentRepo.upsertUserGrammarState(userId, exercise.grammarPointId, { status: nextGrammarStatus(successCount), successCount });
  }

  await activityRepo.bumpDailyActivity(userId, { exercisesDone: 1 }, now);

  return { attemptId: attempt.id, isCorrect: result.isCorrect, correctAnswer: result.correctAnswer, explanation: exercise.explanation };
}

// ───────────────────────── harvest (UC-09/UC-20/UC-21) ─────────────────────────

function dummyGivenAnswerFor(typeCode: ExerciseTypeCode): GivenAnswer {
  switch (typeCode) {
    case 'mc_cloze':
    case 'grammar_drill':
    case 'reading_comprehension':
      return { selected: -1 };
    case 'open_cloze':
    case 'word_formation':
    case 'key_word_transformation':
      return { text: '' };
    case 'error_correction':
      return { tapped: -1 };
    case 'collocation_match':
      return { pairs: {}, misses: 0 };
  }
}

function buildHarvestFront(typeCode: ExerciseTypeCode, content: ExerciseContent): string {
  switch (typeCode) {
    case 'mc_cloze':
    case 'grammar_drill':
    case 'open_cloze':
    case 'word_formation': {
      const c = content as McClozeContent | GrammarDrillContent | OpenClozeContent | WordFormationContent;
      return `${c.pre}____${c.post}`.trim();
    }
    case 'key_word_transformation': {
      const c = content as KeyWordTransformationContent;
      return `${c.s1} (${c.key})`;
    }
    case 'error_correction': {
      const c = content as ErrorCorrectionContent;
      return c.words.join(' ');
    }
    case 'collocation_match': {
      const c = content as CollocationMatchContent;
      return `${c.left.join(' / ')} ↔ ${c.right.join(' / ')}`;
    }
    case 'reading_comprehension': {
      const c = content as ReadingComprehensionContent;
      return c.q;
    }
  }
}

/** UC-09/UC-20: turns a missed exercise into a flashcard (source=error_harvest) + card_state + error_map_entry. */
export async function harvestError(userId: number, attemptId: number): Promise<{ flashcardId: number }> {
  const attempt = await exerciseRepo.getExerciseAttemptById(attemptId);
  if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);
  const exercise = await exerciseRepo.getExerciseById(attempt.exerciseId);
  if (!exercise) throw new Error(`Exercise not found: ${attempt.exerciseId}`);

  const content = exercise.content as ExerciseContent;
  const { correctAnswer } = gradeAttempt(exercise.typeCode, content, dummyGivenAnswerFor(exercise.typeCode));
  const front = buildHarvestFront(exercise.typeCode, content);
  const noteType: NoteType = exercise.typeCode === 'key_word_transformation' ? 'transformation' : 'grammar_cloze';

  const flashcard = await srsRepo.createFlashcard({
    moduleId: exercise.moduleId,
    noteType,
    fields: { front, main: correctAnswer, cases: [], extra: exercise.explanation },
    source: 'error_harvest',
    sourceExerciseId: exercise.id,
    createdByUserId: userId,
  });
  await srsRepo.createCardState(userId, flashcard.id, new Date());
  await exerciseRepo.createErrorMapEntry({
    userId,
    moduleId: exercise.moduleId,
    source: 'exercise',
    sourceAttemptId: attempt.id,
    errorText: front,
    ruleNote: exercise.explanation,
    flashcardId: flashcard.id,
  });
  return { flashcardId: flashcard.id };
}
