'use client';

/**
 * Exercise-set progress dots (ExercisePlayer header row) — current item ink,
 * correct green, incorrect red, not-yet-answered neutral. Mirrors the mockup's
 * `exDots`.
 *
 * Sets are no longer always module-sized: a checkpoint runs 40 items and the
 * diagnostic 60, which at a fixed 7px + 5px gap overflowed the 640px column and
 * pushed the row off-screen. The strip therefore wraps, and past ~24 items the
 * dots shrink so a long set still reads as a few tidy rows rather than a block.
 * A `12 / 60` counter carries the precise position, which is what the learner
 * actually wants once individual dots get small.
 */
export function ProgressDots({ results, currentIndex }: { results: Array<boolean | null>; currentIndex: number }) {
  const total = results.length;
  const compact = total > 24;
  const size = compact ? 'h-[5px] w-[5px]' : 'h-[7px] w-[7px]';
  const answered = results.filter((r) => r !== null).length;

  return (
    <div className="mb-4">
      <div className={`flex flex-wrap ${compact ? 'gap-[3px]' : 'gap-[5px]'}`}>
        {results.map((r, i) => {
          const color = i === currentIndex && r === null ? 'var(--ink)' : r === true ? 'var(--green)' : r === false ? 'var(--red)' : '#DAD6CB';
          return <span key={i} className={`${size} flex-none rounded-sm`} style={{ background: color }} />;
        })}
      </div>
      {compact && (
        <div className="mt-1.5 text-[12px] font-semibold tabular-nums text-fg-subtle">
          {currentIndex + 1} / {total}
          {answered > 0 && ` · ${answered} answered`}
        </div>
      )}
    </div>
  );
}
