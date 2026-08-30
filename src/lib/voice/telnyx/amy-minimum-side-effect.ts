/**
 * Minimum-side-effect configuration for Amy on Telnyx (866 production).
 * GPT-5.4-mini + Flux balanced STT + narrow live tool surface.
 *
 * Telnyx tuning surface: docs/telnyx-assistant-optimization-surface.md
 * Barge-in = Flux StartOfTurn (vendor). Endpointing = Flux EOT settings.
 * Do not tune eot_threshold aggressively to fix barge-in.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { OPENAI_API_KEY_REF } from "@/lib/voice/telnyx/official-baseline";
import { applyAmyProductionVoiceTuning } from "./amy-production-voice-tuning";
import { applyLatencyProfileToConfig } from "@/lib/voice/latency-profiles";

export const AMY_MINIMUM_SIDE_EFFECT_MODEL = "openai/gpt-5.4-mini";
/** Production Flux profile — balanced EOT (not flux_b_fast lab variant). */
export const AMY_FLUX_PROFILE = "flux_b_balanced";
/** @deprecated Use AMY_FLUX_PROFILE */
export const AMY_FLUX_FAST_PROFILE = AMY_FLUX_PROFILE;

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
    ...applyLatencyProfileToConfig(
      {
        ...tuned,
        enabledBuiltinTools: Array.from(minimalTools),
        advanced: {
          ...(tuned.advanced || {}),
          minimumSideEffectMode: true,
          voiceArchitectureVersion: "telnyx-minimum-side-effect-v1",
        },
      },
      AMY_FLUX_PROFILE,
    ),
    model: {
      ...(tuned.model || {}),
      provider: "telnyx",
      modelId: AMY_MINIMUM_SIDE_EFFECT_MODEL,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: tuned.model?.temperature ?? 0.35,
      maxTokens: tuned.model?.maxTokens ?? 800,
    },
  };
}

export function isMinimumSideEffectMode(config?: VoiceAgentConfig | null): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.minimumSideEffectMode === true;
}
