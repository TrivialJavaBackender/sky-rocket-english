import Link from 'next/link';
import type { CourseMapBlockDTO, CourseMapCheckpointDTO, CourseMapDTO } from '@/lib/use-cases/course-map';
import { StatusTag } from '@/components/ui/StatusTag';

/** UC-02 course map (ARCHITECTURE.md §1.1, §7). Block color/tint/name/pct come straight from the DTO — never hardcoded (§8 D4). */
export function CourseMap({ map }: { map: CourseMapDTO }) {
  const totalModules = map.blocks.reduce((n, b) => n + b.modules.length, 0);
  return (
    <div className="animate-fade-up">
      <div className="text-[11px] font-bold tracking-kicker text-fg-subtle">
        {map.courseName.toUpperCase()} · {map.levelLabel}
      </div>
      <h1 className="m-0 mb-1 mt-0.5 text-[30px] tracking-[-.01em]">Course map</h1>
      <p className="m-0 mb-4 text-[15px] text-fg-muted">
        {totalModules} modules in {map.blocks.length} blocks. Each block's checkpoint gates the next.
      </p>

      {map.diagnostic && (
        <div className="mb-3.5 flex items-center justify-between rounded-xl border border-border bg-bg-card px-4 py-3 text-[14px]">
          <span className="font-semibold">Diagnostic · {map.diagnostic.title}</span>
          <span className="tabular-nums text-fg-muted">{map.diagnostic.status === 'passed' && map.diagnostic.bestScore != null ? `done · ${map.diagnostic.bestScore}%` : 'not taken yet'}</span>
        </div>
      )}

      {map.blocks.map((block) => (
        <BlockSection key={block.slug} block={block} />
      ))}
    </div>
  );
}

function BlockSection({ block }: { block: CourseMapBlockDTO }) {
  return (
    <section className="mb-3.5 overflow-hidden rounded-xl border border-border bg-bg-card">
      <header className="flex items-center gap-2.5 px-[18px] pb-3 pt-3.5">
        <span className="inline-block h-[11px] w-[11px] flex-none rounded-sm" style={{ background: block.color, opacity: block.locked ? 0.35 : 1 }} />
        <span className="text-base font-bold">
          Block {block.position} · {block.name}
        </span>
        <span className="ml-auto text-sm font-semibold tabular-nums text-fg-muted">{block.locked ? '—' : `${block.pct}%`}</span>
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
          <Link key={m.slug} href={`/course/en-c1/module/${m.slug}`} className={`${rowClass} no-underline`}>
            {content}
          </Link>
        ) : (
          <div key={m.slug} className={rowClass}>
            {content}
          </div>
        );
      })}
      {block.checkpoint && <CheckpointFooter checkpoint={block.checkpoint} block={block} />}
    </section>
  );
}

function CheckpointFooter({ checkpoint, block }: { checkpoint: CourseMapCheckpointDTO; block: CourseMapBlockDTO }) {
  const passed = checkpoint.status === 'passed';
  let detail: string;
  if (passed) detail = `passed · ${checkpoint.bestScore}%`;
  else if (checkpoint.status === 'failed') detail = `failed${checkpoint.bestScore != null ? ` · best ${checkpoint.bestScore}%` : ''} · retake available`;
  else if (checkpoint.status === 'available') detail = `available now${checkpoint.passMark != null ? ` · pass mark ${checkpoint.passMark}%` : ''}`;
  else detail = `locked — complete every module above${checkpoint.passMark != null ? ` · pass mark ${checkpoint.passMark}%` : ''}`;

  return (
    <div className="flex items-center gap-3 border-t border-border-faint px-[18px] py-3" style={{ background: passed ? block.tint : 'var(--bg-faint)', color: passed ? 'var(--fg)' : 'var(--fg-subtle)' }}>
      <span className="text-sm font-semibold">{checkpoint.title}</span>
      <span className="ml-auto text-right text-[13px] tabular-nums">{detail}</span>
    </div>
  );
}
