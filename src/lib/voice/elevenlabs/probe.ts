/**
 * Discover ElevenLabs voices/models and probe Telnyx Assistants compatibility.
 * Never mutates the production assistant — uses a disposable clone / probe.
 */

import * as ai from "@/lib/voice/telnyx/ai-client";
import {
  listElevenLabsModels,
  listElevenLabsVoices,
  type ElevenLabsModelInfo,
  type ElevenLabsVoiceInfo,
} from "@/lib/voice/elevenlabs/client";
import {
  ELEVENLABS_CANDIDATE_MODELS,
  ELEVENLABS_SECRET_IDENTIFIER,
  buildElevenLabsProviderVoice,
  catalogIdForElevenLabs,
  getCandidateModel,
  type ElevenLabsCandidateModelId,
} from "@/lib/voice/elevenlabs/models";
import {
  ensureElevenLabsTelnyxSecret,
  getElevenLabsSecretStatus,
} from "@/lib/voice/elevenlabs/telnyx-secret";
import {
  buildElevenLabsVoiceSettings,
  validateElevenLabsBeforePatch,
} from "@/lib/voice/elevenlabs/voice-settings";
import {
  FALLBACK_PROVIDER_VOICE_ID,
  logVoiceAssistantUpdate,
  sanitizeTelnyxVoiceError,
  type TelnyxVoiceOption,
} from "@/lib/voice/telnyx/voices";

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

function remoteVoiceSettings(remote: unknown): Record<string, unknown> {
  const remoteObj = (remote as { data?: Record<string, unknown> } | Record<string, unknown>)
    ?.data
    ? ((remote as { data: Record<string, unknown> }).data as Record<string, unknown>)
    : (remote as Record<string, unknown>);
  return (remoteObj?.voice_settings || {}) as Record<string, unknown>;
}

export type ElevenLabsCompatibilityAttempt = {
  label: string;
  modelId: string;
  voiceId: string;
  providerVoice: string;
  availableOnElevenLabs: boolean;
  request: { voice_settings: Record<string, unknown> };
  ok: boolean;
  status: number | null;
  code: string | null;
  title: string | null;
  message: string | null;
  sourcePointer: string | null;
  requestId: string | null;
  remoteVoice: string | null;
  remoteApiKeyRefPresent: boolean;
  readBackMatch: boolean;
  badge: "available" | "telnyx_accepted" | "telnyx_rejected" | "not_on_account";
  errorBody: unknown;
};

function extractErrorMeta(body: unknown): {
  code: string | null;
  title: string | null;
  detail: string | null;
  sourcePointer: string | null;
  requestId: string | null;
} {
  if (!body || typeof body !== "object") {
    return { code: null, title: null, detail: null, sourcePointer: null, requestId: null };
  }
  const errors = (body as { errors?: Array<Record<string, unknown>> }).errors;
  const first = Array.isArray(errors) ? errors[0] : null;
  const source = first?.source as { pointer?: string } | undefined;
  const meta = (body as { meta?: { request_id?: string } }).meta;
  return {
    code: first?.code != null ? String(first.code) : null,
    title: first?.title != null ? String(first.title) : null,
    detail: first?.detail != null ? String(first.detail) : null,
    sourcePointer: source?.pointer != null ? String(source.pointer) : null,
    requestId: meta?.request_id != null ? String(meta.request_id) : null,
  };
}

export async function discoverElevenLabsCatalog(input?: {
  voiceLimit?: number;
}): Promise<{
  secret: Awaited<ReturnType<typeof getElevenLabsSecretStatus>>;
  models: ElevenLabsModelInfo[];
  ttsModels: ElevenLabsModelInfo[];
  voices: ElevenLabsVoiceInfo[];
  candidateModels: Array<{
    modelId: string;
    onAccount: boolean;
    canDoTts: boolean;
    capabilities: ElevenLabsModelInfo | null;
  }>;
  pickerVoices: TelnyxVoiceOption[];
}> {
  const secret = await getElevenLabsSecretStatus();
  if (!secret.configuredEnv) {
    return {
      secret,
      models: [],
      ttsModels: [],
      voices: [],
      candidateModels: ELEVENLABS_CANDIDATE_MODELS.map((m) => ({
        modelId: m.modelId,
        onAccount: false,
        canDoTts: false,
        capabilities: null,
      })),
      pickerVoices: [],
    };
  }

  const [models, voices] = await Promise.all([
    listElevenLabsModels(),
    listElevenLabsVoices(),
  ]);
  const ttsModels = models.filter((m) => m.can_do_text_to_speech);
  const byId = new Map(ttsModels.map((m) => [m.model_id, m]));
  const candidateModels = ELEVENLABS_CANDIDATE_MODELS.map((m) => {
    const caps = byId.get(m.modelId) || null;
    return {
      modelId: m.modelId,
      onAccount: Boolean(caps),
      canDoTts: Boolean(caps?.can_do_text_to_speech),
      capabilities: caps,
    };
  });

  const limit = Math.max(1, Math.min(40, input?.voiceLimit ?? 12));
  const selectedVoices = voices.slice(0, limit);
  const pickerVoices: TelnyxVoiceOption[] = [];
  for (const voice of selectedVoices) {
    for (const cand of ELEVENLABS_CANDIDATE_MODELS) {
      const onAccount = candidateModels.find((c) => c.modelId === cand.modelId)?.onAccount;
      const providerVoiceId = buildElevenLabsProviderVoice(cand.modelId, voice.voice_id);
      const genderLabel = String(voice.labels?.gender || "").toLowerCase();
      const gender =
        genderLabel.includes("female") || genderLabel === "f"
          ? ("female" as const)
          : genderLabel.includes("male") || genderLabel === "m"
            ? ("male" as const)
            : ("neutral" as const);
      pickerVoices.push({
        id: catalogIdForElevenLabs(cand.modelId, voice.voice_id),
        name: voice.name,
        gender,
        tier: "elevenlabs",
        uiTier: cand.uiTier,
        uiTierLabel: cand.uiTierLabel,
        language: voice.labels?.accent || voice.labels?.language || "en",
        description: [
          cand.shortLabel,
          voice.category,
          voice.description || voice.labels?.description || voice.labels?.use_case,
        ]
          .filter(Boolean)
          .join(" · "),
        providerVoiceId,
        supportsSpeed: true,
        supportsExpressive: false,
        assistantCompatible: Boolean(onAccount),
        previewOnly: !onAccount,
        elevenLabsModelId: cand.modelId,
        elevenLabsVoiceId: voice.voice_id,
        previewUrl: voice.preview_url,
        compatibility: onAccount ? "available" : "not_on_account",
      });
    }
  }

  return {
    secret,
    models,
    ttsModels,
    voices,
    candidateModels,
    pickerVoices,
  };
}

/**
 * Probe Flash / Multilingual v2 / v3 on a disposable Telnyx assistant clone.
 * Starts with voice + api_key_ref only (no tuning).
 */
export async function probeElevenLabsOnTelnyx(input: {
  sourceAssistantId: string;
  voiceId: string;
  models?: ElevenLabsCandidateModelId[];
  includeTuning?: boolean;
}) {
  if (!ai.isTelnyxAiConfigured()) {
    throw new Error("TELNYX_API_KEY not configured");
  }
  if (!input.sourceAssistantId) {
    throw new Error("assistant_id is required");
  }
  if (!input.voiceId) {
    throw new Error("ElevenLabs voice_id is required");
  }

  const ensured = await ensureElevenLabsTelnyxSecret();
  const discovery = await discoverElevenLabsCatalog({ voiceLimit: 50 });
  const voiceOk = discovery.voices.some((v) => v.voice_id === input.voiceId);
  if (!voiceOk) {
    throw new Error(
      `Voice ${input.voiceId} was not returned by ElevenLabs /v1/voices for this account`,
    );
  }

  const modelsToTest =
    input.models?.length
      ? input.models
      : (ELEVENLABS_CANDIDATE_MODELS.map((m) => m.modelId) as ElevenLabsCandidateModelId[]);

  const cloned = await ai.cloneAssistant(input.sourceAssistantId, {
    name: `EL voice probe ${Date.now().toString(36)}`,
  });
  const cloneId = unwrapId(cloned);
  if (!cloneId) throw new Error("Clone assistant returned no id");

  const attempts: ElevenLabsCompatibilityAttempt[] = [];

  try {
    // Baseline NaturalHD still works on the clone
    await ai.updateAssistant(cloneId, {
      voice_settings: { voice: FALLBACK_PROVIDER_VOICE_ID },
    });

    for (const modelId of modelsToTest) {
      const cand = getCandidateModel(modelId);
      const onAccount = discovery.candidateModels.find((c) => c.modelId === modelId);
      const providerVoice = buildElevenLabsProviderVoice(modelId, input.voiceId);
      const caps = onAccount?.capabilities || null;

      if (!onAccount?.onAccount || !onAccount.canDoTts) {
        attempts.push({
          label: `${modelId}_not_on_account`,
          modelId,
          voiceId: input.voiceId,
          providerVoice,
          availableOnElevenLabs: false,
          request: { voice_settings: {} },
          ok: false,
          status: null,
          code: "not_on_elevenlabs_account",
          title: "Not available on account",
          message: `${modelId} was not returned by ElevenLabs /v1/models with can_do_text_to_speech`,
          sourcePointer: null,
          requestId: null,
          remoteVoice: null,
          remoteApiKeyRefPresent: false,
          readBackMatch: false,
          badge: "not_on_account",
          errorBody: null,
        });
        continue;
      }

      const built = buildElevenLabsVoiceSettings({
        modelId,
        voiceId: input.voiceId,
        apiKeyRef: ensured.apiKeyRef || ELEVENLABS_SECRET_IDENTIFIER,
        includeTuning: Boolean(input.includeTuning),
        modelCapabilities: caps
          ? {
              can_use_style: caps.can_use_style,
              can_use_speaker_boost: caps.can_use_speaker_boost,
            }
          : null,
      });

      const validation = validateElevenLabsBeforePatch({
        assistantId: cloneId,
        apiKeyRef: built.apiKeyRef,
        modelId,
        voiceId: input.voiceId,
        providerVoiceId: built.providerVoiceId,
      });
      if (!validation.ok) {
        attempts.push({
          label: `${modelId}_local_validation`,
          modelId,
          voiceId: input.voiceId,
          providerVoice,
          availableOnElevenLabs: true,
          request: { voice_settings: built.voice_settings },
          ok: false,
          status: 400,
          code: "local_validation",
          title: "Validation failed",
          message: validation.error,
          sourcePointer: null,
          requestId: null,
          remoteVoice: null,
          remoteApiKeyRefPresent: false,
          readBackMatch: false,
          badge: "telnyx_rejected",
          errorBody: null,
        });
        continue;
      }

      try {
        await ai.updateAssistant(cloneId, { voice_settings: built.voice_settings });
        logVoiceAssistantUpdate({
          assistantId: cloneId,
          requestedVoice: built.providerVoiceId,
          expressiveMode: false,
          status: "ok",
        });
        const remote = await ai.getAssistant(cloneId);
        const vs = remoteVoiceSettings(remote);
        const remoteVoice = vs.voice != null ? String(vs.voice) : null;
        const remoteApiKeyRefPresent = Boolean(vs.api_key_ref);
        const readBackMatch =
          remoteVoice === built.providerVoiceId && remoteApiKeyRefPresent;
        attempts.push({
          label: `${cand?.shortLabel || modelId}_basic`,
          modelId,
          voiceId: input.voiceId,
          providerVoice: built.providerVoiceId,
          availableOnElevenLabs: true,
          request: { voice_settings: built.voice_settings },
          ok: readBackMatch,
          status: 200,
          code: null,
          title: null,
          message: readBackMatch ? null : "Read-back did not match requested voice/api_key_ref",
          sourcePointer: null,
          requestId: null,
          remoteVoice,
          remoteApiKeyRefPresent,
          readBackMatch,
          badge: readBackMatch ? "telnyx_accepted" : "telnyx_rejected",
          errorBody: null,
        });
      } catch (err) {
        const sanitized = sanitizeTelnyxVoiceError(err);
        const meta = extractErrorMeta(sanitized.body);
        logVoiceAssistantUpdate({
          assistantId: cloneId,
          requestedVoice: built.providerVoiceId,
          expressiveMode: false,
          status: sanitized.status ?? "error",
          errorBody: sanitized.body ?? sanitized.message,
        });
        attempts.push({
          label: `${cand?.shortLabel || modelId}_rejected`,
          modelId,
          voiceId: input.voiceId,
          providerVoice: built.providerVoiceId,
          availableOnElevenLabs: true,
          request: { voice_settings: built.voice_settings },
          ok: false,
          status: sanitized.status,
          code: sanitized.code || meta.code,
          title: meta.title,
          message:
            meta.detail ||
            sanitized.message ||
            "Available from ElevenLabs but not accepted by Telnyx AI Assistants",
          sourcePointer: meta.sourcePointer,
          requestId: meta.requestId,
          remoteVoice: null,
          remoteApiKeyRefPresent: false,
          readBackMatch: false,
          badge: "telnyx_rejected",
          errorBody: sanitized.body,
        });
      }
    }
  } finally {
    await ai.deleteAssistant(cloneId).catch(() => undefined);
  }

  return {
    productionAssistantId: input.sourceAssistantId,
    testAssistantId: cloneId,
    deleted: true,
    apiKeyRef: ensured.apiKeyRef,
    voiceId: input.voiceId,
    modelsFromElevenLabs: discovery.ttsModels.map((m) => ({
      model_id: m.model_id,
      name: m.name,
      can_do_text_to_speech: m.can_do_text_to_speech,
      can_use_style: m.can_use_style,
      can_use_speaker_boost: m.can_use_speaker_boost,
      serves_pro_voices: m.serves_pro_voices,
    })),
    attempts,
    acceptedByTelnyx: attempts.filter((a) => a.badge === "telnyx_accepted").map((a) => a.modelId),
    rejectedByTelnyx: attempts.filter((a) => a.badge === "telnyx_rejected").map((a) => a.modelId),
    payloads: {
      telnyxUltra: {
        voice_settings: {
          voice: "Telnyx.Ultra.01eaafa9-308a-4276-a017-6ab0cf061b1f",
          expressive_mode: true,
        },
      },
      elevenLabsFlash: {
        voice_settings: {
          voice: buildElevenLabsProviderVoice("eleven_flash_v2_5", input.voiceId),
          api_key_ref: ensured.apiKeyRef,
        },
      },
      elevenLabsMultilingualV2: {
        voice_settings: {
          voice: buildElevenLabsProviderVoice("eleven_multilingual_v2", input.voiceId),
          api_key_ref: ensured.apiKeyRef,
        },
      },
      elevenLabsV3: {
        voice_settings: {
          voice: buildElevenLabsProviderVoice("eleven_v3", input.voiceId),
          api_key_ref: ensured.apiKeyRef,
        },
      },
    },
  };
}
