/**
 * GPT-Live `session.thinking.append` / `session.commentary.append` reject payloads
 * over ~500 tokens ("Context append text must not exceed 500 tokens").
 * Keep each single append under a conservative character budget.
 */
export const LIVE_CONTEXT_APPEND_MAX_CHARS = 1_800;

export function capLiveContextAppendText(
  content: string,
  maxChars: number = LIVE_CONTEXT_APPEND_MAX_CHARS,
): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 40)}\n…(truncated for GPT-Live context limit)`;
}
