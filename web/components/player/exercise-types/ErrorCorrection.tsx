'use client';

import { useState } from 'react';
import type { ErrorCorrectionContent } from '@/lib/domain/types';
import type { ExerciseTypeProps } from './types';

/**
 * error_correction — word_tap interaction: tap the word you think is wrong.
 *
 * Contract gap (noted in the stage-4 report): `toPublicErrorCorrection`
 * strips both `wrong` (the correct index) and `correction` from the
 * client-visible content (§5 — grading is server-only), so unlike the
 * mockup, this component cannot highlight the *actual* wrong word when the
 * learner's tap misses — only their own tap is colored red/green from the
 * server's `isCorrect` verdict. The full correction text still surfaces in
 * the feedback panel via `correctAnswer` (server-supplied).
 */
export function ErrorCorrection({ content, phase, isCorrect, onSubmit }: ExerciseTypeProps<Pick<ErrorCorrectionContent, 'words'>>) {
  const [tapped, setTapped] = useState<number | null>(null);
  const disabled = phase === 'chk';

  return (
    <div>
      <div className="mb-3 text-sm text-fg-muted">Tap the word that is wrong.</div>
      <div className="flex flex-wrap gap-2">
        {content.words.map((w, i) => {
          let cls = 'border-border bg-bg-card';
          if (disabled && i === tapped) cls = isCorrect ? 'border-green bg-green-soft text-green-text' : 'border-red bg-red-soft text-red-text animate-shake';
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setTapped(i);
                onSubmit({ tapped: i });
              }}
              className={`rounded-lg border-[1.5px] px-3 py-[7px] text-base disabled:cursor-default ${cls}`}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
