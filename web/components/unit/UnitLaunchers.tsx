'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UnitLauncherDTO } from '@/lib/use-cases/unit';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
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
export function UnitLaunchers({ launchers, exerciseSets, moduleTitle }: { launchers: UnitLauncherDTO[]; exerciseSets: Partial<Record<ExerciseGroup, PublicExerciseDTO[]>>; moduleTitle: string }) {
  const [active, setActive] = useState<ExerciseGroup | null>(null);
  const router = useRouter();

  return (
    <>
      {launchers.map((l) => (
        <button
          key={l.key}
          onClick={() => setActive(l.key)}
          className="mb-[22px] flex w-full items-center gap-3.5 rounded-lg border-[1.5px] border-ink bg-bg-card px-[18px] py-[15px] text-left"
        >
          <span className="flex-1">
            <span className="block text-[15.5px] font-bold">{l.label}</span>
            <span className="text-[13px] text-fg-muted">{l.detail}</span>
          </span>
          <span className="text-lg">→</span>
        </button>
      ))}
      {active && exerciseSets[active] && (
        <ExercisePlayer
          items={exerciseSets[active]!}
          context="practice"
          headerLabel={`${moduleTitle} · Practice`}
          onClose={() => {
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
