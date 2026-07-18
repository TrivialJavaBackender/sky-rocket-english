import type { ElementType, ReactNode } from 'react';

type CardTone = 'default' | 'soft' | 'green' | 'red';

const toneClasses: Record<CardTone, string> = {
  default: 'bg-bg-card border-border',
  soft: 'bg-bg-soft border-border',
  green: 'bg-green-soft border-green-border',
  red: 'bg-red-soft border-red-border',
};

/** The rounded bordered panel used everywhere in the mockup (border-radius 14px, 1px hairline border). */
export function Card({
  children,
  tone = 'default',
  className = '',
  as: As = 'section',
  padding = 'default',
}: {
  children: ReactNode;
  tone?: CardTone;
  className?: string;
  as?: ElementType;
  padding?: 'default' | 'sm' | 'none';
}) {
  const padClass = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : 'px-5 py-[18px]';
  return <As className={`rounded-xl border ${toneClasses[tone]} ${padClass} ${className}`}>{children}</As>;
}
