import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  DEFAULT_DEMO_MESSAGE,
  type MctbDemoSession,
  type MctbDemoSessionStatus,
  type MctbOnboardingState,
} from "./types";
import { loadMctbOnboardingState, parseMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import { MCTB_PLATFORM_DEMO_E164 } from "./constants";

const DEMO_SESSION_TTL_MS = 30 * 60 * 1000;

export function getPlatformDemoNumberE164(): string {
  try {
    return normalizeE164(MCTB_PLATFORM_DEMO_E164);
  } catch {
    return MCTB_PLATFORM_DEMO_E164;
  }
}

export function formatDemoPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

export function isPlatformDemoNumber(businessE164: string): boolean {
  try {
    return normalizeE164(businessE164) === getPlatformDemoNumberE164();
  } catch {
    return false;
  }
}

function isActiveDemoStatus(status: MctbDemoSessionStatus | undefined): boolean {
  return (
    status === "waiting_call" ||
    status === "call_detected" ||
    status === "text_sent" ||
    status === "reply_received"
  );
}

function isDemoSessionExpired(session: MctbDemoSession | null | undefined): boolean {
  if (!session?.startedAt) return true;
  const started = new Date(session.startedAt).getTime();
  return Date.now() - started > DEMO_SESSION_TTL_MS;
}

/** Resolve onboarding workspace for an inbound call to the platform demo line. */
export async function resolveDemoWorkspaceForCaller(
  callerE164: string,
): Promise<{ workspaceId: string; session: MctbDemoSession } | null> {
  let caller = "";
  try {
    caller = normalizeE164(callerE164);
  } catch {
    return null;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { phone: caller },
    select: { id: true },
  });
  if (!user) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { workspaceId: true },
  });

  for (const membership of memberships) {
    const state = await loadMctbOnboardingState(membership.workspaceId);
    const session = state.demoSession;
    if (!session || session.callerE164 !== caller) continue;
    if (!isActiveDemoStatus(session.status)) continue;
    if (isDemoSessionExpired(session)) continue;
    return { workspaceId: membership.workspaceId, session };
  }

  return null;
}

function sameE164(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return false;
  }
}

function isOnboardingForwardOrLiveTestActive(state: MctbOnboardingState): boolean {
  if (state.liveTestPassedAt) return false;
  if (state.forwardingTestStartedAt) return true;
  if (state.liveTestSession?.startedAt) return true;
  return state.currentStep === "connect" || state.currentStep === "live_test";
}

/** Match onboarding workspace for inbound calls to platform 571 (demo, forwarding, live test). */
export async function resolveOnboardingWorkspaceForPlatformInbound(input: {
  callerE164: string;
  forwardedFrom?: string | null;
}): Promise<string | null> {
  const demo = await resolveDemoWorkspaceForCaller(input.callerE164);
  if (demo) return demo.workspaceId;

  const businessLine = input.forwardedFrom?.trim();
  if (!businessLine) return null;

  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    where: { NOT: { customFieldsConfig: null } },
    select: { id: true, customFieldsConfig: true },
    take: 2000,
  });

  for (const ws of workspaces) {
    const state = parseMctbOnboardingState(ws.customFieldsConfig);
    if (!state.businessNumberE164 || !sameE164(state.businessNumberE164, businessLine)) continue;
    if (!isOnboardingForwardOrLiveTestActive(state)) continue;
    return ws.id;
  }

  return null;
}

export async function startDemoSession(input: {
  workspaceId: string;
  callerE164: string;
}): Promise<{ demoNumberE164: string; session: MctbDemoSession }> {
  const demoNumberE164 = getPlatformDemoNumberE164();

  const caller = normalizeE164(input.callerE164);
  const session: MctbDemoSession = {
    status: "waiting_call",
    callerE164: caller,
    demoNumberE164,
    startedAt: new Date().toISOString(),
  };

  await saveMctbOnboardingState(input.workspaceId, {
    demoSession: session,
    currentStep: "demo",
  });

  const { loadMctbConsentMode } = await import("@/lib/mctb/consent-prompt/service");
  const { syncPlatformDemoConsentRuntime } = await import(
    "@/lib/mctb/onboarding/platform-demo"
  );
  const consentMode = await loadMctbConsentMode(input.workspaceId);
  await syncPlatformDemoConsentRuntime(consentMode).catch((err) => {
    console.error("[demo] syncPlatformDemoConsentRuntime", err);
  });

  await recordFunnelEvent(input.workspaceId, "MCTB_DEMO_STARTED", {
    demoNumberE164,
    callerE164: caller,
  });

  return { demoNumberE164, session };
}

export async function recordDemoCallDetected(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
  from?: string | null;
  to?: string | null;
  forwardedFrom?: string | null;
  callSid?: string | null;
  callStatus?: string | null;
}): Promise<void> {
  const state = await loadMctbOnboardingState(input.workspaceId);
  const session = state.demoSession;
  if (!session) return;
  if (
    session.status === "call_detected" ||
    session.status === "text_sent" ||
    session.status === "reply_received" ||
    session.status === "completed"
  ) {
    return;
  }

  const detectedAt = new Date().toISOString();
  const lastInboundCall =
    input.from && input.to
      ? {
          from: input.from,
          to: input.to,
          forwardedFrom: input.forwardedFrom ?? null,
          callSid: input.callSid ?? null,
          callStatus: input.callStatus ?? null,
          detectedAt,
        }
      : session.lastInboundCall ?? null;

  await saveMctbOnboardingState(input.workspaceId, {
    demoSession: {
      ...session,
      status: "call_detected",
      callDetectedAt: detectedAt,
      missedCallEventId: input.missedCallEventId ?? session.missedCallEventId ?? null,
      lastInboundCall,
    },
  });

  await recordFunnelEvent(input.workspaceId, "MCTB_DEMO_CALL_DETECTED", {
    ...(input.missedCallEventId ? { missedCallEventId: input.missedCallEventId } : {}),
    ...(lastInboundCall ? { lastInboundCall } : {}),
  }).catch((err) => {
    console.warn("[mctb-demo] recordFunnelEvent MCTB_DEMO_CALL_DETECTED failed", err);
  });
}

export async function recordDemoTextSent(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  const session = state.demoSession;
  if (!session) return;

  const nextSession: MctbDemoSession = {
    ...session,
    status: "text_sent",
    textSentAt: new Date().toISOString(),
  };
  const nextState = {
    demoSession: nextSession,
    completedSteps: (state.completedSteps.includes("demo")
      ? state.completedSteps
      : [...state.completedSteps, "demo"]) as MctbOnboardingState["completedSteps"],
    currentStep: state.currentStep === "demo" ? ("tfv" as const) : state.currentStep,
  };
  await saveMctbOnboardingState(workspaceId, nextState);
  await recordFunnelEvent(workspaceId, "MCTB_DEMO_TEXT_SENT");
  await recordFunnelEvent(workspaceId, "MCTB_DEMO_COMPLETED").catch(() => undefined);
}

export async function recordDemoReplyReceived(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  const session = state.demoSession;
  if (!session) return;
  if (session.status === "reply_received" || session.status === "completed") return;

  const nextSession: MctbDemoSession = {
    ...session,
    status: "reply_received",
    replyReceivedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  await saveMctbOnboardingState(workspaceId, {
    demoSession: nextSession,
    completedSteps: state.completedSteps.includes("demo")
      ? state.completedSteps
      : [...state.completedSteps, "demo"],
    currentStep: state.currentStep === "demo" ? "tfv" : state.currentStep,
  });
  await recordFunnelEvent(workspaceId, "MCTB_DEMO_REPLY_RECEIVED");
  await recordFunnelEvent(workspaceId, "MCTB_DEMO_COMPLETED");
}

export function getDemoMessageBody(): string {
  return DEFAULT_DEMO_MESSAGE;
}

export function isDemoModeForWorkspace(
  workspaceId: string,
  businessE164: string,
  callerE164: string,
  session: MctbDemoSession | null | undefined,
): boolean {
  if (!isPlatformDemoNumber(businessE164)) return false;
  if (!session || !isActiveDemoStatus(session.status)) return false;
  try {
    return normalizeE164(session.callerE164) === normalizeE164(callerE164);
  } catch {
    return false;
  }
}

export async function getDemoStatus(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const session = state.demoSession;
  const demoNumberE164 = getPlatformDemoNumberE164();

  return {
    configured: true,
    demoNumberE164,
    demoNumberDisplay: formatDemoPhoneDisplay(demoNumberE164),
    session,
    checks: {
      callDetected: Boolean(session?.callDetectedAt),
      missedCall: Boolean(session?.callDetectedAt),
      textDelivered: Boolean(session?.textSentAt),
      replyReceived: Boolean(session?.replyReceivedAt),
    },
    completed: Boolean(session?.replyReceivedAt || session?.textSentAt),
    expired: session ? isDemoSessionExpired(session) : false,
  };
}
