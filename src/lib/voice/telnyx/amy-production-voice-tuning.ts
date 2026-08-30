/**
 * Production voice tuning for Amy on Telnyx (866 line).
 * Favors consistency over demo expressiveness — receptionist use case.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { ACTIVE_LATENCY_PROFILE_DEFAULT } from "@/lib/voice/latency-profiles";

/** Pronunciation hints for Telnyx assistant instructions + STT keyterms. */
export const AMY_PRONUNCIATION_DICTIONARY: Record<string, string> = {
  Transovo: "Trans-ovo",
  "Harbor Drain Pros": "Harbor Drain Pros",
  HVAC: "H V A C",
  FAQ: "F A Q",
  hydrojetting: "hydro jetting",
  "hydro-jetting": "hydro jetting",
};

export const AMY_PRONUNCIATION_NOTES =
  "Say Transovo as Trans-ovo. Say Harbor Drain Pros clearly. " +
  "Spell out acronyms like H V A C when speaking. " +
  "Say hydro jetting as two words.";

/**
 * Apply receptionist-oriented voice settings for Telnyx publish.
 * Higher stability reduces occasional bizarre TTS variance on ElevenLabs voices.
 */
export function applyAmyProductionVoiceTuning(config: VoiceAgentConfig): VoiceAgentConfig {
  const advanced = { ...(config.advanced || {}) } as Record<string, unknown>;
  const voiceTiming = {
    ...(config.voiceTiming || {}),
    activeProfile: config.voiceTiming?.activeProfile || ACTIVE_LATENCY_PROFILE_DEFAULT,
  };

  return {
    ...config,
    instructions: {
      ...(config.instructions || {}),
      pronunciation: config.instructions?.pronunciation || AMY_PRONUNCIATION_NOTES,
      responseLength: config.instructions?.responseLength || "short",
    },
    voiceLanguage: {
      ...(config.voiceLanguage || {}),
      // Receptionist: favor consistency (lower variance) over maximum expressiveness.
      elevenLabsStability: config.voiceLanguage?.elevenLabsStability ?? 0.72,
      elevenLabsSimilarityBoost: config.voiceLanguage?.elevenLabsSimilarityBoost ?? 0.75,
      elevenLabsStyle: config.voiceLanguage?.elevenLabsStyle ?? 0,
      elevenLabsSpeakerBoost: config.voiceLanguage?.elevenLabsSpeakerBoost ?? true,
      pronunciationDictionary: {
        ...(config.voiceLanguage?.pronunciationDictionary || {}),
        ...AMY_PRONUNCIATION_DICTIONARY,
      },
      bargeIn: config.voiceLanguage?.bargeIn ?? true,
    },
    voiceTiming,
    advanced: {
      ...advanced,
      toolSchemaVersion: advanced.toolSchemaVersion || "v2",
      turnDetectionVersion: advanced.turnDetectionVersion || "v1",
      voiceArchitectureVersion: "telnyx-production-v1",
    },
  };
}
