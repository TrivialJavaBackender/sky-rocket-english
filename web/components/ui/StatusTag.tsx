import type { ModuleStatus } from '@/lib/domain/types';

const LABELS: Record<ModuleStatus, string> = {
  locked: 'Locked',
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  completed: 'Completed',
  mastered: 'Mastered',
};

/**
 * Module status pill (CourseMap rows, Today's current-module chip). Color
 * comes from the module's block (§8 D4 — never hardcoded), matching the
 * mockup's per-state styling: Mastered = block tint/color, Completed =
 * outlined in block color, In progress = solid ink, else = faint/neutral.
 */
export function StatusTag({ status, blockColor, blockTint }: { status: ModuleStatus; blockColor: string; blockTint: string }) {
  const base = 'inline-flex flex-none whitespace-nowrap rounded-md px-[9px] py-[3px] text-[11px] font-bold tracking-[.07em] uppercase';
  if (status === 'mastered') {
    return (
      <span className={base} style={{ background: blockTint, color: blockColor }}>
        {LABELS[status]}
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className={`${base} bg-bg-card border`} style={{ borderColor: `${blockColor}66`, color: blockColor }}>
        {LABELS[status]}
      </span>
    );
  }
  if (status === 'in_progress') {
    return <span className={`${base} bg-ink text-white`}>{LABELS[status]}</span>;
  }
  return <span className={`${base} bg-bg-faint text-fg-faint`}>{LABELS[status]}</span>;
}
