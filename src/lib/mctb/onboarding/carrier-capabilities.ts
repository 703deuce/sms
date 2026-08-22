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
  voicemailRaceRisk: "high" | "medium" | "low";
  /** When true, generic device UI setup may be insufficient — show alternate path. */
  alternateSetupRequired: boolean;
  alternateSetupNote?: string;
};

export const DEFAULT_FORWARD_RING_SECONDS = 15;

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
    // *610 no-answer timer exists in legacy AT&T docs — NOT proven on current AT&T Wireless/iPhone.
    supportsNoAnswerTimer: false,
    configurableNoAnswerRingSeconds: false,
    recommendedForwardRingSeconds: 15,
    defaultVoicemailPickupSeconds: 22,
    setupMethod: "device_settings",
    requiresManualCarrierAction: true,
    unverifiedFeatureCodes: ["*610"],
    voicemailRaceRisk: "high",
    alternateSetupRequired: true,
    alternateSetupNote:
      "Live cert 2026-08-22: AT&T Wireless + iPhone with voicemail on — “When Unanswered” forwarding activated but voicemail answered before the call reached Transovo. Requires a no-answer timer shorter than voicemail (carrier support or proven feature code) — do not instruct customers to disable voicemail.",
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
