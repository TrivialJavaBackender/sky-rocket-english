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
          {row.example && <div className="my-0.5 text-[15.5px] italic">{row.example}</div>}
          {row.table && <ParadigmTable table={row.table} />}
          <div className="text-[13.5px] text-fg-muted">{row.note}</div>
        </div>
      ))}
    </Card>
  );
}

/**
 * A paradigm laid out as an actual grid — conjugations, the three genders, case
 * endings. Wrapped in its own horizontal scroller so a wide table (six persons
 * across three verbs) never widens the page on a phone.
 */
function ParadigmTable({ table }: { table: NonNullable<GrammarSpotlightDTO['items'][number]['table']> }) {
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[14.5px]">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="whitespace-nowrap border-b border-green-border px-2.5 py-1.5 text-left text-[13px] font-bold uppercase tracking-kicker text-green-text"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((cell, c) => (
                <td
                  key={c}
                  className={`whitespace-nowrap border-b border-green-border/40 px-2.5 py-1.5 ${
                    c === 0 ? 'font-semibold text-fg-muted' : 'text-fg'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
