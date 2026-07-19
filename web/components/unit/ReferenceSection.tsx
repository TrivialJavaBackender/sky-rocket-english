import type { ReactNode } from 'react';

/**
 * UC-05 collapsed reference section on the unit hub — native <details>
 * (RSC-safe, no JS island). The full theory/vocab/texts live here for
 * re-reading after (or outside) the sessions; the guided path itself is the
 * session runner, so everything starts collapsed.
 */
export function ReferenceSection({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <details className="group mb-2.5 rounded-xl border border-border bg-bg-card">
      <summary className="flex cursor-pointer list-none items-baseline gap-2.5 px-5 py-[15px] [&::-webkit-details-marker]:hidden">
        <span className="flex-none text-[13px] text-fg-faint transition-transform group-open:rotate-90">▸</span>
        <span className="text-[15.5px] font-bold">{title}</span>
        {detail && <span className="ml-auto text-right text-[13px] text-fg-muted">{detail}</span>}
      </summary>
      <div className="border-t border-border-faint px-5 pb-[18px] pt-4">{children}</div>
    </details>
  );
}
