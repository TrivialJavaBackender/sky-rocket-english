'use client';

import { useState } from 'react';
import type { AttemptContext } from '@/lib/domain/types';
import type { PublicExerciseDTO, SetProgressDTO } from '@/lib/use-cases/exercise-set';
import { ExercisePlayer, type ExercisePlayerSummary } from '@/components/player/ExercisePlayer';
import { Button } from '@/components/ui/Button';
import { advanceStep, closeModule } from '@/app/actions/sessions';
import { useActionRefresh } from '@/components/useActionRefresh';

/**
 * A session step whose completion is a graded exercise run — `exercise_set`,
 * `review_slot`, or `module_quiz` (UC-13/UC-14/UC-16, ARCHITECTURE.md §1.2-1.4).
 * The learner taps "Start" (rather than the queue opening automatically) so
 * the step list stays legible before commit. On finish: `module_quiz` closes
 * the module (schedules r7/r21, D5 unlock) via `closeModule`; anything else
 * just marks the step done via `advanceStep` — both already chain
 * `advanceStep` server-side, so this island stays a thin trigger.
 */
export function StepExercisePanel({
  items,
  context,
  headerLabel,
  startLabel,
  stepId,
  moduleId,
  isModuleQuiz,
  readingTitle,
  readingParagraphs,
  progress,
}: {
  items: PublicExerciseDTO[];
  context: AttemptContext;
  headerLabel: string;
  startLabel: string;
  stepId: number;
  moduleId: number;
  isModuleQuiz: boolean;
  /** Fix 3: the close-read text, passed through to `ExercisePlayer` so a reading_comprehension exercise_set can show it without leaving the player. */
  readingTitle?: string;
  readingParagraphs?: string[];
  /** Resume support (UC-09) — see `computeSetProgress`. Absent means "always start fresh". */
  progress?: SetProgressDTO;
}) {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const { pending, run } = useActionRefresh();

  const partway = !!progress && progress.answered > 0 && progress.answered < progress.total;

  function launch(startFresh: boolean) {
    setFresh(startFresh);
    setOpen(true);
  }

  async function handleFinished(summary: ExercisePlayerSummary) {
    if (isModuleQuiz) {
      await closeModule(moduleId, summary.score, stepId);
    } else {
      await advanceStep(stepId);
    }
  }

  if (items.length === 0) {
    return <div className="text-[14.5px] text-fg-muted">No exercises are available for this step yet.</div>;
  }

  return (
    <>
      {partway && (
        <div className="mb-2.5 text-[13.5px] text-fg-muted">
          {progress!.answered} of {progress!.total} answered — your answers are saved as you go.
        </div>
      )}
      <Button size="block" onClick={() => launch(!partway)} disabled={pending}>
        {partway ? `Resume · item ${progress!.resumeIndex + 1} of ${progress!.total}` : startLabel}
      </Button>
      {partway && (
        <button
          onClick={() => launch(true)}
          disabled={pending}
          className="mt-2.5 w-full text-[13.5px] font-semibold text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          Start over from item 1
        </button>
      )}
      {open && (
        <ExercisePlayer
          items={items}
          context={context}
          headerLabel={headerLabel}
          onFinished={handleFinished}
          onClose={() => run(async () => setOpen(false))}
          readingTitle={readingTitle}
          readingParagraphs={readingParagraphs}
          initialResults={fresh || !progress ? undefined : progress.results}
          initialIndex={fresh || !progress ? 0 : progress.resumeIndex}
        />
      )}
    </>
  );
}
