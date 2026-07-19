import Link from 'next/link';
import type { UnitSessionCellDTO } from '@/lib/use-cases/unit';

/**
 * UC-05 session plan — one row per session with done/current/locked state
 * (D11 hard gating) and a compact preview of its steps, so the whole week is
 * visible up front (incl. the Output writing task and extra text). Locked
 * rows are not links; the server-side redirect in the session page is the
 * backstop for direct URLs.
 */
export function SessionRibbon({ courseSlug, moduleSlug, sessions }: { courseSlug: string; moduleSlug: string; sessions: UnitSessionCellDTO[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {sessions.map((s) => {
        const locked = s.cell === 'locked';
        const rowClass =
          s.cell === 'current'
            ? 'border-2 border-green bg-bg-card'
            : s.cell === 'done'
              ? 'border border-border bg-bg-faint'
              : 'border border-border bg-bg-card opacity-60';
        const stateLabel = s.cell === 'done' ? 'Done · revisit' : s.cell === 'current' ? 'Up next' : `Finish Session ${s.position - 1} first`;

        const body = (
          <>
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${
                  s.cell === 'done' ? 'bg-green-soft text-green-text' : s.cell === 'current' ? 'bg-ink text-white' : 'bg-bg-faint text-fg-faint'
                }`}
              >
                {s.cell === 'done' ? '✓' : s.position}
              </span>
              <span className={`text-[12px] font-bold uppercase tracking-[.06em] ${s.cell === 'current' ? 'text-green' : 'text-fg-subtle'}`}>
                Session {s.position} · {s.title}
              </span>
              <span className="text-xs tabular-nums text-fg-subtle">{s.plannedMinutes}′</span>
              <span className={`ml-auto text-right text-[11.5px] font-bold uppercase tracking-[.06em] ${s.cell === 'current' ? 'text-green-text' : 'text-fg-faint'}`}>
                {locked && <span className="mr-1" aria-hidden>🔒</span>}
                {stateLabel}
              </span>
            </div>
            <div className="mt-2 border-t border-border-faint pt-1.5">
              {s.steps.map((st, i) => (
                <div key={i} className="flex items-baseline gap-2 py-[3px] text-[13px]">
                  <span className={`w-3.5 flex-none text-center ${st.status === 'done' ? 'font-bold text-green-text' : 'text-fg-faint'}`}>{st.status === 'done' ? '✓' : '·'}</span>
                  <span className={st.status === 'done' ? 'text-fg-muted line-through decoration-border' : 'text-fg'}>{st.title}</span>
                  <span className="ml-auto flex-none text-xs tabular-nums text-fg-faint">{st.plannedMinutes}′</span>
                </div>
              ))}
            </div>
          </>
        );

        if (locked) {
          return (
            <div key={s.sessionType} aria-disabled className={`rounded-lg px-3.5 py-3 ${rowClass}`}>
              {body}
            </div>
          );
        }
        return (
          <Link key={s.sessionType} href={`/course/${courseSlug}/module/${moduleSlug}/session/${s.sessionType}`} className={`rounded-lg px-3.5 py-3 no-underline ${rowClass}`}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
