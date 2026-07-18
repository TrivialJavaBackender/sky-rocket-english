'use client';

import { useState } from 'react';
import type { GlossDTO } from '@/lib/repositories/content.repo';
import { addGlossToDeck } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';

type Segment = { t: string } | { g: string };

/**
 * UC-07 reading with tap-glosses (ARCHITECTURE.md §1.2, §8 D3). The DB
 * stores segments as `{t}`/`{g:key}` (normalized — glosses live in their
 * own table); this island does the `key -> gloss` join on tap rather than
 * receiving inline gloss objects like the mockup's `content.js`.
 */
export function ReadingText({ paragraphs, glosses, moduleId }: { paragraphs: Segment[][]; glosses: Record<string, GlossDTO>; moduleId: number }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);

  async function handleAdd(gloss: GlossDTO) {
    if (added[gloss.key] || adding) return;
    setAdding(gloss.key);
    await addGlossToDeck(gloss.id, moduleId);
    setAdded((a) => ({ ...a, [gloss.key]: true }));
    setAdding(null);
  }

  return (
    <div>
      {paragraphs.map((para, pi) => {
        const openInThisPara = para.find((s) => 'g' in s && s.g === openKey) as { g: string } | undefined;
        return (
          <div key={pi}>
            <p className="text-pretty mb-[18px] text-lg leading-[1.68] text-fg">
              {para.map((s, si) => {
                if ('t' in s) return <span key={si}>{s.t}</span>;
                const gloss = glosses[s.g];
                const isOpen = openKey === s.g;
                return (
                  <span
                    key={si}
                    onClick={() => setOpenKey(isOpen ? null : s.g)}
                    className={`cursor-pointer underline decoration-dotted decoration-green underline-offset-[3px] ${isOpen ? 'font-semibold' : ''}`}
                  >
                    {gloss?.term ?? s.g}
                  </span>
                );
              })}
            </p>
            {openInThisPara && glosses[openInThisPara.g] && (
              <GlossPanel gloss={glosses[openInThisPara.g]} inDeck={!!added[openInThisPara.g]} adding={adding === openInThisPara.g} onAdd={() => handleAdd(glosses[openInThisPara.g])} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function GlossPanel({ gloss, inDeck, adding, onAdd }: { gloss: GlossDTO; inDeck: boolean; adding: boolean; onAdd: () => void }) {
  return (
    <div className="animate-fade-up mb-5 -mt-2 rounded-[10px] bg-green-soft p-3.5">
      <div className="text-base font-bold">
        {gloss.term} {gloss.posLabel && <span className="text-[13.5px] font-normal italic text-fg-muted">{gloss.posLabel}</span>}
      </div>
      <div className="my-1 text-[15px] leading-relaxed">{gloss.definition}</div>
      {gloss.example && <div className="text-[14.5px] italic leading-relaxed text-fg-muted">“{gloss.example}”</div>}
      <Button
        variant={inDeck ? 'success-outline' : 'outline'}
        size="sm"
        className={`mt-2.5 ${inDeck ? 'bg-green text-white border-green' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        disabled={inDeck || adding}
      >
        {inDeck ? '✓ In your deck' : adding ? 'Adding…' : '＋ Add to deck'}
      </Button>
    </div>
  );
}
