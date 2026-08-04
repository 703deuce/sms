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

/** Known-good Ultra voice on this Telnyx account (Howard). */
export const BASELINE_ULTRA_VOICE =
  "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82";

export const BASELINE_REQUESTED = {
  name: OFFICIAL_BASELINE_NAME,
  instructions:
    "You are a concise phone assistant.\nAnswer immediately in one short sentence.\nUse no more than twelve words.",
  greeting: "Hi, how can I help?",
  model: "google/gemini-2.5-flash-lite",
  transcription: {
    model: "deepgram/flux",
  },
  voice_settings: {
    voice: BASELINE_ULTRA_VOICE,
  },
} as const;

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
}) {
  const voice = opts?.voiceId?.trim() || BASELINE_ULTRA_VOICE;
  const createBody: Record<string, unknown> = {
    name: BASELINE_REQUESTED.name,
    instructions: BASELINE_REQUESTED.instructions,
    greeting: BASELINE_REQUESTED.greeting,
    model: BASELINE_REQUESTED.model,
    transcription: {
      model: BASELINE_REQUESTED.transcription.model,
    },
    voice_settings: {
      voice,
    },
  };

  // Intentionally omitted (Telnyx defaults):
  // tools, interruption_settings, start_speaking_plan, wait_seconds,
  // punctuation waits, eot_threshold / eager_eot_threshold / eot_timeout_ms,
  // dynamic_variables_webhook, mcp, knowledge, memory, external LLM keys.

  const created = await ai.createAssistant(createBody);
  const assistantId = unwrapId(created);
  if (!assistantId) {
    throw new Error(
      `Telnyx createAssistant returned no id: ${JSON.stringify(created).slice(0, 500)}`,
    );
  }

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

  const requested = {
    ...createBody,
    voice_settings: { voice },
  };

  return {
    createBody: requested,
    createResponse: created,
    assistantId,
    activeVersionId,
    live,
    versions,
    diffs: diffRequestedVsLive(requested, live),
    providerInserted: providerInsertedFields(live),
    note:
      "Undocumented timing fields were omitted. Any eot_*/wait_*/endpointing values below were inserted by Telnyx, not by Transovo.",
  };
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
      voiceAgentId: true,
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
