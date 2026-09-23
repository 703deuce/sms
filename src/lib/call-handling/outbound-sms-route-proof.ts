/**
 * Pure documentation + test helpers for MCTB outbound SMS vs voice ingress.
 * Call Handling must never mutate SMS sender selection.
 *
 * Production path (no changes in this PR):
 * `resolveMctbOutboundSmsRoute` → `resolveMctbSmsSender` (phoneNumberId first)
 *   + optional second candidate when smsPhoneNumberId !== phoneNumberId,
 *   then picks first `isPhoneAuthorizedForOutboundSms` candidate.
 *
 * `resolvePlatformTelnyxSmsRoute` exists but platform demo owner/sender resolvers
 * currently return null (`platform-demo.ts` retired). Split-sender production relies
 * on distinct smsPhoneNumberId with authorization, not demoMode platform shortcut.
 */
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";

export type SmsSenderCandidate = {
  phoneNumberId: string;
  source: "phone_number_id" | "sms_phone_number_id";
};

/** Mirrors candidate ordering in `resolveMctbOutboundSmsRoute` (read-only). */
export function listMctbOutboundSmsSenderCandidates(
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">,
  resolved: {
    fromPhoneNumberId: { phoneNumberId: string } | null;
    fromSmsPhoneNumberId: { phoneNumberId: string } | null;
  },
): SmsSenderCandidate[] {
  const out: SmsSenderCandidate[] = [];
  if (resolved.fromPhoneNumberId) {
    out.push({ phoneNumberId: resolved.fromPhoneNumberId.phoneNumberId, source: "phone_number_id" });
  }
  if (
    config.smsPhoneNumberId &&
    config.smsPhoneNumberId !== config.phoneNumberId &&
    resolved.fromSmsPhoneNumberId
  ) {
    out.push({
      phoneNumberId: resolved.fromSmsPhoneNumberId.phoneNumberId,
      source: "sms_phone_number_id",
    });
  }
  return out;
}

/**
 * Mirrors `resolveMctbOutboundSmsRoute` authorization loop (first allowed candidate wins).
 */
export function pickMctbOutboundSmsSenderCandidate(
  candidates: SmsSenderCandidate[],
  isAuthorized: (phoneNumberId: string) => boolean,
): SmsSenderCandidate | null {
  for (const candidate of candidates) {
    if (isAuthorized(candidate.phoneNumberId)) return candidate;
  }
  return candidates[0] ?? null;
}

/** Call Handling must not touch MCTB config SMS fields — static guard for tests. */
export const CALL_HANDLING_FORBIDDEN_SMS_MUTATION_MARKERS = [
  "smsPhoneNumberId",
  "sms_phone_number_id",
  "resolveMctbOutboundSmsRoute",
  "resolveMctbSmsSender",
  "missedCallTextConfig.update",
] as const;
