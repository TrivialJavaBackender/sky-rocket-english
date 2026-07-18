import type { ProgressUpcomingDTO } from '@/lib/use-cases/progress';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/** UC-04 "SCHEDULED" — the nearest module-review and re-queue dates (ARCHITECTURE.md §1.1). */
export function UpcomingList({ upcoming }: { upcoming: ProgressUpcomingDTO[] }) {
  if (upcoming.length === 0) return null;
  return (
    <Card>
      <Kicker className="mb-1.5">Scheduled</Kicker>
      {upcoming.map((u, i) => (
        <div key={i} className="flex gap-3.5 border-t border-border-faint py-2 text-sm first:border-t-0">
          <span className="w-[60px] flex-none font-bold tabular-nums">{u.dateLabel}</span>
          <span>{u.title}</span>
        </div>
      ))}
    </Card>
  );
}
