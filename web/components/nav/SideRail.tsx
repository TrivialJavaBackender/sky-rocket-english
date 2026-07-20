'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isNavItemActive } from './nav-items';
import { CourseIcon, ProgressIcon, ReviewIcon, TodayIcon } from './NavIcons';
import { SignOutButton } from '@/components/auth/SignOutButton';

const ICONS = { today: TodayIcon, course: CourseIcon, review: ReviewIcon, progress: ProgressIcon };

/**
 * Desktop left rail (>= 980px) — ARCHITECTURE.md §7.1. `courseLabel` comes
 * from the DB (getCourseMap/getToday's `courseName`+`levelLabel`, §8 D4).
 * The second line ("German · A2 → B1 · soon") is the one piece of UI copy
 * ARCHITECTURE explicitly sanctions as a placeholder (§1.1 UC-03: "курс
 * один — свитчер показывает заглушку, пока не появится второй курс") — it
 * names a course that has no row in the DB yet, so there is nothing to fetch.
 */
export function SideRail({ courseLabel, username }: { courseLabel: string; username: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-[3px] border-r border-border bg-bg-card p-[22px_14px] desktop:flex">
      <div className="px-3 pb-[18px] text-lg font-bold tracking-[-.01em]">SkyRocket</div>
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.key];
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-[10px] rounded-lg px-3 py-[10px] text-[15px] font-semibold no-underline ${active ? 'bg-bg-faint text-fg' : 'text-fg-muted hover:bg-bg-faint/60'}`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-border-faint pt-3">
        <div className="rounded-lg bg-bg-faint px-3 py-2 text-[13.5px] font-semibold">{courseLabel}</div>
        <div className="px-3 py-2 text-[13.5px] text-fg-faint">German · A2 → B1 · soon</div>
        <div className="mt-1 border-t border-border-faint pt-2">
          <div className="truncate px-3 py-1 text-[13.5px] font-semibold">{username}</div>
          <SignOutButton className="w-full rounded-lg px-3 py-2 text-[13.5px] text-fg-muted hover:bg-bg-faint/60 hover:text-fg" />
        </div>
      </div>
    </nav>
  );
}
