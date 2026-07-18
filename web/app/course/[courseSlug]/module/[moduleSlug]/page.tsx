import { notFound } from 'next/navigation';
import { getCurrentUserId } from '@/lib/current-user';
import { getUnit } from '@/lib/use-cases/unit';
import { startExerciseSet, type PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import type { ExerciseGroup } from '@/lib/domain/types';
import { LinkButton } from '@/components/ui/LinkButton';
import { UnitHeader } from '@/components/unit/UnitHeader';
import { GoalsList } from '@/components/unit/GoalsList';
import { SessionRibbon } from '@/components/unit/SessionRibbon';
import { GrammarSpotlight } from '@/components/unit/GrammarSpotlight';
import { WatchoutBox } from '@/components/unit/WatchoutBox';
import { VocabStudio } from '@/components/unit/VocabStudio';
import { UnitLaunchers } from '@/components/unit/UnitLaunchers';
import { ReadingText } from '@/components/reading/ReadingText';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

// UC-05..08 Unit overview (ARCHITECTURE.md §1.2, §7.1).
export default async function UnitPage({ params }: { params: Promise<{ courseSlug: string; moduleSlug: string }> }) {
  const { courseSlug, moduleSlug } = await params;
  const userId = await getCurrentUserId();
  const unit = await getUnit(userId, courseSlug, moduleSlug);
  if (!unit) notFound();

  const exerciseSets: Partial<Record<ExerciseGroup, PublicExerciseDTO[]>> = {};
  for (const l of unit.launchers) {
    exerciseSets[l.key] = await startExerciseSet({ moduleId: unit.moduleId, groupKey: l.key, pool: 'core' });
  }

  return (
    <div className="animate-fade-up">
      <LinkButton href="/course" variant="ghost" className="mb-3.5">
        ← Course map
      </LinkButton>

      <UnitHeader blockPosition={unit.blockPosition} blockName={unit.blockName} moduleSlug={unit.moduleSlug} title={unit.title} standfirst={unit.standfirst} />

      <Card className="mb-3.5">
        <Kicker className="mb-1">In this unit</Kicker>
        {unit.goals.map((g, i) => (
          <div key={i} className="flex gap-3 border-t border-border-faint py-[9px] text-[15px] first:border-t-0">
            <span className="mt-[7px] h-2 w-2 flex-none rounded-sm bg-green" />
            <span>{g}</span>
          </div>
        ))}
        <SessionRibbon courseSlug={unit.courseSlug} moduleSlug={unit.moduleSlug} sessions={unit.sessions} />
      </Card>

      {unit.spotlights.map((s) => (
        <GrammarSpotlight key={s.id} spotlight={s} />
      ))}

      {unit.watchouts.map((w) => (
        <WatchoutBox key={w.id} watchout={w} />
      ))}

      {unit.reading && (
        <div className="mx-0.5 mb-[22px]">
          {unit.reading.kicker && <Kicker>{unit.reading.kicker}</Kicker>}
          <h2 className="text-pretty m-0 mb-1 mt-1 text-[26px] leading-[1.15] tracking-[-.01em]">{unit.reading.title}</h2>
          {unit.reading.meta && <div className="mb-3.5 text-[13px] text-fg-subtle">{unit.reading.meta}</div>}
          <ReadingText paragraphs={unit.reading.paragraphs} glosses={unit.reading.glosses} moduleId={unit.moduleId} />
        </div>
      )}

      <VocabStudio title={unit.vocabTitle} entries={unit.vocabEntries} />

      <UnitLaunchers launchers={unit.launchers} exerciseSets={exerciseSets} moduleTitle={unit.title} />

      <GoalsList goals={unit.goals} kicker="Unit review · session 4" />
    </div>
  );
}
