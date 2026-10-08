export type ArLunaConversationMessage = { role: "user" | "assistant"; content: string };

/** Ensures the current inbound SMS appears exactly once at the end of the thread. */
export function appendCurrentInboundIfNeeded(
  messages: ArLunaConversationMessage[],
  persistedRows: Array<{ providerMessageId: string | null }>,
  currentMessage: string,
  currentProviderMessageId?: string,
): ArLunaConversationMessage[] {
  const current = (currentMessage || "").trim();
  if (!current) return messages;
  const pid = currentProviderMessageId?.trim();
  const last = messages[messages.length - 1];
  const alreadyInHistory =
    (pid && persistedRows.some((r) => r.providerMessageId === pid)) ||
    (last?.role === "user" && last.content === current);
  if (alreadyInHistory) return messages;
  return [...messages, { role: "user", content: current }];
}
