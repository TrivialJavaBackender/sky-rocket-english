/** UC-05 unit header — block/module kicker, title, standfirst (ARCHITECTURE.md §1.2). Block name/position come from the DTO, never hardcoded (§8 D4). */
export function UnitHeader({ blockPosition, blockName, moduleSlug, title, standfirst }: { blockPosition: number; blockName: string; moduleSlug: string; title: string; standfirst: string | null }) {
  return (
    <div className="mb-5">
      <span className="rounded-md bg-green-soft px-2.5 py-1 text-[11px] font-bold tracking-[.1em] text-green-text">
        BLOCK {blockPosition} · {moduleSlug.toUpperCase()}
      </span>
      <h1 className="text-pretty m-0 mb-1.5 mt-3 text-[36px] leading-[1.05] tracking-[-.015em]">{title}</h1>
      {standfirst && <p className="text-pretty m-0 text-base text-fg-muted">{standfirst}</p>}
    </div>
  );
}
