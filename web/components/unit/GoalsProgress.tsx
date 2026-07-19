import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import type { UnitGoalDTO } from '@/lib/use-cases/unit';

/**
 * UC-05 goals-progress card (D12) — replaces the static green-bullet GoalsList.
 * Each module goal is pinned to the session that earns it and flips
 * todo → in progress → achieved bottom-up as that session completes.
 */
export function GoalsProgress({ goals }: { goals: UnitGoalDTO[] }) {
  return (
    <Card className="mb-3.5">
      <Kicker className="mb-1">In this unit — goals unlock as you work</Kicker>
      {goals.map((g, i) => {
        const marker =
          g.status === 'achieved' ? (
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-green-soft text-[13px] font-bold text-green-text">✓</span>
          ) : g.status === 'in_progress' ? (
            <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-green" />
          ) : (
            <span className="h-[22px] w-[22px] flex-none rounded-full border border-border-faint bg-bg-faint" />
          );
        const label =
          g.status === 'achieved' ? 'Done' : g.status === 'in_progress' ? `In progress · Session ${g.sessionPosition}` : `Session ${g.sessionPosition} · ${g.sessionTitle}`;
        return (
          <div key={i} className="flex items-center gap-3 border-t border-border-faint py-[9px] first:border-t-0">
            {marker}
            <span className={`flex-1 text-[15px] ${g.status === 'todo' ? 'text-fg-muted' : ''}`}>{g.text}</span>
            <span className={`flex-none text-[11.5px] font-bold uppercase tracking-[.06em] ${g.status === 'achieved' ? 'text-green-text' : g.status === 'in_progress' ? 'text-fg' : 'text-fg-faint'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
