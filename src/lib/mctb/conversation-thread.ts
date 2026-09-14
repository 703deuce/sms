export type MctbConversationTurn = {
  role: "customer" | "business";
  text: string;
};

/** Ordinary MCTB threads stay under this — full thread sent to semantic LLMs. */
export const MCTB_FULL_THREAD_MESSAGE_CAP = 30;
const TRUNCATE_KEEP_RECENT = 24;
const MAX_ESTIMATED_CHARS = 12_000;

export function estimateContextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function applyConversationTruncationPolicy(thread: MctbConversationTurn[]): {
  conversation: MctbConversationTurn[];
  truncated: boolean;
  message_count: number;
} {
  const cleaned = thread
    .map((t) => ({ role: t.role, text: t.text.trim() }))
    .filter((t) => t.text.length > 0);

  let conv = cleaned;
  let truncated = false;

  const charLen = () => conv.reduce((n, t) => n + t.text.length, 0);

  if (conv.length > MCTB_FULL_THREAD_MESSAGE_CAP) {
    conv = conv.slice(-TRUNCATE_KEEP_RECENT);
    truncated = true;
  }
  while (charLen() > MAX_ESTIMATED_CHARS && conv.length > 8) {
    conv = conv.slice(2);
    truncated = true;
  }

  return { conversation: conv, truncated, message_count: conv.length };
}

export function mergeConversationTurn(
  thread: MctbConversationTurn[],
  turn: MctbConversationTurn,
): MctbConversationTurn[] {
  const last = thread.at(-1);
  if (last && last.role === turn.role && last.text === turn.text) return thread;
  return [...thread, turn];
}
