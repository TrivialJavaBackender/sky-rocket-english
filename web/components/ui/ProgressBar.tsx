/** Thin fill bar used for block progress (Course map header %, Progress screen BLOCKS section). Color comes from the block (§8 D4). */
export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="block h-2 flex-1 overflow-hidden rounded-full bg-bg-faint">
      <span className="block h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}
