import * as ai from "./ai-client";
import type { TelnyxWorkflowReadBack } from "@/lib/voice-v2/workflow-capability";

export async function readTelnyxWorkflowState(assistantId: string): Promise<TelnyxWorkflowReadBack> {
  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const displayNameByToolId = new Map<string, string>();
  for (const t of tools) {
    if (t.id) displayNameByToolId.set(t.id, t.display_name || "");
  }

  const remote = await ai.getAssistant(assistantId);
  const data = ((remote as { data?: Record<string, unknown> }).data ||
    remote) as Record<string, unknown>;
  const tool_ids = Array.isArray(data.tool_ids) ? (data.tool_ids as string[]) : [];
  const flow = data.conversation_flow as { nodes?: Array<Record<string, unknown>> } | undefined;
  const liveBookingNode = flow?.nodes?.find((n) => n.id === "n_live_booking") || null;

  return {
    tool_ids,
    liveBookingNode: liveBookingNode
      ? {
          id: String(liveBookingNode.id || ""),
          shared_tool_ids: Array.isArray(liveBookingNode.shared_tool_ids)
            ? (liveBookingNode.shared_tool_ids as string[])
            : [],
          instructions: String(liveBookingNode.instructions || ""),
        }
      : null,
    displayNameByToolId,
  };
}
