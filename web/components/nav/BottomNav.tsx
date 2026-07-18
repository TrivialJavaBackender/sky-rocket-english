'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isNavItemActive } from './nav-items';
import { CourseIcon, ProgressIcon, ReviewIcon, TodayIcon } from './NavIcons';

const ICONS = { today: TodayIcon, course: CourseIcon, review: ReviewIcon, progress: ProgressIcon };

/** Mobile tab bar (< 980px) — ARCHITECTURE.md §7.1. Fixed to viewport bottom, mirrors the mockup's `nav` (blurred white, safe-area padding). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg-card/95 backdrop-blur desktop:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.key];
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-[3px] py-[9px] pb-[11px] text-[10.5px] font-semibold tracking-[.05em] no-underline ${active ? 'text-ink' : 'text-fg-faint'}`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
