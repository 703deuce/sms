import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  DEFAULT_DEMO_MESSAGE,
  type MctbDemoSession,
  type MctbDemoSessionStatus,
  type MctbOnboardingState,
} from "./types";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
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

/** Resolve onboarding workspace for an inbound call to the platform demo TFN. */
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
  await recordFunnelEvent(input.workspaceId, "demo_started", {
    demoNumberE164,
    callerE164: caller,
  });

  return { demoNumberE164, session };
}

export async function recordDemoCallDetected(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
}): Promise<void> {
  const state = await loadMctbOnboardingState(input.workspaceId);
  const session = state.demoSession;
  if (!session) return;

  await saveMctbOnboardingState(input.workspaceId, {
    demoSession: {
      ...session,
      status: "call_detected",
      callDetectedAt: new Date().toISOString(),
      missedCallEventId: input.missedCallEventId || session.missedCallEventId,
    },
  });
  await recordFunnelEvent(input.workspaceId, "demo_call_detected", {
    missedCallEventId: input.missedCallEventId,
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
    currentStep: state.currentStep === "demo" ? ("compliance" as const) : state.currentStep,
  };
  await saveMctbOnboardingState(workspaceId, nextState);
  await recordFunnelEvent(workspaceId, "demo_text_sent");
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
    currentStep: state.currentStep === "demo" ? "compliance" : state.currentStep,
  });
  await recordFunnelEvent(workspaceId, "demo_reply_received");
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
      missedCallDetected: Boolean(session?.callDetectedAt),
      textDelivered: Boolean(session?.textSentAt),
      replyReceived: Boolean(session?.replyReceivedAt),
    },
    completed: Boolean(session?.replyReceivedAt || session?.textSentAt),
    expired: session ? isDemoSessionExpired(session) : false,
  };
}
