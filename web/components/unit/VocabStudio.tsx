'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VocabEntryDTO } from '@/lib/repositories/content.repo';
import type { VocabStatus } from '@/lib/domain/types';
import { markVocabPriority } from '@/app/actions/sessions';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

const STATUS_LABELS: Record<VocabStatus, string> = { new: 'New', learning: 'Learning', known: 'Known', in_use: 'In use' };

/**
 * UC-08 vocabulary studio (ARCHITECTURE.md §1.2). "Mark priority" = `new ->
 * learning` (§8 D6 — the schema has no separate priority flag yet).
 */
export function VocabStudio({ title, entries, rangeLabel }: { title: string; entries: VocabEntryDTO[]; rangeLabel?: string }) {
  const [statuses, setStatuses] = useState<Record<number, VocabStatus>>(() => Object.fromEntries(entries.map((e) => [e.id, e.status])));
  const [pending, setPending] = useState<number | null>(null);
  const router = useRouter();

  async function handleMark(id: number) {
    if (pending) return;
    setPending(id);
    await markVocabPriority(id);
    setStatuses((s) => ({ ...s, [id]: s[id] === 'new' ? 'learning' : s[id] }));
    setPending(null);
    router.refresh();
  }

  return (
    <Card className="mb-3.5">
      <Kicker tone="green" className="mb-0.5">
        Vocabulary in focus · {title}
      </Kicker>
      {rangeLabel && <div className="mb-1 text-[13px] text-fg-subtle">{rangeLabel}</div>}
      {entries.map((e) => {
        const status = statuses[e.id];
        return (
          <div key={e.id} className="border-t border-border-faint py-3.5">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[17px] font-bold">{e.term}</span>
              {e.tag && <span className="text-[11.5px] italic text-fg-subtle">{e.tag}</span>}
              <button
                onClick={() => handleMark(e.id)}
                disabled={status !== 'new' || pending === e.id}
                className={`ml-auto rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.06em] ${
                  status === 'new' ? 'border-ink text-fg hover:bg-bg-faint' : 'border-border-faint text-fg-faint'
                }`}
              >
                {status === 'new' ? 'Mark priority' : STATUS_LABELS[status]}
              </button>
            </div>
            <div className="my-0.5 text-[14.5px] text-fg">{e.definition}</div>
            <div className="text-[14.5px] italic leading-relaxed text-fg-muted">
              {e.useCases.map((u, i) => (
                <div key={i}>“{u}”</div>
              ))}
            </div>
            {(e.collocations || e.registerNote) && (
              <div className="mt-1.5 text-[13px] text-fg-muted">
                {e.collocations && (
                  <>
                    <span className="font-semibold">Collocations:</span> {e.collocations}
                  </>
                )}
                {e.collocations && e.registerNote && ' · '}
                {e.registerNote}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
