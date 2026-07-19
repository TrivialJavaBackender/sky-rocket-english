'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Runs a progress mutation and its follow-up `router.refresh()` inside one
 * React transition, so `pending` stays true until the re-rendered server UI
 * has actually been applied. The previous pattern (`await action();
 * setPending(false); router.refresh()`) re-enabled the trigger while the
 * refresh roundtrip was still in flight: on a fast connection the swap felt
 * instant, but on a phone the old step stayed on screen for seconds with no
 * feedback, inviting a second tap ("the next step only appears every other
 * tap").
 *
 * `scrollTop` (default true) jumps back to the top before the new content
 * commits — `router.refresh()` deliberately preserves scroll position, which
 * left mobile users staring at the bottom of the next step's panel.
 */
export function useActionRefresh() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>, { scrollTop = true }: { scrollTop?: boolean } = {}) {
    if (pending) return;
    startTransition(async () => {
      await action();
      if (scrollTop) window.scrollTo(0, 0);
      router.refresh();
    });
  }

  return { pending, run };
}
