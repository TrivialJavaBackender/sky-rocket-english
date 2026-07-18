'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'danger' | 'danger-outline' | 'ghost' | 'success-outline';
type Size = 'default' | 'sm' | 'block';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink text-white border border-ink hover:opacity-90',
  outline: 'bg-bg-card text-fg border-[1.5px] border-ink hover:bg-bg-faint',
  danger: 'bg-red text-white border border-red hover:opacity-90',
  'danger-outline': 'bg-bg-card text-fg border-[1.5px] border-ink hover:bg-red-soft',
  'success-outline': 'bg-bg-card text-green-text border-[1.5px] border-green-text hover:bg-green-soft',
  ghost: 'bg-transparent text-fg-muted border-0 font-semibold hover:text-fg',
};

const sizeClasses: Record<Size, string> = {
  default: 'px-[18px] py-[11px] text-[15px] rounded-lg',
  sm: 'px-3.5 py-[9px] text-sm rounded-md',
  block: 'w-full px-[18px] py-[14px] text-base rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base = variant === 'ghost' ? 'inline-flex items-center gap-1.5 font-semibold' : 'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <button className={`${base} ${variant === 'ghost' ? '' : sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
