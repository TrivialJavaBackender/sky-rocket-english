// Nav icon set — exact path data from docs/design/skyrocket/Skyrocket.dc.html
// (SideRail / BottomNav buttons), ported 1:1 so the icon language matches
// the approved mockup.

export function TodayIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2.3 1.4" />
    </svg>
  );
}

export function CourseIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  );
}

export function ReviewIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
      <path d="M12.2 1.6v2.8h-2.8" />
    </svg>
  );
}

export function ProgressIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3.5 13.5V9.5" />
      <path d="M8 13.5V5" />
      <path d="M12.5 13.5V2.5" />
    </svg>
  );
}
