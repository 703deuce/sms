import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import type { VoiceAgentConfig } from "../types";

type AgentRow = {
  id: string;
  workspaceId: string;
  name: string;
  telnyxAssistantId?: string | null;
  telnyxConnectionId?: string | null;
};

export function isTelnyxVoiceConfigured() {
  return Boolean(getTelnyxApiKey() && process.env.TELNYX_CONNECTION_ID?.trim());
}

export async function syncTelnyxAssistant(
  workspaceId: string,
  agent: AgentRow,
  config: VoiceAgentConfig,
) {
  if (!isTelnyxVoiceConfigured()) {
    return { mode: "mock", assistantId: agent.telnyxAssistantId };
  }

  const instructions =
    config.instructions?.raw ||
    [
      config.instructions?.system,
      config.instructions?.role,
      config.instructions?.goals,
      config.instructions?.prohibited?.length
        ? `Never: ${config.instructions.prohibited.join("; ")}`
        : "",
      "Never claim an external action succeeded until the application confirms it.",
    ]
      .filter(Boolean)
      .join("\n\n");

  const payload = {
    name: `${agent.name} (${workspaceId.slice(0, 8)})`,
    model: config.model?.modelId || "meta-llama/llama-3.3-70b-instruct",
    instructions,
    voice_settings: {
      voice: config.voiceLanguage?.voiceId || "Telnyx.NaturalHD.andromeda",
      speed: config.voiceLanguage?.speed ?? 1,
    },
    language: config.voiceLanguage?.primaryLanguage || "en-US",
    enabled_features: ["telephony"],
    telephony_settings: {
      default_texml_app_id: process.env.TELNYX_CONNECTION_ID?.trim(),
    },
  };

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  if (agent.telnyxAssistantId) {
    await telnyxRequest(`/ai/assistants/${agent.telnyxAssistantId}`, {
      method: "PATCH",
      body: payload,
    });
    return { mode: "telnyx", assistantId: agent.telnyxAssistantId };
  }

  const created = await telnyxRequest<{ data: { id: string } }>("/ai/assistants", {
    method: "POST",
    body: payload,
  });
  const assistantId = created.data?.id;
  if (!assistantId) throw new Error("Telnyx assistant create returned no id");

  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: {
      telnyxAssistantId: assistantId,
      telnyxConnectionId: process.env.TELNYX_CONNECTION_ID?.trim() || null,
    },
  });

  return { mode: "telnyx", assistantId };
}

export async function dialOutboundCall(input: {
  workspaceId: string;
  callId: string;
  fromE164: string;
  toE164: string;
  assistantId?: string | null;
  connectionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isTelnyxVoiceConfigured()) {
    return mockOutboundDial(input);
  }

  const connectionId =
    input.connectionId || process.env.TELNYX_CONNECTION_ID?.trim();
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID required for outbound calls");

  const body: Record<string, unknown> = {
    connection_id: connectionId,
    from: input.fromE164,
    to: input.toE164,
    client_state: Buffer.from(
      JSON.stringify({
        workspaceId: input.workspaceId,
        callId: input.callId,
      }),
    ).toString("base64"),
  };

  if (input.assistantId) {
    body.answering_machine_detection = "detect";
    body.answering_machine_detection_config = {
      total_analysis_time_millis: 3500,
    };
  }

  const res = await telnyxRequest<{ data: { call_control_id: string } }>(
    "/calls",
    { method: "POST", body },
  );

  return {
    mode: "telnyx",
    callControlId: res.data?.call_control_id,
  };
}

async function mockOutboundDial(input: {
  workspaceId: string;
  callId: string;
  fromE164: string;
  toE164: string;
}) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const mockControlId = `mock_${input.callId}`;

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      telnyxCallControlId: mockControlId,
      status: "RINGING",
    },
  });

  // Simulate async lifecycle for tests/workers
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "voice_mock_call_complete",
    queueName: "voice-calls",
    payload: { callId: input.callId, workspaceId: input.workspaceId },
    idempotencyKey: `voice-mock-${input.callId}`,
    runAfter: new Date(Date.now() + 2000),
  });

  return { mode: "mock", callControlId: mockControlId };
}
