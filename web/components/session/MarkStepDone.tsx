'use client';

import { advanceStep } from '@/app/actions/sessions';
import { Button } from '@/components/ui/Button';
import { useActionRefresh } from '@/components/useActionRefresh';

/**
 * Generic completion control for step kinds with no server-graded interaction
 * of their own (opener/theory/reading/vocab/harvest) — UC-13. `done` is set
 * when the session runner is revisiting a step already marked done (Fix 2):
 * the action button is replaced with an inert indicator so re-viewing a
 * completed opener/theory/reading/vocab/harvest step can't advance/re-close
 * the session a second time. The button stays in its pending state until the
 * next step's UI is on screen (see useActionRefresh).
 */
export function MarkStepDone({ stepId, label = 'Mark this step done', done = false }: { stepId: number; label?: string; done?: boolean }) {
  const { pending, run } = useActionRefresh();

  if (done) {
    return <div className="w-full rounded-lg border border-border-faint bg-bg-faint px-[18px] py-[14px] text-center text-base font-semibold text-fg-faint">✓ Step already done</div>;
  }

  return (
    <Button size="block" onClick={() => run(() => advanceStep(stepId))} disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}
