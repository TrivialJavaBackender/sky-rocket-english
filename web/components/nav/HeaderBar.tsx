'use client';

import { useState } from 'react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { useCourseSwitch } from './useCourseSwitch';
import type { CourseOption } from './course-option';

/**
 * Mobile top header (< 980px, "onMain" screens only per the mockup) — course
 * switcher pill + dropdown. Every row comes from the DB (§8 D4): until de-a2
 * shipped this held a hardcoded "German · A2 → B1 · SOON" placeholder, which
 * by then named neither the right language level nor a course that existed.
 */
export function HeaderBar({
  courses,
  activeSlug,
  username,
}: {
  courses: CourseOption[];
  activeSlug: string | null;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const { switchTo, pending } = useCourseSwitch();
  const active = courses.find((c) => c.slug === activeSlug) ?? courses[0];

  return (
    <header className="relative mb-3.5 flex items-center justify-between desktop:hidden">
      <div className="text-[17px] font-bold tracking-[-.01em]">SkyRocket</div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-3 py-[5px] text-[13px] font-semibold text-fg"
      >
        {active ? active.shortLabel : 'Course'} <span className="text-[8px] text-fg-faint">▼</span>
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 top-[38px] z-30 min-w-[224px] rounded-xl border border-border bg-bg-card p-1.5 shadow-pop">
          {courses.map((course) =>
            course.slug === active?.slug ? (
              <div
                key={course.slug}
                className="flex justify-between rounded-lg bg-bg-faint px-3 py-[9px] text-sm font-semibold"
              >
                {course.fullLabel} <span className="text-green">✓</span>
              </div>
            ) : (
              <button
                key={course.slug}
                onClick={() => {
                  setOpen(false);
                  switchTo(course.slug);
                }}
                disabled={pending}
                className="flex w-full justify-between rounded-lg px-3 py-[9px] text-left text-sm text-fg-muted hover:bg-bg-faint disabled:opacity-50"
              >
                {course.fullLabel}
              </button>
            ),
          )}
          <div className="my-1.5 border-t border-border-faint" />
          <div className="truncate px-3 py-[6px] text-sm font-semibold">{username}</div>
          <SignOutButton className="w-full rounded-lg px-3 py-[9px] text-sm text-fg-muted hover:bg-bg-faint" />
        </div>
      )}
    </header>
  );
}
