import type { ReceptionistWizardState } from "./types";
import { CAPABILITY_OPTIONS } from "./types";
import {
  DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
  getReceptionistElevenLabsVoice,
  listEnabledReceptionistElevenLabsVoices,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";

export function defaultAgentJobInstructions(businessName: string): string {
  const business = businessName.trim() || "our business";
  return [
    `You are the front-desk receptionist for ${business}.`,
    "",
    "Your primary responsibilities:",
    "- Answer incoming calls professionally.",
    "- Answer basic questions about the business.",
    "- Determine why the caller is calling.",
    "- Collect required caller information when needed.",
    "- Take messages when the caller cannot be helped immediately.",
    "- Transfer or book appointments when appropriate and enabled.",
  ].join("\n");
}

export function createDefaultWizardState(): ReceptionistWizardState {
  return {
    agentName: "Amy",
    businessName: "",
    industry: "",
    businessDescription: "",
    agentPersonalityNotes: "",
    agentJobInstructions: "",
    additionalInstructions: "",
    businessHours: "",
    serviceArea: "",
    coreServices: "",
    pricingNotes: "",
    importantFacts: "",
    businessAddress: "",
    answerTiming: "every_call",
    greeting:
      "Hi, thanks for calling {{businessName}}. This is {{agentName}}, how can I help you today?",
    language: "en-US",
    timezone: "America/New_York",
    capabilities: CAPABILITY_OPTIONS.filter((c) => c.defaultOn).map((c) => c.id),
    collectFields: ["name", "phone", "reason"],
    voiceId: DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
    voiceLabel: getReceptionistElevenLabsVoice(DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID)?.label || "Jessica",
    voiceSpeed: 1.08,
    elevenLabsStability: 0.45,
    elevenLabsClarity: 0.75,
    elevenLabsStyle: 0.1,
    elevenLabsSpeakerBoost: false,
    elevenLabsOptimizeLatency: true,
    vadThreshold: 0.65,
    vadSilenceMs: 500,
    vadPrefixMs: 300,
  };
}

export function interpolateGreeting(state: ReceptionistWizardState): string {
  const business = state.businessName.trim() || "our office";
  const agent = state.agentName.trim() || "Amy";
  return state.greeting
    .replaceAll("{{businessName}}", business)
    .replaceAll("{{agentName}}", agent);
}

export function generateGreeting(state: ReceptionistWizardState): string {
  const business = state.businessName.trim() || "our business";
  const agent = state.agentName.trim() || "Amy";
  return `Hi, thanks for calling ${business}. This is ${agent}, how can I help you today?`;
}
