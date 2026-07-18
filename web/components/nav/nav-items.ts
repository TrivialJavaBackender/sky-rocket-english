/** Shared by SideRail + BottomNav — one source for hrefs/labels/active-match so the two shells can't drift. */
export interface NavItem {
  key: 'today' | 'course' | 'review' | 'progress';
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'today', href: '/', label: 'Today' },
  { key: 'course', href: '/course', label: 'Course' },
  { key: 'review', href: '/review', label: 'Review' },
  { key: 'progress', href: '/progress', label: 'Progress' },
];

/** "/course" is active for the map itself and for anything nested under it (unit page, session runner) — mirrors the mockup's `active('map')` also covering the `module` screen. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
