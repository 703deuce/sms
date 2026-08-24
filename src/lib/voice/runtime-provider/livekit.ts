import { getPrisma } from "@/lib/db";
import { mediaBackendMetadataStamp } from "@/lib/voice/media-backend/pinning";
import { resolveMediaBackend } from "@/lib/voice/media-backend/resolver";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { VoiceRuntimeProvider, InboundSessionMetadata } from "./types";
import { realEstateCallConfigStamp } from "@/lib/voice/real-estate/publish";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export const liveKitRuntimeProvider: VoiceRuntimeProvider = {
  id: "livekit",
  label: "LiveKit Agents",

  usesTelnyxAssistantWebhooks() {
    return false;
  },

  async bootstrapSession(metadata: InboundSessionMetadata): Promise<{ callId: string }> {
    const prisma = getPrisma();
    const mediaBackend =
      metadata.mediaBackend ||
      (await resolveMediaBackend({
        callId: metadata.callId,
        toE164: metadata.toE164,
      }));
    let callId = metadata.callId;

    if (!callId) {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: metadata.agentId, workspaceId: metadata.workspaceId },
        select: {
          id: true,
          phoneNumberId: true,
          publishedVersionId: true,
          draftConfig: true,
        },
      });
      if (!agent) throw new Error("Agent not found");

      const runtimeCfg = agent.publishedVersionId
        ? await (async () => {
            const ver = await prisma.voiceAgentVersion.findFirst({
              where: { id: agent.publishedVersionId!, workspaceId: metadata.workspaceId },
              select: { config: true },
            });
            return parseVoiceAgentConfig(ver?.config || agent.draftConfig);
          })()
        : parseVoiceAgentConfig(agent.draftConfig);
      const configStamp = realEstateCallConfigStamp(runtimeCfg);

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
            ...mediaBackendMetadataStamp(mediaBackend),
            livekitRoomName: metadata.livekitRoomName,
            livekitParticipantId: metadata.livekitParticipantId,
            realtorAgentConfig: configStamp,
          } as object,
        },
      });
      callId = created.id;
    }

    if (!callId) {
      throw new Error("Failed to resolve call ID for LiveKit session");
    }

    if (metadata.livekitRoomName || metadata.livekitParticipantId) {
      const existing = await prisma.voiceCall.findUnique({
        where: { id: callId },
        select: { metadata: true },
      });
      const prior =
        existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      await prisma.voiceCall
        .update({
          where: { id: callId },
          data: {
            metadata: {
              ...prior,
              source: prior.source || "livekit_voice_runtime",
              ...mediaBackendMetadataStamp(mediaBackend),
              ...(metadata.livekitRoomName ? { livekitRoomName: metadata.livekitRoomName } : {}),
              ...(metadata.livekitParticipantId
                ? { livekitParticipantId: metadata.livekitParticipantId }
                : {}),
            } as object,
          },
        })
        .catch(() => undefined);
    }

    if (metadata.lightweightBootstrap) {
      const fromE164 = metadata.fromE164?.trim();
      if (fromE164 && fromE164 !== "unknown") {
        await prisma.voiceCall
          .update({
            where: { id: callId },
            data: { fromE164: normalizeE164(fromE164) },
          })
          .catch(() => undefined);
      }
      return { callId };
    }

    const { requiresLiveKitVoiceRuntime } = await import(
      "@/lib/voice/architecture/livekit-voice-profiles"
    );
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: metadata.agentId, workspaceId: metadata.workspaceId },
      select: { agentType: true, draftConfig: true },
    });
    if (
      agent &&
      requiresLiveKitVoiceRuntime({
        ...parseVoiceAgentConfig(agent.draftConfig),
        agentType: agent.agentType,
      })
    ) {
      throw new Error(
        "Full Amy bootstrap is not supported for LiveKit-only agents — use lightweightBootstrap",
      );
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
