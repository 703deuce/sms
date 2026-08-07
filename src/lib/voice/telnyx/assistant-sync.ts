import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import type { VoiceAgentConfig } from "../types";
import { getAgentRagBucketIds } from "../knowledge-processor";
import { buildAssistantTools } from "./assistant-tools";
import * as ai from "./ai-client";
import {
  DEFAULT_AGENT_VOICE_ID,
  buildAssistantVoiceSettings,
  logVoiceAssistantUpdate,
  resolveProviderVoiceId,
  sanitizeTelnyxVoiceError,
} from "./voices";
import { CONVERSATIONAL_PROMPT_GUIDANCE } from "../timing-presets";
import {
  LOW_LATENCY_CONVERSATION_GUIDANCE,
  buildFluxTranscriptionSettings,
  buildStartSpeakingPlanFromConfig,
  isDeepgramFluxModel,
  isLatencyOptimizedProfile,
  isNativeAudioModel,
  shouldSkipDynamicVariablesWebhook,
} from "../latency-profiles";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import {
  compileCallerToolPlaybookForPrompt,
  shouldInjectCallerPlaybook,
} from "@/lib/agents/appointment-booking/intelligence/caller-tool-playbook";
import { resolveEnabledBuiltinTools } from "../tools/catalog";

function unwrapTelnyxId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === "string" && obj.id) return obj.id;
  const data = obj.data;
  if (data && typeof data === "object") {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

type AgentRow = {
  id: string;
  workspaceId: string;
  name: string;
  agentType?: string | null;
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
        status: { in: ["indexed", "ready", "pending", "failed", "processing"] },
        sourceType: { in: ["text", "faq"] },
        ...(kbIds.length ? { knowledgeBaseId: { in: kbIds } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { contentText: true, name: true, extractedPreview: true },
    })) as KbSource[];
    const chunks = sources
      .map((s: KbSource) => {
        // Wizard business profiles need the full text in-prompt when RAG is down.
        const body = (s.contentText || s.extractedPreview || "").trim().slice(0, 4000);
        if (!body) return "";
        return `### ${s.name || "FAQ"}\n${body}`;
      })
      .filter(Boolean);
    if (!chunks.length) return "";
    return [
      "Business knowledge digest (answer from this — do not invent facts; for longer docs also use the retrieval knowledge tool when available):",
      ...chunks,
    ].join("\n\n");  } catch {
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

  // Do not auto-attach every workspace tool — only explicitly linked ones.
  return tools;
}

function greetingFromConfig(config: VoiceAgentConfig, agentName: string) {
  const greeting =
    (config.callHandling?.greeting as string | undefined) ||
    (config.conversationFlow?.sections?.find((s) => s.type === "greeting")?.config
      ?.text as string | undefined);
  return (
    greeting?.trim() ||
    `Thank you for calling. I'm ${agentName}, the virtual assistant, and I can answer questions or take a message. How can I help you today?`
  );
}

/** Telnyx has no native first_speaker field — encode clearly in instructions. */
function speaksFirstDirective(config: VoiceAgentConfig): string {
  const mode = String(config.callHandling?.speaksFirst || "ai").toLowerCase();
  if (mode === "caller") {
    return "Opening behavior: Wait for the caller to speak first. Do not open with a greeting until they have said something.";
  }
  return "Opening behavior: Speak first with the greeting.";
}

function speaksFirstIsCaller(config: VoiceAgentConfig): boolean {
  return String(config.callHandling?.speaksFirst || "ai").toLowerCase() === "caller";
}

function outputGainLinear(config: VoiceAgentConfig): number | null {
  const db = Number(config.voiceLanguage?.outputGainDb ?? -5);
  if (!db) return null;
  if (db > 0 || db < -12) return null;
  return Math.round(Math.pow(10, db / 20) * 1000) / 1000;
}

function interruptionSettingsFromConfig(config: VoiceAgentConfig) {
  // Barge-in preserved. Flux: wait_seconds only (no punctuation endpointing plan).
  const startSpeakingPlan = buildStartSpeakingPlanFromConfig(config);
  return {
    enable: config.voiceLanguage?.bargeIn !== false,
    disable_greeting_interruption: true,
    ...(startSpeakingPlan
      ? { start_speaking_plan: startSpeakingPlan }
      : {}),
  };
}

export async function syncTelnyxAssistant(
  workspaceId: string,
  agent: AgentRow,
  config: VoiceAgentConfig,
) {
  // AI Assistants only need TELNYX_API_KEY (Call Control connection is separate).
  if (!ai.isTelnyxAiConfigured()) {
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
  // Include workspace-global destinations (agentId null) so specialists inherit
  // the same phone Transfer destinations (e.g. destination name "Agent Handoff").
  // Note: destination name ≠ Telnyx AI Assistant Handoff tool.
  let transferTargets = transferCfg.targets;
  try {
    const { getPrisma } = await import("@/lib/db");
    const dests = await getPrisma().voiceTransferDestination.findMany({
      where: {
        workspaceId,
        enabled: true,
        OR: [{ agentId: agent.id }, { agentId: null }],
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    if (dests.length) {
      const byName = new Map<string, { name: string; to: string }>();
      for (const d of dests as Array<{
        name: string;
        destination: string;
        agentId: string | null;
      }>) {
        const key = d.name.toLowerCase();
        // Prefer agent-scoped over global when both exist.
        if (!byName.has(key) || d.agentId === agent.id) {
          byName.set(key, { name: d.name, to: d.destination });
        }
      }
      transferTargets = [...byName.values()];
    }
  } catch {
    // keep config.targets
  }

  // Wizard / draft fallback: destinationPhone + destinationName when DB empty
  // or when targets exist without a dialable `to`.
  const destPhone = String(
    (transferCfg as { destinationPhone?: string }).destinationPhone || "",
  ).trim();
  const destName = String(
    (transferCfg as { destinationName?: string }).destinationName || "Agent Handoff",
  ).trim();
  if (destPhone) {
    const byName = new Map<string, { name: string; to: string }>();
    for (const t of transferTargets || []) {
      if (t?.name) byName.set(t.name.toLowerCase(), { name: t.name, to: t.to || destPhone });
    }
    for (const name of [destName, "Agent Handoff", "Front Desk"]) {
      const key = name.toLowerCase();
      const prev = byName.get(key);
      if (!prev || !prev.to) byName.set(key, { name, to: destPhone });
    }
    transferTargets = [...byName.values()];
  }

  const optimizeToolLatency =
    config.voiceTiming?.activeProfile === "legacy_cascade"
      ? false
      : true;
  const tools = buildAssistantTools({
    workspaceId,
    agentId: agent.id,
    bucketIds,
    tools: agentTools,
    transferTargets,
    handoffAssistants: transferCfg.handoffAssistants,
    warmTransferInstructions: transferCfg.warmTransferInstructions,
    enabledBuiltinTools: config.enabledBuiltinTools,
    agentType: agent.agentType || undefined,
    optimizeToolLatency,
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
    speaksFirstDirective(config),
    // Soft prompt guidance only — not hard truncation or provider timing.
    CONVERSATIONAL_PROMPT_GUIDANCE,
    isDeepgramFluxModel(
      config.transcription?.sttModel || process.env.VOICE_TRANSCRIPTION_MODEL,
    ) || isLatencyOptimizedProfile(config.voiceTiming?.activeProfile)
      ? LOW_LATENCY_CONVERSATION_GUIDANCE
      : "",
    digest,
    bucketIds.length
      ? "You have a knowledge retrieval tool backed by the business document store. Use it for FAQs, policies, pricing, and detailed questions instead of guessing."
      : "",
    "Never claim an external action succeeded until the application tool confirms it.",
    "Never tell a caller an appointment is booked until book_appointment returns success with ok=true.",
    "If book_appointment fails or returns an error, explain the issue and offer alternatives.",
    "CRITICAL TOOL RULES: When the caller asks for a human/person/agent, use Transfer (not hangup, not AI handoff). When they ask to look up a contact, use search_crm_contacts or crm_lookup, then speak the result. Never call hangup after a tool. Tool failures must stay on the call.",
    shouldInjectCallerPlaybook(
      "caller_amy",
      resolveEnabledBuiltinTools({
        enabledBuiltinTools: config.enabledBuiltinTools,
        agentType: agent.agentType,
      }),
    )
      ? compileCallerToolPlaybookForPrompt(
          resolveEnabledBuiltinTools({
            enabledBuiltinTools: config.enabledBuiltinTools,
            agentType: agent.agentType,
          }),
        )
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Prefer Telnyx-native models (no llm_api_key_ref). Override via builder Model ID.
  const modelId =
    config.model?.modelId?.trim() || "moonshotai/Kimi-K2.6";

  const transcription = config.transcription || {};
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();

  // Core create body — keep strict; optional fields go on a follow-up update.
  // No native Telnyx first_speaker field: caller-first omits greeting so the
  // assistant waits; AI-first includes the configured greeting.
  const corePayload: Record<string, unknown> = {
    name: `${agent.name} (${workspaceId.slice(0, 8)})`.slice(0, 100),
    model: modelId,
    instructions: instructions.slice(0, 100_000),
  };
  if (!speaksFirstIsCaller(config)) {
    corePayload.greeting = greetingFromConfig(config, agent.name);
  }
  if (config.model?.customBaseUrl) {
    let apiKey: string | undefined;
    if (config.model.customApiKeyRef) {
      try {
        const { decryptSecret } = await import("@/lib/messaging/crypto");
        const secret = await (
          await import("@/lib/db")
        ).getPrisma().voiceIntegrationSecret.findFirst({
          where: { id: config.model.customApiKeyRef, workspaceId },
        });
        if (secret) apiKey = decryptSecret(secret.encryptedValue);
      } catch {
        // omit
      }
    }
    corePayload.external_llm = {
      model: modelId,
      base_url: config.model.customBaseUrl,
      ...(apiKey ? { llm_api_key_ref: config.model.customApiKeyRef } : {}),
    };
  } else if (config.model?.customApiKeyRef) {
    corePayload.llm_api_key_ref = config.model.customApiKeyRef;
  }

  const gainLinear = outputGainLinear(config);
  const voiceBuilt = buildAssistantVoiceSettings({
    voiceRef: config.voiceLanguage?.voiceId || DEFAULT_AGENT_VOICE_ID,
    speed: config.voiceLanguage?.speed,
    expressiveMode: config.voiceLanguage?.expressiveMode,
    volume: gainLinear,
    apiKeyRef: config.voiceLanguage?.elevenLabsApiKeyRef,
    includeElevenLabsTuning: Boolean(config.voiceLanguage?.elevenLabsTuning),
    elevenLabsStability: config.voiceLanguage?.elevenLabsStability,
    elevenLabsSimilarityBoost: config.voiceLanguage?.elevenLabsSimilarityBoost,
    elevenLabsStyle: config.voiceLanguage?.elevenLabsStyle,
    elevenLabsSpeakerBoost: config.voiceLanguage?.elevenLabsSpeakerBoost,
  });
  if (voiceBuilt.isElevenLabs) {
    const { ensureElevenLabsTelnyxSecret } = await import(
      "@/lib/voice/elevenlabs/telnyx-secret"
    );
    const ensured = await ensureElevenLabsTelnyxSecret();
    voiceBuilt.voice_settings.api_key_ref = ensured.apiKeyRef;
  }
  const voiceId = voiceBuilt.providerVoiceId;
  // TeXML app id only — never Call Control TELNYX_CONNECTION_ID (causes 10015).
  const texmlAppId = process.env.TELNYX_TEXML_APP_ID?.trim() || "";

  const nativeAudio = isNativeAudioModel(modelId);
  const sttModel =
    transcription.sttModel?.trim() ||
    process.env.VOICE_TRANSCRIPTION_MODEL?.trim() ||
    "deepgram/nova-3";

  const enrichPayload: Record<string, unknown> = {
    voice_settings: voiceBuilt.voice_settings,
    // Barge-in unchanged; start_speaking_plan includes Flux endpointing plan when opted in.
    interruption_settings: interruptionSettingsFromConfig(config),
    enabled_features: ["telephony"] as string[],
    // Required for in-app browser test calls (TelnyxRTC anonymous_login).
    telephony_settings: {
      supports_unauthenticated_web_calls: true,
      ...(texmlAppId ? { default_texml_app_id: texmlAppId } : {}),
      // Prefer inbound-oriented NS via assistant telephony when available.
      // Per-call suppression_start(inbound) is also applied on PSTN answer.
      ...(config.voiceLanguage?.noiseSuppression === false
        ? { noise_suppression: "disabled" }
        : { noise_suppression: "krisp" }),
      // Soft idle check-in from agent silenceTimeoutMs (pre-tuning formula).
      user_idle_reply_secs: Math.max(
        5,
        Math.min(30, Math.round((config.voiceLanguage?.silenceTimeoutMs ?? 2500) / 1000) + 3),
      ),
    },
    // Tools are pushed and verified separately via pushTools() — do not embed
    // them in the voice/telephony enrich payload (failed combined updates were
    // silently falling back and leaving hangup-only assistants).
  };
  // Native-audio models (e.g. Ultravox) ignore STT config — do not attach transcription.
  if (!nativeAudio && transcription.enabled !== false) {
    (enrichPayload.enabled_features as string[]).push("transcription");
  }
  // STT model from agent config. Flux settings only when model is deepgram/flux
  // (opt-in A/B). Native-audio models skip transcription entirely.
  if (!nativeAudio) {
    const langRaw =
      transcription.language ||
      config.voiceLanguage?.primaryLanguage ||
      "en";
    const lang = String(langRaw).toLowerCase().startsWith("en")
      ? "en"
      : String(langRaw).split("-")[0] || "en";
    const fluxSettings = buildFluxTranscriptionSettings({
      ...config,
      transcription: { ...transcription, sttModel },
    });
    enrichPayload.transcription = {
      model: sttModel,
      language: lang,
      ...(transcription.keyterms?.length ? { keyterms: transcription.keyterms } : {}),
      ...(fluxSettings ? { settings: fluxSettings } : {}),
    };
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  async function persistAssistantId(assistantId: string) {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        telnyxAssistantId: assistantId,
        telnyxConnectionId: connectionId || null,
      },
    });
  }

  async function pushTools(assistantId: string) {
    const attempts: Array<{ label: string; tools: Record<string, unknown>[] }> = [
      { label: "all", tools: tools as Record<string, unknown>[] },
    ];
    // Progressive fallback — never fall all the way to hangup-only.
    const nativeOnly = (tools as Record<string, unknown>[]).filter((t) =>
      ["transfer", "hangup", "handoff", "sip_refer", "send_dtmf"].includes(
        String((t as { type?: string }).type || ""),
      ),
    );
    const transferHangup = (tools as Record<string, unknown>[]).filter((t) =>
      ["transfer", "hangup"].includes(String((t as { type?: string }).type || "")),
    );
    const crmWebhooks = (tools as Record<string, unknown>[]).filter((t) => {
      const name = String((t as { webhook?: { name?: string } }).webhook?.name || "");
      return (
        name.includes("crm") ||
        name.includes("lookup") ||
        name.includes("search_crm") ||
        name === "lookup_customer"
      );
    });
    if (nativeOnly.length) attempts.push({ label: "native", tools: nativeOnly });
    if (transferHangup.length) {
      attempts.push({
        label: "transfer_hangup_crm",
        tools: [...transferHangup, ...crmWebhooks],
      });
      attempts.push({ label: "transfer_hangup", tools: transferHangup });
    }

    let lastError = "";
    for (const attempt of attempts) {
      try {
        await ai.updateAssistant(assistantId, { tools: attempt.tools });
        const remote = await ai.getAssistant(assistantId);
        const data = (remote as { data?: { tools?: unknown[] } }).data || remote;
        const remoteTools = Array.isArray((data as { tools?: unknown[] }).tools)
          ? ((data as { tools: unknown[] }).tools as Array<{ type?: string }>)
          : [];
        const types = remoteTools.map((t) => t.type);
        const hasTransfer = types.includes("transfer");
        const hasWebhook = types.includes("webhook");
        const onlyHangup = types.length === 1 && types[0] === "hangup";
        if (onlyHangup && attempt.tools.length > 1) {
          lastError = `Telnyx kept hangup-only after tools push (${attempt.label})`;
          continue;
        }
        return {
          ok: true as const,
          label: attempt.label,
          remoteToolCount: remoteTools.length,
          remoteTypes: types,
          hasTransfer,
          hasWebhook,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    return { ok: false as const, error: lastError || "tool push failed" };
  }

  async function enrichBestEffort(assistantId: string) {
    const voiceBase = { ...(enrichPayload.voice_settings as Record<string, unknown>) };
    const requestedVoice = String(voiceBase.voice || voiceId);
    const expressiveMode = Boolean(voiceBase.expressive_mode);
    try {
      await ai.updateAssistant(assistantId, enrichPayload);
      logVoiceAssistantUpdate({
        assistantId,
        requestedVoice,
        expressiveMode,
        status: "ok",
      });
    } catch (err) {
      const sanitized = sanitizeTelnyxVoiceError(err);
      logVoiceAssistantUpdate({
        assistantId,
        requestedVoice,
        expressiveMode,
        status: sanitized.status ?? "error",
        errorBody: sanitized.body ?? sanitized.message,
      });
      // Retry without optional volume only — never silently swap the voice id.
      delete voiceBase.volume;
      try {
        await ai.updateAssistant(assistantId, {
          voice_settings: voiceBase,
          enabled_features: ["telephony"],
          telephony_settings: {
            supports_unauthenticated_web_calls: true,
            ...(texmlAppId ? { default_texml_app_id: texmlAppId } : {}),
            ...(config.voiceLanguage?.noiseSuppression === false
              ? { noise_suppression: "disabled" }
              : { noise_suppression: "krisp" }),
          },
        });
        logVoiceAssistantUpdate({
          assistantId,
          requestedVoice,
          expressiveMode,
          status: "ok_without_volume",
        });
      } catch (err2) {
        const sanitized2 = sanitizeTelnyxVoiceError(err2);
        logVoiceAssistantUpdate({
          assistantId,
          requestedVoice,
          expressiveMode,
          status: sanitized2.status ?? "error",
          errorBody: sanitized2.body ?? sanitized2.message,
        });
        // Minimal retry with the SAME voice (no silent NaturalHD remap).
        try {
          const plain: Record<string, unknown> = { voice: requestedVoice };
          if (voiceBase.api_key_ref) {
            plain.api_key_ref = voiceBase.api_key_ref;
          }
          await ai.updateAssistant(assistantId, {
            voice_settings: plain,
            enabled_features: ["telephony"],
            telephony_settings: {
              supports_unauthenticated_web_calls: true,
              ...(texmlAppId ? { default_texml_app_id: texmlAppId } : {}),
            },
          });
          logVoiceAssistantUpdate({
            assistantId,
            requestedVoice,
            expressiveMode: false,
            status: "ok_voice_only",
          });
        } catch (err3) {
          const sanitized3 = sanitizeTelnyxVoiceError(err3);
          logVoiceAssistantUpdate({
            assistantId,
            requestedVoice,
            expressiveMode: false,
            status: sanitized3.status ?? "error",
            errorBody: sanitized3.body ?? sanitized3.message,
          });
          // Do not overwrite the customer's active assistant with a different voice.
          throw new Error(
            `Telnyx rejected voice ${requestedVoice}` +
              (sanitized3.status ? ` (HTTP ${sanitized3.status}` : " (") +
              (sanitized3.code ? ` code ${sanitized3.code}` : "") +
              `): ${sanitized3.message}`,
          );
        }
      }
    }

    // Force-clear stale punctuation endpointing + re-assert Flux EOT.
    // Omitting nested keys on PATCH leaves prior Telnyx values (e.g. 1.0s no-punct).
    if (
      isDeepgramFluxModel(sttModel) ||
      isLatencyOptimizedProfile(config.voiceTiming?.activeProfile)
    ) {
      try {
        await ai.updateAssistant(assistantId, {
          interruption_settings: interruptionSettingsFromConfig(config),
          ...(enrichPayload.transcription
            ? { transcription: enrichPayload.transcription }
            : {}),
        });
      } catch (err) {
        console.warn(
          "[assistant-sync] latency timing re-patch failed",
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Static dynvars (business_timezone, names). Flux skips the call-start
    // webhook so greeting is not blocked; resolve_datetime supplies the clock.
    try {
      const dynVars: Record<string, string> = {};
      const raw = (config as { dynamicVariables?: Record<string, unknown> })
        .dynamicVariables;
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          if (v == null) continue;
          const s = String(v).trim();
          if (s) dynVars[k] = s;
        }
      }
      const skipWebhook = shouldSkipDynamicVariablesWebhook(config);
      const webhookBody: Record<string, unknown> = {
        ...(Object.keys(dynVars).length ? { dynamic_variables: dynVars } : {}),
      };
      if (skipWebhook) {
        webhookBody.dynamic_variables_webhook_url = null;
        webhookBody.dynamic_variables_webhook_timeout_ms = null;
      } else {
        webhookBody.dynamic_variables_webhook_url = `${getAppBaseUrl()}/api/telnyx/voice/dynamic-variables`;
        webhookBody.dynamic_variables_webhook_timeout_ms =
          isLatencyOptimizedProfile(config.voiceTiming?.activeProfile)
            ? 500
            : 1500;
      }
      if (Object.keys(webhookBody).length) {
        await ai.updateAssistant(assistantId, webhookBody);
      }
    } catch (err) {
      console.warn(
        "[assistant-sync] dynamic variables / webhook update failed",
        err instanceof Error ? err.message : err,
      );
    }

    return pushTools(assistantId);
  }

  async function readLiveLatencySnapshot(assistantId: string) {
    try {
      const remote = await ai.getAssistant(assistantId);
      const data = ((remote as { data?: Record<string, unknown> }).data ||
        remote) as Record<string, unknown>;
      const interruption = (data.interruption_settings || {}) as Record<
        string,
        unknown
      >;
      const transcriptionRemote = (data.transcription || {}) as Record<
        string,
        unknown
      >;
      const voiceSettings = (data.voice_settings || {}) as Record<string, unknown>;
      return {
        model: data.model,
        voice: voiceSettings.voice,
        transcriptionModel: transcriptionRemote.model,
        transcriptionSettings: transcriptionRemote.settings ?? null,
        startSpeakingPlan: interruption.start_speaking_plan ?? null,
        dynamicVariablesWebhookUrl: data.dynamic_variables_webhook_url ?? null,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (agent.telnyxAssistantId) {
    // Core first — surface model/greeting failures for latency A/B (do not swallow).
    let coreError: string | null = null;
    try {
      await ai.updateAssistant(agent.telnyxAssistantId, corePayload);
      // Telnyx may return 200 while silently ignoring an unsupported model id.
      if (isLatencyOptimizedProfile(config.voiceTiming?.activeProfile) || isNativeAudioModel(modelId)) {
        const remote = await ai.getAssistant(agent.telnyxAssistantId);
        const data = ((remote as { data?: Record<string, unknown> }).data ||
          remote) as Record<string, unknown>;
        const liveModel = String(data.model || "");
        if (liveModel && liveModel !== modelId) {
          coreError =
            `Telnyx kept model "${liveModel}" after requesting "${modelId}" ` +
            `(unsupported or ignored model id for AI Assistants)`;
        }
      }
    } catch (err) {
      coreError = err instanceof Error ? err.message : String(err);
      console.error("[assistant-sync] core update failed", {
        assistantId: agent.telnyxAssistantId,
        model: modelId,
        error: coreError,
      });
    }
    const toolResult = await enrichBestEffort(agent.telnyxAssistantId);
    if (!toolResult.ok) {
      // Recreate assistant — existing one appears stuck on hangup-only tools.
      const created = await ai.createAssistant({
        ...corePayload,
        ...enrichPayload,
        tools,
      }).catch(async () => {
        const createdCore = await ai.createAssistant(corePayload);
        const newId = unwrapTelnyxId(createdCore);
        if (!newId) throw new Error("assistant recreate returned no id");
        await enrichBestEffort(newId);
        return createdCore;
      });
      const newId = unwrapTelnyxId(created);
      if (!newId) throw new Error("assistant recreate returned no id");
      await persistAssistantId(newId);
      const verified = await pushTools(newId);
      return {
        mode: "telnyx",
        assistantId: newId,
        bucketIds,
        toolCount: tools.length,
        recreated: true,
        previousAssistantId: agent.telnyxAssistantId,
        toolSync: verified,
        toolSyncError: verified.ok ? null : verified.error,
        coreError,
        requestedModel: modelId,
      };
    }
    // If model update failed, do not pretend latency profile is live on Telnyx.
    if (coreError && isLatencyOptimizedProfile(config.voiceTiming?.activeProfile)) {
      throw new Error(
        `Telnyx rejected assistant core update (model=${modelId}): ${coreError}`,
      );
    }
    const liveLatency = await readLiveLatencySnapshot(agent.telnyxAssistantId);
    return {
      mode: "telnyx",
      assistantId: agent.telnyxAssistantId,
      bucketIds,
      toolCount: tools.length,
      toolSync: toolResult,
      toolSyncError: null,
      coreError,
      requestedModel: modelId,
      liveLatency,
    };
  }

  // Create with core fields only — optional tools/voice often cause 10015 Bad Request.
  let created: unknown;
  try {
    created = await ai.createAssistant(corePayload);
  } catch (err) {
    // Last resort: omit model so Telnyx applies account default.
    const { model: _omit, ...withoutModel } = corePayload;
    created = await ai.createAssistant(withoutModel).catch(() => {
      throw err;
    });
  }
  const assistantId = unwrapTelnyxId(created);
  if (!assistantId) {
    throw new Error(
      `Telnyx assistant create returned no id: ${JSON.stringify(created).slice(0, 400)}`,
    );
  }

  await persistAssistantId(assistantId);
  const toolResult = await enrichBestEffort(assistantId);

  let outboundVoice: {
    ready: boolean;
    outboundVoiceProfileId: string | null;
    issues: Array<{ code: string; severity: string; message: string }>;
  } | null = null;
  if (transferTargets?.length) {
    try {
      const { ensureTelnyxOutboundVoiceReady } = await import(
        "@/lib/phone/telnyx-outbound-voice"
      );
      const ready = await ensureTelnyxOutboundVoiceReady();
      outboundVoice = {
        ready: ready.ready,
        outboundVoiceProfileId: ready.outboundVoiceProfileId,
        issues: ready.issues,
      };
      if (!ready.ready) {
        console.warn(
          "[assistant-sync] Transfer tool enabled but outbound voice not ready:",
          ready.issues.map((i) => i.message).join("; "),
        );
      }
    } catch (err) {
      outboundVoice = {
        ready: false,
        outboundVoiceProfileId: null,
        issues: [
          {
            code: "outbound_check_failed",
            severity: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      };
    }
  }

  return {
    mode: "telnyx",
    assistantId,
    bucketIds,
    toolCount: tools.length,
    toolSync: toolResult,
    toolSyncError: toolResult.ok ? null : toolResult.error,
    outboundVoice,
  };
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

  let connectionId =
    input.connectionId || process.env.TELNYX_CONNECTION_ID?.trim() || "";
  try {
    const { ensureTelnyxOutboundVoiceReady } = await import(
      "@/lib/phone/telnyx-outbound-voice"
    );
    const { resolveVoiceConnectionId } = await import(
      "@/lib/phone/telnyx-voice-connection"
    );
    if (!connectionId) connectionId = await resolveVoiceConnectionId();
    const ready = await ensureTelnyxOutboundVoiceReady({
      connectionId,
      callerIdE164: input.fromE164,
    });
    if (ready.connectionId) connectionId = ready.connectionId;
    if (!ready.ready) {
      const detail =
        ready.issues.find((i) => i.severity === "error")?.message ||
        "Outbound Voice Profile not ready";
      throw new Error(
        `Outbound calling is not configured for this Voice API Application. ${detail}`,
      );
    }
  } catch (err) {
    if (err instanceof Error && /Outbound calling is not configured/.test(err.message)) {
      throw err;
    }
    console.error("[dialOutboundCall] outbound ensure", err);
  }
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

/** Start live transcription on a call control leg (Deepgram Nova-3 + smart format). */
export async function startCallTranscription(callControlId: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }

  const engine =
    process.env.VOICE_TRANSCRIPTION_ENGINE?.trim() || "Deepgram";
  const model =
    process.env.VOICE_TRANSCRIPTION_MODEL?.trim() || "deepgram/nova-3";
  const languageRaw =
    process.env.VOICE_TRANSCRIPTION_LANGUAGE?.trim() || "en";
  // Deepgram expects short codes (en), not BCP-47 tags like en-US.
  const languageLower = languageRaw.toLowerCase();
  const language = languageLower.startsWith("en")
    ? "en"
    : languageLower.split("-")[0] || "en";
  const smartFormat = process.env.VOICE_TRANSCRIPTION_SMART_FORMAT !== "0";

  const body: Record<string, unknown> =
    engine === "Deepgram" || engine.toLowerCase() === "deepgram"
      ? {
          transcription_engine: "Deepgram",
          transcription_tracks: "both",
          transcription_engine_config: {
            transcription_engine: "Deepgram",
            transcription_model: model.startsWith("deepgram/")
              ? model
              : "deepgram/nova-3",
            language,
            smart_format: smartFormat,
            interim_results: false,
          },
        }
      : {
          // Legacy escape hatch (Google / Telnyx / A / B).
          language,
          transcription_engine: engine,
          transcription_tracks: "both",
        };

  await telnyxRequest(`/calls/${callControlId}/actions/transcription_start`, {
    method: "POST",
    body,
  }).catch((err) => console.warn("[voice] transcription_start failed", err));
  return { mode: "telnyx" as const, engine, model };
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
