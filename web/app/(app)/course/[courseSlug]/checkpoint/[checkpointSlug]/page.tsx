import { notFound, redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/current-user';
import * as checkpointUseCase from '@/lib/use-cases/checkpoint';
import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { CheckpointRunner } from '@/components/checkpoint/CheckpointRunner';
import { WritingEditor } from '@/components/writing/WritingEditor';
import { SelfCheck } from '@/components/writing/SelfCheck';
import * as writingUseCase from '@/lib/use-cases/writing';

// Per-user checkpoint status changes as progress is made (see app/course/page.tsx).
export const dynamic = 'force-dynamic';

// UC-18 Diagnostic + UC-19 Block/final checkpoints (ARCHITECTURE.md §1.5, §7.1).
export default async function CheckpointPage({
  params,
}: {
  params: Promise<{ courseSlug: string; checkpointSlug: string }>;
}) {
  const { courseSlug, checkpointSlug } = await params;
  const userId = await getCurrentUserId();
  const result = await checkpointUseCase.getCheckpointForUser(userId, courseSlug, checkpointSlug);

  if (result.kind === 'not_found') notFound();
  // Same bounce as a locked session (D11): the map is where the reason is shown.
  if (result.kind === 'locked') redirect('/course');
  const cp = result.checkpoint;

  const isDiagnostic = cp.kind === 'diagnostic';
  const retaking = cp.status === 'passed' || cp.status === 'failed';

  return (
    <div className="animate-fade-up">
      <LinkButton href="/course" variant="ghost" className="mb-3.5">
        ← Course map
      </LinkButton>

      <div className="mb-4">
        <Kicker>
          {isDiagnostic ? 'Diagnostic' : cp.kind === 'final' ? 'Final mock' : 'Block checkpoint'}
          {cp.passMark !== null && ` · pass mark ${cp.passMark}%`}
          {cp.bestScore !== null && ` · best ${cp.bestScore}%`}
        </Kicker>
        <h1 className="m-0 mt-1 text-[30px] tracking-[-.01em]">{cp.title}</h1>
      </div>

      <Card tone="soft" padding="sm" className="mb-4">
        <div className="text-[14.5px] text-fg-muted">
          {isDiagnostic ? (
            <>
              {cp.exercises.length} Use of English items covering every grammar topic in the course, followed by a
              written and a spoken task. Nothing here is gated on your score — the point is a map of what will be easy
              and what will be hard. Sit it in one session, without a dictionary.
            </>
          ) : (
            <>
              {cp.exercises.length} items drawn from the modules of this block, followed by a written task. The pass
              mark is {cp.passMark}%. Score below it and the recommendation is a revision week before the next block,
              then a retake.
            </>
          )}
        </div>
      </Card>

      {retaking && (
        <Card padding="sm" className="mb-4">
          <Kicker className="mb-0.5">Already taken</Kicker>
          <div className="text-[14.5px] text-fg-muted">
            Your best score is {cp.bestScore}%. Retaking replaces it only if you do better.
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <Kicker className="mb-1.5">{isDiagnostic ? 'Use of English' : 'Test items'}</Kicker>
        <p className="mb-3 text-[15px] text-fg-muted">
          {cp.exercises.length} item{cp.exercises.length === 1 ? '' : 's'}, answered in one run. Each one explains itself
          after you answer.
        </p>
        <CheckpointRunner
          checkpointId={cp.checkpointId}
          title={cp.title}
          items={cp.exercises}
          passMark={cp.passMark}
          progress={cp.progress}
        />
      </Card>

      {cp.writingTask ? (
        <>
          <WritingEditor task={cp.writingTask} />
          {/*
            A checkpoint has no session steps, so it never reaches the `self_check`
            step that shows the model answer inside a module. Without this the
            model answer and the checklist were authored but unreachable — the
            editor even promised "standalone usage reveals the model answer
            below". No `stepId`: there is no step to complete here.
          */}
          <div className="mt-4">
            <SelfCheck
              task={cp.writingTask}
              latestSubmission={(await writingUseCase.getSelfCheckView(userId, cp.writingTask.id))?.latestSubmission ?? null}
            />
          </div>
        </>
      ) : (
        <Card>
          <div className="text-[14.5px] text-fg-muted">No production task is attached to this checkpoint yet.</div>
        </Card>
      )}
    </div>
  );
}
