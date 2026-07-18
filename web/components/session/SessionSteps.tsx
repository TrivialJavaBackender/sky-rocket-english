import type { SessionStepDTO } from '@/lib/repositories/module.repo';

/** UC-13 session runner's step list (ARCHITECTURE.md §1.3, §7.2 `SessionSteps`) — read-only overview; the active step's interactive panel is rendered separately below. */
export function SessionSteps({ steps, activeStepId }: { steps: SessionStepDTO[]; activeStepId: number | null }) {
  return (
    <div className="mb-5">
      {steps.map((s, i) => {
        const isActive = s.id === activeStepId;
        const isDone = s.status === 'done';
        return (
          <div key={s.id} className={`flex items-center gap-3.5 border-t border-border-faint py-[11px] first:border-t-0 ${isActive ? '' : 'opacity-80'}`}>
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${
                isDone ? 'bg-green-soft text-green-text' : isActive ? 'bg-ink text-white' : 'bg-bg-faint text-fg-faint'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </span>
            <span className="flex-1">
              <span className={`block text-[15px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{s.title}</span>
              {s.detail && <span className="text-[13px] text-fg-muted">{s.detail}</span>}
            </span>
            <span className="text-xs tabular-nums text-fg-faint">{s.plannedMinutes}′</span>
          </div>
        );
      })}
    </div>
  );
}
