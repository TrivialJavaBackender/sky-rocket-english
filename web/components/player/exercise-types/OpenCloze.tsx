'use client';

import { useState } from 'react';
import type { OpenClozeContent } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { GapLine, PromptChip, TextGapInput } from './shared';
import type { ExerciseTypeProps } from './types';

/** open_cloze — text_input interaction: type the missing word/phrase, Enter or Check submits (ARCHITECTURE.md §5). Shows a base-form chip when the item carries a `hint`. */
export function OpenCloze({ content, phase, isCorrect, onSubmit }: ExerciseTypeProps<Pick<OpenClozeContent, 'pre' | 'post' | 'hint'>>) {
  const [value, setValue] = useState('');
  const disabled = phase === 'chk';

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit({ text: value });
  };

  return (
    <div>
      {content.hint && (
        <div className="mb-2.5">
          <PromptChip>{content.hint}</PromptChip>
        </div>
      )}
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
