'use client';

import { useState } from 'react';
import { completeFlashcardsIntro } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';
import { useActionRefresh } from '@/components/useActionRefresh';

/** `flashcards_intro` step (UC-15 note, ARCHITECTURE.md §1.3) — introduces the words met so far (card_state phase='new', spread over the next week) and marks the step done in one call. Later batches join from their own `vocab` step, so the count here is one batch, not the module's whole deck. */
export function FlashcardsIntroPanel({ moduleId, stepId }: { moduleId: number; stepId: number }) {
  const [introduced, setIntroduced] = useState<number | null>(null);
  const { pending, run } = useActionRefresh();

  function handleClick() {
    run(async () => {
      const result = await completeFlashcardsIntro(moduleId, stepId);
      setIntroduced(result.introduced);
    });
  }

  if (introduced != null) {
    return <div className="text-[14.5px] font-semibold text-green-text">✓ {introduced} new card{introduced === 1 ? '' : 's'} joined the daily review queue.</div>;
  }

  return (
    <Button size="block" onClick={handleClick} disabled={pending}>
      {pending ? 'Adding…' : "Add this batch's cards to rotation"}
    </Button>
  );
}
