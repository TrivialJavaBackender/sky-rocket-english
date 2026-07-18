import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/** UC-01 overdue-reviews state (`todayState==='overdue-reviews'`) — ARCHITECTURE.md §1.1. */
export function OverdueBanner({ count, message }: { count: number; message: string }) {
  return (
    <Card tone="red" className="mb-3.5">
      <Kicker tone="red">Overdue reviews</Kicker>
      <div className="mb-0.5 mt-1 text-[17px] font-semibold">
        {count} review item{count === 1 ? ' has' : 's have'} slipped past its date.
      </div>
      <div className="text-[14px] leading-relaxed text-fg-muted">{message}</div>
      <LinkButton href="/review" variant="danger" className="mt-3">
        Clear the backlog
      </LinkButton>
    </Card>
  );
}
