import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import * as courseSwitchUseCase from '@/lib/use-cases/course-switch';
import { getCurrentUser } from '@/lib/current-user';
import { HeaderBar } from '@/components/nav/HeaderBar';
import { SideRail } from '@/components/nav/SideRail';
import { BottomNav } from '@/components/nav/BottomNav';
import { AudioProvider } from '@/components/audio/AudioProvider';

// Reads cookies and per-request DB state, so it must never be frozen into
// static HTML at build time — and the build has to succeed against a
// database with no users at all (ARCHITECTURE §8 D10).
export const dynamic = 'force-dynamic';

// ARCHITECTURE.md §9 stage 4: the real shell — SideRail (desktop >= 980px,
// pure CSS breakpoint, see tailwind.config.ts `desktop`) / HeaderBar +
// BottomNav (mobile). Course rows come from the DB (§8 D4).
export default async function AppLayout({ children }: { children: ReactNode }) {
  // `middleware.ts` already gates this group; this is the defence-in-depth
  // copy for the case where the cookie expires between the two.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // `courses[0]` is only the lowest `position`, not the learner's enrolment —
  // reading it as "current" silently pinned the nav to en-c1 once a second
  // course existed, no matter which one they had switched to.
  const [allCourses, active] = await Promise.all([
    courseSwitchUseCase.listAvailableCourses(),
    courseSwitchUseCase.getActiveCourse(user.userId),
  ]);
  const courses = allCourses.map((c) => ({
    slug: c.slug,
    shortLabel: `${c.language.toUpperCase()} · ${c.levelLabel}`,
    fullLabel: `${c.name} · ${c.levelLabel}`,
  }));

  return (
    <>
      <SideRail courses={courses} activeSlug={active?.slug ?? null} username={user.username} />
      <div className="desktop:pl-56">
        <div className="mx-auto max-w-[720px] px-[18px] pb-[104px] pt-4 desktop:pb-10">
          <HeaderBar courses={courses} activeSlug={active?.slug ?? null} username={user.username} />
          <AudioProvider>{children}</AudioProvider>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
