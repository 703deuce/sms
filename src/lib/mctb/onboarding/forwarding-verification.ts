import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import { getOnboardingForwardTargetE164ForWorkspace } from "./forward-target";
import { resolvePlatformDemoOwnerWorkspaceId } from "./platform-demo";

export type ForwardingCallPath = "direct_to_transovo" | "forwarded_to_transovo" | "unknown";

export type ForwardingVerificationResult = {
  testStarted: boolean;
  callDetected: boolean;
  verified: boolean;
  callControlId: string | null;
  callerE164: string | null;
  businessLineE164: string | null;
  forwardedFromE164: string | null;
  forwardTargetE164: string;
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
  transovoE164: string,
): ForwardingCallPath {
  const fwd = forwardedFrom?.trim();
  if (!fwd) return "direct_to_transovo";
  if (sameNumber(fwd, transovoE164)) return "direct_to_transovo";
  return "forwarded_to_transovo";
}

/**
 * Poll platform 571 smart-routing sessions since forwarding test started.
 * Sets forwardingConnectedAt when a forwarded call reaches Transovo (not direct dial).
 */
export async function getForwardingVerificationStatus(
  workspaceId: string,
): Promise<ForwardingVerificationResult> {
  const state = await loadMctbOnboardingState(workspaceId);
  const forwardTargetE164 = await getOnboardingForwardTargetE164ForWorkspace(workspaceId);
  const businessE164 = state.businessNumberE164?.trim() || null;
  const testStartedAt = state.forwardingTestStartedAt;

  const empty: ForwardingVerificationResult = {
    testStarted: Boolean(testStartedAt),
    callDetected: false,
    verified: Boolean(state.forwardingConnectedAt),
    callControlId: null,
    callerE164: null,
    businessLineE164: businessE164,
    forwardedFromE164: null,
    forwardTargetE164,
    path: null,
    aniLikelyPreserved: null,
    detectedAt: state.forwardingConnectedAt || null,
  };

  if (!testStartedAt) return empty;

  const since = new Date(testStartedAt);
  const prisma = getPrisma();
  const { isPlatformDemoNumber } = await import("./demo");

  if (!isPlatformDemoNumber(forwardTargetE164)) {
    const event = await prisma.missedCallEvent.findFirst({
      where: {
        workspaceId,
        businessE164: forwardTargetE164,
        detectedAt: { gte: since },
      },
      orderBy: { detectedAt: "desc" },
    });
    if (!event) return empty;

    const meta =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : {};
    const forwardedFrom =
      typeof meta.forwardedFrom === "string" ? meta.forwardedFrom : null;
    const path = classifyPath(forwardedFrom, forwardTargetE164);
    const callerE164 = event.callerE164 || null;
    const aniLikelyPreserved =
      path === "forwarded_to_transovo" && callerE164 && businessE164
        ? !sameNumber(callerE164, businessE164)
        : path === "forwarded_to_transovo"
          ? callerE164 != null
          : null;
    const detectedAt = event.detectedAt.toISOString();
    const verified =
      path === "forwarded_to_transovo" &&
      Boolean(businessE164 && forwardedFrom && sameNumber(forwardedFrom, businessE164));

    if (verified && !state.forwardingConnectedAt) {
      await saveMctbOnboardingState(workspaceId, {
        forwardingConnectedAt: detectedAt,
        forwardingVerifiedCallSid: event.id,
        forwardingVerifiedCallerE164: callerE164,
        forwardingVerifiedFromE164: forwardedFrom,
      });
      await recordFunnelEvent(workspaceId, "MCTB_FORWARDING_VERIFIED", {
        missedCallEventId: event.id,
        path,
        callerE164,
        forwardedFrom,
        forwardTargetE164,
      });
    }

    return {
      testStarted: true,
      callDetected: true,
      verified: verified || Boolean(state.forwardingConnectedAt),
      callControlId: event.id,
      callerE164,
      businessLineE164: businessE164,
      forwardedFromE164: forwardedFrom,
      forwardTargetE164,
      path,
      aniLikelyPreserved,
      detectedAt,
    };
  }

  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) return empty;

  const sessions = await prisma.smartRoutingCallSession.findMany({
    where: {
      workspaceId: ownerId,
      calledNumber: forwardTargetE164,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const match = sessions[0];
  if (!match) return empty;

  const forwardedFrom = match.forwardedFromNumber || null;
  const path = classifyPath(forwardedFrom, forwardTargetE164);
  const callerE164 = match.callerNumber || null;
  const aniLikelyPreserved =
    path === "forwarded_to_transovo" && callerE164 && businessE164
      ? !sameNumber(callerE164, businessE164)
      : path === "forwarded_to_transovo"
        ? callerE164 != null
        : null;

  const detectedAt = match.startedAt.toISOString();
  const verified =
    path === "forwarded_to_transovo" &&
    Boolean(businessE164 && forwardedFrom && sameNumber(forwardedFrom, businessE164));

  if (verified && !state.forwardingConnectedAt) {
    await saveMctbOnboardingState(workspaceId, {
      forwardingConnectedAt: detectedAt,
      forwardingVerifiedCallSid: match.callControlId,
      forwardingVerifiedCallerE164: callerE164,
      forwardingVerifiedFromE164: forwardedFrom,
    });
    await recordFunnelEvent(workspaceId, "MCTB_FORWARDING_VERIFIED", {
      callControlId: match.callControlId,
      path,
      callerE164,
      forwardedFrom,
      forwardTargetE164,
    });
  }

  return {
    testStarted: true,
    callDetected: true,
    verified: verified || Boolean(state.forwardingConnectedAt),
    callControlId: match.callControlId,
    callerE164,
    businessLineE164: businessE164,
    forwardedFromE164: forwardedFrom,
    forwardTargetE164,
    path,
    aniLikelyPreserved,
    detectedAt,
  };
}

export async function startForwardingVerificationTest(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (!state.completedSteps.includes("demo")) {
    throw new Error("Complete the direct-call demo before testing forwarding.");
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
    forwardTargetE164: await getOnboardingForwardTargetE164ForWorkspace(workspaceId),
  });
}
