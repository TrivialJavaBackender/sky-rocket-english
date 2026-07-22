'use client';

import { useAudio } from './AudioProvider';
import type { AudioClipDTO } from '@/lib/repositories/audio.repo';

type Size = 'sm' | 'md';

const ICON_SIZE: Record<Size, number> = { sm: 13, md: 16 };
const BOX_CLASS: Record<Size, string> = { sm: 'p-1', md: 'p-1.5' };

/**
 * Play/pause glyphs, exported (not just used internally) so ReadingText's
 * paragraph and "Play all" controls — which drive `playSequence` directly
 * rather than wrapping `PlayButton`, since their unit of playback is a list
 * of clips, not one — render the identical icon instead of a second copy of
 * the path data.
 *
 * Filled, not stroked like NavIcons.tsx's line icons: a play triangle or
 * pause bars drawn as a thin outline read as a faint blob at 13-16px, where
 * NavIcons' shapes (circles, rectangles) stay legible. Everything else
 * about these — viewBox, currentColor, hand-written inline SVG instead of
 * an icon library — follows NavIcons' lead.
 */
export function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.6 2.75a.9.9 0 0 1 1.36-.78l7.3 4.25a.9.9 0 0 1 0 1.56l-7.3 4.25a.9.9 0 0 1-1.36-.78V2.75z" />
    </svg>
  );
}

export function PauseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3.8" y="2.6" width="2.8" height="10.8" rx="1" />
      <rect x="9.4" y="2.6" width="2.8" height="10.8" rx="1" />
    </svg>
  );
}

/**
 * Single-clip play/pause control (ARCHITECTURE.md §4.8) — vocab terms and
 * use cases, theory examples, the watch-out ✓ line. Renders nothing at all
 * when there is no clip: a module with an empty `audio_clip` table (nothing
 * synthesized yet) or a non-German course must look exactly like a build
 * with no audio feature at all, never a disabled ghost button holding open
 * layout space for a clip that doesn't exist.
 */
export function PlayButton({
  clip,
  id,
  label,
  size = 'sm',
  className = '',
}: {
  clip: AudioClipDTO | null | undefined;
  /** Unique across the whole page — compared against the shared player's `activeId` to decide this exact button's icon. Two buttons sharing an id would each think the other's clip is theirs. */
  id: string;
  /** What is being played, spoken by screen readers ("Play audio: <label>") — the term, the example sentence, the ✓ line, whatever this button sits next to. */
  label: string;
  size?: Size;
  className?: string;
}) {
  const { activeId, play, stop } = useAudio();
  if (!clip) return null;
  const isPlaying = activeId === id;
  return (
    <button
      type="button"
      aria-label={`${isPlaying ? 'Pause' : 'Play'} audio: ${label}`}
      aria-pressed={isPlaying}
      onClick={(e) => {
        e.stopPropagation(); // several call sites (a vocab row, a gloss span) sit inside their own click handlers
        if (isPlaying) stop();
        else play(clip, id);
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full align-middle transition-colors ${BOX_CLASS[size]} ${
        isPlaying ? 'text-green-text' : 'text-fg-faint hover:bg-bg-faint hover:text-fg-muted'
      } ${className}`}
    >
      {isPlaying ? <PauseIcon size={ICON_SIZE[size]} /> : <PlayIcon size={ICON_SIZE[size]} />}
    </button>
  );
}
