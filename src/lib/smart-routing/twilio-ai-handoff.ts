import "server-only";

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { requiresLiveKitVoiceRuntime } from "@/lib/voice/architecture/livekit-voice-profiles";
import { buildExplicitDispatchMetadata } from "@/lib/telephony/provisioning/dispatch-metadata";
import { getLiveKitSipHost } from "@/lib/telephony/provisioning/config";
import { escapeXml } from "./prompt-playback";
import { finalizeSession } from "./flow-runtime";
import { emitSmartRoutingEvent } from "./events";

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

/**
 * Hand off Smart Routing caller to AI receptionist on Twilio (LiveKit SIP path).
 */
export async function buildTwilioAiReceptionistTwiml(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  callerNumber: string;
  calledNumber: string;
  callSid: string;
  agentId: string;
  intentHint?: string;
  menuSelection?: string | null;
}): Promise<string> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      name: true,
      agentType: true,
      telnyxAssistantId: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });

  if (!agent) {
    await finalizeSession(input.sessionId, "routing_error");
    return twiml("<Say>Our assistant is unavailable right now.</Say><Hangup/>");
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const liveKitAgent = requiresLiveKitVoiceRuntime({
    ...config,
    agentType: agent.agentType,
  });

  const { handleInboundCallEvent } = await import("@/lib/voice/inbound");
  const inbound = await handleInboundCallEvent({
    workspaceId: input.workspaceId,
    fromE164: input.callerNumber,
    toE164: input.calledNumber,
    telnyxCallControlId: input.callSid,
    payload: {
      smartRoutingSessionId: input.sessionId,
      agentId: input.agentId,
      intentHint: input.intentHint,
      menuSelection: input.menuSelection,
      forcedAgentId: input.agentId,
    },
  });

  await emitSmartRoutingEvent({
    workspaceId: input.workspaceId,
    type: "AI_HANDOFF_STARTED",
    sessionId: input.sessionId,
    flowId: input.flowId,
    payload: {
      agentId: input.agentId,
      callId: inbound.callId,
      provider: "twilio",
      runtime: liveKitAgent ? "livekit" : "telnyx_assistant",
    },
  });

  if (liveKitAgent) {
    const sipHost = getLiveKitSipHost();
    if (!sipHost) {
      await finalizeSession(input.sessionId, "ai_receptionist_unavailable");
      return twiml("<Say>LiveKit SIP is not configured.</Say><Hangup/>");
    }
    const { livekitProfileFromConfig } = await import("@/lib/voice/frontdesk/agent-config");
    const metadata = buildExplicitDispatchMetadata({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      publishedVersionId: agent.publishedVersionId,
      livekitProfile: livekitProfileFromConfig(config.advanced as Record<string, unknown>),
      fromE164: input.callerNumber,
      toE164: input.calledNumber,
      dispatchSource: "sip_metadata",
    });
    if (inbound.callId) {
      metadata.callId = inbound.callId;
    }

    const sipUri = `sip:${input.calledNumber}@${sipHost};transport=tcp`;
    await prisma.voiceCall.update({
      where: { id: inbound.callId },
      data: {
        metadata: {
          smartRoutingSessionId: input.sessionId,
          twilioCallSid: input.callSid,
          livekitHandoff: true,
          dispatchMetadata: metadata,
        } as object,
      },
    }).catch(() => undefined);

    await finalizeSession(input.sessionId, "ai_receptionist");
    return twiml(`<Dial><Sip>${escapeXml(sipUri)}</Sip></Dial>`);
  }

  await finalizeSession(input.sessionId, "ai_receptionist_unavailable");
  return twiml(
    "<Say>This assistant requires LiveKit voice runtime on Twilio numbers. Update the agent profile or use a Telnyx number.</Say><Hangup/>",
  );
}
