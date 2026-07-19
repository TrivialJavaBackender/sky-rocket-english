import Link from 'next/link';
import type { SessionStepDTO } from '@/lib/repositories/module.repo';

/**
 * UC-13 session runner's step list (ARCHITECTURE.md §1.3, §7.2 `SessionSteps`)
 * — read-only overview; the viewed step's interactive panel is rendered
 * separately below. Fix 2 (step revisiting): a step is "viewable" once it's
 * done or is the active (first not-done) step — those rows link to
 * `?step={i+1}`, which the session page reads back to pick which step's
 * panel to render. `viewedStepId` (active step by default, or whatever
 * `?step` resolved to) drives the highlight, independently of which step is
 * actually active, so the row you're looking at is the one that's bold.
 */
export function SessionSteps({ steps, activeStepId, viewedStepId }: { steps: SessionStepDTO[]; activeStepId: number | null; viewedStepId: number | null }) {
  return (
    <div className="mb-5">
      {steps.map((s, i) => {
        const isDone = s.status === 'done';
        const isActive = s.id === activeStepId;
        const isViewed = s.id === viewedStepId;
        const isViewable = isDone || isActive;
        const row = (
          <div className={`flex items-center gap-3.5 border-t border-border-faint py-[11px] first:border-t-0 ${isViewed ? '' : 'opacity-80'}`}>
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${
                isDone ? 'bg-green-soft text-green-text' : isActive ? 'bg-ink text-white' : 'bg-bg-faint text-fg-faint'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </span>
            <span className="flex-1">
              <span className={`block text-[15px] ${isViewed ? 'font-bold' : 'font-semibold'}`}>{s.title}</span>
              {s.detail && <span className="text-[13px] text-fg-muted">{s.detail}</span>}
            </span>
            <span className="text-xs tabular-nums text-fg-faint">{s.plannedMinutes}′</span>
          </div>
        );
        return isViewable ? (
          <Link key={s.id} href={`?step=${i + 1}`} className="block text-fg no-underline">
            {row}
          </Link>
        ) : (
          <div key={s.id}>{row}</div>
        );
      })}
    </div>
  );
}
