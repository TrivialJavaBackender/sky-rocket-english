'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UnitLauncherDTO } from '@/lib/use-cases/unit';
import type { PublicExerciseDTO, SetProgressDTO } from '@/lib/use-cases/exercise-set';
import type { ExerciseGroup } from '@/lib/domain/types';
import { ExercisePlayer } from '@/components/player/ExercisePlayer';

/**
 * UC-09(б) launcher entry points on the unit page — "Practise the
 * spotlight/reading/vocabulary" (ARCHITECTURE.md §1.2, §7.2). Exercise sets
 * are pre-fetched server-side per group (RSC, answer-stripped) and handed
 * to this island as props; it only decides *which* pre-fetched set to show,
 * never fetches content itself (§2: islands don't read the DB). Grading
 * context is `practice` (free practice outside the weekly protocol).
 */
export function UnitLaunchers({
  launchers,
  exerciseSets,
  progressByGroup,
  moduleTitle,
}: {
  launchers: UnitLauncherDTO[];
  exerciseSets: Partial<Record<ExerciseGroup, PublicExerciseDTO[]>>;
  /** Resume support (UC-09) — see `computeSetProgress`. */
  progressByGroup?: Partial<Record<ExerciseGroup, SetProgressDTO>>;
  moduleTitle: string;
}) {
  const [active, setActive] = useState<ExerciseGroup | null>(null);
  const [fresh, setFresh] = useState(false);
  const router = useRouter();

  const partwayFor = (key: ExerciseGroup) => {
    const p = progressByGroup?.[key];
    return p && p.answered > 0 && p.answered < p.total ? p : null;
  };

  const activeProgress = active ? partwayFor(active) : null;

  return (
    <>
      {launchers.map((l) => {
        const partway = partwayFor(l.key);
        return (
          <div key={l.key} className="mb-[22px]">
            <button
              onClick={() => {
                setFresh(false);
                setActive(l.key);
              }}
              className="flex w-full items-center gap-3.5 rounded-lg border-[1.5px] border-ink bg-bg-card px-[18px] py-[15px] text-left"
            >
              <span className="flex-1">
                <span className="block text-[15.5px] font-bold">{l.label}</span>
                <span className="text-[13px] text-fg-muted">
                  {partway ? `Resume at item ${partway.resumeIndex + 1} of ${partway.total} · ${partway.answered} answered` : l.detail}
                </span>
              </span>
              <span className="text-lg">→</span>
            </button>
            {partway && (
              <button
                onClick={() => {
                  setFresh(true);
                  setActive(l.key);
                }}
                className="mt-1.5 text-[13px] font-semibold text-fg-muted underline underline-offset-2 hover:text-fg"
              >
                Start over from item 1
              </button>
            )}
          </div>
        );
      })}
      {active && exerciseSets[active] && (
        <ExercisePlayer
          items={exerciseSets[active]!}
          context="practice"
          headerLabel={`${moduleTitle} · Practice`}
          initialResults={fresh ? undefined : (activeProgress?.results ?? undefined)}
          initialIndex={fresh ? 0 : (activeProgress?.resumeIndex ?? 0)}
          onClose={() => {
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
