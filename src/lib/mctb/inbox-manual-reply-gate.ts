/** Shared rules for whether staff may manually compose SMS in MCTB-tagged conversations. */

export const MCTB_PLATFORM_SENDER_MANUAL_REPLY_MESSAGE =
  "Manual replies are locked while Transovo Platform sender is active. Automated recovery and system messages still send. Use your own verified sender to reply from this inbox.";

export function conversationIsMctbProduct(input: {
  productSource?: string | null;
  missedCallEventId?: string | null;
}): boolean {
  if (input.missedCallEventId) return true;
  const src = String(input.productSource ?? "").toLowerCase();
  return src === "mctb";
}
