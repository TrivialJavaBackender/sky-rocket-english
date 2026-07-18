import { notFound } from 'next/navigation';
import { getCurrentUserId } from '@/lib/current-user';
import * as sessionUseCase from '@/lib/use-cases/session';
import * as unitUseCase from '@/lib/use-cases/unit';
import * as exerciseSetUseCase from '@/lib/use-cases/exercise-set';
import * as writingUseCase from '@/lib/use-cases/writing';
import type { ExerciseGroup, ExerciseTypeCode, ReadingKind, SessionType } from '@/lib/domain/types';
import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { SessionSteps } from '@/components/session/SessionSteps';
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
export default async function SessionPage({ params }: { params: Promise<{ courseSlug: string; moduleSlug: string; sessionType: string }> }) {
  const { courseSlug, moduleSlug, sessionType } = await params;
  if (!SESSION_TYPES.includes(sessionType as SessionType)) notFound();

  const userId = await getCurrentUserId();
  const session = await sessionUseCase.getSession(userId, courseSlug, moduleSlug, sessionType as SessionType);
  if (!session) notFound();

  const activeStep = session.steps.find((s) => s.status !== 'done') ?? null;

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
        <SessionSteps steps={session.steps} activeStepId={activeStep?.id ?? null} />
      </Card>

      {activeStep ? (
        <ActiveStepPanel userId={userId} moduleId={session.moduleId} stepId={activeStep.id} kind={activeStep.kind} title={activeStep.title} config={activeStep.config} />
      ) : (
        <Card className="text-center">
          <div className="text-[17px] font-bold">Session complete</div>
          <div className="mt-1 text-[14.5px] text-fg-muted">Every step here is done — head back to the unit to pick the next session.</div>
          <LinkButton href={`/course/${courseSlug}/module/${moduleSlug}`} className="mt-3.5">
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
  stepId,
  kind,
  title,
  config,
}: {
  userId: number;
  moduleId: number;
  stepId: number;
  kind: string;
  title: string;
  config: Record<string, unknown>;
}) {
  switch (kind) {
    case 'opener': {
      return (
        <Card>
          <Kicker className="mb-1.5">Unit opener</Kicker>
          <p className="text-[15px] text-fg-muted">Review the unit's goals and can-do statements on the unit page, then mark this step done to move on.</p>
          <MarkStepDone stepId={stepId} />
        </Card>
      );
    }

    case 'theory': {
      const { spotlights, watchouts } = await unitUseCase.getModuleTheory(moduleId);
      return (
        <div>
          {spotlights.map((s) => (
            <GrammarSpotlight key={s.id} spotlight={s} />
          ))}
          {watchouts.map((w) => (
            <WatchoutBox key={w.id} watchout={w} />
          ))}
          <Card>
            <MarkStepDone stepId={stepId} />
          </Card>
        </div>
      );
    }

    case 'reading': {
      const readingKind = (config.reading_kind as ReadingKind | undefined) ?? 'main';
      const reading = await unitUseCase.getReadingWithGlosses(moduleId, readingKind);
      if (!reading) {
        return (
          <Card>
            <div className="text-[14.5px] text-fg-muted">No {readingKind} text is available for this module yet.</div>
            <div className="mt-3">
              <MarkStepDone stepId={stepId} />
            </div>
          </Card>
        );
      }
      return (
        <Card>
          {reading.kicker && <Kicker>{reading.kicker}</Kicker>}
          <h2 className="text-pretty m-0 mb-1 mt-1 text-[22px] leading-[1.2] tracking-[-.01em]">{reading.title}</h2>
          {reading.meta && <div className="mb-3.5 text-[13px] text-fg-subtle">{reading.meta}</div>}
          <ReadingText paragraphs={reading.paragraphs} glosses={reading.glosses} moduleId={moduleId} />
          <div className="mt-3">
            <MarkStepDone stepId={stepId} />
          </div>
        </Card>
      );
    }

    case 'vocab': {
      const entries = await unitUseCase.getModuleVocab(userId, moduleId);
      return (
        <div>
          <VocabStudio title={title} entries={entries} />
          <Card>
            <MarkStepDone stepId={stepId} />
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
          />
        </Card>
      );
    }

    case 'exercise_set': {
      const types = Array.isArray(config.types) ? (config.types as ExerciseTypeCode[]) : undefined;
      const groupKey = typeof config.group_key === 'string' ? (config.group_key as ExerciseGroup) : undefined;
      const items = await exerciseSetUseCase.startExerciseSet({ moduleId, types, groupKey, pool: 'core' });
      return (
        <Card>
          <Kicker className="mb-1.5">{title}</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">{items.length} exercise{items.length === 1 ? '' : 's'} in this set.</p>
          <StepExercisePanel items={items} context="session" headerLabel={title} startLabel={`Start · ${items.length} items`} stepId={stepId} moduleId={moduleId} isModuleQuiz={false} />
        </Card>
      );
    }

    case 'harvest':
      return (
        <Card>
          <Kicker className="mb-1.5">Harvest errors</Kicker>
          <p className="mb-3 text-[15px] text-fg-muted">Every exercise you missed above already offered a "Harvest to flashcards" button — anything you harvested is already in your deck. Mark this step done to continue.</p>
          <MarkStepDone stepId={stepId} />
        </Card>
      );

    case 'production': {
      const task = await writingUseCase.getWritingTaskForModule(moduleId);
      if (!task) {
        return (
          <Card>
            <div className="text-[14.5px] text-fg-muted">No writing/speaking task is available for this module yet.</div>
            <div className="mt-3">
              <MarkStepDone stepId={stepId} />
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
              <MarkStepDone stepId={stepId} />
            </div>
          </Card>
        );
      }
      const view = await writingUseCase.getSelfCheckView(userId, task.id);
      return <SelfCheck task={task} latestSubmission={view?.latestSubmission ?? null} stepId={stepId} />;
    }

    case 'module_quiz': {
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
