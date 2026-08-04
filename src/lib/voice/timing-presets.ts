/**
 * Voice timing — experimental catalog + latency reporting bands.
 *
 * IMPORTANT (cleanup pass):
 * - Presets are NOT auto-applied to agents or Telnyx sync.
 * - Do not send speculative Retell/Vapi/Pipecat numbers to Telnyx.
 * - Live call timing uses existing agent config + provider defaults
 *   (see assistant-sync interruptionSettingsFromConfig).
 * - Latency bands here are reporting guidance only — never artificial delays.
 */

export const VOICE_TIMING_PRESET_IDS = [
  "NATURAL_DEFAULT",
  "FAST_RECEPTIONIST",
  "PATIENT_INTAKE",
  "NOISY_ENVIRONMENT",
] as const;

export type VoiceTimingPresetId = (typeof VOICE_TIMING_PRESET_IDS)[number];

/**
 * Reporting bands for end-of-speech → first audible agent audio.
 * These are performance targets, not pauses to insert.
 */
export type ResponseLatencyTargets = {
  medianTargetMs: number;
  medianAcceptableMs: number;
  medianWarningMs: number;
  medianCriticalMs: number;
  p95TargetMs: number;
  p95CriticalMs: number;
};

export const SHARED_LATENCY_TARGETS: ResponseLatencyTargets = {
  medianTargetMs: 500,
  medianAcceptableMs: 800,
  medianWarningMs: 1000,
  medianCriticalMs: 1500,
  p95TargetMs: 1200,
  p95CriticalMs: 2000,
};

/**
 * Experimental preset shapes retained for future A/B testing only.
 * Fields are intentionally NOT mapped into Telnyx unless explicitly
 * verified and opted-in by a later change.
 */
export type ExperimentalVoiceTimingPreset = {
  id: VoiceTimingPresetId;
  label: string;
  description: string;
  /** Always experimental until verified against live Telnyx calls. */
  status: "experimental";
  responseLatencyTargets: ResponseLatencyTargets;
  notes: string[];
};

export const EXPERIMENTAL_VOICE_TIMING_PRESETS: Record<
  VoiceTimingPresetId,
  ExperimentalVoiceTimingPreset
> = {
  NATURAL_DEFAULT: {
    id: "NATURAL_DEFAULT",
    label: "Natural default (experimental)",
    description: "Placeholder catalog entry — not auto-applied.",
    status: "experimental",
    responseLatencyTargets: SHARED_LATENCY_TARGETS,
    notes: [
      "Do not send speculative EOT / silence / backchannel values to Telnyx.",
      "Use provider defaults until verified live.",
    ],
  },
  FAST_RECEPTIONIST: {
    id: "FAST_RECEPTIONIST",
    label: "Fast receptionist (experimental)",
    description: "Placeholder catalog entry — not auto-applied.",
    status: "experimental",
    responseLatencyTargets: SHARED_LATENCY_TARGETS,
    notes: ["Not applied to production agents."],
  },
  PATIENT_INTAKE: {
    id: "PATIENT_INTAKE",
    label: "Patient intake (experimental)",
    description: "Placeholder catalog entry — not auto-applied.",
    status: "experimental",
    responseLatencyTargets: SHARED_LATENCY_TARGETS,
    notes: ["Not applied to production agents."],
  },
  NOISY_ENVIRONMENT: {
    id: "NOISY_ENVIRONMENT",
    label: "Noisy environment (experimental)",
    description: "Placeholder catalog entry — not auto-applied.",
    status: "experimental",
    responseLatencyTargets: SHARED_LATENCY_TARGETS,
    notes: ["Not applied to production agents."],
  },
};

export function isVoiceTimingPresetId(value: unknown): value is VoiceTimingPresetId {
  return (
    typeof value === "string" &&
    (VOICE_TIMING_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function getExperimentalVoiceTimingPreset(
  id?: string | null,
): ExperimentalVoiceTimingPreset | null {
  if (!isVoiceTimingPresetId(id)) return null;
  return EXPERIMENTAL_VOICE_TIMING_PRESETS[id];
}

/**
 * Soft conversational guidance injected into assistant instructions.
 * Behavioral prompt rules only — not hard truncation or provider timing.
 */
export const CONVERSATIONAL_PROMPT_GUIDANCE = [
  "VOICE CONVERSATION STYLE:",
  "- Speak in short natural turns (about one or two sentences).",
  "- Ask one question at a time.",
  "- When offering choices, start with a small number (about two) before listing more.",
  "- Do not narrate internal tool or API actions.",
  "- Before a slow required lookup (calendar, account, transfer), a brief acknowledgement is fine (e.g. \"Sure—let me check.\").",
  "- Do not invent filler on every turn; use acknowledgements mainly before real waits.",
  "- If unsure, say so and offer to take a message or connect a person.",
  "- Stop speaking immediately when the caller interrupts.",
].join("\n");
