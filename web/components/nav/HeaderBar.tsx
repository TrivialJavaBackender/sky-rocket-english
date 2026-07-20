'use client';

import { useState } from 'react';
import { SignOutButton } from '@/components/auth/SignOutButton';

/**
 * Mobile top header (< 980px, "onMain" screens only per the mockup) — course
 * switcher pill + dropdown. `courseLabel`/`courseFullLabel` come from the DB
 * (§8 D4); the "German · A2 → B1 · SOON" row is the sanctioned UC-03
 * placeholder (see SideRail's comment) — there is no second course row to
 * fetch yet.
 */
export function HeaderBar({
  courseLabel,
  courseFullLabel,
  username,
}: {
  courseLabel: string;
  courseFullLabel: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative mb-3.5 flex items-center justify-between desktop:hidden">
      <div className="text-[17px] font-bold tracking-[-.01em]">SkyRocket</div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-3 py-[5px] text-[13px] font-semibold text-fg"
      >
        {courseLabel} <span className="text-[8px] text-fg-faint">▼</span>
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 top-[38px] z-30 min-w-[224px] rounded-xl border border-border bg-bg-card p-1.5 shadow-pop">
          <div className="flex justify-between rounded-lg bg-bg-faint px-3 py-[9px] text-sm font-semibold">
            {courseFullLabel} <span className="text-green">✓</span>
          </div>
          <div className="flex justify-between px-3 py-[9px] text-sm text-fg-faint">
            German · A2 → B1 <span className="self-center text-[10.5px] font-bold tracking-[.08em]">SOON</span>
          </div>
          <div className="my-1.5 border-t border-border-faint" />
          <div className="truncate px-3 py-[6px] text-sm font-semibold">{username}</div>
          <SignOutButton className="w-full rounded-lg px-3 py-[9px] text-sm text-fg-muted hover:bg-bg-faint" />
        </div>
      )}
    </header>
  );
}
