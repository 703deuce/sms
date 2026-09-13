/**
 * Shared call bootstrap for Telnyx tool webhooks (narrow + unified routes).
 */
import { ensureVoiceCallForToolWebhook } from "@/lib/voice/ensure-call-from-event";

export async function ensureToolWebhookCallContext(input: {
  workspaceId: string;
  agentId: string;
  conversationId?: string;
  callControlId?: string;
  inboundAni?: string;
  toE164FromBody?: string;
  /** Conversation-workflow SMS tools must respond before Telnyx timeout — skip heavy realtime init. */
  skipRealtimeSessionInit?: boolean;
}): Promise<string | undefined> {
  let calledE164 = input.toE164FromBody?.trim() || "";
  if (!calledE164 && input.workspaceId) {
    try {
      const { loadMctbLineInboundConfig } = await import(
        "@/lib/mctb/inbound-handling/line-config"
      );
      const line = await loadMctbLineInboundConfig({ workspaceId: input.workspaceId });
      if (line?.ingressE164) calledE164 = line.ingressE164;
    } catch {
      // optional
    }
  }

  if (!input.conversationId && !input.callControlId) return undefined;

  const id = await ensureVoiceCallForToolWebhook({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    conversationId: input.conversationId || null,
    callControlId: input.callControlId || null,
    fromE164: input.inboundAni || null,
    toE164: calledE164 || null,
    skipRealtimeSessionInit: input.skipRealtimeSessionInit,
  }).catch(() => null);

  return id || undefined;
}
