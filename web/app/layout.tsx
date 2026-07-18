import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getCurrentUserId } from '@/lib/current-user';
import * as courseSwitchUseCase from '@/lib/use-cases/course-switch';
import { HeaderBar } from '@/components/nav/HeaderBar';
import { SideRail } from '@/components/nav/SideRail';
import { BottomNav } from '@/components/nav/BottomNav';

export const metadata: Metadata = {
  title: 'SkyRocket English',
  description: 'Personal language-learning course engine.',
};

// ARCHITECTURE.md §9 stage 4: the real shell — SideRail (desktop >= 980px,
// pure CSS breakpoint, see tailwind.config.ts `desktop`) / HeaderBar +
// BottomNav (mobile). Course label comes from the DB (§8 D4); only one
// course is enrolled today so `courses[0]` is "current" by construction.
export default async function RootLayout({ children }: { children: ReactNode }) {
  await getCurrentUserId();
  const courses = await courseSwitchUseCase.listAvailableCourses();
  const current = courses[0];
  const courseLabel = current ? `${current.language.toUpperCase()} · ${current.levelLabel}` : 'Course';
  const courseFullLabel = current ? `${current.name} · ${current.levelLabel}` : 'Course';

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..700;1,400..600&display=swap" />
      </head>
      <body className="bg-bg font-sans text-fg antialiased">
        <SideRail courseLabel={courseLabel} />
        <div className="desktop:pl-56">
          <div className="mx-auto max-w-[720px] px-[18px] pb-[104px] pt-4 desktop:pb-10">
            <HeaderBar courseLabel={courseLabel} courseFullLabel={courseFullLabel} />
            {children}
          </div>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
