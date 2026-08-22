import type { MctbForwardingCarrier } from "./types";

export type CarrierSetupMethod =
  | "device_settings"
  | "carrier_codes"
  | "admin_portal"
  | "contact_carrier";

/**
 * Per-carrier forwarding capabilities — drives onboarding copy and setup strategy.
 * Update only from live certification evidence, not assumptions.
 */
export type CarrierForwardingCapabilities = {
  supportsNoAnswerForwarding: boolean;
  supportsBusyForwarding: boolean;
  /** Carrier exposes a no-answer forward timer independent of voicemail. */
  supportsNoAnswerTimer: boolean;
  configurableNoAnswerRingSeconds: boolean;
  /** Rings before forward should fire — must be < voicemail pickup when VM is on. */
  recommendedForwardRingSeconds: number;
  /** Typical voicemail answer delay on this carrier (seconds), if known. */
  defaultVoicemailPickupSeconds: number | null;
  setupMethod: CarrierSetupMethod;
  requiresManualCarrierAction: boolean;
  /** Documented but not live-verified on current wireless (do not ship as instructions). */
  unverifiedFeatureCodes?: string[];
  /**
   * Live-cert verified dial/setup pattern. Use placeholders:
   * YOUR_TRANSOVO_NUMBER_DIGITS (E.164 without +), YOUR_FORWARD_RING_SECONDS
   */
  verifiedNoAnswerForwardDialCode?: string;
  liveVerifiedAt?: string;
  liveVerifiedNote?: string;
  voicemailRaceRisk: "high" | "medium" | "low";
  /** When true, generic device UI setup may be insufficient — show alternate path. */
  alternateSetupRequired: boolean;
  alternateSetupNote?: string;
};

export const DEFAULT_FORWARD_RING_SECONDS = 15;

/** GSM no-answer forward: *61*{number}*11*{seconds}# — live-verified AT&T Wireless 2026-08-22. */
export function formatAttNoAnswerForwardDialCode(input: {
  forwardToE164: string;
  delaySeconds?: number;
}): string {
  const digits = input.forwardToE164.replace(/\D/g, "");
  const national = digits.length === 10 ? `1${digits}` : digits.startsWith("1") ? digits : digits;
  const delay = Math.min(30, Math.max(5, input.delaySeconds ?? DEFAULT_FORWARD_RING_SECONDS));
  return `*61*${national}*11*${delay}#`;
}

export const MCTB_CARRIER_CAPABILITIES: Record<
  MctbForwardingCarrier,
  CarrierForwardingCapabilities
> = {
  verizon: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: true,
    configurableNoAnswerRingSeconds: true,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 25,
    setupMethod: "carrier_codes",
    requiresManualCarrierAction: false,
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
  },
  att: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: true,
    configurableNoAnswerRingSeconds: true,
    recommendedForwardRingSeconds: 10,
    defaultVoicemailPickupSeconds: 22,
    setupMethod: "carrier_codes",
    requiresManualCarrierAction: false,
    unverifiedFeatureCodes: ["*610"],
    verifiedNoAnswerForwardDialCode: "*61*YOUR_TRANSOVO_NUMBER_DIGITS*11*YOUR_FORWARD_RING_SECONDS#",
    liveVerifiedAt: "2026-08-22",
    liveVerifiedNote:
      "Pass 2 cert: iPhone AT&T Wireless, voicemail on. Dial code reached TFN before VM; ANI preserved (703→571→855).",
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
    alternateSetupNote:
      "iPhone Settings → When Unanswered alone failed live cert when voicemail was on. Use the *61* dial code with ring seconds below voicemail pickup.",
  },
  tmobile: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: false,
    configurableNoAnswerRingSeconds: false,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 25,
    setupMethod: "device_settings",
    requiresManualCarrierAction: true,
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
  },
  google_voice: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: false,
    supportsNoAnswerTimer: true,
    configurableNoAnswerRingSeconds: true,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 30,
    setupMethod: "admin_portal",
    requiresManualCarrierAction: false,
    voicemailRaceRisk: "low",
    alternateSetupRequired: false,
  },
  ringcentral: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: true,
    configurableNoAnswerRingSeconds: true,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 30,
    setupMethod: "admin_portal",
    requiresManualCarrierAction: false,
    voicemailRaceRisk: "low",
    alternateSetupRequired: false,
  },
  spectrum: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: false,
    configurableNoAnswerRingSeconds: false,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 25,
    setupMethod: "contact_carrier",
    requiresManualCarrierAction: true,
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
  },
  comcast: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: false,
    configurableNoAnswerRingSeconds: false,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 25,
    setupMethod: "device_settings",
    requiresManualCarrierAction: true,
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
  },
  other: {
    supportsNoAnswerForwarding: true,
    supportsBusyForwarding: true,
    supportsNoAnswerTimer: false,
    configurableNoAnswerRingSeconds: false,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: null,
    setupMethod: "contact_carrier",
    requiresManualCarrierAction: true,
    voicemailRaceRisk: "medium",
    alternateSetupRequired: false,
  },
};

export function getCarrierCapabilities(
  carrier: MctbForwardingCarrier,
): CarrierForwardingCapabilities {
  return MCTB_CARRIER_CAPABILITIES[carrier] || MCTB_CARRIER_CAPABILITIES.other;
}

/** Ring seconds must be below voicemail pickup when voicemail is active. */
export function isForwardRingTimingSafe(input: {
  forwardRingSeconds: number;
  voicemailPickupSeconds: number | null;
}): boolean {
  if (input.voicemailPickupSeconds == null) return true;
  return input.forwardRingSeconds < input.voicemailPickupSeconds;
}
