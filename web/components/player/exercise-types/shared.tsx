'use client';

/** Pieces reused across the 3 `choice` exercise types (mc_cloze, grammar_drill, reading_comprehension) — ARCHITECTURE.md §5. */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * A–D option list. `correctAnswer` is the *text* of the right option (that's
 * all `gradeAttempt` returns for choice types, §5) — matched back to an
 * index by string equality to render the green highlight post-check, since
 * `content.answer`'s numeric index never reaches the client.
 */
export function OptionList({
  options,
  selected,
  disabled,
  correctAnswer,
  onPick,
}: {
  options: string[];
  selected: number | null;
  disabled: boolean;
  correctAnswer: string | null;
  onPick: (i: number) => void;
}) {
  const correctIndex = correctAnswer != null ? options.indexOf(correctAnswer) : -1;
  return (
    <div className="mt-3.5 flex flex-col gap-[9px]">
      {options.map((label, i) => {
        let cls = 'border-border bg-bg-card text-fg';
        if (disabled) {
          if (i === correctIndex) cls = 'border-green bg-green-soft text-green-text';
          else if (i === selected) cls = 'border-red bg-red-soft text-red-text';
          else cls = 'border-border bg-bg-card text-fg-faint';
        }
        return (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onPick(i)}
            className={`flex w-full items-baseline gap-3 rounded-lg border-[1.5px] px-3.5 py-3 text-left text-[15.5px] leading-snug disabled:cursor-default ${cls}`}
          >
            <span className="min-w-[14px] text-[13px] font-bold opacity-55">{LETTERS[i]}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The `{{ exPrompt }}` chip — a capitalized cue word shown above the gapped sentence (grammar_drill/word_formation). */
export function PromptChip({ children }: { children: string }) {
  return <span className="inline-block rounded-md bg-bg-faint px-2.5 py-[3px] text-[13px] font-bold tracking-[.08em]">{children}</span>;
}

/** The gapped-sentence line shared by mc_cloze/grammar_drill (gap = placeholder word, revealed on check) and open_cloze/word_formation (gap = text input). */
export function GapLine({ pre, post, children }: { pre: string; post: string; children: React.ReactNode }) {
  return (
    <div className="text-[19px] leading-[1.9]">
      <span>{pre}</span>
      {children}
      <span>{post}</span>
    </div>
  );
}

/**
 * The inline gap in mc_cloze/grammar_drill's stem. Before checking it shows
 * the learner's current pick (grey, so nothing reads as a verdict yet);
 * after checking it always reveals the *correct* option in green — the
 * pass/fail verdict on the learner's own pick lives in the option list
 * below, not in the gap (mirrors the mockup's `gapText`/`gapStyle`, which
 * always renders `options[answer]` once checked).
 */
export function GapPlaceholder({ pendingText, revealedCorrectText }: { pendingText: string | null; revealedCorrectText: string | null }) {
  if (revealedCorrectText != null) {
    return <span className="border-b-2 border-green px-0.5 font-semibold text-green">{revealedCorrectText}</span>;
  }
  if (pendingText != null) {
    return <span className="tracking-[.08em] text-fg-faintest">{pendingText}</span>;
  }
  return <span className="tracking-[.08em] text-fg-faintest">________</span>;
}

export function TextGapInput({
  value,
  onChange,
  onEnter,
  disabled,
  isCorrect,
  wide,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  disabled: boolean;
  isCorrect: boolean | null;
  wide?: boolean;
}) {
  const borderColor = disabled ? (isCorrect ? 'border-green text-green' : 'border-red text-red') : 'border-fg-faintest text-fg';
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter();
      }}
      readOnly={disabled}
      autoFocus
      className={`border-0 border-b-2 bg-transparent px-0.5 text-center font-semibold outline-none ${wide ? 'w-[220px]' : 'w-[160px]'} ${borderColor}`}
    />
  );
}
