'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { Button } from '@/components/ui/Button';
import { resetAllProgress } from '@/app/actions/maintenance';

/** Testing/dev affordance (single-user app, no auth yet) — wipes every progress row so the app can be re-driven from a clean slate. Two-step confirm to guard against a stray tap; see lib/use-cases/maintenance.ts for exactly what gets deleted. */
export function ResetProgressCard() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    await resetAllProgress();
    router.push('/');
    router.refresh();
  }

  return (
    <Card tone="red" className="mt-3.5">
      <Kicker tone="red">Danger zone</Kicker>
      <div className="mt-1.5 text-[14.5px] text-fg-muted">Wipes every attempt, review queue, card state and session progress. Course content stays. There is no undo.</div>
      {confirming ? (
        <div className="mt-3.5 flex gap-2.5">
          <Button variant="danger" onClick={handleConfirm} disabled={pending}>
            {pending ? 'Wiping…' : 'Yes, wipe everything'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Keep my progress
          </Button>
        </div>
      ) : (
        <Button variant="danger-outline" className="mt-3.5" onClick={() => setConfirming(true)}>
          Reset all progress…
        </Button>
      )}
    </Card>
  );
}
