/**
 * Voice agent outbound SMS sender — separate from the inbound voice DID.
 * Toll-free / voice-only numbers must not be used as SMS From.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  candidateE164,
  isHpCertifiedSmsNumber,
  normalizePhoneE164,
  type SmsNumberCandidate,
} from "@/lib/messaging/preferred-sending-number";

export type VoiceOutboundSmsMode =
  /** Pick certified / A2P-approved sender for the workspace (default for toll-free voice). */
  | "workspace_preferred"
  /** Text from the same number the caller dialed — only when that number is SMS-capable. */
  | "same_as_voice_line"
  /** Fixed workspace number by id or E.164 from agent config. */
  | "explicit_number"
  /** Infer: toll-free voice → workspace_preferred; else same_as_voice_line. */
  | "auto";

export type VoiceOutboundSmsSettings = {
  mode: VoiceOutboundSmsMode;
  phoneNumberId: string | null;
  e164: string | null;
  /** Snapshot of inbound voice DID for auto / same-line checks. */
  voiceInboundE164: string | null;
};

export function isTollFreeE164(e164: string | null | undefined): boolean {
  const normalized = normalizePhoneE164(e164);
  if (!normalized) return false;
  const national = normalized.replace(/^\+1/, "");
  return /^8(?:00|33|44|55|66|77|88)\d{7}$/.test(national);
}

export function isLikelySmsCapableInboundLine(e164: string | null | undefined): boolean {
  const normalized = normalizePhoneE164(e164);
  if (!normalized) return false;
  if (isTollFreeE164(normalized)) return false;
  // HP 571 and other approved 10DLC lines are valid SMS senders.
  if (isHpCertifiedSmsNumber(normalized)) return true;
  const national = normalized.replace(/^\+1/, "");
  if (/^5\d{9}$/.test(national) || /^2\d{9}$/.test(national) || /^3\d{9}$/.test(national)) {
    return true;
  }
  return !isTollFreeE164(normalized);
}

export function parseVoiceOutboundSmsSettings(
  config?: VoiceAgentConfig | null,
): VoiceOutboundSmsSettings {
  const messaging = (config?.messaging || {}) as Record<string, unknown>;
  const outbound = (messaging.outboundSms || {}) as Record<string, unknown>;
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const wizard = advanced.appointmentReceptionistWizard as
    | { phoneNumberE164?: string | null; outboundSmsMode?: VoiceOutboundSmsMode; outboundSmsPhoneNumberId?: string | null }
    | undefined;

  const modeRaw =
    (outbound.mode as VoiceOutboundSmsMode) ||
    wizard?.outboundSmsMode ||
    "auto";
  const mode: VoiceOutboundSmsMode =
    modeRaw === "workspace_preferred" ||
    modeRaw === "same_as_voice_line" ||
    modeRaw === "explicit_number" ||
    modeRaw === "auto"
      ? modeRaw
      : "auto";

  return {
    mode,
    phoneNumberId:
      (typeof outbound.phoneNumberId === "string" ? outbound.phoneNumberId : null) ||
      wizard?.outboundSmsPhoneNumberId ||
      null,
    e164: normalizePhoneE164(
      typeof outbound.e164 === "string"
        ? outbound.e164
        : typeof outbound.fromE164 === "string"
          ? outbound.fromE164
          : null,
    ) || null,
    voiceInboundE164: normalizePhoneE164(
      typeof outbound.voiceInboundE164 === "string"
        ? outbound.voiceInboundE164
        : wizard?.phoneNumberE164 || null,
    ),
  };
}

export function effectiveOutboundSmsMode(settings: VoiceOutboundSmsSettings): Exclude<
  VoiceOutboundSmsMode,
  "auto"
> {
  if (settings.mode !== "auto") {
    return settings.mode;
  }
  if (settings.voiceInboundE164 && isLikelySmsCapableInboundLine(settings.voiceInboundE164)) {
    return "same_as_voice_line";
  }
  return "workspace_preferred";
}

export function describeVoiceOutboundSmsPolicy(settings: VoiceOutboundSmsSettings): string {
  const effective = effectiveOutboundSmsMode(settings);
  switch (effective) {
    case "same_as_voice_line":
      return `Outbound SMS uses the voice line (${settings.voiceInboundE164 || "inbound DID"}) when SMS-capable.`;
    case "explicit_number":
      return `Outbound SMS uses configured sender ${settings.e164 || settings.phoneNumberId || "(unset)"}.`;
    default:
      return "Outbound SMS uses the workspace preferred texting number (not the toll-free voice DID).";
  }
}

export function buildDefaultOutboundSmsMessaging(input: {
  voiceInboundE164: string | null;
  dedicatedPhoneNumberId?: string | null;
  dedicatedE164?: string | null;
}): VoiceAgentConfig["messaging"] {
  const voice = normalizePhoneE164(input.voiceInboundE164);
  const tollFree = isTollFreeE164(voice);
  const mode: VoiceOutboundSmsMode =
    input.dedicatedPhoneNumberId || input.dedicatedE164
      ? "explicit_number"
      : tollFree
        ? "workspace_preferred"
        : "auto";

  return {
    outboundSms: {
      mode,
      phoneNumberId: input.dedicatedPhoneNumberId || null,
      e164: normalizePhoneE164(input.dedicatedE164) || null,
      voiceInboundE164: voice || null,
    },
  };
}

export function pickExplicitSmsNumber<T extends SmsNumberCandidate>(
  numbers: T[],
  settings: VoiceOutboundSmsSettings,
): T | null {
  if (settings.phoneNumberId) {
    const byId = numbers.find((n) => n.id === settings.phoneNumberId);
    if (byId && candidateE164(byId)) return byId;
  }
  if (settings.e164) {
    const target = normalizePhoneE164(settings.e164);
    const byE164 = numbers.find((n) => candidateE164(n) === target);
    if (byE164) return byE164;
  }
  return null;
}
