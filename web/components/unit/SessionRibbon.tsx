import Link from 'next/link';
import type { UnitSessionCellDTO } from '@/lib/use-cases/unit';

/** UC-05 session ribbon — Prime/Input/Workout/Output cells with done/current/todo state (ARCHITECTURE.md §1.2, §1.3). */
export function SessionRibbon({ courseSlug, moduleSlug, sessions }: { courseSlug: string; moduleSlug: string; sessions: UnitSessionCellDTO[] }) {
  return (
    <div className="mt-3.5 grid grid-cols-4 gap-2">
      {sessions.map((s) => {
        const mark = s.cell === 'done' ? '✓' : String(s.position);
        const cellClass =
          s.cell === 'current'
            ? 'border-2 border-green bg-bg-card'
            : s.cell === 'done'
              ? 'border border-border bg-bg-faint'
              : 'border border-border bg-bg-card opacity-75';
        return (
          <Link key={s.sessionType} href={`/course/${courseSlug}/module/${moduleSlug}/session/${s.sessionType}`} className={`rounded-lg px-1.5 py-2.5 text-center no-underline ${cellClass}`}>
            <div className={`text-[11.5px] font-bold uppercase tracking-[.06em] ${s.cell === 'current' ? 'text-green' : 'text-fg-subtle'}`}>
              {mark} · {s.title}
            </div>
            <div className="text-xs tabular-nums text-fg-subtle">{s.plannedMinutes}′</div>
          </Link>
        );
      })}
    </div>
  );
}
