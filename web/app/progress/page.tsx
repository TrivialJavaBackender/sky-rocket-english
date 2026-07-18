import { getCurrentUserId } from '@/lib/current-user';
import { getProgress } from '@/lib/use-cases/progress';

// Aggregates live progress — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';
import { ProgressStats } from '@/components/progress/ProgressStats';
import { ProgressBars } from '@/components/progress/ProgressBars';
import { Ladder } from '@/components/progress/Ladder';
import { UpcomingList } from '@/components/progress/UpcomingList';
import { CourseCompletedBanner } from '@/components/progress/CourseCompletedBanner';

// UC-04 Progress (ARCHITECTURE.md §1.1, §7.1 `/progress`).
export default async function ProgressPage() {
  const userId = await getCurrentUserId();
  const progress = await getProgress(userId);

  return (
    <div className="animate-fade-up">
      <h1 className="m-0 mb-4 text-[30px] tracking-[-.01em]">Progress</h1>
      {progress.courseCompleted && <CourseCompletedBanner courseName={progress.courseName} levelLabel={progress.levelLabel} />}
      <ProgressStats stats={progress.stats} />
      <ProgressBars blocks={progress.blocks} />
      <Ladder />
      <UpcomingList upcoming={progress.upcoming} />
    </div>
  );
}
