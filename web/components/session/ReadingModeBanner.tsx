import { Kicker } from '@/components/ui/Kicker';

/**
 * UC-07: Prime skims the SAME main long-read that Input later close-reads —
 * without an explicit mode banner the two steps look identical. Skim mode
 * also switches glosses off (ReadingText glossesEnabled={false}).
 */
export function ReadingModeBanner({ mode }: { mode: 'skim' | 'close' }) {
  if (mode === 'skim') {
    return (
      <div className="mb-4 rounded-[10px] bg-bg-faint p-3.5">
        <Kicker className="mb-1">Skim mode · gist only</Kicker>
        <p className="m-0 text-[14px] leading-relaxed text-fg-muted">
          One pass, no dictionary — glosses are off on purpose. Don't stop at unknown words; you only need the big picture. You'll come back for close reading in Session 2.
        </p>
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-[10px] bg-green-soft p-3.5">
      <Kicker tone="green" className="mb-1">
        Close reading · glosses on
      </Kicker>
      <p className="m-0 text-[14px] leading-relaxed text-fg-muted">
        Read slowly this time. Tap the dotted words for glosses, and hunt for the module's target constructions and focus lexemes as you go.
      </p>
    </div>
  );
}
