'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AttemptContext,
  CollocationMatchContent,
  ErrorCorrectionContent,
  GivenAnswer,
  GrammarDrillContent,
  KeyWordTransformationContent,
  McClozeContent,
  OpenClozeContent,
  ReadingComprehensionContent,
  WordFormationContent,
} from '@/lib/domain/types';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import { gradeAndRecord, harvestError } from '@/app/actions/exercises';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { Button } from '@/components/ui/Button';
import { ProgressDots } from '@/components/ui/ProgressDots';
import { EXERCISE_TYPE_LABELS } from './type-labels';
import { McCloze } from './exercise-types/McCloze';
import { GrammarDrill } from './exercise-types/GrammarDrill';
import { ReadingComprehension } from './exercise-types/ReadingComprehension';
import { OpenCloze } from './exercise-types/OpenCloze';
import { WordFormation } from './exercise-types/WordFormation';
import { KeyWordTransformation } from './exercise-types/KeyWordTransformation';
import { ErrorCorrection } from './exercise-types/ErrorCorrection';
import { CollocationMatch } from './exercise-types/CollocationMatch';

export interface ExercisePlayerAttempt {
  exerciseId: number;
  attemptId: number;
  isCorrect: boolean;
}

export interface ExercisePlayerSummary {
  total: number;
  correct: number;
  score: number;
  attempts: ExercisePlayerAttempt[];
  harvestedCount: number;
}

interface GradedState {
  attemptId: number;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

/**
 * UC-09 exercise set player (ARCHITECTURE.md §5, §7.2) — full-viewport
 * modal overlay (mirrors the mockup's `screen:'ex'` takeover), not a
 * separate route: launched by whichever page assembled the queue
 * (Unit launchers, Session runner steps, Review hub lanes 2/3, checkpoints).
 * `context` is the one thing that varies per launch site (§5's
 * `AttemptContext`) — grading itself is always the same server round-trip.
 * `onFinished` lets the caller do whatever domain-specific thing follows a
 * complete run (advanceStep, closeModule, finishModuleReview,
 * finishCheckpoint) — the player itself is agnostic to that.
 */
export function ExercisePlayer({
  items,
  context,
  headerLabel,
  onClose,
  onFinished,
}: {
  items: PublicExerciseDTO[];
  context: AttemptContext;
  headerLabel: string;
  onClose: () => void;
  onFinished?: (summary: ExercisePlayerSummary) => void | Promise<void>;
}) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Array<boolean | null>>(() => items.map(() => null));
  const [attempts, setAttempts] = useState<ExercisePlayerAttempt[]>([]);
  const [phase, setPhase] = useState<'ans' | 'chk'>('ans');
  const [current, setCurrent] = useState<GradedState | null>(null);
  const [grading, setGrading] = useState(false);
  const [harvestedMap, setHarvestedMap] = useState<Record<number, boolean>>({});
  const [harvesting, setHarvesting] = useState(false);
  const [done, setDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const router = useRouter();

  const item = items[i];

  async function handleSubmit(given: GivenAnswer) {
    if (phase !== 'ans' || grading || !item) return;
    setGrading(true);
    const timeMs = Date.now() - startedAt;
    const result = await gradeAndRecord(item.id, context, given, timeMs);
    setResults((r) => {
      const next = [...r];
      next[i] = result.isCorrect;
      return next;
    });
    setAttempts((a) => [...a, { exerciseId: item.id, attemptId: result.attemptId, isCorrect: result.isCorrect }]);
    setCurrent(result);
    setPhase('chk');
    setGrading(false);
  }

  async function handleHarvest() {
    if (!current || harvesting || harvestedMap[i]) return;
    setHarvesting(true);
    await harvestError(current.attemptId);
    setHarvestedMap((h) => ({ ...h, [i]: true }));
    setHarvesting(false);
  }

  async function handleNext() {
    if (i + 1 >= items.length) {
      setDone(true);
      if (onFinished) {
        setFinishing(true);
        const correct = results.filter((r) => r === true).length;
        await onFinished({ total: items.length, correct, score: items.length === 0 ? 0 : Math.round((correct / items.length) * 100), attempts, harvestedCount: Object.keys(harvestedMap).length });
        setFinishing(false);
      }
      return;
    }
    setI(i + 1);
    setPhase('ans');
    setCurrent(null);
  }

  if (done) {
    const correct = results.filter((r) => r === true).length;
    const harvestedCount = Object.keys(harvestedMap).length;
    const missed = items.length - correct;
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
        <div className="animate-fade-up mx-auto max-w-[560px] px-2 py-11 text-center">
          <Kicker>Practice complete</Kicker>
          <div className="my-1.5 text-[56px] font-bold tracking-tight tabular-nums">
            {correct} / {items.length}
          </div>
          <div className="text-[15px] text-fg-muted">
            {harvestedCount === 0 ? 'No new cards — a clean run.' : `${harvestedCount} harvested ${harvestedCount === 1 ? 'card' : 'cards'} join tomorrow's review.`}
          </div>
          <div className="mt-0.5 text-[15px] text-fg-muted">
            {missed === 0 ? 'Nothing returns to the re-queue.' : `${missed} missed item${missed > 1 ? 's' : ''} return${missed > 1 ? '' : 's'} to the re-queue at +2 → +7 → +21 days.`}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Button onClick={onClose} disabled={finishing}>
              {finishing ? 'Saving…' : 'Back to the unit'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                router.push('/review');
              }}
            >
              Review hub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[640px] px-4 py-4 desktop:py-8">
        <div className="flex items-center gap-3 pb-3.5 pt-1">
          <button onClick={onClose} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-border bg-bg-card text-sm text-fg-muted">
            ✕
          </button>
          <div className="flex-1 text-center text-[13px] font-semibold text-fg-muted">{headerLabel}</div>
          <div className="text-[12.5px] font-semibold tabular-nums text-fg-subtle">{Object.keys(harvestedMap).length} harvested</div>
        </div>
        <ProgressDots results={results} currentIndex={i} />
        <Card className="px-5 py-[22px]">
          <div className="mb-3.5 flex items-center justify-between">
            <Kicker tone="green">{EXERCISE_TYPE_LABELS[item.typeCode]}</Kicker>
            <span className="text-xs tabular-nums text-fg-faint">
              {i + 1} of {items.length}
            </span>
          </div>

          {renderExercise(item, phase, current, handleSubmit)}

          {phase === 'chk' && current && (
            <div className={`animate-fade-up mt-4 rounded-lg p-3.5 ${current.isCorrect ? 'bg-green-soft' : 'bg-red-soft'}`}>
              <div className={`text-[15px] font-bold ${current.isCorrect ? 'text-green-text' : 'text-red-text'}`}>
                {current.isCorrect ? 'Correct' : `Not quite · ${current.correctAnswer}`}
              </div>
              <div className="mt-1 text-[14.5px] leading-relaxed text-fg">{current.explanation}</div>
              {!current.isCorrect && !harvestedMap[i] && (
                <Button variant="outline" size="sm" className="mt-2.5" onClick={handleHarvest} disabled={harvesting}>
                  {harvesting ? 'Harvesting…' : '+ Harvest to flashcards'}
                </Button>
              )}
              {!current.isCorrect && harvestedMap[i] && <div className="mt-2.5 text-[13.5px] font-bold text-green-text">✓ In your deck — first review tomorrow, then 2 d · 7 d · 21 d</div>}
            </div>
          )}

          {phase === 'chk' && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleNext} disabled={finishing}>
                {i + 1 >= items.length ? 'Finish →' : 'Next →'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function renderExercise(item: PublicExerciseDTO, phase: 'ans' | 'chk', current: GradedState | null, onSubmit: (given: GivenAnswer) => void) {
  const isCorrect = current?.isCorrect ?? null;
  const correctAnswer = current?.correctAnswer ?? null;
  const key = item.id;
  switch (item.typeCode) {
    case 'mc_cloze':
      return <McCloze key={key} content={item.content as Omit<McClozeContent, 'answer'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />;
    case 'grammar_drill':
      return <GrammarDrill key={key} content={item.content as Omit<GrammarDrillContent, 'answer'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />;
    case 'reading_comprehension':
      return (
        <ReadingComprehension key={key} content={item.content as Omit<ReadingComprehensionContent, 'answer'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />
      );
    case 'open_cloze':
      return <OpenCloze key={key} content={item.content as Pick<OpenClozeContent, 'pre' | 'post'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />;
    case 'word_formation':
      return (
        <WordFormation key={key} content={item.content as Pick<WordFormationContent, 'pre' | 'post' | 'prompt'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />
      );
    case 'key_word_transformation':
      return (
        <KeyWordTransformation
          key={key}
          content={item.content as Pick<KeyWordTransformationContent, 's1' | 'key' | 'pre' | 'post' | 'hint'>}
          phase={phase}
          isCorrect={isCorrect}
          correctAnswer={correctAnswer}
          onSubmit={onSubmit}
        />
      );
    case 'error_correction':
      return <ErrorCorrection key={key} content={item.content as Pick<ErrorCorrectionContent, 'words'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />;
    case 'collocation_match':
      return (
        <CollocationMatch key={key} content={item.content as Pick<CollocationMatchContent, 'left' | 'right'>} phase={phase} isCorrect={isCorrect} correctAnswer={correctAnswer} onSubmit={onSubmit} />
      );
  }
}
