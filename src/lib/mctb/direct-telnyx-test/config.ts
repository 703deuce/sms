import { MCTB_TWILIO_VOICE_INGRESS_E164 } from "@/lib/mctb/onboarding/constants";

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value : null;
}

/** Test-only gate — production defaults remain LiveKit / existing paths. */
export function isMctbDirectTelnyxTestEnabled(): boolean {
  const raw = process.env.MCTB_DIRECT_TELNYX_TEST?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Hold duration before optional hangup (ms). Default 15s. */
export function mctbDirectTelnyxTestHoldMs(): number {
  const raw = Number(process.env.MCTB_DIRECT_TELNYX_TEST_HOLD_MS || "15000");
  if (!Number.isFinite(raw) || raw < 1000) return 15_000;
  return Math.min(raw, 120_000);
}

/** When false (default), emit normalized events only — no customer SMS. */
export function mctbDirectTelnyxTestEmitSms(): boolean {
  const raw = process.env.MCTB_DIRECT_TELNYX_TEST_EMIT_SMS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Designated PSTN test destination(s). Default: platform 855 TFN ingress. */
export function mctbDirectTelnyxTestE164s(): Set<string> {
  const raw = process.env.MCTB_DIRECT_TELNYX_TEST_E164S?.trim();
  const values = new Set<string>();
  if (raw) {
    for (const part of raw.split(",")) {
      const normalized = normalizeDid(part.trim());
      if (normalized) values.add(normalized);
    }
  }
  const defaultTfn = normalizeDid(MCTB_TWILIO_VOICE_INGRESS_E164);
  if (defaultTfn) values.add(defaultTfn);
  return values;
}

export function isMctbDirectTelnyxTestTarget(toE164: string | null | undefined): boolean {
  if (!isMctbDirectTelnyxTestEnabled()) return false;
  const normalized = normalizeDid(toE164);
  if (!normalized) return false;
  return mctbDirectTelnyxTestE164s().has(normalized);
}

export const MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE = "mctb-direct-telnyx-test";

export const MCTB_DIRECT_TELNYX_TEST_SAY =
  "Transovo direct Telnyx isolation test. Your forwarded call reached us without LiveKit.";
