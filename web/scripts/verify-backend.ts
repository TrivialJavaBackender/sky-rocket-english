/**
 * Stage 3 backend verification (ARCHITECTURE.md §9 "Этап 3" Definition of
 * Done). Exercises the use-case layer end-to-end against the local DB
 * (module-01 already synced) and prints actual results for each DoD point.
 * Throws (non-zero exit) on the first failed assertion.
 *
 * Usage: tsx scripts/verify-backend.ts --username=<name>
 * The user must already exist — register one through /register first. This
 * script can't go through `lib/current-user.ts` any more: identity now comes
 * from a request cookie, and there is no request here.
 *
 * Leaves real progress rows behind for that user — run
 * `tsx scripts/reset-progress.ts --username=<name>` afterwards to give
 * stage 4 a clean slate.
 *
 * Deliberately an **en-c1 smoke test**, not a generic harness: the assertions
 * below encode that course's shape (4 blocks, 45 lexemes per module, 5 goals on
 * m01, 5 steps in Prime). Pointing it at another course would need that course's
 * own expectations, so the slug is a constant rather than a flag.
 */
import 'dotenv/config';
import { prisma } from '../lib/db';

import * as todayUseCase from '../lib/use-cases/today';
import * as courseMapUseCase from '../lib/use-cases/course-map';
import * as unitUseCase from '../lib/use-cases/unit';
import * as sessionUseCase from '../lib/use-cases/session';
import * as exerciseSetUseCase from '../lib/use-cases/exercise-set';
import * as flashcardsUseCase from '../lib/use-cases/flashcards';
import * as reviewUseCase from '../lib/use-cases/review';
import * as moduleReviewUseCase from '../lib/use-cases/module-review';
import * as writingUseCase from '../lib/use-cases/writing';
import * as progressUseCase from '../lib/use-cases/progress';

import * as reviewRepo from '../lib/repositories/review.repo';
import * as srsRepo from '../lib/repositories/srs.repo';
import * as moduleRepo from '../lib/repositories/module.repo';

import type { ExerciseTypeCode, GivenAnswer } from '../lib/domain/types';

/** The course this script verifies. See the note in the file header before changing it. */
const COURSE = 'en-c1';

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

/** Builds a correct and an incorrect given_answer from an exercise's *full* content — this script is allowed to peek at content directly (it plays the role of an oracle/test client), gradeAndRecord itself always re-reads content from the DB rather than trusting this. */
function buildGivenAnswers(typeCode: ExerciseTypeCode, content: any): { correct: GivenAnswer; incorrect: GivenAnswer } {
  switch (typeCode) {
    case 'mc_cloze':
    case 'grammar_drill':
    case 'reading_comprehension': {
      const wrongIdx = (content.answer + 1) % content.options.length;
      return { correct: { selected: content.answer }, incorrect: { selected: wrongIdx } };
    }
    case 'open_cloze':
    case 'word_formation':
    case 'key_word_transformation':
      return { correct: { text: content.answers[0] }, incorrect: { text: 'zzz-definitely-wrong-zzz' } };
    case 'error_correction': {
      const wrongTap = (content.wrong + 1) % content.words.length;
      return { correct: { tapped: content.wrong }, incorrect: { tapped: wrongTap } };
    }
    case 'collocation_match': {
      const correctPairs: Record<string, number> = content.pairs;
      const keys = Object.keys(correctPairs);
      const brokenPairs = { ...correctPairs, [keys[0]]: (correctPairs[keys[0]] + 1) % content.right.length };
      return { correct: { pairs: correctPairs, misses: 0 }, incorrect: { pairs: brokenPairs, misses: 1 } };
    }
  }
}

/** Resolves the target user directly, since there is no request cookie to read outside the app. */
async function resolveUserId(): Promise<number> {
  const username = process.argv.find((a) => a.startsWith('--username='))?.split('=')[1];
  if (!username) {
    console.error('Usage: tsx scripts/verify-backend.ts --username=<name>');
    process.exit(1);
  }
  const user = await prisma.app_user.findUnique({ where: { username } });
  if (!user) {
    console.error(`No app_user with username "${username}" — register one at /register first.`);
    process.exit(1);
  }
  return Number(user.id);
}

async function main() {
  const userId = await resolveUserId();
  console.log(`Verifying against user_id=${userId}`);

  const priorAttempts = await prisma.exercise_attempt.count({ where: { user_id: userId } });
  if (priorAttempts > 0) {
    console.warn(
      `\nWARNING: ${priorAttempts} exercise_attempt rows already exist for this user — this looks like a re-run. ` +
        `Some assertions assume a clean progress state (e.g. m01 not yet Mastered). ` +
        `Run "tsx scripts/reset-progress.ts" first for a fully reproducible pass.\n`,
    );
  }

  // ── (a) Dashboard: course/blocks/modules with correct statuses ──────────
  section('(a) getToday + getCourseMap');
  const today = await todayUseCase.getToday(userId);
  console.log(JSON.stringify(today, null, 2));
  assert(today.courseSlug === COURSE, 'getToday returns the en-c1 course');
  assert(today.currentModule?.slug === 'm01', 'getToday resolves current module = m01');

  const map = await courseMapUseCase.getCourseMap(userId);
  console.log(`Blocks: ${map.blocks.map((b) => `${b.slug}(${b.pct}%,cp=${b.checkpoint?.status})`).join(', ')}`);
  assert(map.blocks.length === 4, 'course map has 4 blocks');
  const blockA = map.blocks.find((b) => b.slug === 'a')!;
  // §6.5: the course's first module starts life as 'upcoming' (ensureFirstModuleUnlocked, run by getToday above) —
  // it only flips to 'in_progress' on first *unit page* entry (UC-05, exercised in section (b) below).
  assert(blockA.modules.find((m) => m.slug === 'm01')?.status === 'upcoming', 'm01 status is upcoming before its unit page has been opened');
  assert(blockA.modules.find((m) => m.slug === 'm02')?.status === 'locked', 'm02 starts locked (sequential unlock, D5)');

  // ── (b) Unit screen: theory/vocab/reading/exercises/writing ─────────────
  section(`(b) getUnit(${COURSE}, m01)`);
  const unit = await unitUseCase.getUnit(userId, COURSE, 'm01');
  assert(unit !== null, 'getUnit returns m01');
  assert(unit!.spotlights.length > 0, `spotlights present (${unit!.spotlights.length})`);
  assert(unit!.watchouts.length > 0, `watchouts present (${unit!.watchouts.length})`);
  assert(unit!.vocabEntries.length === 45, `vocab entries = 45 (got ${unit!.vocabEntries.length})`);
  assert(unit!.reading !== null && unit!.reading.paragraphs.length > 0, 'main reading text with paragraphs present');
  assert(Object.keys(unit!.reading!.glosses).length > 0, `glosses joined dictionary present (${Object.keys(unit!.reading!.glosses).length} keys)`);
  assert(unit!.launchers.length === 3, `3 launchers (grammar/reading/vocab), got ${unit!.launchers.length}`);

  const courseRow = await prisma.course.findUniqueOrThrow({ where: { slug: COURSE } });
  const courseId = Number(courseRow.id);
  const module = await moduleRepo.getModuleBySlug(courseId, 'm01');
  const moduleId = module!.id;

  const moduleStateAfterUnitEntry = await moduleRepo.getUserModuleState(userId, moduleId);
  assert(moduleStateAfterUnitEntry?.status === 'in_progress', `UC-05: m01 flips upcoming -> in_progress on first unit-page entry (got ${moduleStateAfterUnitEntry?.status})`);

  const writingTask = await writingUseCase.getWritingTaskForModule(moduleId);
  assert(writingTask !== null, 'writing_task present for m01');
  console.log(`  writing genre: ${writingTask!.genre}, checklist items: ${writingTask!.checklist.length}`);

  // ── (b2) D11 session gating + dosed theory/vocab slices (0004) ──────────
  section('(b2) Session gating (D11) + content slicing');
  const cellsNow = unit!.sessions.map((s) => s.cell).join(',');
  assert(cellsNow === 'current,locked,locked,locked', `hub cells start current,locked,locked,locked (got ${cellsNow})`);
  assert(unit!.continueTarget?.sessionType === 'prime', `continueTarget points at prime (got ${unit!.continueTarget?.sessionType})`);
  assert(unit!.readingExtra !== null, 'extra reading is surfaced on the hub');
  assert(unit!.sessions.every((s) => s.steps.length > 0), 'every hub session cell carries a step preview');
  assert(unit!.goals.length === 5 && unit!.goals.some((g) => g.achievedBy === 'workout'), 'module goals carry the achieved_by mapping (D12)');
  assert(unit!.goals.every((g) => g.status !== 'achieved'), 'no goal is achieved before any session is done');

  const primeRes = await sessionUseCase.getSession(userId, COURSE, 'm01', 'prime');
  assert(primeRes.kind === 'ok', `prime opens as the current session (got ${primeRes.kind})`);
  assert(primeRes.session.steps.length === 5, `prime has 5 steps after 0004 (got ${primeRes.session.steps.length})`);
  const workoutRes = await sessionUseCase.getSession(userId, COURSE, 'm01', 'workout');
  assert(workoutRes.kind === 'locked' && workoutRes.currentSessionType === 'prime', `workout is locked while prime is current (got ${workoutRes.kind})`);

  // en-c1's language ('en') is outside AUDIO_LANGS, so these also exercise the
  // zero-audio-query path (ARCHITECTURE.md §4.8) — same course row already
  // fetched above, no extra query.
  const theory1 = await unitUseCase.getModuleTheorySlice(moduleId, 1, 2, courseRow.language);
  const theory2 = await unitUseCase.getModuleTheorySlice(moduleId, 2, 2, courseRow.language);
  assert(
    theory1.spotlights.length + theory2.spotlights.length === unit!.spotlights.length && theory1.spotlights.length >= theory2.spotlights.length && theory2.spotlights.length > 0,
    `theory parts are balanced and cover everything (${theory1.spotlights.length}+${theory2.spotlights.length}=${unit!.spotlights.length})`,
  );
  const batch1 = await unitUseCase.getModuleVocabBatch(userId, moduleId, 1, 3, courseRow.language);
  const batch2 = await unitUseCase.getModuleVocabBatch(userId, moduleId, 2, 3, courseRow.language);
  const batch3 = await unitUseCase.getModuleVocabBatch(userId, moduleId, 3, 3, courseRow.language);
  assert(
    batch1.entries.length === 15 && batch2.entries.length === 15 && batch3.entries.length === 15,
    `vocab batches split 15/15/15 (got ${batch1.entries.length}/${batch2.entries.length}/${batch3.entries.length})`,
  );
  assert(batch2.rangeStart === 16 && batch3.rangeEnd === 45, `vocab batch ranges are contiguous (batch2 starts ${batch2.rangeStart}, batch3 ends ${batch3.rangeEnd})`);

  // ── (c) Grade all 8 exercise types, correct + incorrect ──────────────────
  section('(c) gradeAndRecord — all 8 exercise types, correct + incorrect');
  const typeCodes: ExerciseTypeCode[] = [
    'mc_cloze',
    'grammar_drill',
    'reading_comprehension',
    'open_cloze',
    'word_formation',
    'key_word_transformation',
    'error_correction',
    'collocation_match',
  ];

  let grammarPromotionExerciseId: number | null = null;
  for (const typeCode of typeCodes) {
    const rows = await prisma.exercise.findMany({ where: { module_id: moduleId, type_code: typeCode }, take: 2 });
    assert(rows.length >= 2, `at least 2 ${typeCode} exercises exist in m01 (found ${rows.length})`);
    const [correctRow, incorrectRow] = rows;
    const { correct } = buildGivenAnswers(typeCode, correctRow.content);
    const { incorrect } = buildGivenAnswers(typeCode, incorrectRow.content);

    const okResult = await exerciseSetUseCase.gradeAndRecord(userId, Number(correctRow.id), 'session', correct);
    assert(okResult.isCorrect === true, `${typeCode}: correct given_answer graded is_correct=true`);

    const badResult = await exerciseSetUseCase.gradeAndRecord(userId, Number(incorrectRow.id), 'session', incorrect);
    assert(badResult.isCorrect === false, `${typeCode}: incorrect given_answer graded is_correct=false`);

    const attempts = await prisma.exercise_attempt.findMany({ where: { user_id: userId, exercise_id: { in: [correctRow.id, incorrectRow.id] } } });
    assert(attempts.length >= 2, `${typeCode}: exercise_attempt rows written`);

    const openItem = await reviewRepo.findOpenReviewQueueItem(userId, Number(incorrectRow.id));
    assert(openItem !== null && openItem.stage === 1, `${typeCode}: wrong answer in 'session' context opened a stage-1 review_queue_item`);

    // correctRow was graded with its own correct answer ('session' context) — a real is_correct=true attempt, usable to check UC-23 grammar promotion.
    if (correctRow.grammar_point_id && grammarPromotionExerciseId === null) {
      grammarPromotionExerciseId = Number(correctRow.id);
    }
  }

  if (grammarPromotionExerciseId) {
    const ex = await prisma.exercise.findUniqueOrThrow({ where: { id: grammarPromotionExerciseId } });
    const gpId = Number(ex.grammar_point_id);
    const before = await prisma.user_grammar_state.findUnique({ where: { user_id_grammar_point_id: { user_id: userId, grammar_point_id: gpId } } });
    console.log(`  grammar_point ${gpId} success_count after one correct attempt: ${before?.success_count} status=${before?.status}`);
    assert((before?.success_count ?? 0) >= 1, 'UC-23: correct grammar-tagged attempt bumped user_grammar_state.success_count');
  } else {
    console.log('  (no grammar_point-linked exercise hit in this run — skipping UC-23 assertion)');
  }

  // ── (d) Flashcard full cycle: due queue → grade → card_state + log ──────
  section('(d) Flashcard cycle: batch-dosed intro → due queue → grade (all 4 ratings) → card_state/card_review_log');

  // Deck dosing (UC-15): only words already met in a `vocab` step are eligible,
  // so with no vocab step done yet the intro is a no-op even though m01 has 90
  // cards waiting.
  const gatedIntro = await flashcardsUseCase.introduceModuleFlashcards(userId, moduleId);
  assert(gatedIntro.introduced === 0, `intro introduces nothing before any vocab step is done (got ${gatedIntro.introduced})`);

  const primeSteps = await moduleRepo.listStepsForSession(userId, primeRes.kind === 'ok' ? primeRes.session.id : 0);
  const vocabStep1 = primeSteps.find((s) => s.kind === 'vocab');
  assert(vocabStep1 !== undefined, "prime carries a `vocab` step to complete");
  await sessionUseCase.advanceStep(userId, vocabStep1!.id);

  const introduced = await flashcardsUseCase.introduceModuleFlashcards(userId, moduleId);
  console.log(`  introduced ${introduced.introduced} new flashcards into rotation`);
  // 45 lexemes dosed 15/15/15, two directions each: batch 1 is 30 cards.
  assert(introduced.introduced === 30, `batch 1 of 3 introduces 15 words × 2 directions (got ${introduced.introduced})`);

  // spreadInitialDueDate (§6.4) never schedules a card for *today* — earliest
  // due is tomorrow, round-robined across 7 days — so right after
  // flashcards_intro, listDueCards(now) is legitimately empty. Confirm that,
  // then confirm the queue does fill in once "now" moves past the spread
  // window (both are real, meaningful behaviors of the due-queue query).
  const dueToday = await srsRepo.listDueCards(userId, new Date(), 10);
  console.log(`  due right now: ${dueToday.length} (expected 0 — spreadInitialDueDate starts at tomorrow)`);
  const farFuture = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const dueWithinSpreadWindow = await srsRepo.listDueCards(userId, farFuture, 10);
  assert(dueWithinSpreadWindow.length >= 4, `due queue fills in once "now" passes the 7-day spread window (found ${dueWithinSpreadWindow.length})`);

  // Grading itself doesn't require a card to be "due" — pull any card_state
  // rows for this module directly so this section is safe to re-run after a
  // prior pass has already pushed some cards' due dates further out.
  const dueCards = await prisma.card_state.findMany({ where: { user_id: userId, flashcard: { module_id: moduleId } }, take: 10 });
  assert(dueCards.length >= 4, `at least 4 card_state rows exist to grade (found ${dueCards.length})`);

  const ratings: Array<[1 | 2 | 3 | 4, string]> = [
    [1, 'Again'],
    [2, 'Hard'],
    [3, 'Good'],
    [4, 'Easy'],
  ];
  for (let i = 0; i < ratings.length; i++) {
    const [rating, label] = ratings[i];
    const flashcardId = Number(dueCards[i].flashcard_id);
    const before = await srsRepo.getCardState(userId, flashcardId);
    const result = await flashcardsUseCase.reviewFlashcard(userId, flashcardId, rating);
    const after = await srsRepo.getCardState(userId, flashcardId);
    console.log(`  ${label}: phase ${before?.phase ?? 'new'} -> ${after?.phase}, due ${after?.dueAt.toISOString()}`);
    assert(after !== null, `${label}: card_state row exists after grading`);
    assert(after!.dueAt.getTime() !== (before?.dueAt.getTime() ?? -1) || after!.reps !== (before?.reps ?? -1), `${label}: card_state changed (due_at or reps)`);
    assert(result.nextDueAt.getTime() === after!.dueAt.getTime(), `${label}: reviewFlashcard's returned dueAt matches persisted card_state`);
  }
  const logCount = await prisma.card_review_log.count({ where: { user_id: userId } });
  assert(logCount >= 4, `card_review_log has >=4 rows (found ${logCount})`);

  // ── (e) Review queue +2/+7/+21: open → advance → advance → resolve ──────
  section('(e) Review queue stage progression +2 -> +7 -> +21 -> resolved');
  const rqExercise = await prisma.exercise.findFirstOrThrow({ where: { module_id: moduleId, type_code: 'mc_cloze' }, skip: 2 });
  const { correct: rqCorrect, incorrect: rqIncorrect } = buildGivenAnswers('mc_cloze', rqExercise.content as any);

  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise.id), 'session', rqIncorrect);
  let item = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise.id));
  assert(item !== null && item.stage === 1, `stage 1 item opened (due +2d) — got stage ${item?.stage}`);

  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise.id), 'review_slot', rqCorrect);
  item = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise.id));
  assert(item !== null && item.stage === 2, `stage 1 -> 2 on correct review_slot answer (due +7d) — got stage ${item?.stage}`);

  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise.id), 'review_slot', rqCorrect);
  item = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise.id));
  assert(item !== null && item.stage === 3, `stage 2 -> 3 on correct review_slot answer (due +21d) — got stage ${item?.stage}`);

  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise.id), 'review_slot', rqCorrect);
  item = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise.id));
  assert(item === null, 'stage 3 correct closes the item (resolved_at set, no longer open)');

  // Also verify the reset-to-stage-1 rule on a fresh item.
  const rqExercise2 = await prisma.exercise.findFirstOrThrow({ where: { module_id: moduleId, type_code: 'grammar_drill' }, skip: 2 });
  const g2 = buildGivenAnswers('grammar_drill', rqExercise2.content as any);
  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise2.id), 'session', g2.incorrect);
  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise2.id), 'review_slot', g2.correct);
  let item2 = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise2.id));
  assert(item2?.stage === 2, 'sanity: second item advanced to stage 2 before testing the reset rule');
  await exerciseSetUseCase.gradeAndRecord(userId, Number(rqExercise2.id), 'review_slot', g2.incorrect);
  item2 = await reviewRepo.findOpenReviewQueueItem(userId, Number(rqExercise2.id));
  assert(item2?.stage === 1, `wrong answer on review_slot resets stage back to 1 (§6.2) — got stage ${item2?.stage}`);

  // ── (f) Writing submission ───────────────────────────────────────────────
  section('(f) submitWriting -> writing_submission');
  const vocabForUsageTest = await prisma.vocab_entry.findFirstOrThrow({ where: { module_id: moduleId } });
  const bodyWithTerm = `This is a short test submission that deliberately uses the term "${vocabForUsageTest.term}" to exercise the UC-23 usage-detection heuristic. ` + 'Word '.repeat(50);
  const submission = await writingUseCase.submitWriting(userId, writingTask!.id, bodyWithTerm, 22, null);
  assert(submission.id > 0, `writing_submission created (id=${submission.id})`);
  const vocabState = await prisma.user_vocab_state.findUnique({
    where: { user_id_vocab_entry_id: { user_id: userId, vocab_entry_id: vocabForUsageTest.id } },
  });
  assert(vocabState?.status === 'in_use', `UC-23: vocab term "${vocabForUsageTest.term}" used in submission -> status=in_use (got ${vocabState?.status})`);

  // ── (g) Module review r7/r21 -> Mastered ─────────────────────────────────
  section('(g) closeModule -> module_review r7/r21 -> both passed -> Mastered');
  await sessionUseCase.closeModule(userId, moduleId, 92);
  const moduleStateAfterQuiz = await moduleRepo.getUserModuleState(userId, moduleId);
  assert(moduleStateAfterQuiz?.status === 'completed', `module status = completed after quiz close (got ${moduleStateAfterQuiz?.status})`);
  const reviews = await reviewRepo.getModuleReviews(userId, moduleId);
  assert(reviews.length === 2, `2 module_review rows created (r7 + r21), found ${reviews.length}`);
  const r7 = reviews.find((r) => r.stage === 'r7')!;
  const r21 = reviews.find((r) => r.stage === 'r21')!;
  console.log(`  r7 due=${r7.dueAt.toISOString()} r21 due=${r21.dueAt.toISOString()}`);
  assert(r7.dueAt.getTime() < r21.dueAt.getTime(), 'r7 due date is before r21 due date');

  // Scoped to en-c1: de-a1 and de-a2 have an `m02` too, and an unqualified
  // findFirst could resolve to either of them.
  const m02 = await moduleRepo.getModuleBySlug(courseId, 'm02');
  const m02State = m02 ? await moduleRepo.getUserModuleState(userId, m02.id) : null;
  assert(m02State?.status === 'upcoming', `D5: m02 unlocked to 'upcoming' after m01 closes (got ${m02State?.status})`);

  const r7Set = await moduleReviewUseCase.getModuleReviewSet(moduleId, 10);
  console.log(`  r7 review set size: ${r7Set.length}`);
  const r7Attempts: moduleReviewUseCase.ModuleReviewAttemptInput[] = [];
  for (const ex of r7Set) {
    const full = await prisma.exercise.findUniqueOrThrow({ where: { id: ex.id } });
    const { correct } = buildGivenAnswers(full.type_code as ExerciseTypeCode, full.content as any);
    const graded = await exerciseSetUseCase.gradeAndRecord(userId, ex.id, 'module_review', correct);
    r7Attempts.push({ exerciseId: ex.id, attemptId: graded.attemptId, isCorrect: graded.isCorrect });
  }
  const r7Outcome = await moduleReviewUseCase.finishModuleReview(userId, moduleId, 'r7', r7Attempts);
  console.log(`  r7 outcome: score=${r7Outcome.score} passed=${r7Outcome.passed} mastered=${r7Outcome.mastered}`);
  assert(r7Outcome.passed === true, `r7 quiz (all-correct) scores >=80 and passes (score=${r7Outcome.score})`);
  assert(r7Outcome.mastered === false, 'module not yet mastered after only r7 passed');

  const r21Set = await moduleReviewUseCase.getModuleReviewSet(moduleId, 10);
  const r21Attempts: moduleReviewUseCase.ModuleReviewAttemptInput[] = [];
  for (const ex of r21Set) {
    const full = await prisma.exercise.findUniqueOrThrow({ where: { id: ex.id } });
    const { correct } = buildGivenAnswers(full.type_code as ExerciseTypeCode, full.content as any);
    const graded = await exerciseSetUseCase.gradeAndRecord(userId, ex.id, 'module_review', correct);
    r21Attempts.push({ exerciseId: ex.id, attemptId: graded.attemptId, isCorrect: graded.isCorrect });
  }
  const r21Outcome = await moduleReviewUseCase.finishModuleReview(userId, moduleId, 'r21', r21Attempts);
  console.log(`  r21 outcome: score=${r21Outcome.score} passed=${r21Outcome.passed} mastered=${r21Outcome.mastered}`);
  assert(r21Outcome.passed === true, `r21 quiz (all-correct) scores >=80 and passes (score=${r21Outcome.score})`);
  assert(r21Outcome.mastered === true, 'both r7 and r21 passed -> module mastered');

  const finalModuleState = await moduleRepo.getUserModuleState(userId, moduleId);
  assert(finalModuleState?.status === 'mastered', `user_module_state.status = mastered (got ${finalModuleState?.status})`);
  assert(finalModuleState?.masteredAt !== null, 'mastered_at timestamp set');

  // ── extra: review hub + progress screens don't blow up and show real data ──
  section('Extra: getReviewHub + getProgress sanity');
  const hub = await reviewUseCase.getReviewHub(userId);
  console.log(`  lane1 cardsDue=${hub.lane1.cardsDue} breakdown=${JSON.stringify(hub.lane1.breakdown)}`);
  console.log(`  lane2 itemsDue=${hub.lane2.itemsDue}`);
  console.log(`  lane3 items=${hub.lane3.items.length}`);
  const progress = await progressUseCase.getProgress(userId);
  console.log(`  progress stats: ${JSON.stringify(progress.stats)}`);
  assert(progress.blocks.length === 4, 'progress screen returns 4 blocks');

  console.log(`\n${passed} assertions passed, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error('\nVerification FAILED:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
