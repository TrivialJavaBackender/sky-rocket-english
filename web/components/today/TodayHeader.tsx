/** Date eyebrow + streak counter row atop Today (ARCHITECTURE.md §1.1 UC-01, `SKY.today.date`/`streak`). */
export function TodayHeader({ now, streakDays }: { now: Date; streakDays: number }) {
  const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now).toUpperCase();
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <span className="text-[11px] font-bold tracking-kicker text-fg-subtle">{dateLabel}</span>
      <span className="text-[13px] font-semibold tabular-nums text-fg-muted">◆ {streakDays}-day streak</span>
    </div>
  );
}
