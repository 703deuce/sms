import type { AgentConfig } from "@/lib/agent";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";

export type RuntimeProfile = "conversational_ivr" | "full_receptionist";

export const RUNTIME_PROFILE_CONVERSATIONAL_IVR: RuntimeProfile = "conversational_ivr";
export const RUNTIME_PROFILE_FULL_RECEPTIONIST: RuntimeProfile = "full_receptionist";

export const CONVERSATIONAL_IVR_PRODUCT_TITLE = "Conversational IVR";
export const CONVERSATIONAL_IVR_PRODUCT_DESCRIPTION =
  "Let callers explain what they need. Your conversational phone menu can answer common questions, connect them to the right person, or take a message.";

export const CONVERSATIONAL_IVR_ACTIVE_TOOLS = [
  "end_call",
  "search_business_knowledge",
  "transfer_call",
  "take_message",
] as const;

export function resolveRuntimeProfile(editor: AgentConfig): RuntimeProfile {
  return editor.runtimeProfile === "full_receptionist"
    ? RUNTIME_PROFILE_FULL_RECEPTIONIST
    : RUNTIME_PROFILE_CONVERSATIONAL_IVR;
}

export function isConversationalIvrEditor(editor: AgentConfig): boolean {
  return resolveRuntimeProfile(editor) === RUNTIME_PROFILE_CONVERSATIONAL_IVR;
}

export function isConversationalIvrRuntime(config: VoiceV3AgentConfig): boolean {
  return config.runtimeProfile !== "full_receptionist";
}

export function conversationalIvrToolAllowlist(editor: AgentConfig): string[] {
  const names: string[] = ["end_call", "search_business_knowledge"];
  if (editor.capabilities.transfer) names.push("transfer_call");
  const messageOn =
    editor.messageTaking?.enabled ?? editor.messages.takeMessage ?? editor.capabilities.message;
  if (messageOn) names.push("take_message");
  return [...new Set(names)];
}
