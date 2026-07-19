'use client';

import { useState } from 'react';
import type { WritingTaskDTO } from '@/lib/repositories/writing.repo';
import { submitWriting } from '@/app/actions/writing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { PromptText } from './PromptText';
import { useActionRefresh } from '@/components/useActionRefresh';

const WORD_TARGET: [number, number] = [220, 260];

/**
 * UC-10 writing production (`mode: 'writing'`) + UC-11 speaking production
 * (`mode: 'speaking'`) — ARCHITECTURE.md §1.2. Speaking has no
 * record/upload flow yet (§8 D8 — out of scope for this stage): the learner
 * marks the monologue done and `attachmentUrl` stays null, recorded outside
 * the app for now.
 */
export function WritingEditor({ task, stepId, alreadySubmittedBody }: { task: WritingTaskDTO; stepId?: number; alreadySubmittedBody?: string | null }) {
  const [body, setBody] = useState(alreadySubmittedBody ?? '');
  const [submitted, setSubmitted] = useState(!!alreadySubmittedBody);
  const { pending: submitting, run } = useActionRefresh();
  const wordCount = body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;
  const [min, max] = WORD_TARGET;
  const inRange = wordCount >= min && wordCount <= max;

  function handleSubmitWriting() {
    if (!body.trim()) return;
    // Scroll to top only when this editor is a session step (the refresh swaps in the next step's panel); standalone usage reveals the model answer below instead.
    run(async () => {
      await submitWriting(task.id, body, undefined, undefined, stepId);
      setSubmitted(true);
    }, { scrollTop: !!stepId });
  }

  function handleMarkSpeakingDone() {
    run(async () => {
      await submitWriting(task.id, '(recorded outside the app)', undefined, undefined, stepId);
      setSubmitted(true);
    }, { scrollTop: !!stepId });
  }

  return (
    <Card>
      <Kicker>{task.mode === 'writing' ? `Writing task · ${task.genre}` : `Speaking task · ${task.genre}`}</Kicker>
      <div className="mt-2">
        <PromptText md={task.promptMd} />
      </div>

      {task.mode === 'writing' ? (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitted}
            rows={10}
            placeholder="Write your response here…"
            className="mt-4 w-full resize-y rounded-lg border border-border bg-bg-card p-3.5 text-[15px] leading-relaxed text-fg outline-none focus:border-ink disabled:opacity-70"
          />
          <div className="mt-1.5 flex items-center justify-between text-[13px]">
            <span className={inRange ? 'font-semibold text-green-text' : 'text-fg-faint'}>
              {wordCount} words <span className="text-fg-faint">({min}–{max} target)</span>
            </span>
          </div>
          {!submitted ? (
            <div className="mt-3 flex justify-end">
              <Button onClick={handleSubmitWriting} disabled={submitting || !body.trim()}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          ) : (
            <div className="mt-3 text-[13.5px] font-semibold text-green-text">✓ Submitted — see the model answer below.</div>
          )}
        </>
      ) : (
        <div className="mt-4">
          {!submitted ? (
            <Button onClick={handleMarkSpeakingDone} disabled={submitting}>
              {submitting ? 'Saving…' : 'Mark monologue done'}
            </Button>
          ) : (
            <div className="text-[13.5px] font-semibold text-green-text">✓ Marked done — see the model answer below.</div>
          )}
        </div>
      )}
    </Card>
  );
}
