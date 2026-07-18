import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/** UC-04 `courseState==='completed'` — every module Mastered and the final checkpoint passed (ARCHITECTURE.md §1.1). No fabricated "start the next course" CTA: the second course doesn't exist in the DB yet (same placeholder rule as the course switcher, §1.1 UC-03). */
export function CourseCompletedBanner({ courseName, levelLabel }: { courseName: string; levelLabel: string }) {
  return (
    <Card tone="green" className="mb-3.5">
      <Kicker tone="green">
        {courseName.toUpperCase()} · {levelLabel}
      </Kicker>
      <div className="mt-1 text-2xl font-bold">Course complete</div>
      <div className="text-[14.5px] text-fg-muted">Every module reached Mastered, and the final checkpoint has passed.</div>
    </Card>
  );
}
