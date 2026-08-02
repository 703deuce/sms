import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import type { VoiceAgentConfig } from "../types";
import { getAgentRagBucketIds } from "../knowledge-processor";
import { buildAssistantTools } from "./assistant-tools";

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

/** Short FAQ digest only — long docs use Telnyx RAG retrieval tool. */
async function buildShortKnowledgeDigest(workspaceId: string, agentId: string): Promise<string> {
  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
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
        sourceType: { in: ["text", "faq"] },
        ...(kbIds.length ? { knowledgeBaseId: { in: kbIds } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { contentText: true, name: true, extractedPreview: true },
    })) as KbSource[];
    const chunks = sources
      .map((s: KbSource) => {
        const body = (s.contentText || s.extractedPreview || "").trim().slice(0, 600);
        if (!body) return "";
        return `### ${s.name || "FAQ"}\n${body}`;
      })
      .filter(Boolean);
    if (!chunks.length) return "";
    return [
      "Quick FAQ digest (for longer documents, use the retrieval knowledge tool — do not invent facts):",
      ...chunks,
    ].join("\n\n");
  } catch {
    return "";
  }
}

async function loadAgentTools(workspaceId: string, agentId: string, config: VoiceAgentConfig) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const links = await prisma.voiceAgentTool.findMany({
    where: { agentId, workspaceId },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          description: true,
          toolType: true,
          config: true,
          inputSchema: true,
          status: true,
        },
      },
    },
  });
  let tools = links
    .map((l: (typeof links)[number]) => l.tool)
    .filter((t: (typeof links)[number]["tool"]) => t && t.status === "active");

  if (!tools.length && config.toolIds?.length) {
    tools = await prisma.voiceTool.findMany({
      where: { workspaceId, id: { in: config.toolIds }, status: "active" },
      select: {
        id: true,
        name: true,
        description: true,
        toolType: true,
        config: true,
        inputSchema: true,
        status: true,
      },
    });
  }

  if (!tools.length) {
    // Attach all active workspace tools (bounded) so publish is useful out of the box.
    tools = await prisma.voiceTool.findMany({
      where: { workspaceId, status: "active" },
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        toolType: true,
        config: true,
        inputSchema: true,
        status: true,
      },
    });
  }

  return tools;
}

function greetingFromConfig(config: VoiceAgentConfig, agentName: string) {
  const greeting =
    (config.callHandling?.greeting as string | undefined) ||
    (config.conversationFlow?.sections?.find((s) => s.type === "greeting")?.config
      ?.text as string | undefined);
  return greeting || `Thank you for calling. This is ${agentName}. How can I help you today?`;
}

export async function syncTelnyxAssistant(
  workspaceId: string,
  agent: AgentRow,
  config: VoiceAgentConfig,
) {
  if (!isTelnyxVoiceConfigured()) {
    return { mode: "mock", assistantId: agent.telnyxAssistantId };
  }

  const digest = await buildShortKnowledgeDigest(workspaceId, agent.id);
  const bucketIds = await getAgentRagBucketIds(workspaceId, agent.id);
  const agentTools = await loadAgentTools(workspaceId, agent.id, config);

  const transferCfg = (config.transfers || {}) as {
    targets?: Array<{ name: string; to: string }>;
    handoffAssistants?: Array<{ name: string; id: string }>;
    warmTransferInstructions?: string;
    fallbackDestinations?: Array<{ to: string } | string>;
    timeoutSeconds?: number;
  };

  // Prefer named destinations from VoiceTransferDestination (platform UI).
  let transferTargets = transferCfg.targets;
  try {
    const { getPrisma } = await import("@/lib/db");
    const dests = await getPrisma().voiceTransferDestination.findMany({
      where: { workspaceId, agentId: agent.id, enabled: true },
      take: 20,
    });
    if (dests.length) {
      transferTargets = dests.map((d: { name: string; destination: string }) => ({
        name: d.name,
        to: d.destination,
      }));
    }
  } catch {
    // keep config.targets
  }

  const tools = buildAssistantTools({
    workspaceId,
    agentId: agent.id,
    bucketIds,
    tools: agentTools,
    transferTargets,
    handoffAssistants: transferCfg.handoffAssistants,
    warmTransferInstructions: transferCfg.warmTransferInstructions,
  });

  const personality = [
    config.instructions?.tone ? `Tone: ${config.instructions.tone}.` : "",
    config.instructions?.style ? `Style: ${config.instructions.style}.` : "",
    config.instructions?.responseLength
      ? `Response length: ${config.instructions.responseLength}.`
      : "",
    config.voiceLanguage?.interruptionHandling
      ? `Interruption handling: ${config.voiceLanguage.interruptionHandling}.`
      : "",
    config.instructions?.pronunciation
      ? `Pronunciation notes: ${config.instructions.pronunciation}.`
      : "",
    config.voiceLanguage?.pronunciationDictionary
      ? `Pronunciation dictionary: ${JSON.stringify(config.voiceLanguage.pronunciationDictionary)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const instructions = [
    config.instructions?.raw ||
      [
        config.instructions?.system,
        config.instructions?.role,
        agent.purpose ? `Purpose: ${agent.purpose}` : "",
        config.instructions?.goals,
        personality,
        config.instructions?.prohibited?.length
          ? `Never: ${config.instructions.prohibited.join("; ")}`
          : "",
        config.instructions?.escalation
          ? `Escalation: ${config.instructions.escalation}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    digest,
    bucketIds.length
      ? "You have a knowledge retrieval tool backed by the business document store. Use it for FAQs, policies, pricing, and detailed questions instead of guessing."
      : "",
    "Never claim an external action succeeded until the application tool confirms it.",
    "Never tell a caller an appointment is booked until book_appointment returns success with ok=true.",
    "If book_appointment fails or returns an error, explain the issue and offer alternatives.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelSettings: Record<string, unknown> = {
    model: config.model?.modelId || "meta-llama/llama-3.3-70b-instruct",
    temperature: config.model?.temperature,
    max_tokens: config.model?.maxTokens,
  };
  if (config.model?.customBaseUrl) {
    modelSettings.api_base = config.model.customBaseUrl;
    // Credentials stay server-side via secret ref — never sent from browser.
    if (config.model.customApiKeyRef) {
      try {
        const { decryptSecret } = await import("@/lib/messaging/crypto");
        const secret = await (await import("@/lib/db")).getPrisma().voiceIntegrationSecret.findFirst({
          where: { id: config.model.customApiKeyRef, workspaceId },
        });
        if (secret) modelSettings.api_key = decryptSecret(secret.encryptedValue);
      } catch {
        // omit key if unavailable
      }
    }
  }

  const transcription = config.transcription || {};
  const payload: Record<string, unknown> = {
    name: `${agent.name} (${workspaceId.slice(0, 8)})`,
    model: modelSettings.model,
    instructions,
    greeting: greetingFromConfig(config, agent.name),
    voice_settings: {
      voice: config.voiceLanguage?.voiceId || "Telnyx.NaturalHD.andromeda",
      speed: config.voiceLanguage?.speed ?? 1,
      ...(config.voiceLanguage?.bargeIn != null
        ? { barge_in: config.voiceLanguage.bargeIn }
        : {}),
    },
    language: config.voiceLanguage?.primaryLanguage || "en-US",
    enabled_features: [
      "telephony",
      ...(transcription.enabled !== false ? ["transcription"] : []),
    ],
    telephony_settings: {
      default_texml_app_id: process.env.TELNYX_CONNECTION_ID?.trim(),
    },
    tools,
  };
  if (config.model?.temperature != null) payload.temperature = config.model.temperature;
  if (config.model?.maxTokens != null) payload.max_tokens = config.model.maxTokens;
  if (config.model?.maxToolCalls != null) payload.max_tool_calls = config.model.maxToolCalls;
  if (config.model?.customBaseUrl) {
    payload.llm_api = {
      base_url: config.model.customBaseUrl,
      ...(modelSettings.api_key ? { api_key: modelSettings.api_key } : {}),
    };
  }
  if (transcription.sttProvider || transcription.sttModel || transcription.keyterms?.length) {
    payload.transcription = {
      enabled: transcription.enabled !== false,
      provider: transcription.sttProvider,
      model: transcription.sttModel,
      language: transcription.language || config.voiceLanguage?.primaryLanguage,
      keyterms: transcription.keyterms || [],
    };
  }
  if (config.voiceLanguage?.endpointingMs) {
    payload.endpointing_ms = config.voiceLanguage.endpointingMs;
  }
  if (config.voiceLanguage?.noiseSuppression != null) {
    payload.noise_suppression = config.voiceLanguage.noiseSuppression;
  }
  if (config.voiceLanguage?.endOfTurn) {
    payload.end_of_turn = config.voiceLanguage.endOfTurn;
  }
  if (config.instructions?.protectedGreeting) {
    payload.greeting_settings = { protected: true };
  }
  if (config.instructions?.fillerMessages?.length) {
    payload.filler_messages = config.instructions.fillerMessages;
  }

  if (config.voiceLanguage?.additionalLanguages?.length) {
    payload.additional_languages = config.voiceLanguage.additionalLanguages;
  }
  if (config.voiceLanguage?.autoLanguageDetection) {
    payload.auto_detect_language = true;
  }
  if (config.voiceLanguage?.silenceTimeoutMs) {
    (payload as { silence_timeout_ms?: number }).silence_timeout_ms =
      config.voiceLanguage.silenceTimeoutMs;
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  if (agent.telnyxAssistantId) {
    await telnyxRequest(`/ai/assistants/${agent.telnyxAssistantId}`, {
      method: "PATCH",
      body: payload,
    });
    return {
      mode: "telnyx",
      assistantId: agent.telnyxAssistantId,
      bucketIds,
      toolCount: tools.length,
    };
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

  return { mode: "telnyx", assistantId, bucketIds, toolCount: tools.length };
}

export async function dialOutboundCall(input: {
  workspaceId: string;
  callId: string;
  fromE164: string;
  toE164: string;
  assistantId?: string | null;
  connectionId?: string | null;
  metadata?: Record<string, unknown>;
  /** Injected into Telnyx assistant session when the callee answers. */
  dynamicVariables?: Record<string, string> | null;
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
        dynamicVariables: input.dynamicVariables || undefined,
      }),
    ).toString("base64"),
  };

  if (input.assistantId) {
    body.answering_machine_detection = "detect_words";
    body.answering_machine_detection_config = {
      total_analysis_time_millis: 3500,
      after_greeting_silence_millis: 800,
      between_words_silence_millis: 50,
      greeting_duration_millis: 3000,
      initial_silence_millis: 2500,
    };
    body.assistant_id = input.assistantId;
    // Call Control dial accepts assistant dynamic variables alongside assistant_id.
    if (input.dynamicVariables && Object.keys(input.dynamicVariables).length) {
      body.assistant_dynamic_variables = input.dynamicVariables;
    }
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
  dynamicVariables?: Record<string, string> | null;
}) {
  if (!input.callControlId || input.callControlId.startsWith("mock_")) {
    return { mode: "mock" as const };
  }
  if (!isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }

  const assistant: Record<string, unknown> = { id: input.assistantId };
  if (input.dynamicVariables && Object.keys(input.dynamicVariables).length) {
    assistant.dynamic_variables = input.dynamicVariables;
  }
  const body: Record<string, unknown> = { assistant };
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

/** Start live transcription on a call control leg. */
export async function startCallTranscription(callControlId: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }
  await telnyxRequest(`/calls/${callControlId}/actions/transcription_start`, {
    method: "POST",
    body: {
      language: "en",
      transcription_engine: "A",
      transcription_tracks: "both",
    },
  }).catch((err) => console.warn("[voice] transcription_start failed", err));
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
