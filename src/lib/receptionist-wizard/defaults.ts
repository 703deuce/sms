import type { ReceptionistWizardState } from "./types";
import { CAPABILITY_OPTIONS } from "./types";

export function createDefaultWizardState(): ReceptionistWizardState {
  return {
    agentName: "Amy",
    businessName: "",
    businessDescription: "",
    answerTiming: "every_call",
    greeting:
      "Hi, thanks for calling {{businessName}}. This is {{agentName}}, how can I help you today?",
    language: "en-US",
    timezone: "America/New_York",
    capabilities: CAPABILITY_OPTIONS.filter((c) => c.defaultOn).map((c) => c.id),
    collectFields: ["name", "phone", "reason"],
    voiceId: "marin",
    voiceLabel: "Marin",
    voiceSpeed: 1,
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
