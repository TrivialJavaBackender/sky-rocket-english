import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'default' | 'sm' | 'block';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink text-white border border-ink hover:opacity-90',
  outline: 'bg-bg-card text-fg border-[1.5px] border-ink hover:bg-bg-faint',
  ghost: 'bg-transparent text-fg-muted border-0 font-semibold hover:text-fg no-underline',
  danger: 'bg-red text-white border border-red hover:opacity-90',
};

const sizeClasses: Record<Size, string> = {
  default: 'px-[18px] py-[11px] text-[15px] rounded-lg',
  sm: 'px-3.5 py-[9px] text-sm rounded-md',
  block: 'w-full px-[18px] py-[14px] text-base rounded-lg',
};

/** Navigation-as-button — RSC-safe (plain `next/link`), used for the mockup's dark/outline CTAs that just move between routes ("Continue Session 2 →", "← Course map"). */
export function LinkButton({
  href,
  variant = 'primary',
  size = 'default',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  const base = variant === 'ghost' ? 'inline-flex items-center gap-1.5 font-semibold no-underline' : 'inline-flex items-center justify-center gap-2 font-semibold no-underline transition-colors';
  return (
    <Link href={href} className={`${base} ${variant === 'ghost' ? '' : sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </Link>
  );
}
