'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AudioClipDTO } from '@/lib/repositories/audio.repo';

interface ActiveSequence {
  clips: AudioClipDTO[];
  index: number;
  id: string;
  /** Fires once the *entire* queue has played through to its last clip's `ended` — never when the queue is cut short by `stop()` or by another `play`/`playSequence` call taking over the shared element. ReadingText's "Play all" is built entirely on this distinction: it chains one paragraph's queue into the next by passing `onEnded`, and that chain must break, not continue, the moment something else interrupts playback. */
  onEnded?: () => void;
}

interface AudioContextValue {
  /** The `id` passed to whichever `play`/`playSequence` call currently owns the shared element, whether it is actively playing or between clips of a queue. A `PlayButton` compares this against its own `id` to decide ▶ vs ⏸ — `null` means nothing is loaded/playing at all. */
  activeId: string | null;
  play: (clip: AudioClipDTO, id: string) => void;
  playSequence: (clips: AudioClipDTO[], id: string, onEnded?: () => void) => void;
  stop: () => void;
  /** Fire-and-forget: asks the service worker (if one is registered and in control) to warm the cache for these URLs. A no-op with no error if there is no controller yet — offline caching is a progressive enhancement, playback over the network works regardless (ARCHITECTURE.md §4.8). */
  prefetch: (urls: string[]) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

/**
 * Root audio player + service worker registration (ARCHITECTURE.md §4.8,
 * plan steps 6-7). Mounted once in app/(app)/layout.tsx around `children`,
 * so every PlayButton / ReadingText / DownloadModuleAudio island on any page
 * shares the *same* <audio> element — "exactly one clip plays at a time"
 * falls out of there being only one element in the whole app, not out of
 * coordination logic between components.
 *
 * The element is constructed lazily, inside the first `play`/`playSequence`
 * call, rather than eagerly on mount: there is nothing to play yet at mount
 * time, and on iOS Safari in particular an <audio> element only stays
 * unlockable for *later* programmatic `.play()` calls if its very first
 * `.play()` happened synchronously inside a real user gesture (a click
 * handler) — building it in a `useEffect` and calling `.play()` from a
 * timer or a subsequent render would silently fail there.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sequenceRef = useRef<ActiveSequence | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  /** Advances to the sequence's next clip, or — if this was the last one — clears state and fires `onEnded`. Shared by the `ended` and `error` listeners so one corrupt/missing file skips forward instead of stranding the queue mid-play (plan step 7: "ошибки отдельных URL не роняют пачку" applies just as much to playback as to prefetch). */
  const advanceOrFinish = useCallback((el: HTMLAudioElement) => {
    const seq = sequenceRef.current;
    if (seq && seq.index + 1 < seq.clips.length) {
      seq.index += 1;
      el.src = seq.clips[seq.index].url;
      void el.play();
      return; // same seq.id throughout — activeId doesn't change, so a queue reads as one continuous clip to anything watching it
    }
    const onEnded = seq?.onEnded;
    sequenceRef.current = null;
    setActiveId(null);
    onEnded?.();
  }, []);

  const ensureElement = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = 'none'; // most resolved clips on a page are never played at all (a module's whole vocab vs. what one session batch shows) — don't warm connections for content nobody asked for
    el.addEventListener('ended', () => advanceOrFinish(el));
    el.addEventListener('error', () => advanceOrFinish(el));
    audioRef.current = el;
    return el;
  }, [advanceOrFinish]);

  const play = useCallback(
    (clip: AudioClipDTO, id: string) => {
      const el = ensureElement();
      sequenceRef.current = null;
      el.src = clip.url;
      setActiveId(id);
      void el.play();
    },
    [ensureElement],
  );

  const playSequence = useCallback(
    (clips: AudioClipDTO[], id: string, onEnded?: () => void) => {
      if (clips.length === 0) return;
      const el = ensureElement();
      sequenceRef.current = { clips, index: 0, id, onEnded };
      el.src = clips[0].url;
      setActiveId(id);
      void el.play();
    },
    [ensureElement],
  );

  const stop = useCallback(() => {
    // A plain pause, not a full reset: whatever is loaded stays loaded, but
    // since activeId is what every PlayButton actually renders from, the UI
    // already reads as fully stopped. The next play()/playSequence() call
    // (from any button, including this same one) overwrites `src` anyway,
    // so there is nothing to gain from also clearing it here.
    sequenceRef.current = null;
    setActiveId(null);
    audioRef.current?.pause();
  }, []);

  const prefetch = useCallback((urls: string[]) => {
    if (urls.length === 0) return;
    navigator.serviceWorker?.controller?.postMessage({ type: 'audio-prefetch', urls });
  }, []);

  // Registered once for the whole session, independent of the lazy <audio>
  // element above — a service worker only pays off if it is already
  // controlling the page *before* the first clip is requested, so unlike
  // the element itself, delaying this behind a user gesture would only lose
  // the first play's offline benefit for no upside.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Swallowed on purpose: offline caching is a progressive enhancement
      // (ARCHITECTURE.md §4.8) layered on top of ordinary network playback,
      // which still works with no service worker at all — a registration
      // failure (browser quirk, private-browsing restrictions) must not
      // surface as an error anywhere near the player.
    });
  }, []);

  const value = useMemo<AudioContextValue>(() => ({ activeId, play, playSequence, stop, prefetch }), [activeId, play, playSequence, stop, prefetch]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}
