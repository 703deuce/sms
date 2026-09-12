import { getCarrierGuide, type CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";

export type ForwardingVerificationUi = {
  testStarted: boolean;
  callDetected: boolean;
  verified: boolean;
  detectedAt: string | null;
  path?: string | null;
} | null;

export type ConnectionUiStatus = "verified" | "pending" | "failed" | "unknown";

export type PhoneForwardingSnapshot = {
  phoneNumberId: string | null;
  businessLineE164: string;
  carrier: MctbForwardingCarrier;
  forwardRingSeconds: number;
};

export function normalizeBusinessLineInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+")) return trimmed;
  return trimmed;
}

export function isPlausibleUsPhoneInput(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

export function resolveConnectionUiStatus(
  verification: ForwardingVerificationUi,
  hasBusinessLine: boolean,
  hasForwardTarget: boolean,
): ConnectionUiStatus {
  if (!hasBusinessLine || !hasForwardTarget) return "unknown";
  if (verification?.verified) return "verified";
  if (verification?.testStarted && verification.callDetected && !verification.verified) return "failed";
  return "pending";
}

export function connectionStatusLabel(status: ConnectionUiStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return "Not set";
  }
}

export function formatCompactWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function shouldShowVoicemailTimingWarning(
  carrier: MctbForwardingCarrier,
  forwardRingSeconds: number,
): boolean {
  const guide = getCarrierGuide(carrier);
  const vm = guide.capabilities.defaultVoicemailPickupSeconds;
  if (vm == null) return false;
  return forwardRingSeconds >= vm;
}

export function buildDialCodeCopyText(
  guide: CarrierForwardingGuide,
  forwardE164: string,
  forwardRingSeconds: number,
): string | null {
  const template = guide.capabilities.verifiedNoAnswerForwardDialCode;
  if (!template) return null;
  const digits = forwardE164.replace(/\D/g, "");
  const national = digits.length === 10 ? `1${digits}` : digits;
  const seconds = String(forwardRingSeconds);
  return template
    .replace(/YOUR_TRANSOVO_NUMBER_DIGITS/g, national)
    .replace(/YOUR_FORWARD_RING_SECONDS/g, seconds);
}

export function snapshotsEqual(a: PhoneForwardingSnapshot, b: PhoneForwardingSnapshot): boolean {
  return (
    a.phoneNumberId === b.phoneNumberId &&
    normalizeBusinessLineInput(a.businessLineE164) === normalizeBusinessLineInput(b.businessLineE164) &&
    a.carrier === b.carrier &&
    a.forwardRingSeconds === b.forwardRingSeconds
  );
}

export function displayPhone(e164: string | null | undefined): string {
  if (!e164?.trim()) return "—";
  return formatMctbPhoneLabel(e164);
}

export const RING_PRESETS = [10, 15, 20] as const;

export function clampRingSeconds(n: number): number {
  return Math.min(30, Math.max(10, Math.round(n)));
}
