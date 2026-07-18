'use client';

import { useState } from 'react';
import type { McClozeContent } from '@/lib/domain/types';
import { GapLine, GapPlaceholder, OptionList } from './shared';
import type { ExerciseTypeProps } from './types';

/** mc_cloze — choice interaction: pick an option, graded immediately (ARCHITECTURE.md §5). */
export function McCloze({ content, phase, correctAnswer, onSubmit }: ExerciseTypeProps<Omit<McClozeContent, 'answer'>>) {
  const [selected, setSelected] = useState<number | null>(null);
  const disabled = phase === 'chk';

  return (
    <div>
      <GapLine pre={content.pre} post={content.post}>
        <GapPlaceholder pendingText={selected != null ? content.options[selected] : null} revealedCorrectText={disabled ? correctAnswer : null} />
      </GapLine>
      <OptionList
        options={content.options}
        selected={selected}
        disabled={disabled}
        correctAnswer={correctAnswer}
        onPick={(i) => {
          if (disabled) return;
          setSelected(i);
          onSubmit({ selected: i });
        }}
      />
    </div>
  );
}
