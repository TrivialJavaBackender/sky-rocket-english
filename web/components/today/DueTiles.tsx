import Link from 'next/link';

/** Cards-due / queue-due tiles (UC-01) — link to the dedicated `/flashcards` and `/review` routes (ARCHITECTURE.md §7.1) rather than an in-place overlay, so the SRS queue and the re-queue lane hub are each reachable at a stable URL. */
export function DueTiles({ cardsDue, queueDue }: { cardsDue: number; queueDue: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/flashcards" className="rounded-xl border border-border bg-bg-card px-4 py-3.5 no-underline">
        <span className="block text-[26px] font-bold tabular-nums">{cardsDue}</span>
        <span className="block text-[13px] text-fg-muted">cards due · ≈ 12 min</span>
      </Link>
      <Link href="/review" className="rounded-xl border border-border bg-bg-card px-4 py-3.5 no-underline">
        <span className="block text-[26px] font-bold tabular-nums">{queueDue}</span>
        <span className="block text-[13px] text-fg-muted">re-queue items waiting</span>
      </Link>
    </div>
  );
}
