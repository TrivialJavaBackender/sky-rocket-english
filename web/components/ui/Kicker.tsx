import type { ReactNode } from 'react';

/** Small uppercase eyebrow label — "BLOCK 3 · MODULE 09", "GRAMMAR SPOTLIGHT", section headers throughout the mockup (11px / .14em / 700). */
export function Kicker({ children, className = '', tone = 'subtle' }: { children: ReactNode; className?: string; tone?: 'subtle' | 'green' | 'red' }) {
  const toneClass = tone === 'green' ? 'text-green-text' : tone === 'red' ? 'text-red-text' : 'text-fg-subtle';
  return <div className={`text-[11px] font-bold tracking-kicker uppercase ${toneClass} ${className}`}>{children}</div>;
}
