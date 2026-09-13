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
import { isConversationWorkflowMode } from "@/lib/voice/workflow-engine/tool-publish";

export const AMY_MINIMUM_SIDE_EFFECT_MODEL = "openai/gpt-5.4-mini";
/** Production Flux profile — balanced EOT (not flux_b_fast lab variant). */
export const AMY_FLUX_PROFILE = "flux_b_balanced";
/** @deprecated Use AMY_FLUX_PROFILE */
export const AMY_FLUX_FAST_PROFILE = AMY_FLUX_PROFILE;

export const MINIMUM_SIDE_EFFECT_PROMPT = [
  "MINIMUM-SIDE-EFFECT RELIABILITY:",
  "1. Answer company questions from the Business knowledge section — zero tools.",
  "2. Capture caller information conversationally — software saves it; do not call record_call_fact.",
  "3. For booking links, quotes, financing, or forms: use send_resource with resource_type and verbal_sms_consent after the caller agrees to text.",
  "4. Transfer only when the caller needs a person — use native Transfer in the Human node.",
  "5. Target 0–1 live external tool calls per ordinary turn.",
  "6. Confirm SMS only after send_resource returns success.",
  "7. CRM, tags, notes, and follow-up workflows happen after the call — never during.",
].join("\n");

export const CONVERSATION_WORKFLOW_PROMPT = [
  "TELNYX CONVERSATION WORKFLOW:",
  "You move between capability scopes (General, Send Resource, Detailed Lookup, Human, Recovery, Closing).",
  "In General: answer from the base prompt — no tools.",
  "Only use tools exposed in the current workflow step.",
  "Never invent URLs or claim an action succeeded before the tool confirms it.",
].join("\n");

export function applyAmyMinimumSideEffectConfig(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const tuned = applyAmyProductionVoiceTuning(config);
  const workflowMode = true;
  const minimalTools = workflowMode
    ? new Set(["hangup", "transfer", "send_resource", "search_business_details"])
    : new Set([
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
          conversationWorkflowMode: workflowMode,
          voiceArchitectureVersion: "telnyx-conversation-workflow-v1",
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
