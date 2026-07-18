import type { ReactNode } from 'react';

/**
 * Minimal renderer for `prompt_md`/`model_answer_md` (ARCHITECTURE.md §1.2
 * UC-10/12) — no markdown dependency is in the project, so this handles
 * just the handful of constructs the content package actually uses
 * (paragraphs, `> blockquote` lines, `**bold**`) rather than pulling in a
 * full markdown library for two fields.
 */
export function PromptText({ md, className = '' }: { md: string; className?: string }) {
  const blocks = md.trim().split(/\n\s*\n/);
  return (
    <div className={`text-pretty space-y-3 text-[15.5px] leading-relaxed text-fg ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('>'))) {
          return (
            <blockquote key={i} className="rounded-md border-l-[3px] border-border-faint bg-bg-soft px-3.5 py-2.5 italic text-fg-muted">
              {lines.map((l, li) => (
                <div key={li}>{renderInline(l.replace(/^>\s?/, ''))}</div>
              ))}
            </blockquote>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
