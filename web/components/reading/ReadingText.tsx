'use client';

import { useId, useState } from 'react';
import type { GlossDTO } from '@/lib/repositories/content.repo';
import type { AudioClipDTO } from '@/lib/repositories/audio.repo';
import { addGlossToDeck } from '@/app/actions/flashcards';
import { Button } from '@/components/ui/Button';
import { useAudio } from '@/components/audio/AudioProvider';
import { PlayIcon, PauseIcon } from '@/components/audio/PlayButton';

type Segment = { t: string } | { g: string };

/**
 * UC-07 reading with tap-glosses (ARCHITECTURE.md §1.2, §8 D3). The DB
 * stores segments as `{t}`/`{g:key}` (normalized — glosses live in their
 * own table); this island does the `key -> gloss` join on tap rather than
 * receiving inline gloss objects like the mockup's `content.js`.
 */
export function ReadingText({
  paragraphs,
  glosses,
  moduleId,
  glossesEnabled = true,
  paragraphAudio,
}: {
  paragraphs: Segment[][];
  glosses: Record<string, GlossDTO>;
  moduleId: number;
  /** false in Prime's skim step (UC-07): gloss segments render as plain text — one pass, gist only. */
  glossesEnabled?: boolean;
  /** Per paragraph, the clips of whichever of its sentences were synthesized (ARCHITECTURE.md §4.8) — attached server-side by getUnit/getReadingWithGlosses. Absent entirely for a call site that never resolves audio (en-c1); an individual paragraph's own entry can still be `[]` if that module has audio but this particular paragraph doesn't yet — either way its ▶ just doesn't render, the same "no clip → no button" rule PlayButton itself follows. */
  paragraphAudio?: AudioClipDTO[][];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const { activeId, playSequence, stop } = useAudio();
  const [playingAll, setPlayingAll] = useState(false);
  // Two ReadingText instances can be mounted at once (the module hub shows
  // both the main and the extra text), sharing the one AudioProvider — this
  // keeps each instance's paragraph/"Play all" ids from colliding, which
  // would otherwise make one text's highlight/pause-icon follow the other's
  // playback.
  const instanceId = useId();

  async function handleAdd(gloss: GlossDTO) {
    if (added[gloss.key] || adding) return;
    setAdding(gloss.key);
    await addGlossToDeck(gloss.id, moduleId);
    setAdded((a) => ({ ...a, [gloss.key]: true }));
    setAdding(null);
  }

  const paragraphId = (pi: number) => `${instanceId}-p${pi}`;

  /** Plays paragraph `pi`'s own clip queue, or — if it has none synthesized — skips straight to `onEnded` so a "Play all" run doesn't stall on a gap in coverage. */
  function playParagraph(pi: number, onEnded?: () => void) {
    const clips = paragraphAudio?.[pi] ?? [];
    if (clips.length === 0) {
      onEnded?.();
      return;
    }
    playSequence(clips, paragraphId(pi), onEnded);
  }

  function handleParagraphClick(pi: number) {
    if (activeId === paragraphId(pi)) {
      stop();
      setPlayingAll(false);
      return;
    }
    setPlayingAll(false); // a direct click on one paragraph is never part of a "Play all" run, even if one was mid-flight
    playParagraph(pi);
  }

  function handlePlayAllClick() {
    if (playingAll) {
      stop();
      setPlayingAll(false);
      return;
    }
    setPlayingAll(true);
    // Chains one paragraph's queue into the next via `onEnded`, which only
    // ever fires on a queue's *natural* completion (see AudioProvider) — an
    // interruption (stop(), or some other button taking the shared element)
    // simply never calls it, so the chain breaks itself for free instead of
    // needing to be told to stop.
    const runFrom = (pi: number) => {
      if (pi >= paragraphs.length) {
        setPlayingAll(false);
        return;
      }
      playParagraph(pi, () => runFrom(pi + 1));
    };
    runFrom(0);
  }

  const hasAnyAudio = (paragraphAudio ?? []).some((clips) => clips.length > 0);

  return (
    <div>
      {hasAnyAudio && (
        <button
          type="button"
          aria-pressed={playingAll}
          onClick={handlePlayAllClick}
          className="mb-3.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-card px-2.5 py-1 text-[12px] font-bold uppercase tracking-kicker text-fg-muted hover:bg-bg-faint"
        >
          {playingAll ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
          Play all
        </button>
      )}
      {paragraphs.map((para, pi) => {
        const openInThisPara = para.find((s) => 'g' in s && s.g === openKey) as { g: string } | undefined;
        const clips = paragraphAudio?.[pi] ?? [];
        const isParaPlaying = activeId === paragraphId(pi);
        return (
          // -mx-3/px-3 cancel out exactly, so an unplayed paragraph (the
          // common case: no audio at all, or simply not this one) sits at
          // the identical position it had before this background existed —
          // the highlight only ever adds a bleed, never a permanent shift.
          <div key={pi} className={`-mx-3 rounded-lg px-3 transition-colors duration-300 ${isParaPlaying ? 'bg-green-soft' : ''}`}>
            <p className="text-pretty mb-[18px] flex items-start gap-2 text-lg leading-[1.68] text-fg">
              {clips.length > 0 && (
                <button
                  type="button"
                  aria-label={`${isParaPlaying ? 'Pause' : 'Play'} audio: paragraph ${pi + 1}`}
                  aria-pressed={isParaPlaying}
                  onClick={() => handleParagraphClick(pi)}
                  className={`mt-1.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-colors ${
                    isParaPlaying ? 'text-green-text' : 'text-fg-faint hover:bg-bg-faint hover:text-fg-muted'
                  }`}
                >
                  {isParaPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                </button>
              )}
              <span className="min-w-0 flex-1">
                {para.map((s, si) => {
                  if ('t' in s) return <span key={si}>{s.t}</span>;
                  const gloss = glosses[s.g];
                  if (!glossesEnabled) return <span key={si}>{gloss?.term ?? s.g}</span>;
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
              </span>
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
