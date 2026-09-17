import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { shouldUseOpenAiRealtimeMediaBridge } from "./flags";
import { startTelnyxBidirectionalMediaStream } from "./telnyx-streaming";
import { ensureTelnyxRealtimeBridgeServer } from "./ws-server";
import { getOpenAiApiKey } from "./config";
import { initializeRealtimeSessionForCall } from "@/lib/voice/realtime-session/init";

/**
 * Start PSTN media bridge (Telnyx streaming ↔ OpenAI Realtime). Does not start Telnyx AI Assistant.
 */
export async function startOpenAiRealtimeMediaBridgeOnCall(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  fromE164?: string | null;
}): Promise<{ started: boolean; reason?: string; streamUrl?: string }> {
  const cfg = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  if (!shouldUseOpenAiRealtimeMediaBridge(cfg)) {
    return { started: false, reason: "bridge_not_enabled" };
  }
  if (!getOpenAiApiKey()) {
    return { started: false, reason: "openai_api_key_missing" };
  }

  await ensureTelnyxRealtimeBridgeServer();

  await initializeRealtimeSessionForCall({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    telnyxControlId: input.telnyxCallControlId,
    telnyxConversationId: input.telnyxCallControlId,
    fromE164: input.fromE164,
  });

  const { streamUrl } = await startTelnyxBidirectionalMediaStream({
    callControlId: input.telnyxCallControlId,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...prevMeta,
          aiStarted: true,
          voiceTransport: "openai_realtime_media_bridge",
          realtimeBridgeStreamUrl: streamUrl,
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.realtime_bridge_started",
        payload: { streamUrl } as object,
      },
    })
    .catch(() => undefined);

  return { started: true, streamUrl };
}
