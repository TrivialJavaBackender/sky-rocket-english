import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUserId } from '@/lib/current-user';
import * as sessionUseCase from '@/lib/use-cases/session';
import * as unitUseCase from '@/lib/use-cases/unit';
import * as exerciseSetUseCase from '@/lib/use-cases/exercise-set';
import * as writingUseCase from '@/lib/use-cases/writing';
import type { ExerciseGroup, ExerciseTypeCode, ProgressStatus, ReadingKind, SessionType } from '@/lib/domain/types';
import { paragraphTexts } from '@/lib/domain/audio-text';
import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { SessionSteps } from '@/components/session/SessionSteps';
import { ReadingModeBanner } from '@/components/session/ReadingModeBanner';
import { MarkStepDone } from '@/components/session/MarkStepDone';
import { FlashcardsIntroPanel } from '@/components/session/FlashcardsIntroPanel';
import { StepExercisePanel } from '@/components/session/StepExercisePanel';
import { GrammarSpotlight } from '@/components/unit/GrammarSpotlight';
import { WatchoutBox } from '@/components/unit/WatchoutBox';
import { VocabStudio } from '@/components/unit/VocabStudio';
import { ReadingText } from '@/components/reading/ReadingText';
import { WritingEditor } from '@/components/writing/WritingEditor';
import { SelfCheck } from '@/components/writing/SelfCheck';

const SESSION_TYPES: SessionType[] = ['prime', 'input', 'workout', 'output'];

// UC-13/14 Session runner (ARCHITECTURE.md §1.3, §7.1 `.../session/[sessionType]`).
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; moduleSlug: string; sessionType: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { courseSlug, moduleSlug, sessionType } = await params;
  const { step: stepParam } = await searchParams;
  if (!SESSION_TYPES.includes(sessionType as SessionType)) notFound();

  const userId = await getCurrentUserId();
  const result = await sessionUseCase.getSession(userId, courseSlug, moduleSlug, sessionType as SessionType);
  if (result.kind === 'not_found') notFound();
  // D11 hard gating: a locked session bounces back to the unit hub, which shows why.
  if (result.kind === 'locked') redirect(`/course/${courseSlug}/module/${moduleSlug}`);
  const session = result.session;

  const activeStep = session.steps.find((s) => s.status !== 'done') ?? null;
  const nextSessionType = session.position < SESSION_TYPES.length ? SESSION_TYPES[session.position] : null;

  // Fix 2 (step revisiting): a step is viewable once it's done or is the
  // active (first not-done) step. `?step=N` (1-based, matching SessionSteps'
  // `i+1` links) opens that step's panel instead of the active one, as long
  // as it's viewable — an out-of-range or not-yet-reached position is
  // ignored and the page behaves exactly as it did before this param
  // existed.
  const isViewable = (s: (typeof session.steps)[number]) => s.status === 'done' || s.id === activeStep?.id;
  const requestedIndex = stepParam ? Number(stepParam) - 1 : NaN;
  const requestedStep = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < session.steps.length ? session.steps[requestedIndex] : null;
  const viewedStep = requestedStep && isViewable(requestedStep) ? requestedStep : activeStep;
  const viewedStepIndex = viewedStep ? session.steps.findIndex((s) => s.id === viewedStep.id) : -1;
  const isRevisiting = viewedStep !== null && viewedStep.id !== activeStep?.id;

  return (
    <div className="animate-fade-up">
      <LinkButton href={`/course/${courseSlug}/module/${moduleSlug}`} variant="ghost" className="mb-3.5">
        ← {session.moduleTitle}
      </LinkButton>

      <div className="mb-4">
        <Kicker>
          {moduleSlug.toUpperCase()} · Session {session.position} of {SESSION_TYPES.length}
        </Kicker>
        <h1 className="m-0 mt-1 text-[30px] tracking-[-.01em]">
          {session.title} <span className="font-normal text-fg-subtle">· {session.plannedMinutes} min</span>
        </h1>
      </div>

      <Card className="mb-4">
        <SessionSteps steps={session.steps} activeStepId={activeStep?.id ?? null} viewedStepId={viewedStep?.id ?? null} />
      </Card>

      {viewedStep ? (
        <>
          {isRevisiting ? (
            <Card tone="soft" padding="sm" className="mb-4">
              <Kicker className="mb-0.5">Revisiting a completed step</Kicker>
              <div className="text-[14.5px] text-fg-muted">
                You&apos;re re-viewing this step — your place in the session is kept.
                {activeStep && (
                  <>
                    {' '}
                    <Link href="?" className="font-semibold text-fg underline">
                      Back to your active step →
                    </Link>
                  </>
                )}
              </div>
            </Card>
          ) : (
            viewedStep.detail && (
              <Card tone="green" padding="sm" className="mb-4">
                <Kicker tone="green" className="mb-0.5">
                  Step {viewedStepIndex + 1} of {session.steps.length} · Goal
                </Kicker>
                <div className="text-[14.5px]">{viewedStep.detail}</div>
              </Card>
            )
          )}
          <ActiveStepPanel
            key={viewedStep.id}
            userId={userId}
            moduleId={session.moduleId}
            language={session.language}
            stepId={viewedStep.id}
            kind={viewedStep.kind}
            title={viewedStep.title}
            config={viewedStep.config}
            stepStatus={viewedStep.status}
          />
        </>
      ) : (
        <Card className="text-center">
          <div className="text-[17px] font-bold">Session complete</div>
          <div className="mt-1 text-[14.5px] text-fg-muted">
            {nextSessionType ? `Every step here is done — Session ${session.position + 1} is now open.` : 'Every step here is done — this was the last session of the unit.'}
          </div>
          {nextSessionType && (
            <LinkButton href={`/course/${courseSlug}/module/${moduleSlug}/session/${nextSessionType}`} className="mt-3.5">
              Go to Session {session.position + 1} →
            </LinkButton>
          )}
          <LinkButton href={`/course/${courseSlug}/module/${moduleSlug}`} variant={nextSessionType ? 'ghost' : 'primary'} className="mt-3.5 ml-2.5">
            Back to the unit
          </LinkButton>
        </Card>
      )}
    </div>
  );
}

async function ActiveStepPanel({
  userId,
  moduleId,
  language,
  stepId,
  kind,
  title,
  config,
  stepStatus,
}: {
  userId: number;
  moduleId: number;
  /** Course language (ARCHITECTURE.md §4.8) — threaded into the theory/reading/vocab use-case calls below so a German course's steps resolve audio and an en-c1 page costs zero audio queries. */
  language: string;
  stepId: number;
  kind: string;
  title: string;
  config: Record<string, unknown>;
  /** Fix 2: the *viewed* step's own status (not necessarily the session's active step) — threaded into every `MarkStepDone` below so revisiting a done step shows "already done" instead of an actionable button. */
  stepStatus: ProgressStatus;
}) {
  const done = stepStatus === 'done';
  switch (kind) {
    case 'opener': {
      return (
        <Card>
          <Kicker className="mb-1.5">Unit opener</Kicker>
          <p className="text-[15px] text-fg-muted">Review the unit's goals and can-do statements on the unit page, then mark this step done to move on.</p>
          <MarkStepDone stepId={stepId} done={done} />
        </Card>
      );
    }

    case 'theory': {
      // Dosed theory (PLAN.md §3): {"part":P,"of":N} slices the module's ordered spotlights/watchouts — part 1 in Prime, part 2 in Workout.
      const part = typeof config.part === 'number' ? config.part : 1;
      const of = typeof config.of === 'number' ? config.of : 1;
      const { spotlights, watchouts } = await unitUseCase.getModuleTheorySlice(moduleId, part, of, language);
      if (spotlights.length === 0 && watchouts.length === 0) {
        return (
          <Card>
            <Kicker className="mb-1.5">Grammar spotlight · part {part} of {of}</Kicker>
            <p className="text-[15px] text-fg-muted">This module's constructions were all covered in the earlier part — nothing new here. Mark the step done to move on.</p>
            <MarkStepDone stepId={stepId} done={done} />
          </Card>
        );
      }
      return (
        <div>
          <Kicker className="mx-0.5 mb-2">Part {part} of {of}</Kicker>
          {spotlights.map((s) => (
            <GrammarSpotlight key={s.id} spotlight={s} />
          ))}
          {watchouts.map((w) => (
            <WatchoutBox key={w.id} watchout={w} />
          ))}
          <Card>
            <MarkStepDone stepId={stepId} done={done} />
          </Card>
        </div>
      );
    }

    case 'reading': {
      const readingKind = (config.reading_kind as ReadingKind | undefined) ?? 'main';
      const mode = config.mode === 'skim' ? 'skim' : 'close';
      const reading = await unitUseCase.getReadingWithGlosses(moduleId, readingKind, language);
      if (!reading) {
        return (
          <Card>
            <div className="text-[14.5px] text-fg-muted">No {readingKind} text is available for this module yet.</div>
            <div className="mt-3">
              <MarkStepDone stepId={stepId} done={done} />
            </div>
          </Card>
        );
      }
      return (
        <Card>
          <ReadingModeBanner mode={mode} />
          {reading.kicker && <Kicker>{reading.kicker}</Kicker>}
          <h2 className="text-pretty m-0 mb-1 mt-1 text-[22px] leading-[1.2] tracking-[-.01em]">{reading.title}</h2>
          {reading.meta && <div className="mb-3.5 text-[13px] text-fg-subtle">{reading.meta}</div>}
          <ReadingText paragraphs={reading.paragraphs} glosses={reading.glosses} moduleId={moduleId} glossesEnabled={mode !== 'skim'} paragraphAudio={reading.paragraphAudio} />
          <div className="mt-3">
            <MarkStepDone stepId={stepId} done={done} />
          </div>
        </Card>
      );
    }

    case 'vocab': {
      // Dosed vocabulary (PLAN.md §3): {"batch":B,"of":N} slices the 45 lexemes into balanced batches — 1/3 in Prime, 2/3 and 3/3 in Input.
      const batch = typeof config.batch === 'number' ? config.batch : 1;
      const of = typeof config.of === 'number' ? config.of : 1;
      const { entries, rangeStart, rangeEnd, total } = await unitUseCase.getModuleVocabBatch(userId, moduleId, batch, of, language);
      return (
        <div>
          <VocabStudio title={title} entries={entries} rangeLabel={of > 1 ? `Lexemes ${rangeStart}–${rangeEnd} of ${total}` : undefined} />
          <Card>
            <MarkStepDone stepId={stepId} done={done} />
          </Card>
        </div>
      );
    }

    case 'flashcards_intro':
      return (
        <Card>
          <Kicker className="mb-1.5">New cards into rotation</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">Every flashcard in this module's deck joins your daily review queue, spread over the coming week.</p>
          <FlashcardsIntroPanel moduleId={moduleId} stepId={stepId} />
        </Card>
      );

    case 'review_slot': {
      const limit = typeof config.count === 'number' ? config.count : 10;
      const slot = await exerciseSetUseCase.startReviewSlot(userId, new Date(), limit);
      // Fix 1: an empty slot (the common case on a normal day — misses only
      // come back at +2/+7/+21 days) used to fall through to
      // StepExercisePanel's "No exercises are available" dead end, with no
      // way to finish the step. Explain why it's empty and let the learner
      // continue.
      if (slot.length === 0) {
        return (
          <Card>
            <Kicker className="mb-1.5">Review Slot</Kicker>
            <p className="mb-3 text-[15px] text-fg-muted">
              Nothing is due right now. This queue fills whenever you miss an exercise — misses come back for review at +2, +7, and +21 days.
            </p>
            <MarkStepDone stepId={stepId} label="Nothing due — continue" done={done} />
          </Card>
        );
      }
      return (
        <Card>
          <Kicker className="mb-1.5">Review Slot</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">{slot.length} item{slot.length === 1 ? '' : 's'} from the exercise re-queue.</p>
          <StepExercisePanel
            items={slot.map((s) => s.exercise)}
            context="review_slot"
            headerLabel="Review Slot"
            startLabel={`Start · ${slot.length} items`}
            stepId={stepId}
            moduleId={moduleId}
            isModuleQuiz={false}
            progress={await exerciseSetUseCase.computeSetProgress(userId, slot.map((s) => s.exercise), 'review_slot')}
          />
        </Card>
      );
    }

    case 'exercise_set': {
      const types = Array.isArray(config.types) ? (config.types as ExerciseTypeCode[]) : undefined;
      const groupKey = typeof config.group_key === 'string' ? (config.group_key as ExerciseGroup) : undefined;
      const items = await exerciseSetUseCase.startExerciseSet({ moduleId, types, groupKey, pool: 'core' });

      // Fix 3: Input's close-reading step is followed by a reading_comprehension
      // exercise_set, but by then the text is gone. When this set is quizzing on
      // the reading, fetch it too and flatten it server-side into plain-text
      // paragraphs so ExercisePlayer can show it in a collapsible panel.
      // paragraphTexts is the same join scripts/audio.ts uses to turn this same
      // body into clip texts to synthesize, so a gloss resolves identically here,
      // there, and in ReadingText's own client-side join.
      let readingTitle: string | undefined;
      let readingParagraphs: string[] | undefined;
      if (types?.includes('reading_comprehension')) {
        const reading = await unitUseCase.getReadingWithGlosses(moduleId, 'main', language);
        if (reading) {
          readingTitle = reading.title;
          readingParagraphs = paragraphTexts(reading.paragraphs, reading.glosses);
        }
      }

      return (
        <Card>
          <Kicker className="mb-1.5">{title}</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">{items.length} exercise{items.length === 1 ? '' : 's'} in this set.</p>
          <StepExercisePanel
            items={items}
            context="session"
            headerLabel={title}
            startLabel={`Start · ${items.length} items`}
            stepId={stepId}
            moduleId={moduleId}
            isModuleQuiz={false}
            readingTitle={readingTitle}
            readingParagraphs={readingParagraphs}
            progress={await exerciseSetUseCase.computeSetProgress(userId, items, 'session')}
          />
        </Card>
      );
    }

    case 'harvest':
      return (
        <Card>
          <Kicker className="mb-1.5">Harvest errors</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">Every exercise you missed above already offered a "Harvest to flashcards" button — anything you harvested is already in your deck. Mark this step done to continue.</p>
          <MarkStepDone stepId={stepId} done={done} />
        </Card>
      );

    case 'production': {
      const task = await writingUseCase.getWritingTaskForModule(moduleId);
      if (!task) {
        return (
          <Card>
            <div className="text-[14.5px] text-fg-muted">No writing/speaking task is available for this module yet.</div>
            <div className="mt-3">
              <MarkStepDone stepId={stepId} done={done} />
            </div>
          </Card>
        );
      }
      return <WritingEditor task={task} stepId={stepId} />;
    }

    case 'self_check': {
      const task = await writingUseCase.getWritingTaskForModule(moduleId);
      if (!task) {
        return (
          <Card>
            <div className="text-[14.5px] text-fg-muted">No task is available for this module yet.</div>
            <div className="mt-3">
              <MarkStepDone stepId={stepId} done={done} />
            </div>
          </Card>
        );
      }
      const view = await writingUseCase.getSelfCheckView(userId, task.id);
      return <SelfCheck task={task} latestSubmission={view?.latestSubmission ?? null} stepId={stepId} />;
    }

    case 'module_quiz': {
      // Fix 2: a done module_quiz can't be re-run from here (it would
      // re-close the module and re-schedule r7/r21 — Fix 4 guards against the
      // double-close, but re-*offering* the quiz is still the wrong UX).
      if (done) {
        return (
          <Card>
            <Kicker className="mb-1.5">Module quiz</Kicker>
            <p className="text-[15px] text-fg-muted">Module quiz already taken — scheduled +7/+21-day reviews will confirm mastery.</p>
          </Card>
        );
      }
      const count = typeof config.count === 'number' ? config.count : 10;
      const items = await exerciseSetUseCase.startExerciseSet({ moduleId, pool: 'review', limit: count });
      return (
        <Card>
          <Kicker className="mb-1.5">Module quiz</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">{items.length} items from the review pool. 80%+ contributes toward Mastered once the +7/+21-day reviews also pass.</p>
          <StepExercisePanel
            items={items}
            context="module_quiz"
            headerLabel="Module quiz"
            startLabel={`Start · ${items.length} items`}
            stepId={stepId}
            moduleId={moduleId}
            isModuleQuiz
            progress={await exerciseSetUseCase.computeSetProgress(userId, items, 'module_quiz')}
          />
        </Card>
      );
    }

    default:
      return (
        <Card>
          <div className="text-[14.5px] text-fg-muted">Unrecognised step kind: {kind}</div>
        </Card>
      );
  }
}
