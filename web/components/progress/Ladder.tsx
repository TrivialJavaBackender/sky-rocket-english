import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/**
 * UC-04 "HOW ITEMS ADVANCE" — the three status ladders. Fixed system
 * vocabulary (the enum values themselves, from `lib/domain/types.ts` /
 * PLAN.md §4), not per-course editorial content, so it's safe to state here
 * directly rather than round-trip it through a use-case (same footing as
 * StatusTag's status labels, §8 D4 only restricts block/module names/colors).
 */
const LADDER: { key: string; value: string }[] = [
  { key: 'Lexeme', value: 'New → Learning → Known → In use' },
  { key: 'Construction', value: 'Introduced → Practising → Reliable' },
  { key: 'Module', value: 'Upcoming → In progress → Completed → Mastered' },
];

export function Ladder() {
  return (
    <Card className="mb-3.5">
      <Kicker className="mb-1.5">How items advance</Kicker>
      {LADDER.map((l) => (
        <div key={l.key} className="flex gap-3 border-t border-border-faint py-2 text-sm first:border-t-0">
          <span className="w-[110px] flex-none font-bold">{l.key}</span>
          <span className="text-fg-muted">{l.value}</span>
        </div>
      ))}
    </Card>
  );
}
