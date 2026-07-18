'use client';

import { useState } from 'react';
import type { OpenClozeContent } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { GapLine, TextGapInput } from './shared';
import type { ExerciseTypeProps } from './types';

/** open_cloze — text_input interaction: type the missing word/phrase, Enter or Check submits (ARCHITECTURE.md §5). */
export function OpenCloze({ content, phase, isCorrect, onSubmit }: ExerciseTypeProps<Pick<OpenClozeContent, 'pre' | 'post'>>) {
  const [value, setValue] = useState('');
  const disabled = phase === 'chk';

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit({ text: value });
  };

  return (
    <div>
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
