'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NoteType, Rating } from '@/lib/domain/types';
import type { DueCardViewDTO } from '@/lib/use-cases/flashcards';
import { reviewFlashcard } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';

const TYPE_LABELS: Record<NoteType, string> = { vocab: 'Vocab', grammar_cloze: 'Grammar cloze', transformation: 'Transformation' };
const TYPE_COLORS: Record<NoteType, [string, string]> = {
  vocab: ['var(--green-soft)', 'var(--green-text)'],
  grammar_cloze: ['#E8EEF6', '#2E5F9E'],
  transformation: ['#F6EDDD', '#8A5510'],
};

const RATINGS: { rating: Rating; label: string; interval: string; accent?: 'red' | 'green' }[] = [
  { rating: 1, label: 'Again', interval: '10 min', accent: 'red' },
  { rating: 2, label: 'Hard', interval: '2 d' },
  { rating: 3, label: 'Good', interval: '4 d' },
  { rating: 4, label: 'Easy', interval: '8 d', accent: 'green' },
];

/**
 * UC-15 SRS player (ARCHITECTURE.md §7.1 `/flashcards`, §7.2). Full-viewport
 * takeover like ExercisePlayer — flip to reveal, grade Again/Hard/Good/Easy,
 * each grade is one `reviewFlashcard` server action call (SM-2, §6.4).
 */
export function FlashcardPlayer({ cards, backHref }: { cards: DueCardViewDTO[]; backHref: string }) {
  const [i, setI] = useState(0);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [done, setDone] = useState(cards.length === 0);
  const [gradedCount, setGradedCount] = useState(0);
  const [grading, setGrading] = useState(false);
  const router = useRouter();

  const card = cards[Math.min(i, cards.length - 1)];

  async function grade(rating: Rating) {
    if (!card || grading) return;
    setGrading(true);
    await reviewFlashcard(card.flashcardId, rating);
    setGrading(false);
    setGradedCount((n) => n + 1);
    if (i + 1 >= cards.length) {
      setDone(true);
    } else {
      setI(i + 1);
      setSide('front');
    }
  }

  function exit() {
    router.push(backHref);
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
        <div className="animate-fade-up mx-auto max-w-[560px] px-2 py-11 text-center">
          <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-green-soft text-lg font-bold text-green">✓</div>
          <div className="text-2xl font-bold">Queue clear</div>
          <div className="mt-1 tabular-nums text-fg-muted">{gradedCount === 0 ? 'No cards were due right now.' : `${gradedCount} of ${gradedCount} reviewed today.`}</div>
          <div className="mt-0.5 text-[13.5px] text-fg-subtle">The next batch opens as cards come due.</div>
          <Button className="mt-[22px]" onClick={exit}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const [bg, fg] = TYPE_COLORS[card.noteType];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[560px] px-4 py-4 desktop:py-8">
        <div className="flex items-center gap-3 pb-4 pt-1">
          <button onClick={exit} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-border bg-bg-card text-sm text-fg-muted">
            ✕
          </button>
          <div className="flex-1 text-center text-[13px] font-semibold text-fg-muted">Daily review</div>
          <div className="text-[12.5px] font-semibold tabular-nums text-fg-subtle">
            {i + 1} / {cards.length}
          </div>
        </div>
        <div
          onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
          className="flex min-h-[320px] cursor-pointer flex-col rounded-2xl border border-border bg-bg-card p-6 shadow-card"
        >
          <span className="self-start rounded-md px-2.5 py-1 text-[10.5px] font-bold tracking-[.1em]" style={{ background: bg, color: fg }}>
            {TYPE_LABELS[card.noteType].toUpperCase()}
          </span>
          {side === 'front' ? (
            <>
              <div className="text-pretty flex flex-1 items-center justify-center px-1 py-4 text-center text-2xl font-semibold leading-snug">{card.fields.front}</div>
              <div className="text-center text-[12.5px] tracking-[.06em] text-fg-faintest">TAP TO REVEAL</div>
            </>
          ) : (
            <div className="animate-card-in flex flex-1 flex-col justify-center px-0.5 py-3.5">
              <div className="text-center text-sm text-fg-subtle">{card.fields.front}</div>
              <div className="mx-auto my-3 w-14 border-t border-border-faint" />
              <div className="text-pretty text-center text-[22px] font-bold leading-snug">{card.fields.main}</div>
              <div className="mt-3.5">
                {card.fields.cases.map((c, idx) => (
                  <div key={idx} className="py-[3px] text-center text-[14.5px] italic leading-relaxed text-fg">
                    “{c}”
                  </div>
                ))}
              </div>
              {card.fields.extra && <div className="mt-3 text-center text-[12.5px] text-fg-subtle">{card.fields.extra}</div>}
            </div>
          )}
        </div>
        {side === 'back' ? (
          <div className="animate-fade-up mt-3.5 grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.rating}
                onClick={() => grade(r.rating)}
                disabled={grading}
                className={`rounded-lg border px-1 py-2.5 text-center disabled:opacity-60 ${r.accent === 'red' ? 'border-red-border' : r.accent === 'green' ? 'border-green-border' : 'border-border'} bg-bg-card`}
              >
                <span className={`block text-sm font-bold ${r.accent === 'red' ? 'text-red' : r.accent === 'green' ? 'text-green' : 'text-fg'}`}>{r.label}</span>
                <span className="text-[11.5px] tabular-nums text-fg-faint">{r.interval}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center text-[13px] text-fg-faint">Grade yourself honestly — the intervals do the rest.</div>
        )}
      </div>
    </div>
  );
}
