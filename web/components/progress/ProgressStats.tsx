import type { ProgressStatDTO } from '@/lib/use-cases/progress';

/** UC-04 Progress stat tiles (ARCHITECTURE.md §1.1). Values are pre-formatted by the use-case (percent strings, counts) — this just lays them out. */
export function ProgressStats({ stats }: { stats: ProgressStatDTO[] }) {
  return (
    <div className="mb-3.5 grid grid-cols-2 gap-3 desktop:grid-cols-4">
      {stats.map((s, i) => (
        <div key={i} className="rounded-lg border border-border bg-bg-card p-4">
          <div className="text-[32px] font-bold tracking-[-.02em] tabular-nums">{s.bigLabel}</div>
          <div className="mt-0.5 text-[13.5px] font-semibold">{s.label}</div>
          <div className="text-[12.5px] tabular-nums text-fg-subtle">{s.subLabel}</div>
        </div>
      ))}
    </div>
  );
}
