'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WritingSubmissionDTO, WritingTaskDTO } from '@/lib/repositories/writing.repo';
import { submitSelfCheck } from '@/app/actions/writing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { PromptText } from './PromptText';

/** UC-12 self-check (ARCHITECTURE.md §1.2) — the learner's own submission next to the model answer, plus a tickable checklist. */
export function SelfCheck({ task, latestSubmission, stepId }: { task: WritingTaskDTO; latestSubmission: WritingSubmissionDTO | null; stepId?: number }) {
  const initialTicks = (latestSubmission?.selfCheck as Record<string, boolean> | null) ?? {};
  const [ticks, setTicks] = useState<Record<string, boolean>>(initialTicks);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  if (!latestSubmission) {
    return (
      <Card>
        <Kicker>Self-check</Kicker>
        <div className="mt-2 text-[15px] text-fg-muted">Complete the production step first — your submission will appear here next to the model answer.</div>
      </Card>
    );
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    await submitSelfCheck(latestSubmission!.id, ticks, stepId);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <Kicker>Model answer & checklist</Kicker>
      {task.mode === 'writing' && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-kicker text-fg-subtle">Your submission</div>
          <div className="text-pretty mt-1 whitespace-pre-wrap rounded-lg border border-border-faint bg-bg-soft p-3.5 text-[14.5px] leading-relaxed">{latestSubmission.bodyMd}</div>
        </div>
      )}
      {task.modelAnswerMd && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-kicker text-green-text">Model answer</div>
          <div className="mt-1">
            <PromptText md={task.modelAnswerMd} />
          </div>
        </div>
      )}
      {task.checklist.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-kicker text-fg-subtle">Checklist</div>
          {task.checklist.map((item, idx) => {
            const key = String(idx);
            return (
              <label key={key} className="flex cursor-pointer gap-3 py-2 text-[14.5px] text-fg">
                <input
                  type="checkbox"
                  checked={!!ticks[key]}
                  onChange={(e) => setTicks((t) => ({ ...t, [key]: e.target.checked }))}
                  className="mt-[3px] h-[15px] w-[15px] flex-none accent-green"
                />
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </Card>
  );
}
