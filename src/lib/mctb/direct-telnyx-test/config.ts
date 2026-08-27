import { MCTB_TELNYX_FQDN_TEST_E164 } from "@/lib/mctb/onboarding/constants";

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value : null;
}

/** Hold before stability checkpoint (ms). */
export const MCTB_DIRECT_TELNYX_TEST_HOLD_MS = 15_000;

/** Isolation test — log normalized event only, no customer SMS. */
export const MCTB_DIRECT_TELNYX_TEST_EMIT_SMS = false;

/** Only this Telnyx TFN on FQDN SIP is handled by the direct path. */
export function isMctbDirectTelnyxTestTarget(toE164: string | null | undefined): boolean {
  const normalized = normalizeDid(toE164);
  if (!normalized) return false;
  return normalized === normalizeDid(MCTB_TELNYX_FQDN_TEST_E164);
}

export function mctbDirectTelnyxTestHoldMs(): number {
  return MCTB_DIRECT_TELNYX_TEST_HOLD_MS;
}

export function mctbDirectTelnyxTestEmitSms(): boolean {
  return MCTB_DIRECT_TELNYX_TEST_EMIT_SMS;
}

export const MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE = "mctb-direct-telnyx-test";

export const MCTB_DIRECT_TELNYX_TEST_SAY =
  "Transovo direct Telnyx isolation test. Your forwarded call reached us without LiveKit.";
