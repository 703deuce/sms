/**
 * Minimum-side-effect configuration for Amy on Telnyx (866 production).
 * GPT-5.4-mini + Flux fast STT + narrow live tool surface.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { OPENAI_API_KEY_REF } from "@/lib/voice/telnyx/official-baseline";
import { applyAmyProductionVoiceTuning } from "./amy-production-voice-tuning";

export const AMY_MINIMUM_SIDE_EFFECT_MODEL = "openai/gpt-5.4-mini";
export const AMY_FLUX_FAST_PROFILE = "flux_b_fast";

export const MINIMUM_SIDE_EFFECT_PROMPT = [
  "MINIMUM-SIDE-EFFECT RELIABILITY:",
  "1. Answer company questions from the Business knowledge section — zero tools.",
  "2. Capture caller information with record_call_fact — local only, no CRM during the call.",
  "3. For booking, quotes, financing, or forms: offer to text a link via send_sms with template_id (booking_link, quote_link, financing_link). Do not run live calendar booking on the phone.",
  "4. Transfer only when the caller needs a person — escalate_human.",
  "5. Target 0–2 live external tool calls per ordinary call.",
  "6. Confirm SMS only after send_sms returns success.",
  "7. CRM, tags, notes, and follow-up workflows happen after the call — never during.",
].join("\n");

export function applyAmyMinimumSideEffectConfig(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const tuned = applyAmyProductionVoiceTuning(config);
  const minimalTools = new Set([
    "hangup",
    "end_call",
    "send_sms",
    "record_call_fact",
    "take_structured_message",
    "lookup_customer",
    "escalate_human",
    "transfer",
  ]);

  return {
    ...tuned,
    model: {
      ...(tuned.model || {}),
      provider: "telnyx",
      modelId: AMY_MINIMUM_SIDE_EFFECT_MODEL,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: tuned.model?.temperature ?? 0.35,
      maxTokens: tuned.model?.maxTokens ?? 800,
    },
    voiceTiming: {
      ...(tuned.voiceTiming || {}),
      activeProfile: AMY_FLUX_FAST_PROFILE,
    },
    transcription: {
      ...(tuned.transcription || {}),
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/flux",
      settings: {
        eot_threshold: 0.75,
        eager_eot_threshold: 0.35,
        eot_timeout_ms: 4500,
      },
    },
    enabledBuiltinTools: Array.from(minimalTools),
    advanced: {
      ...(tuned.advanced || {}),
      minimumSideEffectMode: true,
      voiceArchitectureVersion: "telnyx-minimum-side-effect-v1",
    },
  };
}

export function isMinimumSideEffectMode(config?: VoiceAgentConfig | null): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.minimumSideEffectMode === true;
}
