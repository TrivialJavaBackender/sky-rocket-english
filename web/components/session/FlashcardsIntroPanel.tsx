'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeFlashcardsIntro } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';

/** `flashcards_intro` step (UC-15 note, ARCHITECTURE.md §1.3) — introduces the module's deck (card_state phase='new', spread over the next week) and marks the step done in one call. */
export function FlashcardsIntroPanel({ moduleId, stepId }: { moduleId: number; stepId: number }) {
  const [pending, setPending] = useState(false);
  const [introduced, setIntroduced] = useState<number | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (pending) return;
    setPending(true);
    const result = await completeFlashcardsIntro(moduleId, stepId);
    setIntroduced(result.introduced);
    setPending(false);
    router.refresh();
  }

  if (introduced != null) {
    return <div className="text-[14.5px] font-semibold text-green-text">✓ {introduced} new card{introduced === 1 ? '' : 's'} joined the daily review queue.</div>;
  }

  return (
    <Button size="block" onClick={handleClick} disabled={pending}>
      {pending ? 'Adding…' : 'Add module cards to rotation'}
    </Button>
  );
}
