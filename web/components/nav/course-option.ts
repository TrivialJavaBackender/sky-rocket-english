/**
 * The shape the nav needs to render the course switcher. Built once in
 * app/(app)/layout.tsx so SideRail and HeaderBar agree on the labels instead of
 * each formatting a CourseDTO their own way.
 */
export interface CourseOption {
  slug: string;
  /** Compact form for the mobile pill, e.g. "DE · A1 → A2". */
  shortLabel: string;
  /** Full form for switcher rows, e.g. "Deutsch · A1 → A2". */
  fullLabel: string;
}
