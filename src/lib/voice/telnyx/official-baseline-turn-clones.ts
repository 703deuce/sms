/**
 * E/F/G/H turn-tuning clones for the Telnyx-direct baseline.
 *
 * A/B/C/D stay LLM-only on the untouched baseline assistant.
 * These four clones keep the same Ultra voice / greeting / prompt / no tools,
 * and only change Flux EOT + start-speaking timing (plus LLM for Kimi).
 *
 *   E = Haiku Fast
 *   F = Haiku Aggressive (experimental)
 *   G = Kimi Fast
 *   H = Kimi Aggressive (experimental)
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import * as ai from "@/lib/voice/telnyx/ai-client";
import {
  BASELINE_SHARED,
  BASELINE_ULTRA_VOICE,
  assistantModelFields,
} from "@/lib/voice/telnyx/official-baseline";

export const UNTOUCHED_BASELINE_ASSISTANT_ID =
  "assistant-f2a573af-dde1-4441-a6f1-846aeccc1020";

export const DEFAULT_TEXML_APP_ID = "3018993788841362850";

export const HAIKU_MODEL_ID = "anthropic/claude-haiku-4-5";
export const KIMI_MODEL_CANDIDATES = [
  "moonshotai/Kimi-K2.6",
  "moonshotai/Kimi-K2.5",
] as const;

export type TurnTimingId = "baseline" | "fast" | "aggressive";
export type TurnCloneProfileId = "E" | "F" | "G" | "H";

export type FluxTurnTiming = {
  eot_threshold: number;
  eager_eot_threshold: number;
  eot_timeout_ms: number;
  wait_seconds: number;
  on_punctuation_seconds: number;
  on_no_punctuation_seconds: number;
  on_number_seconds: number;
};

/** Known-good Telnyx-generated defaults (control). */
export const TURN_TIMING_BASELINE: FluxTurnTiming = {
  eot_threshold: 0.8,
  eager_eot_threshold: 0.8,
  eot_timeout_ms: 5000,
  wait_seconds: 0.1,
  on_punctuation_seconds: 0.1,
  on_no_punctuation_seconds: 0.1,
  on_number_seconds: 0.1,
};

/** Careful latency tuning — only eager EOT changes. */
export const TURN_TIMING_FAST: FluxTurnTiming = {
  eot_threshold: 0.8,
  eager_eot_threshold: 0.4,
  eot_timeout_ms: 5000,
  wait_seconds: 0.1,
  on_punctuation_seconds: 0.1,
  on_no_punctuation_seconds: 0.1,
  on_number_seconds: 0.1,
};

/** Maximum-speed experimental — higher cutoff risk. */
export const TURN_TIMING_AGGRESSIVE: FluxTurnTiming = {
  eot_threshold: 0.7,
  eager_eot_threshold: 0.3,
  eot_timeout_ms: 3000,
  wait_seconds: 0.05,
  on_punctuation_seconds: 0.05,
  on_no_punctuation_seconds: 0.05,
  on_number_seconds: 0.1,
};

export const TURN_CLONE_PROFILES = {
  E: {
    id: "E" as const,
    name: "TELNYX_ULL_HAIKU_FAST",
    label: "Haiku Fast",
    family: "haiku" as const,
    timingId: "fast" as const,
    timing: TURN_TIMING_FAST,
    experimental: false,
    note: "Haiku + eager_eot_threshold 0.4 only. A/B/C/D untouched.",
  },
  F: {
    id: "F" as const,
    name: "TELNYX_ULL_HAIKU_AGGRESSIVE",
    label: "Haiku Aggressive",
    family: "haiku" as const,
    timingId: "aggressive" as const,
    timing: TURN_TIMING_AGGRESSIVE,
    experimental: true,
    note: "Haiku experimental max-speed Flux/start-speaking. Do not auto-promote.",
  },
  G: {
    id: "G" as const,
    name: "TELNYX_ULL_KIMI_FAST",
    label: "Kimi Fast",
    family: "kimi" as const,
    timingId: "fast" as const,
    timing: TURN_TIMING_FAST,
    experimental: false,
    note: "Kimi + eager_eot_threshold 0.4 only. Exact Kimi id from live models.",
  },
  H: {
    id: "H" as const,
    name: "TELNYX_ULL_KIMI_AGGRESSIVE",
    label: "Kimi Aggressive",
    family: "kimi" as const,
    timingId: "aggressive" as const,
    timing: TURN_TIMING_AGGRESSIVE,
    experimental: true,
    note: "Kimi experimental max-speed Flux/start-speaking. Do not auto-promote.",
  },
} as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function unwrapId(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as { id?: string; data?: { id?: string } };
  return String(o.id || o.data?.id || "");
}

function nearlyEqual(a: unknown, b: unknown, eps = 1e-6): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= eps;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function resolveTurnCloneProfileId(
  raw: string | null | undefined,
): TurnCloneProfileId | null {
  const key = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^PROFILE[_-]?/, "")
    .replace(/-/g, "_");
  if (key === "E" || key === "F" || key === "G" || key === "H") return key;
  const aliases: Record<string, TurnCloneProfileId> = {
    HAIKU_FAST: "E",
    HAIKU_AGGRESSIVE: "F",
    HAIKU_AGG: "F",
    KIMI_FAST: "G",
    KIMI_AGGRESSIVE: "H",
    KIMI_AGG: "H",
  };
  return aliases[key] || null;
}

export async function listAvailableLlmModels(): Promise<string[]> {
  const remote = await telnyxRequest("/ai/openai/models");
  const rows = Array.isArray(asRecord(remote)?.data)
    ? (asRecord(remote)!.data as Array<Record<string, unknown>>)
    : Array.isArray(remote)
      ? (remote as Array<Record<string, unknown>>)
      : [];
  return rows
    .map((r) => String(r.id || "").trim())
    .filter(Boolean);
}

/** Prefer live account-supported Kimi id (K2.6 over K2.5). Never guess silently. */
export async function resolveLiveKimiModelId(): Promise<{
  modelId: string;
  availableKimi: string[];
  source: "live_models" | "candidate_probe";
}> {
  let available: string[] = [];
  try {
    available = await listAvailableLlmModels();
  } catch {
    available = [];
  }
  const kimi = available.filter((id) => /moonshotai\/kimi/i.test(id));
  for (const candidate of KIMI_MODEL_CANDIDATES) {
    if (kimi.includes(candidate) || available.includes(candidate)) {
      return {
        modelId: candidate,
        availableKimi: kimi.length ? kimi : [...KIMI_MODEL_CANDIDATES],
        source: "live_models",
      };
    }
  }
  // Fall back to probe order if the models list is empty / filtered.
  return {
    modelId: KIMI_MODEL_CANDIDATES[0],
    availableKimi: kimi.length ? kimi : [...KIMI_MODEL_CANDIDATES],
    source: "candidate_probe",
  };
}

export function buildTurnTuningPatch(input: {
  name: string;
  modelId: string;
  timing: FluxTurnTiming;
  voiceId?: string;
}) {
  const voice = input.voiceId?.trim() || BASELINE_ULTRA_VOICE;
  return {
    name: input.name,
    instructions: BASELINE_SHARED.instructions,
    greeting: BASELINE_SHARED.greeting,
    ...assistantModelFields(input.modelId),
    tools: [],
    dynamic_variables_webhook_url: null,
    transcription: {
      model: "deepgram/flux",
      language: "en",
      settings: {
        eot_threshold: input.timing.eot_threshold,
        eager_eot_threshold: input.timing.eager_eot_threshold,
        eot_timeout_ms: input.timing.eot_timeout_ms,
      },
    },
    voice_settings: {
      voice,
    },
    interruption_settings: {
      enable: true,
      disable_greeting_interruption: false,
      interrupt_prediction_threshold: 0,
      start_speaking_plan: {
        wait_seconds: input.timing.wait_seconds,
        transcription_endpointing_plan: {
          on_punctuation_seconds: input.timing.on_punctuation_seconds,
          on_no_punctuation_seconds: input.timing.on_no_punctuation_seconds,
          on_number_seconds: input.timing.on_number_seconds,
        },
      },
    },
  } as const;
}

export function verifyTurnTuningLive(
  live: Record<string, unknown>,
  expected: {
    modelId: string;
    timing: FluxTurnTiming;
    voiceId?: string;
    name?: string;
  },
) {
  const voice = expected.voiceId || BASELINE_ULTRA_VOICE;
  const transcription = asRecord(live.transcription) || {};
  const settings = asRecord(transcription.settings) || {};
  const interruption = asRecord(live.interruption_settings) || {};
  const plan = asRecord(interruption.start_speaking_plan) || {};
  const endpointing = asRecord(plan.transcription_endpointing_plan) || {};
  const voiceSettings = asRecord(live.voice_settings) || {};

  const checks: Array<{
    path: string;
    expected: unknown;
    live: unknown;
    ok: boolean;
  }> = [];
  const add = (path: string, exp: unknown, got: unknown) => {
    checks.push({
      path,
      expected: exp,
      live: got ?? null,
      ok: nearlyEqual(exp, got),
    });
  };

  if (expected.name) add("name", expected.name, live.name);
  add("model", expected.modelId, live.model);
  add("greeting", BASELINE_SHARED.greeting, live.greeting);
  add("instructions", BASELINE_SHARED.instructions, live.instructions);
  add("voice_settings.voice", voice, voiceSettings.voice);
  add("transcription.model", "deepgram/flux", transcription.model);
  add("eot_threshold", expected.timing.eot_threshold, settings.eot_threshold);
  add(
    "eager_eot_threshold",
    expected.timing.eager_eot_threshold,
    settings.eager_eot_threshold,
  );
  add("eot_timeout_ms", expected.timing.eot_timeout_ms, settings.eot_timeout_ms);
  add("wait_seconds", expected.timing.wait_seconds, plan.wait_seconds);
  add(
    "on_punctuation_seconds",
    expected.timing.on_punctuation_seconds,
    endpointing.on_punctuation_seconds,
  );
  add(
    "on_no_punctuation_seconds",
    expected.timing.on_no_punctuation_seconds,
    endpointing.on_no_punctuation_seconds,
  );
  add(
    "on_number_seconds",
    expected.timing.on_number_seconds,
    endpointing.on_number_seconds,
  );
  add("tools", [], live.tools ?? []);
  add(
    "dynamic_variables_webhook_url",
    null,
    live.dynamic_variables_webhook_url ?? null,
  );

  const failures = checks.filter((c) => !c.ok);
  return {
    ok: failures.length === 0,
    checks,
    failures,
    liveLabel: failures.length === 0 ? "Live" : "Publish mismatch",
  };
}

async function listAssistantsByName(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const remote = await ai.listAssistants({ "page[size]": 100 });
  const rows = Array.isArray(asRecord(remote)?.data)
    ? (asRecord(remote)!.data as Array<Record<string, unknown>>)
    : Array.isArray(remote)
      ? (remote as Array<Record<string, unknown>>)
      : [];
  for (const row of rows) {
    const id = String(row.id || "").trim();
    const name = String(row.name || "").trim();
    if (id && name) map.set(name, id);
  }
  return map;
}

async function findAssistantIdByName(name: string): Promise<string | null> {
  const map = await listAssistantsByName();
  return map.get(name) || null;
}

/**
 * Create or update one E/F/G/H clone from the untouched baseline.
 * Never patches the source baseline assistant's timing.
 */
export async function ensureTurnCloneAssistant(input: {
  profileId: TurnCloneProfileId;
  sourceAssistantId?: string;
  kimiModelId?: string;
  voiceId?: string;
}) {
  const profile = TURN_CLONE_PROFILES[input.profileId];
  const sourceId =
    String(input.sourceAssistantId || UNTOUCHED_BASELINE_ASSISTANT_ID).trim();
  // Guard: never mutate the source baseline assistant id as a clone target.
  if (!sourceId) throw new Error("sourceAssistantId required");

  let kimiResolved: Awaited<ReturnType<typeof resolveLiveKimiModelId>> | null =
    null;
  let modelId = HAIKU_MODEL_ID;
  if (profile.family === "kimi") {
    kimiResolved = input.kimiModelId
      ? {
          modelId: input.kimiModelId,
          availableKimi: [],
          source: "candidate_probe" as const,
        }
      : await resolveLiveKimiModelId();
    modelId = kimiResolved.modelId;
  }

  const patch = buildTurnTuningPatch({
    name: profile.name,
    modelId,
    timing: profile.timing,
    voiceId: input.voiceId,
  });

  let assistantId = await findAssistantIdByName(profile.name);
  let created = false;
  let createResponse: unknown = null;

  if (!assistantId) {
    // Clone from untouched baseline, then apply deliberate timing/model patch.
    const cloned = await ai.cloneAssistant(sourceId, { name: profile.name });
    assistantId = unwrapId(cloned);
    createResponse = cloned;
    created = true;
    if (!assistantId) {
      // Some responses nest under data
      const data = asRecord(cloned)?.data;
      assistantId = unwrapId(data) || String(asRecord(data)?.id || "");
    }
    if (!assistantId) {
      // Re-list by name after clone
      assistantId = (await findAssistantIdByName(profile.name)) || "";
    }
    if (!assistantId) {
      throw new Error(
        `cloneAssistant returned no id for ${profile.name}: ${JSON.stringify(cloned).slice(0, 500)}`,
      );
    }
  }

  if (assistantId === sourceId) {
    throw new Error(
      `Refusing to patch untouched baseline ${sourceId} for profile ${profile.id}`,
    );
  }

  const modelAttempts: Array<{ model: string; ok: boolean; error?: string }> =
    [];
  const tryModels =
    profile.family === "kimi"
      ? [...new Set([modelId, ...KIMI_MODEL_CANDIDATES])]
      : [HAIKU_MODEL_ID];

  let usedModel = "";
  let lastError = "";
  for (const candidate of tryModels) {
    const body = buildTurnTuningPatch({
      name: profile.name,
      modelId: candidate,
      timing: profile.timing,
      voiceId: input.voiceId,
    });
    try {
      // Optional: ask Telnyx to disable Kimi thinking if the field is accepted.
      const withThinking =
        profile.family === "kimi"
          ? { ...body, thinking: { type: "disabled" } }
          : body;
      try {
        await ai.updateAssistant(assistantId, withThinking);
      } catch {
        await ai.updateAssistant(assistantId, body);
      }
      const liveRemote = await ai.getAssistant(assistantId);
      const live = (asRecord(liveRemote)?.data ||
        asRecord(liveRemote) ||
        {}) as Record<string, unknown>;
      const liveModel = String(live.model || "");
      if (liveModel && liveModel !== candidate) {
        modelAttempts.push({
          model: candidate,
          ok: false,
          error: `Telnyx kept model "${liveModel}" after requesting "${candidate}"`,
        });
        lastError = modelAttempts[modelAttempts.length - 1]!.error!;
        continue;
      }
      modelAttempts.push({ model: candidate, ok: true });
      usedModel = candidate;
      const verification = verifyTurnTuningLive(live, {
        modelId: candidate,
        timing: profile.timing,
        voiceId: input.voiceId,
        name: profile.name,
      });
      if (!verification.ok) {
        throw new Error(
          `Hard publish failure for ${profile.id}: ${JSON.stringify(verification.failures)}`,
        );
      }
      return {
        profileId: profile.id,
        profile,
        assistantId,
        sourceAssistantId: sourceId,
        created,
        createResponse,
        usedModel,
        kimi: kimiResolved,
        requested: body,
        live,
        verification,
        modelAttempts,
        untouchedBaselinePreserved: true,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      modelAttempts.push({ model: candidate, ok: false, error: lastError });
    }
  }

  throw new Error(
    `ensureTurnCloneAssistant(${profile.id}) failed: ${lastError || JSON.stringify(modelAttempts)}`,
  );
}

export async function ensureAllTurnCloneAssistants(input?: {
  sourceAssistantId?: string;
  voiceId?: string;
}) {
  const kimi = await resolveLiveKimiModelId();
  const results: Array<Awaited<ReturnType<typeof ensureTurnCloneAssistant>>> =
    [];
  for (const id of ["E", "F", "G", "H"] as TurnCloneProfileId[]) {
    results.push(
      await ensureTurnCloneAssistant({
        profileId: id,
        sourceAssistantId: input?.sourceAssistantId,
        voiceId: input?.voiceId,
        kimiModelId: kimi.modelId,
      }),
    );
  }
  return {
    kimi,
    clones: results,
    untouchedBaselineId:
      input?.sourceAssistantId || UNTOUCHED_BASELINE_ASSISTANT_ID,
  };
}

/** Point phone at a specific assistant via TeXML (direct Telnyx route). */
export async function routeTexmlToAssistant(input: {
  e164?: string;
  assistantId: string;
  texmlAppId?: string;
  providerNumberId?: string;
}) {
  const assistantId = String(input.assistantId || "").trim();
  if (!assistantId) throw new Error("assistantId required");
  const e164 = String(input.e164 || "+18663464256").trim();
  const preferredTexmlAppId = String(
    input.texmlAppId || DEFAULT_TEXML_APP_ID,
  ).trim();

  let providerNumberId = input.providerNumberId
    ? String(input.providerNumberId)
    : "";
  if (!providerNumberId) {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": e164, "page[size]": 5 } },
    );
    const rows = Array.isArray(listed.data) ? listed.data : [];
    providerNumberId = String(rows[0]?.id || "");
  }
  if (!providerNumberId) {
    throw new Error(`Phone ${e164} missing providerNumberId`);
  }

  const voiceUrl = `https://api.telnyx.com/v2/ai/assistants/${assistantId}/call`;
  let texmlAppId = preferredTexmlAppId;
  let patchedExisting = false;

  // Try updating the shared TeXML app first.
  try {
    await telnyxRequest(
      `/texml_applications/${encodeURIComponent(preferredTexmlAppId)}`,
      {
        method: "PATCH",
        body: {
          ai_assistant_id: assistantId,
          voice_url: voiceUrl,
          voice_method: "POST",
          active: true,
        },
      },
    );
    patchedExisting = true;
  } catch {
    patchedExisting = false;
  }

  // Verify whether the existing app now points at this assistant.
  let voiceUrlLive = "";
  if (patchedExisting) {
    const texmlLive = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/texml_applications/${encodeURIComponent(preferredTexmlAppId)}`,
    ).catch(() => null);
    const texmlData = asRecord(texmlLive?.data) || asRecord(texmlLive) || {};
    voiceUrlLive = String(texmlData.voice_url || "");
  }

  if (!voiceUrlLive.includes(assistantId)) {
    // Create a dedicated TeXML app for this assistant (proven path).
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const texmlRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
      "/texml_applications",
      {
        method: "POST",
        body: {
          friendly_name: `ULL ${assistantId.slice(-8)} ${stamp}`.slice(0, 60),
          active: true,
          ai_assistant_id: assistantId,
          voice_url: voiceUrl,
          voice_method: "POST",
        },
      },
    );
    const created = asRecord(texmlRes.data) || asRecord(texmlRes) || {};
    texmlAppId = String(created.id || "");
    if (!texmlAppId) {
      throw new Error(
        `TeXML create returned no id: ${JSON.stringify(texmlRes).slice(0, 500)}`,
      );
    }
    voiceUrlLive = String(created.voice_url || voiceUrl);
  } else {
    texmlAppId = preferredTexmlAppId;
  }

  await ai
    .updateAssistant(assistantId, {
      telephony_settings: {
        default_texml_app_id: texmlAppId,
      },
    })
    .catch(() => undefined);

  await telnyxRequest(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
    {
      method: "PATCH",
      body: { connection_id: texmlAppId },
    },
  );

  const phoneVerify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId = String(
    (asRecord(phoneVerify.data) || asRecord(phoneVerify) || {}).connection_id ||
      "",
  ) || null;

  const matched =
    voiceUrlLive.includes(assistantId) && liveConnectionId === texmlAppId;

  return {
    e164,
    assistantId,
    texmlAppId,
    providerNumberId,
    liveConnectionId,
    voiceUrl: voiceUrlLive || voiceUrl,
    matched,
    path: `${e164} → TeXML ${texmlAppId} → assistant ${assistantId}`,
  };
}

/**
 * Ensure clone + route + verify. Does not modify A/B/C/D baseline timing.
 */
export async function switchToTurnCloneProfile(input: {
  profileId: TurnCloneProfileId;
  sourceAssistantId?: string;
  texmlAppId?: string;
  e164?: string;
  voiceId?: string;
}) {
  const ensured = await ensureTurnCloneAssistant({
    profileId: input.profileId,
    sourceAssistantId: input.sourceAssistantId,
    voiceId: input.voiceId,
  });
  const route = await routeTexmlToAssistant({
    assistantId: ensured.assistantId,
    texmlAppId: input.texmlAppId,
    e164: input.e164,
  });
  if (!route.matched || !ensured.verification.ok) {
    throw new Error(
      `Profile ${input.profileId} not Live: route=${JSON.stringify(route)} verify=${JSON.stringify(ensured.verification.failures)}`,
    );
  }
  return {
    ...ensured,
    route,
    liveStatus: "Live" as const,
    routingStrategy: "texml_create_fallback",
  };
}
