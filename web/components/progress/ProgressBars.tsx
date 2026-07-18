import type { ProgressBlockDTO } from '@/lib/use-cases/progress';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { ProgressBar } from '@/components/ui/ProgressBar';

/** UC-04 "BLOCKS" section — one bar per block, colored from the DB (§8 D4). */
export function ProgressBars({ blocks }: { blocks: ProgressBlockDTO[] }) {
  return (
    <Card className="mb-3.5">
      <Kicker className="mb-2.5">Blocks</Kicker>
      {blocks.map((b, i) => (
        <div key={b.slug} className="flex items-center gap-3 py-2">
          <span className="h-[11px] w-[11px] flex-none rounded-sm" style={{ background: b.color }} />
          <span className="w-[150px] flex-none text-sm font-semibold">
            Block {i + 1} · {b.name}
          </span>
          <ProgressBar pct={b.pct} color={b.color} />
          <span className="w-10 flex-none text-right text-[13.5px] font-semibold tabular-nums text-fg-muted">{b.pct}%</span>
        </div>
      ))}
    </Card>
  );
}
