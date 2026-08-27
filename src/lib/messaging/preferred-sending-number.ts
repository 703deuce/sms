/**
 * Prefer the HP-certified local 10DLC number for SMS display and sending.
 * Toll-free 8xx numbers must not outrank an approved local DID.
 */
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import { classifyProductionNumber } from "@/lib/messaging/compliance/phone-number-class";

/** Telnyx HP-certified production DID — the only 571 number on the account. */
export const HP_CERTIFIED_SMS_E164 = "+15714073615";

export type SmsNumberCandidate = {
  id?: string;
  e164?: string;
  number?: string;
  status?: string | null;
  type?: string | null;
  a2pStatus?: string | null;
  provider?: string | null;
  settingsJson?: unknown;
};

export function candidateE164(n: SmsNumberCandidate): string {
  return normalizePhoneE164(n.e164 || n.number);
}

export function normalizePhoneE164(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(raw || "").startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : "";
}

export function isHpCertifiedSmsNumber(e164: string | null | undefined): boolean {
  return normalizePhoneE164(e164) === HP_CERTIFIED_SMS_E164;
}

export function isApprovedMessagingStatus(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "ready" || s === "certified";
}

function isActiveStatus(status: string | null | undefined): boolean {
  const s = String(status || "Active").toLowerCase();
  return s === "active" || s === "" || s === "in_service";
}

function isTollFreeCandidate(n: SmsNumberCandidate): boolean {
  const e164 = candidateE164(n);
  if (classifyProductionNumber({ ...n, e164 }) === "TWILIO_TOLL_FREE") return true;
  const national = e164.replace(/^\+1/, "");
  return /^8(?:00|33|44|55|66|77|88)\d{7}$/.test(national) || /toll/i.test(String(n.type || ""));
}

/** Higher score wins. HP-certified local 10DLC always beats unverified 8xx. */
export function scoreSmsSendingNumber(n: SmsNumberCandidate): number {
  const e164 = candidateE164(n);
  if (!e164) return -1;
  if (!isActiveStatus(n.status)) return 0;

  const approved = isPhoneMessagingApproved({ ...n, e164 }) || isApprovedMessagingStatus(n.a2pStatus);
  const tollFree = isTollFreeCandidate({ ...n, e164 });
  const hp = isHpCertifiedSmsNumber(e164);
  const telnyx = String(n.provider || "").toLowerCase() === "telnyx";

  let score = 10;
  if (hp) score += 1000;
  if (approved && !tollFree) score += 400;
  if (approved && tollFree) score += 40;
  if (!approved && !tollFree) score += 80;
  if (!approved && tollFree) score += 5;
  if (telnyx && !tollFree) score += 30;
  return score;
}

export function pickPreferredSmsSendingNumber<T extends SmsNumberCandidate>(
  numbers: T[],
): T | null {
  const ranked = [...numbers].sort((a, b) => scoreSmsSendingNumber(b) - scoreSmsSendingNumber(a));
  return ranked[0] || null;
}

export function sortPhoneNumbersForSms<T extends SmsNumberCandidate>(numbers: T[]): T[] {
  return [...numbers].sort((a, b) => scoreSmsSendingNumber(b) - scoreSmsSendingNumber(a));
}

export function workspaceMessagingStatusLabel(input: {
  productRegistrationStatus?: string | null;
  sendingNumberApproved?: boolean;
  workspaceRegistrationReady?: boolean;
}): string {
  if (isApprovedMessagingStatus(input.productRegistrationStatus)) return "approved";
  if (input.sendingNumberApproved) return "approved";
  if (input.workspaceRegistrationReady) return "approved";
  const raw = String(input.productRegistrationStatus || "").toLowerCase();
  if (raw && raw !== "not_started") return raw;
  return "not_started";
}
