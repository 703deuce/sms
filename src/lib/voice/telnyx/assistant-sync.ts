import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import type { VoiceAgentConfig } from "../types";

type AgentRow = {
  id: string;
  workspaceId: string;
  name: string;
  purpose?: string | null;
  telnyxAssistantId?: string | null;
  telnyxConnectionId?: string | null;
};

export function isTelnyxVoiceConfigured() {
  return Boolean(getTelnyxApiKey() && process.env.TELNYX_CONNECTION_ID?.trim());
}

/** Pull indexed knowledge text so the Telnyx assistant has business context on-call. */
async function buildKnowledgeContext(workspaceId: string, agentId: string): Promise<string> {
  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    // Prefer agent-linked KBs when join rows exist; otherwise use workspace KBs.
    type KbLink = { knowledgeBaseId: string };
    type KbSource = { contentText: string | null; name: string; extractedPreview: string | null };
    const links = (await prisma.voiceAgentKnowledgeBase
      .findMany({ where: { agentId }, select: { knowledgeBaseId: true }, take: 10 })
      .catch(() => [] as KbLink[])) as KbLink[];
    const kbIds = links.map((l: KbLink) => l.knowledgeBaseId);
    const sources = (await prisma.voiceKnowledgeSource.findMany({
      where: {
        workspaceId,
        status: "indexed",
        ...(kbIds.length ? { knowledgeBaseId: { in: kbIds } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { contentText: true, name: true, extractedPreview: true },
    })) as KbSource[];
    const chunks = sources
      .map((s: KbSource) => {
        const body = (s.contentText || s.extractedPreview || "").trim().slice(0, 2500);
        if (!body) return "";
        return `### ${s.name || "Source"}\n${body}`;
      })
      .filter(Boolean);
    if (!chunks.length) return "";
    return [
      "Business knowledge (use this to answer FAQs accurately; do not invent facts):",
      ...chunks,
    ].join("\n\n");
  } catch {
    return "";
  }
}

export async function syncTelnyxAssistant(
  workspaceId: string,
  agent: AgentRow,
  config: VoiceAgentConfig,
) {
  if (!isTelnyxVoiceConfigured()) {
    return { mode: "mock", assistantId: agent.telnyxAssistantId };
  }

  const knowledge = await buildKnowledgeContext(workspaceId, agent.id);
  const instructions =
    [
      config.instructions?.raw ||
        [
          config.instructions?.system,
          config.instructions?.role,
          agent.purpose ? `Purpose: ${agent.purpose}` : "",
          config.instructions?.goals,
          config.instructions?.prohibited?.length
            ? `Never: ${config.instructions.prohibited.join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      knowledge,
      "Never claim an external action succeeded until the application confirms it.",
    ]
      .filter(Boolean)
      .join("\n\n");

  const payload: Record<string, unknown> = {
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
    // Detect AMD; AI assistant is started when the call is answered (webhook).
    body.answering_machine_detection = "detect";
    body.answering_machine_detection_config = {
      total_analysis_time_millis: 3500,
    };
    body.assistant_id = input.assistantId;
  }

  const res = await telnyxRequest<{ data: { call_control_id: string } }>(
    "/calls",
    { method: "POST", body },
  );

  return {
    mode: "telnyx",
    callControlId: res.data?.call_control_id,
    assistantId: input.assistantId || null,
  };
}

/**
 * Attach a published Telnyx AI Assistant to an active Call Control leg.
 * This is the critical runtime step — dial/answer alone does not talk.
 */
export async function startAiAssistantOnCall(input: {
  callControlId: string;
  assistantId: string;
  greeting?: string | null;
  clientState?: Record<string, unknown>;
}) {
  if (!input.callControlId || input.callControlId.startsWith("mock_")) {
    return { mode: "mock" as const };
  }
  if (!isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }

  const body: Record<string, unknown> = {
    assistant: { id: input.assistantId },
  };
  if (input.greeting) body.greeting = input.greeting;
  if (input.clientState) {
    body.client_state = Buffer.from(JSON.stringify(input.clientState)).toString("base64");
  }

  try {
    await telnyxRequest(`/calls/${input.callControlId}/actions/ai_assistant_start`, {
      method: "POST",
      body,
    });
    return { mode: "telnyx" as const };
  } catch (err) {
    // Some Call Control apps expose start_ai_assistant instead.
    try {
      await telnyxRequest(`/calls/${input.callControlId}/actions/start_ai_assistant`, {
        method: "POST",
        body,
      });
      return { mode: "telnyx" as const };
    } catch {
      console.error("[voice] ai_assistant_start failed", err);
      throw err;
    }
  }
}

/** Best-effort: start recording on a voice call leg. */
export async function startCallRecording(callControlId: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }
  await telnyxRequest(`/calls/${callControlId}/actions/record_start`, {
    method: "POST",
    body: { format: "mp3", channels: "dual" },
  }).catch((err) => console.warn("[voice] record_start failed", err));
  return { mode: "telnyx" as const };
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
