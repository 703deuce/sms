/**
 * Platform-owned pre-approved Telnyx local A2P number for onboarding demos.
 * Override via MCTB_PLATFORM_DEMO_E164 — direct-call demo ingress only.
 */
export const MCTB_PLATFORM_DEMO_E164 =
  process.env.MCTB_PLATFORM_DEMO_E164?.trim() || "+15714073615";

function formatUsE164Display(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

/** Human-readable display for Try It / platform demo UI (derived from env). */
export const MCTB_PLATFORM_DEMO_DISPLAY = formatUsE164Display(MCTB_PLATFORM_DEMO_E164);

/** Label shown in onboarding — Telnyx A2P-approved platform line. */
export const MCTB_PLATFORM_DEMO_LABEL = "Transovo Demo Line (A2P-approved)";

/** Twilio hidden voice ingress for MCTB bridge (second hop). */
export const MCTB_TWILIO_VOICE_INGRESS_E164 = "+18553103375";

/**
 * Telnyx toll-free on FQDN SIP (Transovo LiveKit Inbound) — use for direct Telnyx test.
 * Override via MCTB_DIRECT_TELNYX_TEST_E164S. The Twilio 855 above is NOT on Telnyx.
 */
export const MCTB_TELNYX_FQDN_TEST_E164 =
  process.env.MCTB_TELNYX_FQDN_TEST_E164?.trim() || "+18663464256";

/** Cert / test business line (AT&T forward source). Set MCTB_TEST_BUSINESS_E164 in env. */
export function getMctbTestBusinessE164(): string {
  return process.env.MCTB_TEST_BUSINESS_E164?.trim() || "";
}

/** Cert / test caller ANI. Set MCTB_TEST_CALLER_E164 in env. */
export function getMctbTestCallerE164(): string {
  return process.env.MCTB_TEST_CALLER_E164?.trim() || "";
}

/** Default area code when auto-provisioning customer Telnyx local MCTB numbers. */
export const MCTB_DEFAULT_LOCAL_AREA_CODE =
  process.env.MCTB_DEFAULT_LOCAL_AREA_CODE?.trim() || "571";

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
