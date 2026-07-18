'use client';

/** Exercise-set progress dots (ExercisePlayer header row) — current item ink, correct green, incorrect red, not-yet-answered neutral. Mirrors the mockup's `exDots`. */
export function ProgressDots({ results, currentIndex }: { results: Array<boolean | null>; currentIndex: number }) {
  return (
    <div className="mb-4 flex gap-[5px]">
      {results.map((r, i) => {
        const color = i === currentIndex && r === null ? 'var(--ink)' : r === true ? 'var(--green)' : r === false ? 'var(--red)' : '#DAD6CB';
        return <span key={i} className="h-[7px] w-[7px] flex-none rounded-sm" style={{ background: color }} />;
      })}
    </div>
  );
}
