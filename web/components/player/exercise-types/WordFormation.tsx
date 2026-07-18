'use client';

import { useState } from 'react';
import type { WordFormationContent } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { GapLine, PromptChip, TextGapInput } from './shared';
import type { ExerciseTypeProps } from './types';

/** word_formation — text_input interaction with a base-word prompt chip (ARCHITECTURE.md §5). */
export function WordFormation({ content, phase, isCorrect, onSubmit }: ExerciseTypeProps<Pick<WordFormationContent, 'pre' | 'post' | 'prompt'>>) {
  const [value, setValue] = useState('');
  const disabled = phase === 'chk';

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit({ text: value });
  };

  return (
    <div>
      <div className="mb-2.5">
        <PromptChip>{content.prompt}</PromptChip>
      </div>
      <GapLine pre={content.pre} post={content.post}>
        <TextGapInput value={value} onChange={setValue} onEnter={submit} disabled={disabled} isCorrect={isCorrect} />
      </GapLine>
      {!disabled && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={!value.trim()}>
            Check
          </Button>
        </div>
      )}
    </div>
  );
}
