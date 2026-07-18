'use client';

import { useState } from 'react';
import type { CollocationMatchContent } from '@/lib/domain/types';
import type { ExerciseTypeProps } from './types';

/**
 * collocation_match — match interaction: tap a left word, then its right
 * partner (ARCHITECTURE.md §5).
 *
 * Contract nuance (noted in the stage-4 report): `toPublicCollocationMatch`
 * strips `pairs` from the client-visible content, so — unlike the mockup,
 * which validates every tap instantly against the true key — this
 * component cannot tell a right pairing apart from a wrong one until the
 * server grades the *complete* mapping. The tap-to-assign interaction is
 * preserved (pick a left, then an unused right; re-tap a left to free it up
 * and reassign), but "misses" here means "pairs the learner changed their
 * mind about" rather than "pairs rejected in real time" — a reasonable
 * proxy for the mockup's "first-try misses count" rule (§5) without leaking
 * the answer key. Once every left has a right, the mapping auto-submits;
 * the post-grade reveal parses the server's "left → right; …" correct-
 * answer string back into per-pair colors, since word labels are unique
 * within an exercise.
 */
export function CollocationMatch({ content, phase, correctAnswer, onSubmit }: ExerciseTypeProps<Pick<CollocationMatchContent, 'left' | 'right'>>) {
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [everAssigned, setEverAssigned] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState(0);
  const disabled = phase === 'chk';

  const correctMap: Record<string, string> = {};
  if (correctAnswer) {
    for (const pair of correctAnswer.split('; ')) {
      const [l, r] = pair.split(' → ');
      if (l && r) correctMap[l] = r;
    }
  }

  const usedRights = new Set(Object.values(assignments));

  function pickLeft(i: number) {
    if (disabled) return;
    if (assignments[i] != null) {
      // Re-tapping an assigned left frees it for reassignment.
      const next = { ...assignments };
      delete next[i];
      setAssignments(next);
      setSelectedLeft(i);
      return;
    }
    setSelectedLeft(selectedLeft === i ? null : i);
  }

  function pickRight(j: number) {
    if (disabled || selectedLeft == null || usedRights.has(j)) return;
    if (everAssigned.has(selectedLeft)) setMisses((m) => m + 1);
    const next = { ...assignments, [selectedLeft]: j };
    setEverAssigned((prev) => new Set(prev).add(selectedLeft));
    setAssignments(next);
    setSelectedLeft(null);
    if (Object.keys(next).length === content.left.length) {
      onSubmit({ pairs: next as unknown as Record<string, number>, misses });
    }
  }

  return (
    <div>
      <div className="mb-3 text-sm text-fg-muted">
        {selectedLeft != null ? 'Now tap its partner →' : 'Tap a verb, then its noun partner.'}
      </div>
      <div className="grid grid-cols-2 gap-[9px]">
        <div className="flex flex-col gap-[9px]">
          {content.left.map((w, i) => {
            const done = assignments[i] != null;
            const sel = selectedLeft === i;
            let cls = 'border-border bg-bg-card text-fg';
            if (disabled && done) {
              const isPairCorrect = correctMap[w] === content.right[assignments[i]];
              cls = isPairCorrect ? 'border-green bg-green-soft text-green-text' : 'border-red bg-red-soft text-red-text';
            } else if (done) cls = 'border-green bg-green-soft text-green-text';
            else if (sel) cls = 'border-ink bg-bg-card text-fg';
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => pickLeft(i)}
                className={`rounded-lg border-[1.5px] px-3 py-[11px] text-left text-[15px] font-semibold disabled:cursor-default ${cls}`}
              >
                {w}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-[9px]">
          {content.right.map((w, j) => {
            const pairedLeft = Object.entries(assignments).find(([, rj]) => rj === j)?.[0];
            const done = pairedLeft != null;
            let cls = 'border-border bg-bg-card text-fg';
            if (disabled && done) {
              const isPairCorrect = correctMap[content.left[Number(pairedLeft)]] === w;
              cls = isPairCorrect ? 'border-green bg-green-soft text-green-text' : 'border-red bg-red-soft text-red-text';
            } else if (done) cls = 'border-green bg-green-soft text-green-text';
            return (
              <button
                key={j}
                disabled={disabled}
                onClick={() => pickRight(j)}
                className={`rounded-lg border-[1.5px] px-3 py-[11px] text-left text-[15px] font-semibold disabled:cursor-default ${cls}`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
