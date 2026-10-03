import { mctbDidE164Variants } from "@/lib/mctb/messaging/caller-e164";
import { mctbSameE164 } from "@/lib/mctb/phone/e164-match";

/** Credit calls placed shortly before the customer taps "Start test". */
export const MCTB_LIVE_TEST_SESSION_LOOKBACK_MS = 15 * 60 * 1000;

export function readMctbLiveTestForwardedFrom(metadata: Record<string, unknown>): string | null {
  const raw = metadata.forwardedFrom ?? metadata.forwardedFromE164;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** Matches onboarding live-test UI / getLiveTestStatus forwarding rules. */
export function evaluateMctbLiveTestForwardingVerified(input: {
  businessE164: string;
  forwardedFrom: string | null;
  forwardTargetE164: string;
  businessLineE164: string | null;
  allowIngressWithoutForwardHeader?: boolean;
}): boolean {
  const businessLine = input.businessLineE164?.trim() || null;
  if (businessLine) {
    if (input.forwardedFrom) {
      return mctbSameE164(input.forwardedFrom, businessLine);
    }
    if (mctbSameE164(input.businessE164, businessLine)) {
      return true;
    }
    return Boolean(input.allowIngressWithoutForwardHeader);
  }
  if (input.forwardedFrom) {
    return !mctbSameE164(input.forwardedFrom, input.forwardTargetE164);
  }
  return true;
}

export function isMctbLiveTestCallBusinessE164(input: {
  businessE164: string;
  forwardTargetE164: string;
  businessLineE164: string | null;
}): boolean {
  if (mctbSameE164(input.businessE164, input.forwardTargetE164)) {
    return true;
  }
  const line = input.businessLineE164?.trim();
  if (!line) return false;
  const variants = mctbDidE164Variants(line);
  return variants.some((v) => mctbSameE164(input.businessE164, v));
}
