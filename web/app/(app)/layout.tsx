import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import * as courseSwitchUseCase from '@/lib/use-cases/course-switch';
import { getCurrentUser } from '@/lib/current-user';
import { HeaderBar } from '@/components/nav/HeaderBar';
import { SideRail } from '@/components/nav/SideRail';
import { BottomNav } from '@/components/nav/BottomNav';

// Reads cookies and per-request DB state, so it must never be frozen into
// static HTML at build time — and the build has to succeed against a
// database with no users at all (ARCHITECTURE §8 D10).
export const dynamic = 'force-dynamic';

// ARCHITECTURE.md §9 stage 4: the real shell — SideRail (desktop >= 980px,
// pure CSS breakpoint, see tailwind.config.ts `desktop`) / HeaderBar +
// BottomNav (mobile). Course label comes from the DB (§8 D4); only one
// course is enrolled today so `courses[0]` is "current" by construction.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // `middleware.ts` already gates this group; this is the defence-in-depth
  // copy for the case where the cookie expires between the two.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const courses = await courseSwitchUseCase.listAvailableCourses();
  const current = courses[0];
  const courseLabel = current ? `${current.language.toUpperCase()} · ${current.levelLabel}` : 'Course';
  const courseFullLabel = current ? `${current.name} · ${current.levelLabel}` : 'Course';

  return (
    <>
      <SideRail courseLabel={courseLabel} username={user.username} />
      <div className="desktop:pl-56">
        <div className="mx-auto max-w-[720px] px-[18px] pb-[104px] pt-4 desktop:pb-10">
          <HeaderBar courseLabel={courseLabel} courseFullLabel={courseFullLabel} username={user.username} />
          {children}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
