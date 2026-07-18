'use client';

import { useState } from 'react';
import type { GrammarDrillContent } from '@/lib/domain/types';
import { GapLine, GapPlaceholder, OptionList, PromptChip } from './shared';
import type { ExerciseTypeProps } from './types';

/** grammar_drill — choice interaction with a cue-word prompt chip above the gapped stem (ARCHITECTURE.md §5). */
export function GrammarDrill({ content, phase, correctAnswer, onSubmit }: ExerciseTypeProps<Omit<GrammarDrillContent, 'answer'>>) {
  const [selected, setSelected] = useState<number | null>(null);
  const disabled = phase === 'chk';

  return (
    <div>
      <div className="mb-2.5">
        <PromptChip>{content.prompt}</PromptChip>
      </div>
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
