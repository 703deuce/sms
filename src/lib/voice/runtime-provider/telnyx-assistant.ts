import type { VoiceRuntimeProvider, InboundSessionMetadata } from "./types";
import { ensureVoiceCallForToolWebhook } from "@/lib/voice/ensure-call-from-event";

export const telnyxAssistantRuntimeProvider: VoiceRuntimeProvider = {
  id: "telnyx",
  label: "Telnyx AI Assistant",

  usesTelnyxAssistantWebhooks() {
    return true;
  },

  async bootstrapSession(metadata: InboundSessionMetadata): Promise<{ callId: string }> {
    const callId = await ensureVoiceCallForToolWebhook({
      workspaceId: metadata.workspaceId,
      agentId: metadata.agentId,
      callControlId: metadata.telnyxCallControlId,
      conversationId: metadata.telnyxConversationId,
      fromE164: metadata.fromE164,
      toE164: metadata.toE164,
    });
    if (!callId) throw new Error("Failed to create VoiceCall for Telnyx session");
    return { callId };
  },

  async endSession(callId: string): Promise<void> {
    const { destroyRealtimeSession } = await import("@/lib/voice/realtime-session/init");
    await destroyRealtimeSession(callId).catch(() => undefined);
  },

  async syncAgentConfig(input: { workspaceId: string; agentId: string }): Promise<void> {
    const { getPrisma } = await import("@/lib/db");
    const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
    const { syncTelnyxAssistant } = await import("@/lib/voice/telnyx/assistant-sync");

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
    });
    if (!agent) return;

    await syncTelnyxAssistant(
      input.workspaceId,
      agent as never,
      parseVoiceAgentConfig(agent.draftConfig),
    );
  },
};
