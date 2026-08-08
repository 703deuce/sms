import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { VoiceRuntimeProvider, InboundSessionMetadata } from "./types";

export const liveKitRuntimeProvider: VoiceRuntimeProvider = {
  id: "livekit",
  label: "LiveKit Agents",

  usesTelnyxAssistantWebhooks() {
    return false;
  },

  async bootstrapSession(metadata: InboundSessionMetadata): Promise<{ callId: string }> {
    const prisma = getPrisma();
    let callId = metadata.callId;

    if (!callId) {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: metadata.agentId, workspaceId: metadata.workspaceId },
        select: {
          id: true,
          phoneNumberId: true,
          publishedVersionId: true,
        },
      });
      if (!agent) throw new Error("Agent not found");

      let toE164 = metadata.toE164 || "";
      if (!toE164 && agent.phoneNumberId) {
        const pn = await prisma.phoneNumber.findFirst({
          where: { id: agent.phoneNumberId },
          select: { e164: true },
        });
        toE164 = pn?.e164 || "";
      }

      const fromE164 = metadata.fromE164
        ? normalizeE164(metadata.fromE164)
        : metadata.fromE164 || "unknown";

      const created = await prisma.voiceCall.create({
        data: {
          workspaceId: metadata.workspaceId,
          agentId: agent.id,
          agentVersionId: agent.publishedVersionId,
          phoneNumberId: agent.phoneNumberId,
          direction: "INBOUND",
          status: "IN_PROGRESS",
          fromE164,
          toE164: toE164 || "unknown",
          telnyxConversationId: metadata.telnyxConversationId,
          telnyxCallControlId: metadata.telnyxCallControlId,
          startedAt: new Date(),
          answeredAt: new Date(),
          metadata: {
            source: "livekit_voice_runtime",
            livekitRoomName: metadata.livekitRoomName,
            livekitParticipantId: metadata.livekitParticipantId,
          } as object,
        },
      });
      callId = created.id;
    }

    if (!callId) {
      throw new Error("Failed to resolve call ID for LiveKit session");
    }

    const { initializeRealtimeSessionForCall } = await import(
      "@/lib/voice/realtime-session/init"
    );
    await initializeRealtimeSessionForCall({
      callId,
      workspaceId: metadata.workspaceId,
      agentId: metadata.agentId,
      telnyxConversationId: metadata.telnyxConversationId,
      telnyxControlId: metadata.telnyxCallControlId,
      fromE164: metadata.fromE164,
    });

    const { bootstrapLiveKitCallContext } = await import(
      "@/lib/voice/domain-actions/session-bootstrap"
    );
    await bootstrapLiveKitCallContext({
      callId,
      workspaceId: metadata.workspaceId,
      agentId: metadata.agentId,
      fromE164: metadata.fromE164,
      toE164: metadata.toE164,
    });

    return { callId };
  },

  async endSession(callId: string): Promise<void> {
    const { finalizeLiveKitCall } = await import("@/lib/voice/domain-actions/session-bootstrap");
    await finalizeLiveKitCall(callId);
    const { destroyRealtimeSession } = await import("@/lib/voice/realtime-session/init");
    await destroyRealtimeSession(callId).catch(() => undefined);
  },

  async syncAgentConfig(_input: { workspaceId: string; agentId: string }): Promise<void> {
    // LiveKit agent reads config at session start from DB — no Telnyx publish.
  },
};
