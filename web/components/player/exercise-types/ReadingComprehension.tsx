'use client';

import { useState } from 'react';
import type { ReadingComprehensionContent } from '@/lib/domain/types';
import { OptionList } from './shared';
import type { ExerciseTypeProps } from './types';

/** reading_comprehension — choice interaction: a short passage + question (ARCHITECTURE.md §5). */
export function ReadingComprehension({ content, phase, correctAnswer, onSubmit }: ExerciseTypeProps<Omit<ReadingComprehensionContent, 'answer'>>) {
  const [selected, setSelected] = useState<number | null>(null);
  const disabled = phase === 'chk';

  return (
    <div>
      <div className="mb-3 rounded-lg border border-border-faint bg-bg-soft px-4 py-3.5 text-base italic leading-relaxed text-fg">“{content.passage}”</div>
      <div className="mb-0.5 text-[17px] font-semibold">{content.q}</div>
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
