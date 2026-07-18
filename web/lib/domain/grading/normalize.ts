/**
 * Text normalization for text_input grading (ARCHITECTURE.md §5), ported
 * verbatim from the mockup's `check()` in docs/design/skyrocket/Skyrocket.dc.html:
 *   const v = ex.input.trim().toLowerCase().replace(/\s+/g, ' ');
 * Applied to both the learner's input and every accepted answer in
 * `answers[]`, so "  Been   IN this job for " matches "been in this job for".
 */
export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
