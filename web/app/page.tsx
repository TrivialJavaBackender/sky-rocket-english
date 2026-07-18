import { getCurrentUserId } from '@/lib/current-user';
import { getToday } from '@/lib/use-cases/today';

// Personalized, mutates on entry (ensureActiveEnrollment/ensureFirstModuleUnlocked)
// and reflects progress that changes every request — must never be
// build-time prerendered as static HTML (Next.js would otherwise freeze it
// at the last build; see stage-4 report for the other 4 routes with the
// same requirement).
export const dynamic = 'force-dynamic';
import { TodayHeader } from '@/components/today/TodayHeader';
import { OverdueBanner } from '@/components/today/OverdueBanner';
import { NothingDueCard } from '@/components/today/NothingDueCard';
import { SessionCard } from '@/components/today/SessionCard';
import { DueTiles } from '@/components/today/DueTiles';

// UC-01 Dashboard / Today (ARCHITECTURE.md §1.1, §7.1 `/`).
export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const today = await getToday(userId);

  return (
    <div className="animate-fade-up">
      <TodayHeader now={today.now} streakDays={today.streakDays} />

      {today.todayState === 'overdue-reviews' && today.overdueMessage && <OverdueBanner count={today.overdueReviewCount} message={today.overdueMessage} />}

      {today.todayState === 'nothing-due' ? (
        <NothingDueCard />
      ) : (
        today.currentModule &&
        today.currentSession && (
          <>
            <SessionCard
              courseSlug={today.courseSlug}
              moduleSlug={today.currentModule.slug}
              moduleTitle={today.currentModule.title}
              sessionType={today.currentSession.sessionType}
              sessionTitle={today.currentSession.title}
              sessionPosition={today.currentSession.position}
              plannedMinutes={today.currentSession.plannedMinutes}
              steps={today.steps}
            />
            <DueTiles cardsDue={today.cardsDueCount} queueDue={today.queueDueCount} />
          </>
        )
      )}
    </div>
  );
}
