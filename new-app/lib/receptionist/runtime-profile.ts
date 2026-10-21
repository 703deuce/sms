import type { AgentConfig } from "@/lib/agent";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";

export type RuntimeProfile = "conversational_ivr" | "full_receptionist";

export const RUNTIME_PROFILE_CONVERSATIONAL_IVR: RuntimeProfile = "conversational_ivr";
export const RUNTIME_PROFILE_FULL_RECEPTIONIST: RuntimeProfile = "full_receptionist";

export const AI_RECEPTIONIST_PRODUCT_TITLE = "AI Receptionist";

export const CONVERSATIONAL_IVR_MODE_LABEL = "Conversational IVR";
export const FULL_RECEPTIONIST_MODE_LABEL = "Full Receptionist";

/** @deprecated Use AI_RECEPTIONIST_PRODUCT_TITLE — product name is AI Receptionist; mode is separate. */
export const CONVERSATIONAL_IVR_PRODUCT_TITLE = AI_RECEPTIONIST_PRODUCT_TITLE;

export const CONVERSATIONAL_IVR_MODE_DESCRIPTION =
  "Answer questions, understand callers, route calls, and take messages.";

export const FULL_RECEPTIONIST_MODE_DESCRIPTION =
  "Collect information, qualify callers, manage appointments, and handle more complex requests.";

export const CONVERSATIONAL_IVR_PRODUCT_DESCRIPTION = CONVERSATIONAL_IVR_MODE_DESCRIPTION;

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

export function runtimeProfileLabel(profile: RuntimeProfile): string {
  return profile === RUNTIME_PROFILE_FULL_RECEPTIONIST
    ? FULL_RECEPTIONIST_MODE_LABEL
    : CONVERSATIONAL_IVR_MODE_LABEL;
}

/** Customer-facing copy when draft editing mode differs from live published mode. */
export function receptionistModeStatusCopy(input: {
  draftProfile: RuntimeProfile;
  liveProfile: RuntimeProfile;
  hasUnpublishedDraft: boolean;
}): { editingLine: string; liveLine: string } {
  const draftLabel = runtimeProfileLabel(input.draftProfile);
  const liveLabel = runtimeProfileLabel(input.liveProfile);
  const modeDiffers = input.draftProfile !== input.liveProfile;

  if (modeDiffers) {
    return {
      editingLine: `${draftLabel} — Unpublished changes`,
      liveLine: `Live calls: ${liveLabel}`,
    };
  }
  if (input.hasUnpublishedDraft) {
    return {
      editingLine: draftLabel,
      liveLine: `Live calls: ${liveLabel} · unpublished settings`,
    };
  }
  return {
    editingLine: draftLabel,
    liveLine: `Live calls: ${liveLabel}`,
  };
}

export function conversationalIvrToolAllowlist(editor: AgentConfig): string[] {
  const names: string[] = ["end_call", "search_business_knowledge"];
  if (editor.capabilities.transfer) names.push("transfer_call");
  const messageOn =
    editor.messageTaking?.enabled ?? editor.messages.takeMessage ?? editor.capabilities.message;
  if (messageOn) names.push("take_message");
  return [...new Set(names)];
}
