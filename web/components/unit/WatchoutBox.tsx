import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import type { WatchoutDTO } from '@/lib/repositories/content.repo';

/** UC-06 "Watch out!" box (ARCHITECTURE.md §1.2). One card per watchout — module-01 has 4 (real DB cardinality; the mockup only illustrates one). */
export function WatchoutBox({ watchout }: { watchout: WatchoutDTO }) {
  return (
    <Card tone="red" className="mb-3.5" padding="sm">
      <Kicker tone="red" className="mb-1.5">
        Watch out! · {watchout.title}
      </Kicker>
      <div className="text-[15.5px]">
        <span className="font-bold text-red">✗</span> <span className="text-red-text line-through decoration-red/60">{watchout.badExample}</span>
      </div>
      <div className="mt-0.5 text-[15.5px]">
        <span className="font-bold text-green">✓</span> <span className="font-semibold">{watchout.goodExample}</span>
      </div>
      {watchout.note && <div className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">{watchout.note}</div>}
    </Card>
  );
}
