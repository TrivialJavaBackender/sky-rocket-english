import Link from 'next/link';

/**
 * Cards-due / queue-due tiles (UC-01) — link to the dedicated `/flashcards` and
 * `/review` routes (ARCHITECTURE.md §7.1) rather than an in-place overlay, so
 * the SRS queue and the re-queue lane hub are each reachable at a stable URL.
 *
 * The cards tile is scoped to the active course, since that is the deck its
 * Start deals out; a backlog in the learner's other courses is called out
 * separately and lives on `/review`, where each course has its own run.
 */
export function DueTiles({ cardsDue, otherCoursesCardsDue, courseSlug, queueDue }: { cardsDue: number; otherCoursesCardsDue: number; courseSlug: string; queueDue: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href={`/flashcards?course=${courseSlug}`} className="rounded-xl border border-border bg-bg-card px-4 py-3.5 no-underline">
        <span className="block text-[26px] font-bold tabular-nums">{cardsDue}</span>
        <span className="block text-[13px] text-fg-muted">cards due · ≈ 12 min</span>
        {otherCoursesCardsDue > 0 && <span className="mt-0.5 block text-[12px] tabular-nums text-fg-faint">+{otherCoursesCardsDue} in your other courses</span>}
      </Link>
      <Link href="/review" className="rounded-xl border border-border bg-bg-card px-4 py-3.5 no-underline">
        <span className="block text-[26px] font-bold tabular-nums">{queueDue}</span>
        <span className="block text-[13px] text-fg-muted">re-queue items waiting</span>
      </Link>
    </div>
  );
}
