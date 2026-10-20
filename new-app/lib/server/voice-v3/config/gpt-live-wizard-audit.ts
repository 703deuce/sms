/**
 * GPT-Live-1 wizard control audit — customer vs internal vs legacy.
 * Regenerate summary via `npx tsx scripts/test-voice-v3-gpt-live-wizard-audit.ts`.
 */

export type GptLiveWizardCategory =
  | "LIVE_API_NATIVE"
  | "LIVE_PROMPT_CONTROL"
  | "PLATFORM_INTERNAL"
  | "RUNTIME_ONLY"
  | "UNSUPPORTED_LEGACY";

export type GptLiveWizardAction =
  | "KEEP"
  | "ADD"
  | "REMAP"
  | "REMOVE"
  | "INTERNAL_ONLY";

export type GptLiveWizardAuditRow = {
  name: string;
  wizardStatePath: string | null;
  gptLiveSupportSource: string;
  category: GptLiveWizardCategory;
  mapsTo: string;
  action: GptLiveWizardAction;
};

/** High-signal rows for docs and certification — not every business wizard leaf. */
export const GPT_LIVE_WIZARD_AUDIT_TABLE: GptLiveWizardAuditRow[] = [
  {
    name: "GPT-Live model",
    wizardStatePath: null,
    gptLiveSupportSource: "OpenAI Live session model",
    category: "PLATFORM_INTERNAL",
    mapsTo: "session.model = gpt-live-1",
    action: "INTERNAL_ONLY",
  },
  {
    name: "Built-in voice",
    wizardStatePath: "voiceId",
    gptLiveSupportSource: "audio.output.voice (built-in)",
    category: "LIVE_API_NATIVE",
    mapsTo: "telephony.liveVoiceId → SessionAcceptParams.audio.output.voice",
    action: "KEEP",
  },
  {
    name: "Custom voice (authorized)",
    wizardStatePath: "openAiCustomVoiceId",
    gptLiveSupportSource: "audio.output.voice { id }",
    category: "LIVE_API_NATIVE",
    mapsTo: "telephony.liveVoiceOutput object when voiceSource=custom",
    action: "ADD",
  },
  {
    name: "Live instructions",
    wizardStatePath: null,
    gptLiveSupportSource: "session.instructions",
    category: "LIVE_API_NATIVE",
    mapsTo: "buildLiveFrontendInstructions()",
    action: "INTERNAL_ONLY",
  },
  {
    name: "Delegation (Responses)",
    wizardStatePath: null,
    gptLiveSupportSource: "session.delegation",
    category: "PLATFORM_INTERNAL",
    mapsTo: "buildVoiceV3AstraDelegationResponses()",
    action: "INTERNAL_ONLY",
  },
  {
    name: "Backend model / reasoning",
    wizardStatePath: null,
    gptLiveSupportSource: "delegation.responses model",
    category: "PLATFORM_INTERNAL",
    mapsTo: "VOICE_V3_BASIC_BACKEND_MODEL env",
    action: "INTERNAL_ONLY",
  },
  {
    name: "Speaking pace",
    wizardStatePath: "speakingPace",
    gptLiveSupportSource: "Prompt (pace)",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "conversation.livePromptControls → # GPT-LIVE CONVERSATION TUNING",
    action: "REMAP",
  },
  {
    name: "Tone",
    wizardStatePath: "tone",
    gptLiveSupportSource: "Prompt (persona)",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "conversation.tone → PERSONA section",
    action: "KEEP",
  },
  {
    name: "Speaking style",
    wizardStatePath: "speakingStyle",
    gptLiveSupportSource: "Prompt",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "conversation.speakingStyle",
    action: "KEEP",
  },
  {
    name: "Accent / dialect",
    wizardStatePath: "voiceAccent",
    gptLiveSupportSource: "Prompt (accent)",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "livePromptControls.voiceAccent instruction block",
    action: "ADD",
  },
  {
    name: "Backchannel level",
    wizardStatePath: "backchannelLevel",
    gptLiveSupportSource: "Prompt",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "livePromptControls.backchannelLevel",
    action: "ADD",
  },
  {
    name: "Caller pause patience",
    wizardStatePath: "callerPausePatience",
    gptLiveSupportSource: "Prompt",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "livePromptControls.callerPausePatience",
    action: "ADD",
  },
  {
    name: "Interruption style",
    wizardStatePath: "interruptionStyle",
    gptLiveSupportSource: "Prompt",
    category: "LIVE_PROMPT_CONTROL",
    mapsTo: "livePromptControls.interruptionStyle",
    action: "ADD",
  },
  {
    name: "Responsiveness slider",
    wizardStatePath: "responsiveness",
    gptLiveSupportSource: "Legacy Realtime VAD / Flux",
    category: "UNSUPPORTED_LEGACY",
    mapsTo: "n/a",
    action: "REMOVE",
  },
  {
    name: "Interruption sensitivity slider",
    wizardStatePath: "interruptionSensitivity",
    gptLiveSupportSource: "Legacy VAD / endpointing",
    category: "UNSUPPORTED_LEGACY",
    mapsTo: "n/a",
    action: "REMOVE",
  },
  {
    name: "Speaking speed (numeric TTS)",
    wizardStatePath: "speakingSpeed",
    gptLiveSupportSource: "Legacy ElevenLabs speed",
    category: "UNSUPPORTED_LEGACY",
    mapsTo: "Migrated to speakingPace prompt control",
    action: "REMAP",
  },
  {
    name: "Session instructions append",
    wizardStatePath: null,
    gptLiveSupportSource: "session.instructions.append",
    category: "RUNTIME_ONLY",
    mapsTo: "Runtime sideband (not wizard)",
    action: "INTERNAL_ONLY",
  },
  {
    name: "Business hours / company facts",
    wizardStatePath: "operatingMaturity.businessSchedule.weekly",
    gptLiveSupportSource: "Business + scheduling config",
    category: "LIVE_API_NATIVE",
    mapsTo: "businessHours + BUSINESS FACTS prompts",
    action: "KEEP",
  },
];
