import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import type { GrammarSpotlightDTO } from '@/lib/repositories/content.repo';

/**
 * UC-06 grammar spotlight (ARCHITECTURE.md §1.2). The mockup shows a single
 * spotlight card; module-01's `theory.yaml` actually carries 5 (one per
 * grammar point) — real DB cardinality, not the mockup's illustrative one,
 * so each spotlight gets its own card here.
 */
export function GrammarSpotlight({ spotlight }: { spotlight: GrammarSpotlightDTO }) {
  return (
    <Card tone="green" className="mb-3.5">
      <Kicker tone="green" className="mb-1.5">
        Grammar spotlight
      </Kicker>
      <h2 className="text-pretty m-0 mb-2 text-[22px] leading-[1.2] tracking-[-.01em]">{spotlight.title}</h2>
      {spotlight.intro && <p className="text-pretty m-0 mb-1.5 text-[15px] leading-relaxed text-fg">{spotlight.intro}</p>}
      {spotlight.items.map((row, i) => (
        <div key={i} className="border-t border-green-border py-[11px]">
          <div className="text-[14.5px] font-bold text-green-text">{row.form}</div>
          <div className="my-0.5 text-[15.5px] italic">{row.example}</div>
          <div className="text-[13.5px] text-fg-muted">{row.note}</div>
        </div>
      ))}
    </Card>
  );
}
