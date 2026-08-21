/**
 * Browser WebRTC test against LiveKit AgentSession (frontdesk_realtime / receptionist).
 */

import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { requiresLiveKitVoiceRuntime } from "@/lib/voice/architecture/livekit-voice-profiles";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "@/lib/telephony/provisioning/config";
import { requireLiveKitEnv } from "@/lib/voice/runtime-provider/config";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import type { TestSessionResult } from "./test-session";

const BROWSER_ROOM_PREFIX =
  process.env.LIVEKIT_BROWSER_TEST_ROOM_PREFIX?.trim() || "transovo-browser-test-";

export async function createLiveKitBrowserTestSession(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  agentTemplate?: string;
}): Promise<TestSessionResult> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) {
    return { ok: false, code: "not_found", error: "Agent not found", status: 404 };
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (!requiresLiveKitVoiceRuntime({ ...config, agentType: agent.agentType })) {
    return {
      ok: false,
      code: "not_livekit",
      error: "Agent is not a LiveKit profile",
      status: 400,
    };
  }

  const sessionId = randomUUID();
  const roomName = `${BROWSER_ROOM_PREFIX}${sessionId}`;
  const participantIdentity = `browser-${input.userId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    fromE164: "browser-tester",
    toE164: agent.phoneNumberId ? undefined : "browser-test",
    livekitRoomName: roomName,
    livekitParticipantId: participantIdentity,
    lightweightBootstrap: true,
  });

  const jobMetadata = {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId,
    publishedVersionId: agent.publishedVersionId || undefined,
    dispatchSource: "job_metadata" as const,
    livekitProfile: "frontdesk_realtime",
    browserTest: true,
    agentTemplate: input.agentTemplate || "livekit_basic_voice",
    runtime: "livekit_python",
  };

  const { AgentDispatchClient, AccessToken } = await import("livekit-server-sdk");
  const { url, apiKey, apiSecret } = requireLiveKitEnv();
  const dispatchClient = new AgentDispatchClient(url, apiKey, apiSecret);

  await dispatchClient.createDispatch(roomName, TRANSOVO_LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify(jobMetadata),
  });

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    ttl: "10m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  return {
    ok: true,
    sessionId,
    agentId: agent.id,
    telnyxAssistantId: "",
    webrtc: {
      target_type: "ai_assistant",
      target_id: "",
    },
    livekit: {
      url,
      token: jwt,
      roomName,
      participantIdentity,
    },
    voice: {
      catalogId: config.voiceLanguage?.voiceId || null,
      displayName: config.identity?.displayName || agent.name,
      providerVoiceId: config.voiceLanguage?.voiceId || "",
    },
    synced: true,
    expiresAt,
    testVariables: {
      telnyx_conversation_channel: "web_call",
      test_caller_name: "Browser Tester",
    },
  };
}
