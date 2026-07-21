import Link from 'next/link';
import type { CourseMapBlockDTO, CourseMapCheckpointDTO, CourseMapDTO } from '@/lib/use-cases/course-map';
import { StatusTag } from '@/components/ui/StatusTag';

/** UC-02 course map (ARCHITECTURE.md §1.1, §7). Block color/tint/name/pct come straight from the DTO — never hardcoded (§8 D4). */
export function CourseMap({ map }: { map: CourseMapDTO }) {
  // Optional blocks sit outside the course proper (0008): they are offered, not
  // scheduled, so they count toward neither the module tally nor block numbering.
  const requiredBlocks = map.blocks.filter((b) => !b.optional);
  const totalModules = requiredBlocks.reduce((n, b) => n + b.modules.length, 0);
  const displayNumber = new Map(requiredBlocks.map((b, i) => [b.slug, i + 1]));
  return (
    <div className="animate-fade-up">
      <div className="text-[11px] font-bold tracking-kicker text-fg-subtle">
        {map.courseName.toUpperCase()} · {map.levelLabel}
      </div>
      <h1 className="m-0 mb-1 mt-0.5 text-[30px] tracking-[-.01em]">Course map</h1>
      <p className="m-0 mb-4 text-[15px] text-fg-muted">
        {totalModules} modules in {requiredBlocks.length} blocks. Each block's checkpoint gates the next.
      </p>

      {/* The diagnostic has no gate (pass_mark=null, §1.5), so it is always open. */}
      {map.diagnostic && (
        <Link
          href={`/course/${map.courseSlug}/checkpoint/${map.diagnostic.slug}`}
          className="mb-3.5 flex items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3 text-[14px] text-fg no-underline transition-colors hover:bg-bg-faint"
        >
          <span className="font-semibold">Diagnostic · {map.diagnostic.title}</span>
          <span className="tabular-nums text-fg-muted">
            {map.diagnostic.status === 'passed' && map.diagnostic.bestScore != null ? `done · ${map.diagnostic.bestScore}%` : 'not taken yet'} →
          </span>
        </Link>
      )}

      {map.blocks.map((block) => (
        <BlockSection key={block.slug} block={block} courseSlug={map.courseSlug} number={displayNumber.get(block.slug)} />
      ))}
    </div>
  );
}

function BlockSection({ block, courseSlug, number }: { block: CourseMapBlockDTO; courseSlug: string; number?: number }) {
  return (
    <section className="mb-3.5 overflow-hidden rounded-xl border border-border bg-bg-card">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-[18px] pb-3 pt-3.5">
        <span className="inline-block h-[11px] w-[11px] flex-none rounded-sm" style={{ background: block.color, opacity: block.locked ? 0.35 : 1 }} />
        <span className="text-base font-bold">{number != null ? `Block ${number} · ${block.name}` : block.name}</span>
        {block.optional && (
          <span className="rounded-full bg-bg-faint px-2 py-0.5 text-[11px] font-bold uppercase tracking-kicker text-fg-subtle">Optional</span>
        )}
        <span className="ml-auto text-sm font-semibold tabular-nums text-fg-muted">{block.locked ? '—' : `${block.pct}%`}</span>
        {block.optional && (
          <p className="m-0 w-full text-[13px] text-fg-muted">Revision of the level below — open any time, outside the course hours, gates nothing.</p>
        )}
      </header>
      {block.modules.map((m) => {
        const open = m.status !== 'locked';
        const rowClass = `flex items-center gap-3 border-t border-border-faint px-[18px] py-[11px] ${open ? 'bg-bg-soft' : 'bg-bg-card'}`;
        const content = (
          <>
            <span className={`w-6 flex-none text-sm font-bold tabular-nums ${open ? '' : 'text-fg-faintest'}`} style={open ? { color: block.color } : undefined}>
              {String(m.position).padStart(2, '0')}
            </span>
            <span className="flex-1">
              <span className={`text-[15px] ${open ? 'font-bold' : 'font-semibold'} ${m.status === 'locked' ? 'text-fg-faint' : ''}`}>{m.title}</span>
            </span>
            <StatusTag status={m.status} blockColor={block.color} blockTint={block.tint} />
          </>
        );
        return open ? (
          <Link key={m.slug} href={`/course/${courseSlug}/module/${m.slug}`} className={`${rowClass} no-underline`}>
            {content}
          </Link>
        ) : (
          <div key={m.slug} className={rowClass}>
            {content}
          </div>
        );
      })}
      {block.checkpoint && <CheckpointFooter checkpoint={block.checkpoint} block={block} courseSlug={courseSlug} />}
    </section>
  );
}

function CheckpointFooter({ checkpoint, block, courseSlug }: { checkpoint: CourseMapCheckpointDTO; block: CourseMapBlockDTO; courseSlug: string }) {
  const passed = checkpoint.status === 'passed';
  let detail: string;
  if (passed) detail = `passed · ${checkpoint.bestScore}%`;
  else if (checkpoint.status === 'failed') detail = `failed${checkpoint.bestScore != null ? ` · best ${checkpoint.bestScore}%` : ''} · retake available`;
  else if (checkpoint.status === 'available') detail = `available now${checkpoint.passMark != null ? ` · pass mark ${checkpoint.passMark}%` : ''}`;
  else detail = `locked — complete every module above${checkpoint.passMark != null ? ` · pass mark ${checkpoint.passMark}%` : ''}`;

  // Openable in exactly the states the checkpoint page itself admits: anything
  // but `locked` (which the page would bounce back here anyway).
  const open = checkpoint.status !== 'locked';
  const className = 'flex items-center gap-3 border-t border-border-faint px-[18px] py-3';
  const style = { background: passed ? block.tint : 'var(--bg-faint)', color: passed ? 'var(--fg)' : 'var(--fg-subtle)' };
  const content = (
    <>
      <span className="text-sm font-semibold">{checkpoint.title}</span>
      <span className="ml-auto text-right text-[13px] tabular-nums">
        {detail}
        {open && ' →'}
      </span>
    </>
  );

  return open ? (
    <Link href={`/course/${courseSlug}/checkpoint/${checkpoint.slug}`} className={`${className} no-underline transition-opacity hover:opacity-80`} style={style}>
      {content}
    </Link>
  ) : (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
