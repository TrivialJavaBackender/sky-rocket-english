import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import type { TodayStepDTO } from '@/lib/use-cases/today';
import type { SessionType } from '@/lib/domain/types';

/** The fixed weekly protocol always seeds exactly 4 sessions per module (db/migrations/0002) — structural, not per-course content, safe to display as "of 4". */
const SESSIONS_PER_MODULE = 4;

/** UC-01 session-due state's primary card — module chip, "Session N of 4", step list, Continue CTA (ARCHITECTURE.md §1.1, §1.3). */
export function SessionCard({
  courseSlug,
  moduleSlug,
  moduleTitle,
  sessionType,
  sessionTitle,
  sessionPosition,
  plannedMinutes,
  steps,
}: {
  courseSlug: string;
  moduleSlug: string;
  moduleTitle: string;
  sessionType: SessionType;
  sessionTitle: string;
  sessionPosition: number;
  plannedMinutes: number;
  steps: TodayStepDTO[];
}) {
  return (
    <Card className="mb-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="rounded-md bg-green-soft px-2.5 py-1 text-[11px] font-bold tracking-[.1em] text-green-text">{moduleSlug.toUpperCase()} · {moduleTitle.toUpperCase()}</span>
        <span className="text-[13px] tabular-nums text-fg-subtle">
          Session {sessionPosition} of {SESSIONS_PER_MODULE}
        </span>
      </div>
      <h1 className="m-0 text-[28px] leading-[1.15] tracking-[-.01em]">
        {sessionTitle} <span className="font-normal text-fg-subtle">· {plannedMinutes} min</span>
      </h1>
      <div className="mb-1.5 mt-3">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3.5 border-t border-border-faint py-[11px]">
            <span className="pt-0.5 text-sm font-semibold tabular-nums text-fg-faintest">{String(i + 1).padStart(2, '0')}</span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{s.title}</span>
              {s.detail && <span className="text-[13.5px] text-fg-muted">{s.detail}</span>}
            </span>
          </div>
        ))}
      </div>
      <LinkButton href={`/course/${courseSlug}/module/${moduleSlug}/session/${sessionType}`} size="block">
        Continue Session {sessionPosition} →
      </LinkButton>
    </Card>
  );
}
