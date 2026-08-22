import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";

export type ForwardingCallPath = "direct_to_tfn" | "forwarded_to_tfn" | "unknown";

export type ForwardingVerificationResult = {
  testStarted: boolean;
  callDetected: boolean;
  verified: boolean;
  twilioCallSid: string | null;
  callerE164: string | null;
  businessLineE164: string | null;
  forwardedFromE164: string | null;
  path: ForwardingCallPath | null;
  /** True when From is not the business line (ANI likely preserved on forward). */
  aniLikelyPreserved: boolean | null;
  detectedAt: string | null;
};

function digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = digits(a);
  const db = digits(b);
  if (da === db) return true;
  if (da.length === 10 && db === `1${da}`) return true;
  if (db.length === 10 && da === `1${db}`) return true;
  return false;
}

function classifyPath(
  forwardedFrom: string | null | undefined,
  tfnE164: string,
): ForwardingCallPath {
  const fwd = forwardedFrom?.trim();
  if (!fwd) return "direct_to_tfn";
  if (sameNumber(fwd, tfnE164)) return "direct_to_tfn";
  return "forwarded_to_tfn";
}

/**
 * Poll Twilio for inbound calls to the workspace TFN since forwarding test started.
 * Sets forwardingConnectedAt only when a forwarded call reaches Transovo (not direct dial).
 */
export async function getForwardingVerificationStatus(
  workspaceId: string,
): Promise<ForwardingVerificationResult> {
  const state = await loadMctbOnboardingState(workspaceId);
  const tfn = getWorkspaceTollFreeNumber(state);
  const businessE164 = state.businessNumberE164?.trim() || null;
  const testStartedAt = state.forwardingTestStartedAt;

  const empty: ForwardingVerificationResult = {
    testStarted: Boolean(testStartedAt),
    callDetected: false,
    verified: Boolean(state.forwardingConnectedAt),
    twilioCallSid: null,
    callerE164: null,
    businessLineE164: businessE164,
    forwardedFromE164: null,
    path: null,
    aniLikelyPreserved: null,
    detectedAt: state.forwardingConnectedAt || null,
  };

  if (!tfn?.e164 || !testStartedAt) return empty;

  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg?.subaccountSid || !reg.subaccountAuthTokenEnc) return empty;

  const since = new Date(testStartedAt);
  const client = getSubaccountTwilioClient(
    reg.subaccountSid,
    decryptSecret(reg.subaccountAuthTokenEnc),
  );
  const calls = await client.calls.list({ to: tfn.e164, limit: 10 });

  const match = calls.find((c) => {
    const start = c.startTime ? new Date(c.startTime) : null;
    return start && start >= since;
  });

  if (!match) return empty;

  const forwardedFrom = (match as { forwardedFrom?: string }).forwardedFrom || null;
  const path = classifyPath(forwardedFrom, tfn.e164);
  const callerE164 = match.from || null;
  const aniLikelyPreserved =
    path === "forwarded_to_tfn" && callerE164 && businessE164
      ? !sameNumber(callerE164, businessE164)
      : path === "forwarded_to_tfn"
        ? callerE164 != null
        : null;

  const detectedAt = match.startTime
    ? new Date(match.startTime).toISOString()
    : new Date().toISOString();

  const verified = path === "forwarded_to_tfn";

  if (verified && !state.forwardingConnectedAt) {
    await saveMctbOnboardingState(workspaceId, {
      forwardingConnectedAt: detectedAt,
      forwardingVerifiedCallSid: match.sid,
      forwardingVerifiedCallerE164: callerE164,
      forwardingVerifiedFromE164: forwardedFrom,
    });
    await recordFunnelEvent(workspaceId, "MCTB_FORWARDING_VERIFIED", {
      twilioCallSid: match.sid,
      path,
      callerE164,
      forwardedFrom,
    });
  }

  return {
    testStarted: true,
    callDetected: true,
    verified: verified || Boolean(state.forwardingConnectedAt),
    twilioCallSid: match.sid,
    callerE164,
    businessLineE164: businessE164,
    forwardedFromE164: forwardedFrom,
    path,
    aniLikelyPreserved,
    detectedAt,
  };
}

export async function startForwardingVerificationTest(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (!getWorkspaceTollFreeNumber(state)?.e164) {
    throw new Error("Assign your Transovo toll-free number before testing forwarding.");
  }
  if (!state.businessNumberE164?.trim()) {
    throw new Error("Enter your business phone number before testing forwarding.");
  }

  try {
    normalizeE164(state.businessNumberE164);
  } catch {
    throw new Error("Enter a valid business phone number before testing forwarding.");
  }

  await saveMctbOnboardingState(workspaceId, {
    forwardingTestStartedAt: new Date().toISOString(),
    forwardingConnectedAt: null,
    forwardingVerifiedCallSid: null,
    forwardingVerifiedCallerE164: null,
    forwardingVerifiedFromE164: null,
  });

  await recordFunnelEvent(workspaceId, "MCTB_FORWARDING_TEST_STARTED", {
    carrier: state.forwardingCarrier,
    businessNumberE164: state.businessNumberE164,
    forwardRingSeconds: state.forwardingRingSeconds,
  });
}
