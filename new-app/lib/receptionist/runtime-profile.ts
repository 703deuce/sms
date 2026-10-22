import type { AgentConfig } from "@/lib/agent";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";
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

/** Launch product: always Full AI Receptionist (Conversational IVR mode retired). */
export function resolveRuntimeProfile(_editor: AgentConfig): RuntimeProfile {
  return RUNTIME_PROFILE_FULL_RECEPTIONIST;
}

/** @deprecated Conversational IVR is retired — Call Routing uses `conversationalRoutes` under full receptionist. */
export function isConversationalIvrEditor(_editor: AgentConfig): boolean {
  return false;
}

/** True when Call Routing has at least one enabled destination with a dialable E.164. */
export function editorHasConversationalTransferRoutes(editor: AgentConfig): boolean {
  return (editor.conversationalRoutes ?? []).some(
    (route) => route.enabled !== false && Boolean(route.destinationPhoneE164?.trim()),
  );
}

/**
 * Published `voiceV3AgentConfig` snapshots may omit `runtimeProfile` (pre two-mode).
 * Always align runtime config with the editor's operating mode before tool catalog gating.
 */
function shouldUseFullReceptionistForLinkBooking(
  editor: AgentConfig,
  config: VoiceV3AgentConfig,
): boolean {
  if (!editor.capabilities.book) return false;
  if (config.scheduling?.bookingStrategy === "SEND_LINK") return true;
  if (isBookingLinkOnlyLaunch()) return true;
  return editor.appointments.strategy === "link";
}

export function coalesceRuntimeProfileForVoiceConfig(
  _editor: AgentConfig,
  _config: VoiceV3AgentConfig,
): RuntimeProfile {
  return RUNTIME_PROFILE_FULL_RECEPTIONIST;
}

export function withRuntimeProfileFromEditor(
  editor: AgentConfig,
  config: VoiceV3AgentConfig,
): VoiceV3AgentConfig {
  const runtimeProfile = coalesceRuntimeProfileForVoiceConfig(editor, config);
  if (config.runtimeProfile === runtimeProfile) return config;
  return { ...config, runtimeProfile };
}

/** IVR four-tool allowlist applies only when explicitly in conversational mode. */
export function isConversationalIvrRuntime(config: VoiceV3AgentConfig): boolean {
  return config.runtimeProfile === "conversational_ivr";
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
  const bookLink =
    editor.capabilities.book &&
    (isBookingLinkOnlyLaunch() || editor.appointments.strategy === "link");
  if (bookLink) names.push("send_booking_link");
  return [...new Set(names)];
}
