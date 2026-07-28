'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NoteType, Rating } from '@/lib/domain/types';
import type { DueCardViewDTO } from '@/lib/use-cases/flashcards';
import { reviewFlashcard } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';

// Two directions of one word (0005): `vocab` asks you to recognise the term,
// `vocab_reverse` to produce it from the definition. Retired note types can
// still reach the player from an old row, so the lookups fall back instead of
// crashing on an undefined label.
const TYPE_LABELS: Record<string, string> = { vocab: 'Word → meaning', vocab_reverse: 'Meaning → word' };
const TYPE_COLORS: Record<string, [string, string]> = {
  vocab: ['var(--green-soft)', 'var(--green-text)'],
  vocab_reverse: ['#E8EEF6', '#2E5F9E'],
};
const FALLBACK_COLORS: [string, string] = ['var(--bg-subtle)', 'var(--fg-muted)'];

// Captions come from the card's own state (previewIntervals, §6.4) — the
// mockup's static 10 min / 2 d / 4 d / 8 d described no card in particular.
const RATINGS: { rating: Rating; label: string; accent?: 'red' | 'green' }[] = [
  { rating: 1, label: 'Again', accent: 'red' },
  { rating: 2, label: 'Hard' },
  { rating: 3, label: 'Good' },
  { rating: 4, label: 'Easy', accent: 'green' },
];

/**
 * UC-15 SRS player (ARCHITECTURE.md §7.1 `/flashcards`, §7.2). Full-viewport
 * takeover like ExercisePlayer — flip to reveal, grade Again/Hard/Good/Easy,
 * each grade is one `reviewFlashcard` server action call (SM-2, §6.4).
 */
export function FlashcardPlayer({ cards, totalDue, backHref }: { cards: DueCardViewDTO[]; totalDue: number; backHref: string }) {
  // Grading calls `revalidatePath`, which refetches this dynamic route and hands
  // us a `cards` prop that no longer holds the card just graded. Advancing the
  // index on top of that shrinking list would skip a card per grade, so the run
  // works off a snapshot taken when the player mounted.
  const [deck, setDeck] = useState(cards);
  const [i, setI] = useState(0);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [done, setDone] = useState(deck.length === 0);
  const [gradedCount, setGradedCount] = useState(0);
  const [grading, setGrading] = useState(false);
  const router = useRouter();

  // `Next` on the summary calls router.refresh(); when the server comes back
  // with a different slice of the backlog, start a run over it. Guarded on
  // `done` and on the slice actually differing, so a mid-run refetch can never
  // yank the snapshot out from under the current card.
  useEffect(() => {
    if (!done || cards.length === 0 || cards[0].flashcardId === deck[0]?.flashcardId) return;
    setDeck(cards);
    setI(0);
    setSide('front');
    setDone(false);
  }, [cards, deck, done]);

  const card = deck[i];

  async function grade(rating: Rating) {
    if (!card || grading) return;
    setGrading(true);
    await reviewFlashcard(card.flashcardId, rating);
    setGrading(false);
    setGradedCount((n) => n + 1);
    if (i + 1 >= deck.length) {
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
    // A run is capped at REVIEW_RUN_SIZE cards, so finishing one does not mean
    // the backlog is empty — claiming "queue clear" while the dashboard still
    // showed a three-digit count was what made the queue look bottomless.
    const remaining = Math.max(0, totalDue - gradedCount);
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
        <div className="animate-fade-up mx-auto max-w-[560px] px-2 py-11 text-center">
          <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-green-soft text-lg font-bold text-green">✓</div>
          <div className="text-2xl font-bold">{remaining > 0 ? 'Run complete' : 'Queue clear'}</div>
          <div className="mt-1 tabular-nums text-fg-muted">{gradedCount === 0 ? 'No cards were due right now.' : `${gradedCount} card${gradedCount === 1 ? '' : 's'} reviewed.`}</div>
          <div className="mt-0.5 text-[13.5px] text-fg-subtle">
            {remaining > 0 ? `${remaining} more still due — another run picks up where this one stopped.` : 'The next batch opens as cards come due.'}
          </div>
          <div className="mt-[22px] flex justify-center gap-2">
            {remaining > 0 && (
              <Button onClick={() => router.refresh()}>Next {Math.min(remaining, deck.length)}</Button>
            )}
            <Button variant={remaining > 0 ? 'outline' : 'primary'} onClick={exit}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const [bg, fg] = TYPE_COLORS[card.noteType] ?? FALLBACK_COLORS;
  const typeLabel = TYPE_LABELS[card.noteType] ?? card.noteType.replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[560px] px-4 py-4 desktop:py-8">
        <div className="flex items-center gap-3 pb-4 pt-1">
          <button onClick={exit} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-border bg-bg-card text-sm text-fg-muted">
            ✕
          </button>
          <div className="flex-1 text-center text-[13px] font-semibold text-fg-muted">{card.origin ? card.origin.courseName : 'Daily review'}</div>
          <div className="text-[12.5px] font-semibold tabular-nums text-fg-subtle">
            {i + 1} / {deck.length}
            {totalDue > deck.length && <span className="text-fg-faintest"> of {totalDue}</span>}
          </div>
        </div>
        <div
          onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
          className="flex min-h-[320px] cursor-pointer flex-col rounded-2xl border border-border bg-bg-card p-6 shadow-card"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md px-2.5 py-1 text-[10.5px] font-bold tracking-[.1em]" style={{ background: bg, color: fg }}>
              {typeLabel.toUpperCase()}
            </span>
            {/* Which language this card even is: both directions are labelled in English metalanguage, so a German word and an English one look identical without this. */}
            {card.origin && (
              <span className="rounded-md bg-bg-subtle px-2.5 py-1 text-[10.5px] font-bold tracking-[.08em] text-fg-muted">
                {card.origin.courseSlug.toUpperCase()} · {card.origin.moduleSlug.toUpperCase()}
              </span>
            )}
          </div>
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
                <span className="text-[11.5px] tabular-nums text-fg-faint">{card.ratingIntervals[r.rating]}</span>
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
