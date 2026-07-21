'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isNavItemActive } from './nav-items';
import { CourseIcon, ProgressIcon, ReviewIcon, TodayIcon } from './NavIcons';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { useCourseSwitch } from './useCourseSwitch';
import type { CourseOption } from './course-option';

const ICONS = { today: TodayIcon, course: CourseIcon, review: ReviewIcon, progress: ProgressIcon };

/**
 * Desktop left rail (>= 980px) — ARCHITECTURE.md §7.1. The course rows come
 * from the DB (§8 D4). Until de-a2 shipped, the second row was a hardcoded
 * "German · A2 → B1 · soon" placeholder that §1.1 UC-03 sanctioned while only
 * one course existed; now every enrolled course is a real switch target.
 */
export function SideRail({
  courses,
  activeSlug,
  username,
}: {
  courses: CourseOption[];
  activeSlug: string | null;
  username: string;
}) {
  const pathname = usePathname();
  const { switchTo, pending } = useCourseSwitch();
  const active = courses.find((c) => c.slug === activeSlug) ?? courses[0];

  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-[3px] border-r border-border bg-bg-card p-[22px_14px] desktop:flex">
      <div className="px-3 pb-[18px] text-lg font-bold tracking-[-.01em]">SkyRocket</div>
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.key];
        const isActive = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-[10px] rounded-lg px-3 py-[10px] text-[15px] font-semibold no-underline ${isActive ? 'bg-bg-faint text-fg' : 'text-fg-muted hover:bg-bg-faint/60'}`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-border-faint pt-3">
        {courses.map((course) =>
          course.slug === active?.slug ? (
            <div key={course.slug} className="rounded-lg bg-bg-faint px-3 py-2 text-[13.5px] font-semibold">
              {course.fullLabel}
            </div>
          ) : (
            <button
              key={course.slug}
              onClick={() => switchTo(course.slug)}
              disabled={pending}
              className="w-full rounded-lg px-3 py-2 text-left text-[13.5px] text-fg-muted hover:bg-bg-faint/60 hover:text-fg disabled:opacity-50"
            >
              {course.fullLabel}
            </button>
          ),
        )}
        <div className="mt-1 border-t border-border-faint pt-2">
          <div className="truncate px-3 py-1 text-[13.5px] font-semibold">{username}</div>
          <SignOutButton className="w-full rounded-lg px-3 py-2 text-[13.5px] text-fg-muted hover:bg-bg-faint/60 hover:text-fg" />
        </div>
      </div>
    </nav>
  );
}
