import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED } from "@/lib/mctb/consent-mode";
import { formatCompactWhen } from "@/lib/mctb/setup-phone-forwarding-model";

export type ConsentFlowStep = {
  id: string;
  title: string;
  detail: string;
};

export const PRESS_1_CALLER_FLOW: ConsentFlowStep[] = [
  { id: "missed", title: "Missed call", detail: "Call reaches Transovo." },
  { id: "disclosure", title: "Disclosure", detail: "Caller hears the consent prompt." },
  { id: "press1", title: "Press 1", detail: "Caller actively agrees." },
  { id: "recorded", title: "Recorded", detail: "Consent is logged." },
  { id: "text", title: "Text back", detail: "Recovery message becomes eligible." },
];

export const EXISTING_CONSENT_CALLER_FLOW: ConsentFlowStep[] = [
  { id: "missed", title: "Missed call", detail: "Call reaches Transovo." },
  { id: "vm", title: "Voicemail / call flow", detail: "No Press 1 prompt on the call." },
  { id: "check", title: "Consent check", detail: "Business attestation + eligibility." },
  { id: "eligibility", title: "Recovery eligibility", detail: "Standard recovery rules apply." },
  { id: "text", title: "Text back", detail: "Recovery when all gates pass." },
];

export const CALL_FLOW_PRESS_1 = [
  "Business phone",
  "Forwarded to Transovo",
  "Consent disclosure",
  "Press 1",
  "Recovery / voicemail",
] as const;

export const CALL_FLOW_EXISTING = [
  "Business phone",
  "Forwarded to Transovo",
  "Voicemail / call flow",
  "Existing-consent eligibility",
  "Recovery text",
] as const;

export function methodLabel(mode: MctbConsentMode): string {
  return mode === MCTB_CONSENT_MODE_VERIFIED ? "Press 1" : "Existing consent";
}

export function evidenceLabel(mode: MctbConsentMode): string {
  return mode === MCTB_CONSENT_MODE_VERIFIED ? "Per-call consent" : "Business attestation";
}

export function formatAttestationWhen(iso: string | null | undefined): string | null {
  return iso ? formatCompactWhen(iso) : null;
}

export type ConsentSnapshot = {
  mode: MctbConsentMode;
};

export function consentSnapshotsEqual(a: ConsentSnapshot, b: ConsentSnapshot): boolean {
  return a.mode === b.mode;
}

export type ConsentPageHealth = "configured" | "needs_attention";

export function consentPageHealth(input: {
  mode: MctbConsentMode;
  existingConsentEligible: boolean;
}): ConsentPageHealth {
  if (
    input.mode === MCTB_CONSENT_MODE_EXISTING &&
    !input.existingConsentEligible
  ) {
    return "needs_attention";
  }
  return "configured";
}

export function senderStatusLabel(messagingReady: boolean): string {
  return messagingReady ? "Ready" : "Pending";
}

export function recoveryActiveLabel(enabled: boolean, paused: boolean): string {
  if (paused) return "Paused";
  return enabled ? "Active" : "Off";
}

export function textBackConfiguredLabel(template: string): string {
  return template.trim().length > 0 ? "Configured" : "Not set";
}

export function draftRequiresAttestation(
  mode: MctbConsentMode,
  savedMode: MctbConsentMode,
): boolean {
  return mode === MCTB_CONSENT_MODE_EXISTING && savedMode !== MCTB_CONSENT_MODE_EXISTING;
}

export function draftRequiresPress1Confirm(
  mode: MctbConsentMode,
  savedMode: MctbConsentMode,
): boolean {
  return mode === MCTB_CONSENT_MODE_VERIFIED && savedMode === MCTB_CONSENT_MODE_EXISTING;
}
