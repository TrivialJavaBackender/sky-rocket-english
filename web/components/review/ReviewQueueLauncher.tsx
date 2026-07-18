'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import { ExercisePlayer } from '@/components/player/ExercisePlayer';
import { Button } from '@/components/ui/Button';

/** UC-16 lane 2 "Run the Review Slot" button on the Review hub (ARCHITECTURE.md §1.4, §7.1 `/review`). Each answer resolves its own review_queue_item via `gradeAndRecord(context='review_slot')` — nothing extra to finalize once the run ends. */
export function ReviewQueueLauncher({ items }: { items: PublicExerciseDTO[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Run the Review Slot · {items.length} items
      </Button>
      {open && (
        <ExercisePlayer
          items={items}
          context="review_slot"
          headerLabel="Review Slot"
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
