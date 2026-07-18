import { Card } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/LinkButton';

/** UC-01 nothing-due state — ARCHITECTURE.md §1.1 (`todayState==='nothing-due'`). Generic, data-honest copy: no fabricated "unlocks tomorrow" specifics the DTO doesn't carry. */
export function NothingDueCard() {
  return (
    <Card className="mb-3.5 py-[38px] text-center">
      <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-green-soft text-lg font-bold text-green">✓</div>
      <div className="text-[21px] font-bold">Nothing due today</div>
      <div className="text-pretty mx-auto mt-1.5 max-w-[360px] text-[14.5px] leading-relaxed text-fg-muted">
        Flashcards and the exercise re-queue are both clear. Your streak is safe — browse the course map if you want a head start.
      </div>
      <LinkButton href="/course" variant="outline" className="mt-[18px]">
        Browse the course map
      </LinkButton>
    </Card>
  );
}
