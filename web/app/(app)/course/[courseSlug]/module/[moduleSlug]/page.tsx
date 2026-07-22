import { notFound } from 'next/navigation';
import { getCurrentUserId } from '@/lib/current-user';
import { getUnit, type ReadingWithGlossesDTO } from '@/lib/use-cases/unit';
import { startExerciseSet, computeSetProgress, type PublicExerciseDTO, type SetProgressDTO } from '@/lib/use-cases/exercise-set';
import type { ExerciseGroup } from '@/lib/domain/types';
import { LinkButton } from '@/components/ui/LinkButton';
import { UnitHeader } from '@/components/unit/UnitHeader';
import { GoalsProgress } from '@/components/unit/GoalsProgress';
import { SessionRibbon } from '@/components/unit/SessionRibbon';
import { ReferenceSection } from '@/components/unit/ReferenceSection';
import { GrammarSpotlight } from '@/components/unit/GrammarSpotlight';
import { WatchoutBox } from '@/components/unit/WatchoutBox';
import { VocabStudio } from '@/components/unit/VocabStudio';
import { UnitLaunchers } from '@/components/unit/UnitLaunchers';
import { ReadingText } from '@/components/reading/ReadingText';
import { DownloadModuleAudio } from '@/components/audio/DownloadModuleAudio';
import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/**
 * UC-05 Unit hub (ARCHITECTURE.md §1.2, §7.1). The guided path lives in the
 * session runner — this page shows goals-with-progress, the single Continue
 * CTA, the 4-session plan with step previews (D11 gating states), and keeps
 * the full theory/vocab/texts only as collapsed reference sections below.
 */
export default async function UnitPage({ params }: { params: Promise<{ courseSlug: string; moduleSlug: string }> }) {
  const { courseSlug, moduleSlug } = await params;
  const userId = await getCurrentUserId();
  const unit = await getUnit(userId, courseSlug, moduleSlug);
  if (!unit) notFound();

  const exerciseSets: Partial<Record<ExerciseGroup, PublicExerciseDTO[]>> = {};
  const practiceProgress: Partial<Record<ExerciseGroup, SetProgressDTO>> = {};
  for (const l of unit.launchers) {
    const set = await startExerciseSet({ moduleId: unit.moduleId, groupKey: l.key, pool: 'core' });
    exerciseSets[l.key] = set;
    practiceProgress[l.key] = await computeSetProgress(userId, set, 'practice');
  }

  return (
    <div className="animate-fade-up">
      <LinkButton href="/course" variant="ghost" className="mb-3.5">
        ← Course map
      </LinkButton>

      <UnitHeader blockPosition={unit.blockPosition} blockName={unit.blockName} moduleSlug={unit.moduleSlug} title={unit.title} standfirst={unit.standfirst} />

      <DownloadModuleAudio vocabEntries={unit.vocabEntries} spotlights={unit.spotlights} watchouts={unit.watchouts} reading={unit.reading} readingExtra={unit.readingExtra} />

      <GoalsProgress goals={unit.goals} />

      {unit.continueTarget ? (
        <LinkButton href={`/course/${unit.courseSlug}/module/${unit.moduleSlug}/session/${unit.continueTarget.sessionType}`} size="block" className="mb-3.5">
          Continue Session {unit.continueTarget.sessionPosition} · {unit.continueTarget.stepTitle} →
        </LinkButton>
      ) : (
        <Card tone="green" className="mb-3.5 text-center text-[15px] font-semibold">
          All four sessions are done — this unit is closed. 🎉
        </Card>
      )}

      <Card className="mb-[22px]">
        <Kicker className="mb-2.5">This week · 4 sessions</Kicker>
        <SessionRibbon courseSlug={unit.courseSlug} moduleSlug={unit.moduleSlug} sessions={unit.sessions} />
      </Card>

      <Kicker className="mx-0.5 mb-2">Reference · study inside the sessions, look things up here</Kicker>

      <ReferenceSection title="Grammar reference" detail={`${unit.spotlights.length} spotlights · ${unit.watchouts.length} watch-outs`}>
        {unit.spotlights.map((s) => (
          <GrammarSpotlight key={s.id} spotlight={s} />
        ))}
        {unit.watchouts.map((w) => (
          <WatchoutBox key={w.id} watchout={w} />
        ))}
      </ReferenceSection>

      <ReferenceSection title={`Vocabulary · ${unit.vocabEntries.length} lexemes`} detail="Full studio">
        <VocabStudio title={unit.vocabTitle} entries={unit.vocabEntries} />
      </ReferenceSection>

      {unit.reading && (
        <ReferenceSection title="Long-read" detail={unit.reading.title}>
          <ReferenceReading reading={unit.reading} moduleId={unit.moduleId} />
        </ReferenceSection>
      )}

      {unit.readingExtra && (
        <ReferenceSection title="Extra text" detail={unit.readingExtra.title}>
          <ReferenceReading reading={unit.readingExtra} moduleId={unit.moduleId} />
        </ReferenceSection>
      )}

      <ReferenceSection title="Free practice" detail="Exercise sets outside the weekly protocol">
        <UnitLaunchers launchers={unit.launchers} exerciseSets={exerciseSets} progressByGroup={practiceProgress} moduleTitle={unit.title} />
      </ReferenceSection>
    </div>
  );
}

function ReferenceReading({ reading, moduleId }: { reading: ReadingWithGlossesDTO; moduleId: number }) {
  return (
    <div>
      {reading.kicker && <Kicker>{reading.kicker}</Kicker>}
      <h2 className="text-pretty m-0 mb-1 mt-1 text-[22px] leading-[1.2] tracking-[-.01em]">{reading.title}</h2>
      {reading.meta && <div className="mb-3.5 text-[13px] text-fg-subtle">{reading.meta}</div>}
      <ReadingText paragraphs={reading.paragraphs} glosses={reading.glosses} moduleId={moduleId} paragraphAudio={reading.paragraphAudio} />
    </div>
  );
}
