'use client';

import { useState } from 'react';
import type { KeyWordTransformationContent } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { PromptChip, TextGapInput } from './shared';
import type { ExerciseTypeProps } from './types';

/** key_word_transformation — text_input interaction: s1 sentence + key-word chip + a second sentence with a gap (ARCHITECTURE.md §5). */
export function KeyWordTransformation({
  content,
  phase,
  isCorrect,
  onSubmit,
}: ExerciseTypeProps<Pick<KeyWordTransformationContent, 's1' | 'key' | 'pre' | 'post' | 'hint'>>) {
  const [value, setValue] = useState('');
  const disabled = phase === 'chk';

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit({ text: value });
  };

  return (
    <div>
      <div className="mb-2 text-lg leading-relaxed">“{content.s1}”</div>
      <div className="my-2.5">
        <PromptChip>{content.key}</PromptChip>
      </div>
      <div className="text-[19px] leading-[1.9]">
        <span>{content.pre}</span>
        <TextGapInput value={value} onChange={setValue} onEnter={submit} disabled={disabled} isCorrect={isCorrect} wide />
        <span>{content.post}</span>
      </div>
      {content.hint && <div className="mt-1 text-[13px] text-fg-faint">{content.hint}</div>}
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
