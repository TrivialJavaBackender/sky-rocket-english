'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GrammarSpotlightDTO, VocabEntryDTO, WatchoutDTO } from '@/lib/repositories/content.repo';
import type { ReadingWithGlossesDTO } from '@/lib/use-cases/unit';
import type { AudioClipDTO } from '@/lib/repositories/audio.repo';
import { Button } from '@/components/ui/Button';
import { useAudio } from './AudioProvider';

interface DownloadModuleAudioProps {
  vocabEntries: VocabEntryDTO[];
  spotlights: GrammarSpotlightDTO[];
  watchouts: WatchoutDTO[];
  reading: ReadingWithGlossesDTO | null;
  readingExtra: ReadingWithGlossesDTO | null;
}

/**
 * Every distinct clip already resolved onto this module's hub DTOs — the
 * *same* clips its own PlayButtons/ReadingText would each fetch on demand,
 * just gathered up front so this button can quote a total size and prefetch
 * all of them in one go. Deduplicated by URL: a term and one of its own use
 * cases can legitimately resolve to the same clip (identical text), and
 * counting its bytes twice would overstate the download.
 */
function collectModuleClips(props: DownloadModuleAudioProps): AudioClipDTO[] {
  const maybeClips: (AudioClipDTO | null | undefined)[] = [];
  for (const e of props.vocabEntries) {
    maybeClips.push(e.audio?.term, ...(e.audio?.useCases ?? []));
  }
  for (const s of props.spotlights) {
    for (const item of s.items) maybeClips.push(item.audio);
  }
  for (const w of props.watchouts) maybeClips.push(w.goodAudio);
  for (const reading of [props.reading, props.readingExtra]) {
    for (const paragraph of reading?.paragraphAudio ?? []) maybeClips.push(...paragraph);
  }

  const byUrl = new Map<string, AudioClipDTO>();
  for (const clip of maybeClips) if (clip) byUrl.set(clip.url, clip);
  return [...byUrl.values()];
}

type Status = 'idle' | 'saving' | 'done';

/**
 * "Save audio offline" (ARCHITECTURE.md §4.8, plan step 7) — a deliberate,
 * learner-initiated download of every clip this module can play, as opposed
 * to the service worker's default of caching a clip only once it's actually
 * played. There is no auto-prefetch anywhere in this feature; a mobile
 * learner's data plan is the entire reason this exists as a button instead
 * of a `useEffect`.
 */
export function DownloadModuleAudio({ vocabEntries, spotlights, watchouts, reading, readingExtra }: DownloadModuleAudioProps) {
  const { prefetch } = useAudio();
  const clips = useMemo(() => collectModuleClips({ vocabEntries, spotlights, watchouts, reading, readingExtra }), [vocabEntries, spotlights, watchouts, reading, readingExtra]);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);

  // Progress/completion arrive as ordinary service-worker messages, not
  // through AudioContext — `prefetch()` itself is fire-and-forget by design
  // (plan step 7's stated context shape has no room for a callback), so this
  // component listens for the sw.js reply on its own instead.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; completed?: number; total?: number } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'audio-prefetch-progress' && typeof data.completed === 'number' && typeof data.total === 'number' && data.total > 0) {
        setProgress(data.completed / data.total);
      } else if (data.type === 'audio-prefetch-done') {
        setStatus('done');
        setProgress(1);
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (clips.length === 0) return null; // nothing synthesized yet for this module — same "no button" rule as PlayButton's own clip check

  const totalMb = (clips.reduce((sum, c) => sum + c.bytes, 0) / 1_000_000).toFixed(1);

  function handleClick() {
    if (status !== 'idle') return;
    setStatus('saving');
    setProgress(0);
    prefetch(clips.map((c) => c.url));
  }

  if (status === 'done') {
    return (
      <Button variant="success-outline" size="sm" disabled className="mb-3.5 border-green bg-green text-white">
        ✓ Saved offline · {totalMb} MB
      </Button>
    );
  }

  if (status === 'saving') {
    return (
      <Button variant="outline" size="sm" disabled className="mb-3.5">
        Saving audio… {Math.round(progress * 100)}%
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="mb-3.5">
      Save audio offline · {totalMb} MB
    </Button>
  );
}
