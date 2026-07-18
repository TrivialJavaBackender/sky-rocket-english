'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import type { ReviewStage } from '@/lib/domain/types';
import { ExercisePlayer, type ExercisePlayerSummary } from '@/components/player/ExercisePlayer';
import { Button } from '@/components/ui/Button';
import { finishModuleReview } from '@/app/actions/reviews';

/** UC-17 lane 3 "Take quiz" — a module's r7/r21 review (ARCHITECTURE.md §1.4, §6.3). On finish, `finishModuleReview` scores the run, decides pass/fail, and promotes the module to Mastered once both stages pass. */
export function ModuleReviewLauncher({ moduleId, moduleTitle, stage, items }: { moduleId: number; moduleTitle: string; stage: ReviewStage; items: PublicExerciseDTO[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleFinished(summary: ExercisePlayerSummary) {
    await finishModuleReview(moduleId, stage, summary.attempts);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Take quiz
      </Button>
      {open && (
        <ExercisePlayer
          items={items}
          context="module_review"
          headerLabel={`${moduleTitle} · +${stage === 'r7' ? 7 : 21}-day quiz`}
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
