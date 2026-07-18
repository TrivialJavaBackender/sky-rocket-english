'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { advanceStep } from '@/app/actions/sessions';
import { Button } from '@/components/ui/Button';

/** Generic completion control for step kinds with no server-graded interaction of their own (opener/theory/reading/vocab/harvest) — UC-13. */
export function MarkStepDone({ stepId, label = 'Mark this step done' }: { stepId: number; label?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (pending) return;
    setPending(true);
    await advanceStep(stepId);
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="block" onClick={handleClick} disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}
