import "server-only";

import { loadNeedsAttentionItems } from "./needs-attention";
import { isVoiceCallsAttentionKind } from "./voice-attention-kinds";

/** Count open Voice Calls attention items — same kinds/status as the Calls attention queue. */
export async function countVoiceCallsNeedingAttention(workspaceId: string): Promise<number> {
  const items = await loadNeedsAttentionItems(workspaceId, { filter: "all" });
  return items.filter(
    (item) =>
      item.status === "needs_attention" && isVoiceCallsAttentionKind(item.primaryKind),
  ).length;
}
