import type { ReactNode } from 'react';

/**
 * Minimal renderer for `prompt_md`/`model_answer_md` (ARCHITECTURE.md §1.2
 * UC-10/12) — no markdown dependency is in the project, so this handles just
 * the constructs the content packages actually use rather than pulling in a
 * full markdown library for two fields.
 *
 * Supports: `## headings`, `·`/`-`/`*` bullet lists, `1.` ordered lists,
 * `> blockquotes`, `**bold**`, and paragraphs.
 *
 * Soft wrapping is the important part. Every prompt in `content/` is hard
 * wrapped at ~78 columns to stay readable in the YAML source, and the previous
 * renderer turned each of those newlines into a `<br>`. On a phone that broke
 * every paragraph at the author's column width instead of the viewport's,
 * producing the ragged wall of text the prompts were reported as. Consecutive
 * plain lines are therefore joined with a space (standard markdown behaviour)
 * and only real structure — blank lines, list items, headings — breaks a line.
 */

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string };

const BULLET = /^\s*[·•*-]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const QUOTE = /^\s*>\s?/;

/**
 * A single blank-line-delimited chunk can still mix a lead-in sentence with a
 * bullet list ("Cover, in any order:" followed by `·` lines), so structure is
 * detected per line and only consecutive lines of the same kind are merged.
 */
function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of md.trim().split(/\n\s*\n/)) {
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      const last = blocks[blocks.length - 1];

      if (HEADING.test(line)) {
        blocks.push({ kind: 'h', text: line.replace(HEADING, '') });
      } else if (QUOTE.test(line)) {
        const text = line.replace(QUOTE, '');
        if (last?.kind === 'quote') last.lines.push(text);
        else blocks.push({ kind: 'quote', lines: [text] });
      } else if (BULLET.test(line)) {
        const text = line.replace(BULLET, '');
        if (last?.kind === 'ul') last.items.push(text);
        else blocks.push({ kind: 'ul', items: [text] });
      } else if (ORDERED.test(line)) {
        const text = line.replace(ORDERED, '');
        if (last?.kind === 'ol') last.items.push(text);
        else blocks.push({ kind: 'ol', items: [text] });
      } else if (last?.kind === 'p') {
        // continuation of a hard-wrapped paragraph — join, don't break
        last.lines.push(line.trim());
      } else {
        blocks.push({ kind: 'p', lines: [line.trim()] });
      }
    }
    // a blank line always ends whatever was open
    blocks.push({ kind: 'p', lines: [] });
  }
  return blocks.filter((b) => !(b.kind === 'p' && b.lines.length === 0));
}

export function PromptText({ md, className = '' }: { md: string; className?: string }) {
  const blocks = parse(md);
  return (
    <div className={`text-pretty space-y-3 text-[15.5px] leading-relaxed text-fg ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return (
              <h3 key={i} className="m-0 mt-4 text-[13px] font-bold uppercase tracking-kicker text-fg-subtle first:mt-0">
                {renderInline(b.text)}
              </h3>
            );
          case 'quote':
            return (
              <blockquote key={i} className="m-0 rounded-md border-l-[3px] border-border-faint bg-bg-soft px-3.5 py-2.5 italic text-fg-muted">
                {b.lines.map((l, li) => (
                  <div key={li}>{renderInline(l)}</div>
                ))}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={i} className="m-0 list-disc space-y-1 pl-5 marker:text-fg-faint">
                {b.items.map((it, ii) => (
                  <li key={ii}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="m-0 list-decimal space-y-1 pl-5 marker:text-fg-faint marker:font-semibold">
                {b.items.map((it, ii) => (
                  <li key={ii}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          default:
            return <p key={i} className="m-0">{renderInline(b.lines.join(' '))}</p>;
        }
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
