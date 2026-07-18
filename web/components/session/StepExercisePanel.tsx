'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AttemptContext } from '@/lib/domain/types';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import { ExercisePlayer, type ExercisePlayerSummary } from '@/components/player/ExercisePlayer';
import { Button } from '@/components/ui/Button';
import { advanceStep, closeModule } from '@/app/actions/sessions';

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
}: {
  items: PublicExerciseDTO[];
  context: AttemptContext;
  headerLabel: string;
  startLabel: string;
  stepId: number;
  moduleId: number;
  isModuleQuiz: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
      <Button size="block" onClick={() => setOpen(true)}>
        {startLabel}
      </Button>
      {open && (
        <ExercisePlayer
          items={items}
          context={context}
          headerLabel={headerLabel}
          onFinished={handleFinished}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
