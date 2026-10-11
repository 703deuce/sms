/**
 * Remove two-way reply CTAs from reminder SMS bodies.
 * Reply instructions are appended at send time on paid plans only — never stored in templates.
 */

export function stripEmbeddedSmsReplyInstructions(body: string): string {
  let text = body.trim();
  const patterns: RegExp[] = [
    /\s*Reply\s+C\s+to\s+confirm,\s*R\s+to\s+reschedule,\s*or\s+X\s+to\s+(?:cancel|request\s+cancellation)\.?\s*/gi,
    /\s*Reply\s+C\s+to\s+confirm\s+or\s+R\s+to\s+request\s+a\s+new\s+time\.?\s*/gi,
    /\s*Reply\s+C\s+to\s+confirm,\s*R\s+to\s+reschedule,\s*or\s+X\s+to\s+cancel\.?\s*/gi,
    /\s*Reply\s+C\s+to\s+confirm\s+or\s+X\s+to\s+cancel\.?\s*/gi,
    /\s*Reply\s+YES\s+to\s+confirm[^.!?]*[.!?]?\s*/gi,
    /\s*Reply\s+C\s+to\s+confirm[^.!?]*[.!?]?\s*/gi,
    /\s*Reply\s+R\s+to\s+reschedule[^.!?]*[.!?]?\s*/gi,
    /\s*Reply\s+X\s+to\s+cancel[^.!?]*[.!?]?\s*/gi,
    /\s*or\s+let\s+us\s+know\s+if\s+you\s+need\s+to\s+reschedule\.?\s*/gi,
  ];
  for (const re of patterns) {
    text = text.replace(re, " ").trim();
  }
  return text.replace(/\s{2,}/g, " ").replace(/\s+([.!?])/g, "$1").trim();
}
