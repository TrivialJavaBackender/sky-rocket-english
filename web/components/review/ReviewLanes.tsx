import type { ReviewHubDTO } from '@/lib/use-cases/review';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';
import { LinkButton } from '@/components/ui/LinkButton';
import { ReviewQueueLauncher } from './ReviewQueueLauncher';
import { ModuleReviewLauncher } from './ModuleReviewLauncher';

const NOTE_TYPE_LABELS: Record<string, string> = { vocab: 'word → meaning', vocab_reverse: 'meaning → word' };

/** UC-16/17 Review hub — the three lanes (ARCHITECTURE.md §1.4, §7.1 `/review`). Lane 1 links to the dedicated `/flashcards` route; lanes 2/3 launch `ExercisePlayer` in place. */
export function ReviewLanes({ hub, queueItems, moduleReviewSets }: { hub: ReviewHubDTO; queueItems: PublicExerciseDTO[]; moduleReviewSets: Record<number, PublicExerciseDTO[]> }) {
  const breakdown = Object.entries(hub.lane1.breakdown)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${n} ${NOTE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')}`)
    .join(' · ');

  return (
    <div className="animate-fade-up">
      <h1 className="m-0 mb-1 text-[30px] tracking-[-.01em]">Review</h1>
      <p className="m-0 mb-4 text-[15px] text-fg-muted">Three lanes keep everything you have met in circulation.</p>

      <Card className="mb-3.5">
        <Kicker>Lane 1 · Flashcards</Kicker>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-[34px] font-bold tracking-[-.02em] tabular-nums">{hub.lane1.cardsDue}</span>
          <span className="text-sm text-fg-muted">cards due</span>
        </div>
        {breakdown && <div className="text-[13.5px] text-fg-muted">{breakdown}</div>}
        {hub.lane1.cardsDue > 0 ? (
          <LinkButton href="/flashcards" className="mt-3">
            Start · ≈ 12 min
          </LinkButton>
        ) : (
          <div className="mt-2.5 text-sm font-semibold text-green-text">Queue clear — the next batch opens as cards come due.</div>
        )}
      </Card>

      <Card className="mb-3.5">
        <div className="flex items-center gap-2.5">
          <Kicker>Lane 2 · Exercise re-queue</Kicker>
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-[34px] font-bold tracking-[-.02em] tabular-nums">{hub.lane2.itemsDue}</span>
          <span className="text-sm text-fg-muted">items due</span>
        </div>
        <div className="text-pretty text-[13.5px] leading-relaxed text-fg-muted">Missed items return at 2 · 7 · 21 days. Sessions 2–3 open with a 10-item Review Slot from this queue.</div>
        {hub.lane2.items.length > 0 ? (
          <>
            {hub.lane2.items.map((it, i) => (
              <div key={i} className="mt-0.5 flex justify-between gap-2.5 border-t border-border-faint py-[9px] text-sm">
                <span className="font-semibold">{it.moduleTitle ?? 'exercise'}</span>
                <span className="text-fg-subtle">{it.dueAt.toDateString()}</span>
              </div>
            ))}
            <div className="mt-2.5">
              <ReviewQueueLauncher items={queueItems} />
            </div>
          </>
        ) : (
          <div className="mt-2.5 text-sm font-semibold text-green-text">Queue clear — nothing scheduled to return today.</div>
        )}
      </Card>

      <Card>
        <Kicker className="mb-1">Lane 3 · Module reviews</Kicker>
        {hub.lane3.items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 border-t border-border-faint py-[11px] first:border-t-0">
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{it.moduleTitle}</span>
              <span className="text-[13px] text-fg-muted">
                {it.stage === 'r7' ? '+7-day quiz' : '+21-day quiz'} · {it.dueNow ? 'due today' : it.dueAt.toDateString()}
              </span>
            </span>
            {it.dueNow && moduleReviewSets[it.moduleId] && <ModuleReviewLauncher moduleId={it.moduleId} moduleTitle={it.moduleTitle} stage={it.stage} items={moduleReviewSets[it.moduleId]} />}
          </div>
        ))}
        <div className="mt-2 text-[13px] text-fg-muted">80%+ on both quizzes promotes a module to Mastered.</div>
      </Card>
    </div>
  );
}
