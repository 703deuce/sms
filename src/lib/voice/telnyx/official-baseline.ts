/**
 * Telnyx-direct ultra-low-latency baseline (no Transovo publish layer).
 *
 * Stack (Telnyx engineer-recommended):
 *   LLM: google/gemini-2.5-flash-lite
 *   STT: deepgram/flux
 *   TTS: Telnyx Ultra
 *
 * Undocumented timing fields are OMITTED so Telnyx applies its own defaults.
 * Do not copy production agent settings or Transovo latency presets.
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import * as ai from "@/lib/voice/telnyx/ai-client";
import { getPrisma } from "@/lib/db";

export const OFFICIAL_BASELINE_NAME = "TELNYX_ULTRA_LOW_LATENCY_BASELINE";

/** Telnyx Mission Control integration secret identifiers. */
export const GEMINI_API_KEY_REF = "gemini_api_key";
export const OPENAI_API_KEY_REF = "openai_key";

/** Shared non-LLM baseline fields — identical across A/B/C/D. */
export const BASELINE_ULTRA_VOICE =
  "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82";

export const BASELINE_SHARED = {
  name: OFFICIAL_BASELINE_NAME,
  instructions:
    "You are a concise phone assistant.\nAnswer immediately in one short sentence.\nUse no more than twelve words.",
  greeting: "Hi, how can I help?",
  transcription: {
    model: "deepgram/flux",
  },
  voice_settings: {
    voice: BASELINE_ULTRA_VOICE,
  },
} as const;

/**
 * A/B/C/D LLM-only variants on the same Flux + Ultra baseline.
 * Everything except model (+ required provider key ref) stays identical.
 */
export const BASELINE_MODEL_PROFILES = {
  A: {
    id: "A",
    label: "Telnyx Haiku",
    modelId: "anthropic/claude-haiku-4-5",
    llmApiKeyRef: null as string | null,
    note: "Telnyx-native Claude Haiku 4.5 (no external key).",
  },
  B: {
    id: "B",
    label: "Telnyx Kimi 2.5",
    modelId: "moonshotai/Kimi-K2.5",
    llmApiKeyRef: null as string | null,
    note: "Telnyx-native Kimi-K2.5 (no external key).",
  },
  C: {
    id: "C",
    label: "Gemini Flash",
    modelId: "google/gemini-2.5-flash-lite",
    llmApiKeyRef: GEMINI_API_KEY_REF,
    fallbackModelId: "google/gemini-2.5-flash",
    note: "Google Gemini via llm_api_key_ref=gemini_api_key. Prefers Flash Lite; this account falls back to gemini-2.5-flash when Lite is blocked (10027).",
  },
  D: {
    id: "D",
    label: "OpenAI GPT-5.4 mini",
    modelId: "openai/gpt-5.4-mini",
    llmApiKeyRef: OPENAI_API_KEY_REF,
    fallbackModelId: "openai/gpt-4o-mini",
    note: "OpenAI via llm_api_key_ref=openai_key. Prefers gpt-5.4-mini (fast); falls back to gpt-4o-mini.",
  },
} as const;

export type BaselineModelProfileId = keyof typeof BASELINE_MODEL_PROFILES;

export const BASELINE_PREFERRED_MODEL =
  BASELINE_MODEL_PROFILES.C.modelId;

/** Create try-order (prefer C, then Flash, then A/B/D natives). */
export const BASELINE_MODEL_CANDIDATES = [
  BASELINE_MODEL_PROFILES.C.modelId,
  BASELINE_MODEL_PROFILES.C.fallbackModelId,
  BASELINE_MODEL_PROFILES.A.modelId,
  BASELINE_MODEL_PROFILES.B.modelId,
  BASELINE_MODEL_PROFILES.D.modelId,
] as const;

export const BASELINE_REQUESTED = {
  ...BASELINE_SHARED,
  model: BASELINE_PREFERRED_MODEL,
  llm_api_key_ref: GEMINI_API_KEY_REF,
} as const;

export function resolveBaselineProfileId(
  raw: string | null | undefined,
): BaselineModelProfileId | null {
  const key = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^PROFILE[_-]?/, "");
  if (key === "A" || key === "B" || key === "C" || key === "D") return key;
  return null;
}

export function modelNeedsGeminiKey(modelId: string) {
  return /^google\//i.test(String(modelId || "").trim());
}

export function modelNeedsOpenAIKey(modelId: string) {
  return /^openai\//i.test(String(modelId || "").trim());
}

/** Build create/update body fields for a model (+ provider secret when needed). */
export function assistantModelFields(
  modelId: string,
  opts?: {
    geminiKeyRef?: string | null;
    openaiKeyRef?: string | null;
    llmApiKeyRef?: string | null;
  },
) {
  const model = String(modelId || "").trim();
  const fields: Record<string, unknown> = { model };
  if (opts?.llmApiKeyRef !== undefined) {
    fields.llm_api_key_ref = opts.llmApiKeyRef;
  } else if (modelNeedsGeminiKey(model)) {
    fields.llm_api_key_ref = (opts?.geminiKeyRef ?? GEMINI_API_KEY_REF).trim();
  } else if (modelNeedsOpenAIKey(model)) {
    fields.llm_api_key_ref = (opts?.openaiKeyRef ?? OPENAI_API_KEY_REF).trim();
  } else {
    // Clear a prior Google/OpenAI key ref when switching to a native model.
    fields.llm_api_key_ref = null;
  }
  return fields;
}

export type OfficialBaselineRouteSnapshot = {
  e164: string;
  providerNumberId: string;
  previousConnectionId: string | null;
  texmlAppId: string | null;
  assistantId: string;
  routedAt: string;
  productionAssistantId: string | null;
  productionAgentId: string | null;
};

function unwrapId(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as { id?: string; data?: { id?: string } };
  return String(o.id || o.data?.id || "");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function diffRequestedVsLive(
  requested: Record<string, unknown>,
  live: Record<string, unknown>,
): Array<{ path: string; requested: unknown; live: unknown }> {
  const diffs: Array<{ path: string; requested: unknown; live: unknown }> = [];
  const check = (path: string, req: unknown, got: unknown) => {
    if (req === undefined) return;
    const reqJson = JSON.stringify(req);
    const gotJson = JSON.stringify(got ?? null);
    if (reqJson !== gotJson) {
      diffs.push({ path, requested: req, live: got ?? null });
    }
  };
  check("name", requested.name, live.name);
  check("model", requested.model, live.model);
  check("greeting", requested.greeting, live.greeting);
  check("instructions", requested.instructions, live.instructions);
  const reqTrans = asRecord(requested.transcription) || {};
  const liveTrans = asRecord(live.transcription) || {};
  check("transcription.model", reqTrans.model, liveTrans.model);
  const reqVoice = asRecord(requested.voice_settings) || {};
  const liveVoice = asRecord(live.voice_settings) || {};
  check("voice_settings.voice", reqVoice.voice, liveVoice.voice);
  return diffs;
}

/** Fields Telnyx inserted that we did not send (informational). */
function providerInsertedFields(live: Record<string, unknown>) {
  return {
    id: live.id ?? null,
    created_at: live.created_at ?? null,
    transcription_full: live.transcription ?? null,
    transcription_settings: asRecord(live.transcription)?.settings ?? null,
    interruption_settings: live.interruption_settings ?? null,
    start_speaking_plan:
      asRecord(live.interruption_settings)?.start_speaking_plan ?? null,
    voice_settings_full: live.voice_settings ?? null,
    tools: live.tools ?? null,
    tool_count: Array.isArray(live.tools) ? live.tools.length : 0,
    dynamic_variables_webhook_url: live.dynamic_variables_webhook_url ?? null,
    dynamic_variables_webhook_timeout_ms:
      live.dynamic_variables_webhook_timeout_ms ?? null,
    enabled_features: live.enabled_features ?? null,
    telephony_settings: live.telephony_settings ?? null,
    insight_settings: live.insight_settings ?? null,
    privacy_settings: live.privacy_settings ?? null,
    mcp_servers: live.mcp_servers ?? null,
    knowledge_base: live.knowledge_base ?? null,
    fallback_model: live.fallback_model ?? live.llm_fallback ?? null,
    temperature: live.temperature ?? null,
    max_tokens: live.max_tokens ?? null,
    messaging_settings: live.messaging_settings ?? null,
  };
}

export async function createOfficialBaselineAssistant(opts?: {
  voiceId?: string;
  modelId?: string;
  profileId?: string;
  geminiKeyRef?: string;
  openaiKeyRef?: string;
}) {
  const voice = opts?.voiceId?.trim() || BASELINE_ULTRA_VOICE;
  const geminiKeyRef = opts?.geminiKeyRef?.trim() || GEMINI_API_KEY_REF;
  const openaiKeyRef = opts?.openaiKeyRef?.trim() || OPENAI_API_KEY_REF;
  const profileId = resolveBaselineProfileId(opts?.profileId);
  const profile = profileId ? BASELINE_MODEL_PROFILES[profileId] : null;

  const candidates: string[] = [];
  if (profile) {
    candidates.push(profile.modelId);
    if ("fallbackModelId" in profile && profile.fallbackModelId) {
      candidates.push(profile.fallbackModelId);
    }
  }
  if (opts?.modelId?.trim()) candidates.push(opts.modelId.trim());
  candidates.push(...BASELINE_MODEL_CANDIDATES);
  const uniqueCandidates = [...new Set(candidates)];

  // Intentionally omitted (Telnyx defaults):
  // tools, interruption_settings, start_speaking_plan, wait_seconds,
  // punctuation waits, eot_threshold / eager_eot_threshold / eot_timeout_ms,
  // dynamic_variables_webhook, mcp, knowledge, memory.

  let created: unknown = null;
  let assistantId = "";
  let usedModel = "";
  const modelAttempts: Array<{
    model: string;
    ok: boolean;
    llmApiKeyRef?: string | null;
    error?: string;
  }> = [];

  for (const model of uniqueCandidates) {
    const modelFields = assistantModelFields(model, {
      geminiKeyRef,
      openaiKeyRef,
    });
    const createBody: Record<string, unknown> = {
      name: BASELINE_SHARED.name,
      instructions: BASELINE_SHARED.instructions,
      greeting: BASELINE_SHARED.greeting,
      ...modelFields,
      transcription: {
        model: BASELINE_SHARED.transcription.model,
      },
      voice_settings: {
        voice,
      },
    };
    try {
      created = await ai.createAssistant(createBody);
      assistantId = unwrapId(created);
      if (!assistantId) {
        modelAttempts.push({
          model,
          ok: false,
          llmApiKeyRef: (modelFields.llm_api_key_ref as string | null) ?? null,
          error: `no id: ${JSON.stringify(created).slice(0, 300)}`,
        });
        continue;
      }
      usedModel = model;
      modelAttempts.push({
        model,
        ok: true,
        llmApiKeyRef: (modelFields.llm_api_key_ref as string | null) ?? null,
      });
      break;
    } catch (err) {
      modelAttempts.push({
        model,
        ok: false,
        llmApiKeyRef: (modelFields.llm_api_key_ref as string | null) ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!assistantId || !created) {
    throw new Error(
      `Telnyx createAssistant failed for all models ${uniqueCandidates.join(", ")}: ${JSON.stringify(modelAttempts)}`,
    );
  }

  const usedFields = assistantModelFields(usedModel, {
    geminiKeyRef,
    openaiKeyRef,
  });
  const createBody: Record<string, unknown> = {
    name: BASELINE_SHARED.name,
    instructions: BASELINE_SHARED.instructions,
    greeting: BASELINE_SHARED.greeting,
    ...usedFields,
    transcription: {
      model: BASELINE_SHARED.transcription.model,
    },
    voice_settings: {
      voice,
    },
  };

  const liveRemote = await ai.getAssistant(assistantId);
  const live = (asRecord(liveRemote)?.data || asRecord(liveRemote) || {}) as Record<
    string,
    unknown
  >;

  let versions: unknown = null;
  let activeVersionId: string | null = null;
  try {
    versions = await ai.listVersions(assistantId);
    const rows = Array.isArray(asRecord(versions)?.data)
      ? (asRecord(versions)!.data as Array<Record<string, unknown>>)
      : Array.isArray(versions)
        ? (versions as Array<Record<string, unknown>>)
        : [];
    const main =
      rows.find((v) => v.is_main || v.main) ||
      rows.find((v) => v.active) ||
      rows[0];
    activeVersionId = main
      ? String(main.id || main.version_id || "") || null
      : null;
  } catch (err) {
    versions = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const matchedProfile =
    (Object.values(BASELINE_MODEL_PROFILES).find(
      (p) =>
        p.modelId === usedModel ||
        ("fallbackModelId" in p && p.fallbackModelId === usedModel),
    )?.id as BaselineModelProfileId | undefined) || null;

  return {
    createBody,
    createResponse: created,
    assistantId,
    activeVersionId,
    live,
    versions,
    diffs: diffRequestedVsLive(createBody, live),
    providerInserted: providerInsertedFields(live),
    modelAttempts,
    profiles: BASELINE_MODEL_PROFILES,
    profileId: matchedProfile,
    preferredModel: BASELINE_PREFERRED_MODEL,
    usedModel,
    llmApiKeyRef: (usedFields.llm_api_key_ref as string | null) ?? null,
    geminiKeyRef: modelNeedsGeminiKey(usedModel) ? geminiKeyRef : null,
    openaiKeyRef: modelNeedsOpenAIKey(usedModel) ? openaiKeyRef : null,
    modelNote: matchedProfile
      ? `Profile ${matchedProfile}: ${BASELINE_MODEL_PROFILES[matchedProfile].label} (${usedModel}).`
      : `Using ${usedModel}.`,
    note:
      "Undocumented timing fields were omitted. Any eot_*/wait_*/endpointing values below were inserted by Telnyx, not by Transovo.",
  };
}

/** Confirm a Mission Control integration secret exists (never returns the key). */
export async function verifyIntegrationSecret(identifier: string) {
  const id = String(identifier || "").trim();
  if (!id) throw new Error("identifier required");
  const listed = await ai.listIntegrationSecrets();
  const rows = Array.isArray(asRecord(listed)?.data)
    ? (asRecord(listed)!.data as Array<Record<string, unknown>>)
    : Array.isArray(listed)
      ? (listed as Array<Record<string, unknown>>)
      : [];
  const found = rows.find((r) => String(r.identifier || "") === id);
  return {
    identifier: id,
    exists: Boolean(found),
    identifiers: rows.map((r) => String(r.identifier || "")).filter(Boolean),
    message: found
      ? `Telnyx integration secret "${id}" is present`
      : `Telnyx integration secret "${id}" not found — create it in Mission Control → Integration Secrets`,
  };
}

/** @deprecated use verifyIntegrationSecret */
export async function verifyGeminiIntegrationSecret(
  identifier = GEMINI_API_KEY_REF,
) {
  return verifyIntegrationSecret(identifier);
}

/**
 * Switch the LLM on an existing baseline assistant (no recreate / no TeXML change).
 * Pass profileId A|B|C|D or an explicit modelId. Shared Flux/Ultra/prompt stay unchanged.
 */
export async function switchOfficialBaselineModel(input: {
  assistantId: string;
  modelId?: string;
  profileId?: string;
  geminiKeyRef?: string;
  openaiKeyRef?: string;
}) {
  const assistantId = String(input.assistantId || "").trim();
  if (!assistantId) throw new Error("assistantId required");

  const profileId = resolveBaselineProfileId(input.profileId);
  const profile = profileId ? BASELINE_MODEL_PROFILES[profileId] : null;
  const geminiKeyRef = input.geminiKeyRef?.trim() || GEMINI_API_KEY_REF;
  const openaiKeyRef = input.openaiKeyRef?.trim() || OPENAI_API_KEY_REF;

  const tryModels: string[] = [];
  if (profile) {
    tryModels.push(profile.modelId);
    if ("fallbackModelId" in profile && profile.fallbackModelId) {
      tryModels.push(profile.fallbackModelId);
    }
  }
  if (input.modelId?.trim()) tryModels.push(input.modelId.trim());
  const uniqueModels = [...new Set(tryModels)];
  if (!uniqueModels.length) {
    throw new Error("profileId (A|B|C|D) or modelId required");
  }

  const beforeRemote = await ai.getAssistant(assistantId);
  const before = (asRecord(beforeRemote)?.data ||
    asRecord(beforeRemote) ||
    {}) as Record<string, unknown>;

  const attempts: Array<{
    model: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const modelId of uniqueModels) {
    const patch = assistantModelFields(modelId, {
      geminiKeyRef,
      openaiKeyRef,
      ...(profile ? { llmApiKeyRef: profile.llmApiKeyRef } : {}),
    });
    try {
      await ai.updateAssistant(assistantId, patch);
      const afterRemote = await ai.getAssistant(assistantId);
      const after = (asRecord(afterRemote)?.data ||
        asRecord(afterRemote) ||
        {}) as Record<string, unknown>;
      const liveModel = String(after.model || "");
      if (liveModel && liveModel !== modelId) {
        attempts.push({
          model: modelId,
          ok: false,
          error: `Telnyx kept model "${liveModel}" after requesting "${modelId}"`,
        });
        continue;
      }
      attempts.push({ model: modelId, ok: true });
      return {
        assistantId,
        profileId: profileId || null,
        profile: profile || null,
        requested: patch,
        attempts,
        before: {
          model: before.model ?? null,
          llm_api_key_ref: before.llm_api_key_ref ?? null,
        },
        live: {
          model: liveModel,
          llm_api_key_ref: after.llm_api_key_ref ?? null,
          name: after.name ?? null,
          transcription: after.transcription ?? null,
          voice: asRecord(after.voice_settings)?.voice ?? null,
          greeting: after.greeting ?? null,
        },
        matched: liveModel === modelId,
        sharedUnchanged: {
          transcription: "deepgram/flux (unchanged by switch)",
          voice: "Telnyx Ultra (unchanged by switch)",
          greeting: "unchanged by switch",
          instructions: "unchanged by switch",
        },
      };
    } catch (err) {
      attempts.push({
        model: modelId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error(
    `switch_model failed for ${uniqueModels.join(", ")}: ${JSON.stringify(attempts)}`,
  );
}

async function resolvePhone(e164: string) {
  const prisma = getPrisma();
  const num = await prisma.phoneNumber.findFirst({
    where: {
      OR: [{ e164 }, { e164: e164.replace(/^\+/, "") }],
    },
    select: {
      id: true,
      e164: true,
      providerNumberId: true,
      workspaceId: true,
    },
  });
  if (!num?.providerNumberId) {
    throw new Error(`Phone ${e164} not found or missing providerNumberId`);
  }
  return num;
}

export async function routePhoneToOfficialBaseline(input: {
  e164: string;
  assistantId: string;
  productionAssistantId?: string | null;
  productionAgentId?: string | null;
}) {
  const num = await resolvePhone(input.e164);
  const providerNumberId = num.providerNumberId!;

  const phoneRemote = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const phoneData = asRecord(phoneRemote.data) || asRecord(phoneRemote) || {};
  const previousConnectionId = phoneData.connection_id
    ? String(phoneData.connection_id)
    : null;

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const texmlRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
    "/texml_applications",
    {
      method: "POST",
      body: {
        friendly_name: `ULL Baseline ${stamp}`.slice(0, 60),
        active: true,
        ai_assistant_id: input.assistantId,
        voice_url: `https://api.telnyx.com/v2/ai/assistants/${input.assistantId}/call`,
        voice_method: "POST",
      },
    },
  );
  const texmlData = asRecord(texmlRes.data) || asRecord(texmlRes) || {};
  const texmlAppId = String(texmlData.id || "");
  if (!texmlAppId) {
    throw new Error(
      `TeXML app create returned no id: ${JSON.stringify(texmlRes).slice(0, 500)}`,
    );
  }

  // Link assistant telephony to this TeXML app (inbound + outbound hygiene).
  await ai
    .updateAssistant(input.assistantId, {
      telephony_settings: {
        default_texml_app_id: texmlAppId,
      },
    })
    .catch((err) =>
      console.warn(
        "[official-baseline] telephony_settings update failed",
        err instanceof Error ? err.message : err,
      ),
    );

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: texmlAppId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const verifyData = asRecord(verify.data) || asRecord(verify) || {};
  const liveConnectionId = verifyData.connection_id
    ? String(verifyData.connection_id)
    : null;

  const snapshot: OfficialBaselineRouteSnapshot = {
    e164: num.e164,
    providerNumberId,
    previousConnectionId,
    texmlAppId,
    assistantId: input.assistantId,
    routedAt: new Date().toISOString(),
    productionAssistantId: input.productionAssistantId ?? null,
    productionAgentId: input.productionAgentId ?? null,
  };

  return {
    snapshot,
    route: {
      e164: num.e164,
      providerNumberId,
      previousConnectionId,
      texmlAppId,
      liveConnectionId,
      assistantId: input.assistantId,
      path: `${num.e164} → TeXML ${texmlAppId} → assistant ${input.assistantId} (direct Telnyx; Transovo Call Control bypassed)`,
      matched: liveConnectionId === texmlAppId,
    },
  };
}

export async function restoreOfficialBaselineRoute(
  snapshot: OfficialBaselineRouteSnapshot,
) {
  if (!snapshot.providerNumberId || !snapshot.previousConnectionId) {
    throw new Error("Snapshot missing providerNumberId or previousConnectionId");
  }
  await telnyxRequest(
    `/phone_numbers/${encodeURIComponent(snapshot.providerNumberId)}`,
    {
      method: "PATCH",
      body: { connection_id: snapshot.previousConnectionId },
    },
  );
  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(snapshot.providerNumberId)}`,
  );
  const verifyData = asRecord(verify.data) || asRecord(verify) || {};
  return {
    restored: true,
    e164: snapshot.e164,
    connectionId: verifyData.connection_id ?? null,
    expected: snapshot.previousConnectionId,
  };
}

export async function fetchOfficialBaselineLive(assistantId: string) {
  const liveRemote = await ai.getAssistant(assistantId);
  const live = (asRecord(liveRemote)?.data || asRecord(liveRemote) || {}) as Record<
    string,
    unknown
  >;
  let versions: unknown = null;
  try {
    versions = await ai.listVersions(assistantId);
  } catch (err) {
    versions = { error: err instanceof Error ? err.message : String(err) };
  }
  return {
    assistantId,
    live,
    versions,
    providerInserted: providerInsertedFields(live),
  };
}

function profileIdForModel(modelId: string): BaselineModelProfileId | null {
  const model = String(modelId || "").trim();
  for (const p of Object.values(BASELINE_MODEL_PROFILES)) {
    if (p.modelId === model) return p.id;
    if ("fallbackModelId" in p && p.fallbackModelId === model) return p.id;
  }
  return null;
}

function unwrapMessageRows(remote: unknown): Record<string, unknown>[] {
  const root = asRecord(remote);
  const data = root?.data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const nested = asRecord(data);
  if (Array.isArray(nested?.messages)) {
    return nested!.messages as Record<string, unknown>[];
  }
  if (Array.isArray(root?.messages)) {
    return root!.messages as Record<string, unknown>[];
  }
  if (Array.isArray(remote)) return remote as Record<string, unknown>[];
  return [];
}

function messageTimestampMs(m: Record<string, unknown>): number | null {
  const meta = asRecord(m.metadata) || {};
  const candidates = [
    m.created_at,
    m.sent_at,
    m.timestamp,
    m.updated_at,
    meta.created_at,
    meta.sent_at,
    meta.timestamp,
    meta.started_at,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
    }
    const ms = new Date(String(raw)).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function deriveGapsFromMessages(messages: Record<string, unknown>[]) {
  const samples: Array<{
    latencyMs: number;
    userAt: string;
    assistantAt: string;
    userText: string;
    assistantText: string;
    category: "first_response" | "conversational";
  }> = [];
  let pendingUserAt: number | null = null;
  let pendingUserText = "";
  let turnIndex = 0;

  for (const m of messages) {
    const role = String(m.role || m.sender || m.speaker || "").toLowerCase();
    const ts = messageTimestampMs(m);
    if (ts == null) continue;
    const text = String(m.content || m.text || m.message || "")
      .trim()
      .slice(0, 120);

    if (role === "user" || role === "caller" || role === "human") {
      pendingUserAt = ts;
      pendingUserText = text;
      continue;
    }
    if (
      pendingUserAt != null &&
      (role === "assistant" || role === "agent" || role === "ai")
    ) {
      const latencyMs = ts - pendingUserAt;
      if (latencyMs >= 0 && latencyMs < 30_000) {
        samples.push({
          latencyMs,
          userAt: new Date(pendingUserAt).toISOString(),
          assistantAt: new Date(ts).toISOString(),
          userText: pendingUserText,
          assistantText: text,
          category: turnIndex === 0 ? "first_response" : "conversational",
        });
        turnIndex += 1;
      }
      pendingUserAt = null;
      pendingUserText = "";
    }
  }
  return samples;
}

function percentileSorted(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx] ?? null;
}

/**
 * Pull caller→agent response gaps directly from Telnyx conversations/messages.
 * Does not change the live assistant — read-only measurement for A/B/C/D.
 *
 * Metric: user message timestamp → next assistant message timestamp (ms).
 * This approximates end-of-speech → agent reply start when Telnyx stamps
 * turns at those boundaries. Prefer call recordings for audible-first-audio
 * when message stamps are coarse.
 */
export async function scoreOfficialBaselineLatency(input: {
  assistantId: string;
  /** Max conversations to inspect (newest first). */
  limit?: number;
}) {
  const assistantId = String(input.assistantId || "").trim();
  if (!assistantId) throw new Error("assistantId required");
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));

  const versionMap = new Map<
    string,
    { model: string; profileId: BaselineModelProfileId | null }
  >();
  try {
    const versionsRemote = await ai.listVersions(assistantId);
    const rows = Array.isArray(asRecord(versionsRemote)?.data)
      ? (asRecord(versionsRemote)!.data as Array<Record<string, unknown>>)
      : Array.isArray(versionsRemote)
        ? (versionsRemote as Array<Record<string, unknown>>)
        : [];
    for (const v of rows) {
      const versionId = String(v.version_id || v.id || "").trim();
      const model = String(v.model || "").trim();
      if (!versionId) continue;
      versionMap.set(versionId, {
        model,
        profileId: profileIdForModel(model),
      });
    }
  } catch {
    // version map optional — calls still scored unlabeled
  }

  const convRemote = await ai.listConversations({
    "page[size]": String(Math.max(limit * 2, 30)),
  });
  const allConvs = Array.isArray(asRecord(convRemote)?.data)
    ? (asRecord(convRemote)!.data as Array<Record<string, unknown>>)
    : Array.isArray(convRemote)
      ? (convRemote as Array<Record<string, unknown>>)
      : [];

  const matched = allConvs
    .filter((c) => {
      const meta = asRecord(c.metadata) || {};
      return String(meta.assistant_id || "") === assistantId;
    })
    .slice(0, limit);

  const calls: Array<{
    conversationId: string;
    createdAt: string | null;
    versionId: string | null;
    model: string | null;
    profileId: BaselineModelProfileId | null;
    callSessionId: string | null;
    messageCount: number;
    samples: ReturnType<typeof deriveGapsFromMessages>;
    p50Ms: number | null;
    meanMs: number | null;
    messageFetchError?: string;
  }> = [];

  for (const c of matched) {
    const conversationId = String(c.id || "");
    const meta = asRecord(c.metadata) || {};
    const versionId = String(meta.assistant_version_id || "") || null;
    const mapped = versionId ? versionMap.get(versionId) : undefined;
    let samples: ReturnType<typeof deriveGapsFromMessages> = [];
    let messageCount = 0;
    let messageFetchError: string | undefined;
    try {
      const msgsRemote = await ai.listConversationMessages(conversationId);
      const rows = unwrapMessageRows(msgsRemote);
      messageCount = rows.length;
      // Chronological order
      const ordered = [...rows].sort((a, b) => {
        const ta = messageTimestampMs(a) ?? 0;
        const tb = messageTimestampMs(b) ?? 0;
        return ta - tb;
      });
      samples = deriveGapsFromMessages(ordered);
    } catch (err) {
      messageFetchError = err instanceof Error ? err.message : String(err);
    }
    const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
    calls.push({
      conversationId,
      createdAt: c.created_at ? String(c.created_at) : null,
      versionId,
      model: mapped?.model ?? null,
      profileId: mapped?.profileId ?? null,
      callSessionId: meta.call_session_id
        ? String(meta.call_session_id)
        : null,
      messageCount,
      samples,
      p50Ms: percentileSorted(latencies, 50),
      meanMs: latencies.length
        ? Math.round(
            latencies.reduce((a, b) => a + b, 0) / latencies.length,
          )
        : null,
      ...(messageFetchError ? { messageFetchError } : {}),
    });
  }

  const byProfile: Record<
    string,
    {
      profileId: string;
      callCount: number;
      sampleCount: number;
      latenciesMs: number[];
      p50Ms: number | null;
      p75Ms: number | null;
      p95Ms: number | null;
      meanMs: number | null;
      minMs: number | null;
      maxMs: number | null;
    }
  > = {};

  for (const call of calls) {
    const key = call.profileId || "unknown";
    if (!byProfile[key]) {
      byProfile[key] = {
        profileId: key,
        callCount: 0,
        sampleCount: 0,
        latenciesMs: [],
        p50Ms: null,
        p75Ms: null,
        p95Ms: null,
        meanMs: null,
        minMs: null,
        maxMs: null,
      };
    }
    byProfile[key].callCount += 1;
    for (const s of call.samples) {
      byProfile[key].latenciesMs.push(s.latencyMs);
    }
  }

  for (const row of Object.values(byProfile)) {
    const sorted = [...row.latenciesMs].sort((a, b) => a - b);
    row.sampleCount = sorted.length;
    row.p50Ms = percentileSorted(sorted, 50);
    row.p75Ms = percentileSorted(sorted, 75);
    row.p95Ms = percentileSorted(sorted, 95);
    row.meanMs = sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : null;
    row.minMs = sorted[0] ?? null;
    row.maxMs = sorted[sorted.length - 1] ?? null;
  }

  const allLatencies = calls
    .flatMap((c) => c.samples.map((s) => s.latencyMs))
    .sort((a, b) => a - b);

  return {
    assistantId,
    metric:
      "telnyx_conversation_message_gap_ms (user message created_at → next assistant message created_at)",
    metricNote:
      "Read-only pull from Telnyx. Not LLM-only time. Approximates caller turn → agent reply; audible first-audio may differ slightly from message stamps.",
    agentUnchanged: true,
    conversationCount: calls.length,
    sampleCount: allLatencies.length,
    overall: {
      p50Ms: percentileSorted(allLatencies, 50),
      p75Ms: percentileSorted(allLatencies, 75),
      p95Ms: percentileSorted(allLatencies, 95),
      meanMs: allLatencies.length
        ? Math.round(
            allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length,
          )
        : null,
      minMs: allLatencies[0] ?? null,
      maxMs: allLatencies[allLatencies.length - 1] ?? null,
    },
    byProfile: Object.values(byProfile).sort((a, b) =>
      a.profileId.localeCompare(b.profileId),
    ),
    calls,
    profiles: BASELINE_MODEL_PROFILES,
  };
}
