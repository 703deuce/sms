/**
 * Platform-owned pre-approved Telnyx local A2P number for onboarding demos.
 * Same for every user — NOT their assigned trial toll-free number.
 * Per-user workspaces are matched by verified caller phone during the demo.
 *
 * Compliance: 10DLC/A2P on Telnyx (not Twilio TFV).
 */
export const MCTB_PLATFORM_DEMO_E164 = "+15714073615";

/** Human-readable display for onboarding UI. */
export const MCTB_PLATFORM_DEMO_DISPLAY = "1-571-407-3615";

/** Label shown in onboarding — Telnyx A2P-approved platform line. */
export const MCTB_PLATFORM_DEMO_LABEL = "Transovo Demo Line (A2P-approved)";

/** Twilio hidden voice ingress for MCTB bridge (second hop). */
export const MCTB_TWILIO_VOICE_INGRESS_E164 = "+18553103375";

/** Cert / test business line (AT&T forward source). Set MCTB_TEST_BUSINESS_E164 in env. */
export function getMctbTestBusinessE164(): string {
  return process.env.MCTB_TEST_BUSINESS_E164?.trim() || "";
}

/** Cert / test caller ANI. Set MCTB_TEST_CALLER_E164 in env. */
export function getMctbTestCallerE164(): string {
  return process.env.MCTB_TEST_CALLER_E164?.trim() || "";
}

/** Toll-free area codes used when auto-provisioning customer trial numbers (Twilio + TFV). */
export const MCTB_TRIAL_TOLL_FREE_AREA_CODES = [
  "888",
  "877",
  "866",
  "855",
  "844",
  "833",
  "800",
] as const;
