import { getCurrentUserId } from '@/lib/current-user';
import { getReviewHub } from '@/lib/use-cases/review';

// Due-today queues change constantly — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';
import { startReviewSlot } from '@/lib/use-cases/exercise-set';
import { getModuleReviewSet } from '@/lib/use-cases/module-review';
import type { PublicExerciseDTO } from '@/lib/use-cases/exercise-set';
import { ReviewLanes } from '@/components/review/ReviewLanes';

// UC-16/17 Review hub (ARCHITECTURE.md §1.4, §7.1 `/review`).
export default async function ReviewPage() {
  const userId = await getCurrentUserId();
  const hub = await getReviewHub(userId);

  const slot = hub.lane2.itemsDue > 0 ? await startReviewSlot(userId) : [];
  const queueItems = slot.map((s) => s.exercise);

  const moduleReviewSets: Record<number, PublicExerciseDTO[]> = {};
  for (const item of hub.lane3.items) {
    if (item.dueNow) moduleReviewSets[item.moduleId] = await getModuleReviewSet(item.moduleId);
  }

  return <ReviewLanes hub={hub} queueItems={queueItems} moduleReviewSets={moduleReviewSets} />;
}
