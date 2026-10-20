import type { VoiceV3AgentConfig } from "../types/agent-config";

export type SpeakingPaceLevel = "slower" | "normal" | "faster";
export type BackchannelLevel = "none" | "minimal" | "natural";
export type CallerPausePatience = "quick" | "normal" | "patient";
export type InterruptionStyle = "yield_immediately" | "natural";
export type VoiceAccentStyle =
  | "neutral_american"
  | "southern_us"
  | "british"
  | "irish"
  | "neutral";

export interface VoiceV3LivePromptControls {
  speakingPace: SpeakingPaceLevel;
  voiceAccent: VoiceAccentStyle;
  backchannelLevel: BackchannelLevel;
  callerPausePatience: CallerPausePatience;
  interruptionStyle: InterruptionStyle;
}

export function speakingPaceFromLegacySpeed(speed: number | undefined): SpeakingPaceLevel {
  const s = speed ?? 1;
  if (s < 0.95) return "slower";
  if (s > 1.05) return "faster";
  return "normal";
}

export function resolveLivePromptControlsFromWizard(input: {
  speakingPace?: SpeakingPaceLevel | null;
  speakingSpeed?: number | null;
  voiceAccent?: VoiceAccentStyle | null;
  backchannelLevel?: BackchannelLevel | null;
  callerPausePatience?: CallerPausePatience | null;
  interruptionStyle?: InterruptionStyle | null;
}): VoiceV3LivePromptControls {
  return {
    speakingPace: input.speakingPace ?? speakingPaceFromLegacySpeed(input.speakingSpeed ?? undefined),
    voiceAccent: input.voiceAccent ?? "neutral_american",
    backchannelLevel: input.backchannelLevel ?? "minimal",
    callerPausePatience: input.callerPausePatience ?? "normal",
    interruptionStyle: input.interruptionStyle ?? "natural",
  };
}

function paceInstruction(pace: SpeakingPaceLevel): string {
  switch (pace) {
    case "slower":
      return "Speak at a slightly slower-than-normal conversational pace while remaining clear and easy to follow on the phone.";
    case "faster":
      return "Speak at a slightly faster-than-normal conversational pace while remaining clear.";
    default:
      return "Use a natural, unhurried telephone pace — neither rushed nor artificially slow.";
  }
}

function accentInstruction(accent: VoiceAccentStyle): string | null {
  switch (accent) {
    case "southern_us":
      return "Use a warm Southern United States English speaking style (word choice and rhythm), without exaggeration or caricature.";
    case "british":
      return "Use British English pronunciation and phrasing where natural.";
    case "irish":
      return "Use Irish English pronunciation and phrasing where natural.";
    case "neutral":
    case "neutral_american":
      return null;
    default:
      return null;
  }
}

function backchannelInstruction(level: BackchannelLevel): string {
  switch (level) {
    case "none":
      return "Avoid listener backchannels (yeah, uh-huh, okay) unless the caller clearly needs acknowledgement.";
    case "minimal":
      return "Use brief acknowledgements sparingly — at most one short backchannel per caller turn when it helps rapport.";
    default:
      return "Use occasional natural acknowledgements (okay, sure, got it) when appropriate, but not on every turn.";
  }
}

function patienceInstruction(level: CallerPausePatience): string {
  switch (level) {
    case "quick":
      return "If the caller is silent for a few seconds mid-thought, you may use one short check-in sooner than usual.";
    case "patient":
      return "Give the caller generous time to think, look something up, or speak to someone nearby before prompting again.";
    default:
      return "Allow natural thinking pauses; do not rush the caller after brief silence.";
  }
}

function interruptionInstruction(style: InterruptionStyle): string {
  if (style === "yield_immediately") {
    return "When the caller begins speaking over you with new intent, stop promptly and follow their latest request.";
  }
  return "When interrupted, follow the conversation rhythm in the INTERRUPTIONS section — yield to meaningful barge-in, not brief backchannels.";
}

/**
 * GPT-Live-1 tuning that OpenAI documents as instruction-controlled (not session numeric params).
 */
export function buildLivePromptControlsInstructionBlock(
  controls: VoiceV3LivePromptControls,
): string {
  const lines = [
    "# GPT-LIVE CONVERSATION TUNING (PROMPT-CONTROLLED)",
    paceInstruction(controls.speakingPace),
    backchannelInstruction(controls.backchannelLevel),
    patienceInstruction(controls.callerPausePatience),
    interruptionInstruction(controls.interruptionStyle),
  ];
  const accent = accentInstruction(controls.voiceAccent);
  if (accent) lines.push(accent);
  return lines.join("\n");
}

export function livePromptControlsFromAgentConfig(
  config: VoiceV3AgentConfig,
): VoiceV3LivePromptControls {
  return (
    config.conversation.livePromptControls ??
    resolveLivePromptControlsFromWizard({})
  );
}
