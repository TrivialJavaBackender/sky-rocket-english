'use client';

import { useState } from 'react';
import type { PublicExerciseDTO, SetProgressDTO } from '@/lib/use-cases/exercise-set';
import type { CheckpointStatus } from '@/lib/domain/types';
import { ExercisePlayer, type ExercisePlayerSummary } from '@/components/player/ExercisePlayer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { finishCheckpoint } from '@/app/actions/course';
import { useActionRefresh } from '@/components/useActionRefresh';

/**
 * UC-18/19 checkpoint run (ARCHITECTURE.md §1.5). Same shape as
 * `StepExercisePanel`: the learner taps to open rather than having the queue
 * open on load, and `ExercisePlayer` stays agnostic — the domain follow-up here
 * is `finishCheckpoint`, which scores the attempt, applies the pass/fail gate
 * and (for a passed block checkpoint) unlocks the next block.
 *
 * A 40- or 60-item checkpoint is far too long to sit in one uninterrupted go,
 * so `progress` (from `computeSetProgress`) reopens the player where the
 * learner left off, with the dots already painted. "Start over" is offered
 * alongside, never instead: re-answering is always the learner's choice.
 *
 * The result is held in local state as well as being persisted, because
 * `finishCheckpoint`'s `revalidatePath` re-renders the page underneath the
 * player: without this the learner would close the overlay and see the page
 * with no indication of what they had just scored.
 */
export function CheckpointRunner({
  checkpointId,
  title,
  items,
  passMark,
  progress,
}: {
  checkpointId: number;
  title: string;
  items: PublicExerciseDTO[];
  passMark: number | null;
  progress: SetProgressDTO;
}) {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [result, setResult] = useState<{ score: number; status: CheckpointStatus } | null>(null);
  const { pending, run } = useActionRefresh();

  const partway = progress.answered > 0 && progress.answered < progress.total;

  async function handleFinished(summary: ExercisePlayerSummary) {
    const outcome = await finishCheckpoint(checkpointId, summary.correct, summary.total);
    setResult(outcome);
  }

  function launch(startFresh: boolean) {
    setFresh(startFresh);
    setOpen(true);
  }

  if (items.length === 0) {
    return (
      <div className="text-[14.5px] text-fg-muted">
        No items are loaded for this checkpoint yet — its content package has not been synced.
      </div>
    );
  }

  return (
    <>
      {result && (
        <Card tone={result.status === 'failed' ? 'red' : 'green'} padding="sm" className="mb-4">
          <Kicker tone={result.status === 'failed' ? 'red' : 'green'} className="mb-0.5">
            {result.status === 'failed' ? 'Below the pass mark' : passMark === null ? 'Baseline recorded' : 'Passed'}
          </Kicker>
          <div className="text-[14.5px]">
            You scored <strong className="tabular-nums">{result.score}%</strong>
            {passMark !== null && ` against a pass mark of ${passMark}%`}.{' '}
            {passMark === null
              ? 'Nothing is gated on this — it is the baseline your final attempt will be compared with.'
              : result.status === 'failed'
                ? 'Take a revision week on the weak modules, then retake this checkpoint.'
                : 'The next block is now unlocked.'}
          </div>
        </Card>
      )}

      {partway && !result && (
        <Card tone="soft" padding="sm" className="mb-3.5">
          <Kicker className="mb-0.5">Part way through</Kicker>
          <div className="text-[14.5px] text-fg-muted">
            {progress.answered} of {progress.total} answered. Your answers are saved as you go — closing the player
            never loses them.
          </div>
        </Card>
      )}

      <Button size="block" onClick={() => launch(!partway)} disabled={pending}>
        {result
          ? `Retake · ${items.length} items`
          : partway
            ? `Resume · item ${progress.resumeIndex + 1} of ${progress.total}`
            : `Start · ${items.length} items`}
      </Button>

      {partway && !result && (
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
          context="checkpoint"
          headerLabel={title}
          onFinished={handleFinished}
          onClose={() => run(async () => setOpen(false))}
          initialResults={fresh ? undefined : progress.results}
          initialIndex={fresh ? 0 : progress.resumeIndex}
        />
      )}
    </>
  );
}
