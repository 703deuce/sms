/**
 * Test Ultra / voice_settings against Telnyx without mutating the production assistant.
 *
 * Flow: create disposable probe assistant → apply voice_settings → read back → delete.
 */

import * as ai from "@/lib/voice/telnyx/ai-client";
import { TelnyxApiError } from "@/lib/voice/telnyx/ai-client";
import {
  buildAssistantVoiceSettings,
  DOCUMENTED_ULTRA_VOICES,
  FALLBACK_PROVIDER_VOICE_ID,
  logVoiceAssistantUpdate,
  sanitizeTelnyxVoiceError,
  validateUltraProviderVoiceId,
} from "@/lib/voice/telnyx/voices";
import {
  resolveElevenLabsParts,
  validateElevenLabsBeforePatch,
} from "@/lib/voice/elevenlabs/voice-settings";

/** Verified Assistants Ultra UUID (short names like Telnyx.Ultra.Clara fail with 10015). */
const ULTRA_CLARA = DOCUMENTED_ULTRA_VOICES[0].providerVoiceId;
const ULTRA_CALLIE = DOCUMENTED_ULTRA_VOICES[1].providerVoiceId;
const ULTRA_ASHER = DOCUMENTED_ULTRA_VOICES[2].providerVoiceId;
const ULTRA_CINDY = DOCUMENTED_ULTRA_VOICES[3].providerVoiceId;

function unwrapId(res: unknown): string | null {
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

export type VoiceProbeAttempt = {
  label: string;
  method: "create" | "patch_via_updateAssistant";
  request: {
    voice_settings: Record<string, unknown>;
  };
  ok: boolean;
  status: number | null;
  code: string | null;
  message: string | null;
  remoteVoice: string | null;
  remoteExpressive: boolean | null;
  errorBody: unknown;
};

export async function probeTelnyxAssistantVoices(input?: {
  voices?: Array<{ voice: string; expressiveMode?: boolean; label?: string }>;
}) {
  if (!ai.isTelnyxAiConfigured()) {
    throw new Error("TELNYX_API_KEY not configured");
  }

  const stamp = Date.now().toString(36);
  const created = await ai.createAssistant({
    name: `Ultra Voice Probe ${stamp}`,
    instructions: "You are a brief test receptionist. Keep replies under one sentence.",
    greeting: "Hi, this is a Transovo voice probe.",
    voice_settings: { voice: FALLBACK_PROVIDER_VOICE_ID },
  });
  const assistantId = unwrapId(created);
  if (!assistantId) {
    throw new Error("Probe assistant create returned no id");
  }

  const attemptsSpec =
    input?.voices?.length
      ? input.voices
      : [
          {
            label: "baseline_naturalhd",
            voice: FALLBACK_PROVIDER_VOICE_ID,
            expressiveMode: false,
          },
          {
            label: "ultra_clara_expressive_off",
            voice: ULTRA_CLARA,
            expressiveMode: false,
          },
          {
            label: "ultra_clara_expressive_on",
            voice: ULTRA_CLARA,
            expressiveMode: true,
          },
          {
            label: "ultra_callie_expressive_on",
            voice: ULTRA_CALLIE,
            expressiveMode: true,
          },
          {
            label: "ultra_asher_expressive_on",
            voice: ULTRA_ASHER,
            expressiveMode: true,
          },
          {
            label: "ultra_cindy_expressive_on",
            voice: ULTRA_CINDY,
            expressiveMode: true,
          },
          // Regression: short names must still fail at Telnyx (or be remapped by resolve).
          {
            label: "legacy_short_clara_should_resolve_or_fail",
            voice: "Telnyx.Ultra.Clara",
            expressiveMode: true,
          },
        ];

  const attempts: VoiceProbeAttempt[] = [];

  try {
    for (const spec of attemptsSpec) {
      const label = spec.label || spec.voice;
      if (spec.voice.startsWith("Telnyx.Ultra.")) {
        const check = validateUltraProviderVoiceId(spec.voice);
        if (!check.ok) {
          attempts.push({
            label,
            method: "patch_via_updateAssistant",
            request: { voice_settings: { voice: spec.voice } },
            ok: false,
            status: 400,
            code: "local_validation",
            message: check.error || "Invalid Ultra voice",
            remoteVoice: null,
            remoteExpressive: null,
            errorBody: null,
          });
          continue;
        }
      }

      const built = buildAssistantVoiceSettings({
        voiceRef: spec.voice,
        expressiveMode: Boolean(spec.expressiveMode),
      });

      try {
        await ai.updateAssistant(assistantId, {
          voice_settings: built.voice_settings,
        });
        logVoiceAssistantUpdate({
          assistantId,
          requestedVoice: built.providerVoiceId,
          expressiveMode: built.expressiveMode,
          status: "ok",
        });

        const remote = await ai.getAssistant(assistantId);
        const remoteObj = (remote as { data?: Record<string, unknown> } | Record<string, unknown>)
          ?.data
          ? ((remote as { data: Record<string, unknown> }).data as Record<string, unknown>)
          : (remote as Record<string, unknown>);
        const vs = (remoteObj?.voice_settings || {}) as Record<string, unknown>;

        attempts.push({
          label,
          method: "patch_via_updateAssistant",
          request: { voice_settings: built.voice_settings },
          ok: true,
          status: 200,
          code: null,
          message: null,
          remoteVoice: vs.voice != null ? String(vs.voice) : null,
          remoteExpressive:
            typeof vs.expressive_mode === "boolean" ? vs.expressive_mode : null,
          errorBody: null,
        });
      } catch (err) {
        const sanitized = sanitizeTelnyxVoiceError(err);
        logVoiceAssistantUpdate({
          assistantId,
          requestedVoice: built.providerVoiceId,
          expressiveMode: built.expressiveMode,
          status: sanitized.status ?? "error",
          errorBody: sanitized.body ?? sanitized.message,
        });
        attempts.push({
          label,
          method: "patch_via_updateAssistant",
          request: { voice_settings: built.voice_settings },
          ok: false,
          status: sanitized.status,
          code: sanitized.code,
          message: sanitized.message,
          remoteVoice: null,
          remoteExpressive: null,
          errorBody: sanitized.body,
        });
      }
    }
  } finally {
    await ai.deleteAssistant(assistantId).catch(() => undefined);
  }

  const anyUltraOk = attempts.some(
    (a) => a.ok && String(a.request.voice_settings.voice || "").startsWith("Telnyx.Ultra."),
  );

  return {
    probeAssistantId: assistantId,
    deleted: true,
    anyUltraOk,
    previousPayloadShape: {
      note: "Prior production payload used NaturalHD after Ultra remap",
      voice_settings: { voice: "Telnyx.NaturalHD.astra" },
    },
    newUltraPayloadShape: {
      voice_settings: {
        voice: ULTRA_CLARA,
        expressive_mode: true,
      },
    },
    attempts,
  };
}

/**
 * Apply a voice to a disposable clone of an existing assistant (test-before-prod).
 * Does not modify the production assistant id.
 */
export async function testVoiceOnClone(input: {
  sourceAssistantId: string;
  voiceRef: string;
  expressiveMode?: boolean;
  apiKeyRef?: string;
  includeElevenLabsTuning?: boolean;
}) {
  if (!ai.isTelnyxAiConfigured()) {
    throw new Error("TELNYX_API_KEY not configured");
  }
  if (!input.sourceAssistantId) {
    throw new Error("assistant_id is required");
  }

  const isEl =
    String(input.voiceRef || "").startsWith("el:") ||
    String(input.voiceRef || "").startsWith("ElevenLabs.");

  let apiKeyRef = input.apiKeyRef || null;
  if (isEl) {
    const { ensureElevenLabsTelnyxSecret } = await import(
      "@/lib/voice/elevenlabs/telnyx-secret"
    );
    const ensured = await ensureElevenLabsTelnyxSecret();
    apiKeyRef = ensured.apiKeyRef;
  }

  const built = buildAssistantVoiceSettings({
    voiceRef: input.voiceRef,
    expressiveMode: input.expressiveMode,
    apiKeyRef,
    includeElevenLabsTuning: Boolean(input.includeElevenLabsTuning),
  });

  const validation = isEl
    ? (() => {
        const parts = resolveElevenLabsParts({ voiceRef: input.voiceRef });
        return validateElevenLabsBeforePatch({
          assistantId: input.sourceAssistantId,
          apiKeyRef: built.apiKeyRef,
          modelId: parts.modelId,
          voiceId: parts.voiceId,
          providerVoiceId: built.providerVoiceId,
        });
      })()
    : { ok: true as const };

  if (!validation.ok) {
    return {
      ok: false as const,
      productionAssistantId: input.sourceAssistantId,
      testAssistantId: null,
      requested: built.voice_settings,
      productionUnchanged: true,
      error: {
        message: validation.error,
        status: 400,
        code: "local_validation",
        body: null,
      },
    };
  }

  const cloned = await ai.cloneAssistant(input.sourceAssistantId, {
    name: `Voice test ${Date.now().toString(36)}`,
  });
  const cloneId = unwrapId(cloned);
  if (!cloneId) {
    throw new Error("Clone assistant returned no id");
  }

  try {
    await ai.updateAssistant(cloneId, { voice_settings: built.voice_settings });
    logVoiceAssistantUpdate({
      assistantId: cloneId,
      requestedVoice: built.providerVoiceId,
      expressiveMode: built.expressiveMode,
      status: "ok",
    });
    const remote = await ai.getAssistant(cloneId);
    const remoteObj = (remote as { data?: Record<string, unknown> } | Record<string, unknown>)
      ?.data
      ? ((remote as { data: Record<string, unknown> }).data as Record<string, unknown>)
      : (remote as Record<string, unknown>);
    const vs = (remoteObj?.voice_settings || {}) as Record<string, unknown>;
    const remoteVoice = vs.voice != null ? String(vs.voice) : null;
    const readBackMatch = remoteVoice === built.providerVoiceId;
    if (!readBackMatch) {
      await ai.deleteAssistant(cloneId).catch(() => undefined);
      return {
        ok: false as const,
        productionAssistantId: input.sourceAssistantId,
        testAssistantId: cloneId,
        requested: built.voice_settings,
        productionUnchanged: true,
        error: {
          message: `Read-back mismatch: requested ${built.providerVoiceId}, remote ${remoteVoice}`,
          status: 422,
          code: "read_back_mismatch",
          body: { remoteVoiceSettings: { voice: remoteVoice, api_key_ref: Boolean(vs.api_key_ref) } },
        },
      };
    }
    return {
      ok: true as const,
      productionAssistantId: input.sourceAssistantId,
      testAssistantId: cloneId,
      requested: built.voice_settings,
      remoteVoice,
      remoteExpressive:
        typeof vs.expressive_mode === "boolean" ? vs.expressive_mode : null,
      remoteApiKeyRefPresent: Boolean(vs.api_key_ref),
      readBackMatch: true,
      productionUnchanged: true,
    };
  } catch (err) {
    const sanitized = sanitizeTelnyxVoiceError(err);
    logVoiceAssistantUpdate({
      assistantId: cloneId,
      requestedVoice: built.providerVoiceId,
      expressiveMode: built.expressiveMode,
      status: sanitized.status ?? "error",
      errorBody: sanitized.body ?? sanitized.message,
    });
    await ai.deleteAssistant(cloneId).catch(() => undefined);
    return {
      ok: false as const,
      productionAssistantId: input.sourceAssistantId,
      testAssistantId: cloneId,
      requested: built.voice_settings,
      productionUnchanged: true,
      error: sanitized,
    };
  }
}

export function isTelnyxVoiceApiError(err: unknown): err is TelnyxApiError {
  return err instanceof TelnyxApiError;
}
