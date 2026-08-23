import "server-only";

import { getPrisma } from "@/lib/db";
import { isExistingConsentMode } from "@/lib/mctb/consent-mode";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import type { TryItProgressChecks, TryItStatus } from "@/lib/mctb/try-it/types";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";

export type { TryItProgressChecks, TryItStatus } from "@/lib/mctb/try-it/types";

type TraceRow = { kind: string };

async function buildTraceChecks(input: {
  workspaceId: string;
  missedCallEventId: string | null | undefined;
  consentMode: MctbConsentMode;
  callDetected: boolean;
}): Promise<TryItProgressChecks> {
  const empty: TryItProgressChecks = {
    callReceived: input.callDetected,
    greetingPlayed: false,
    press1Received: false,
    consentConfirmed: false,
    recoverySmsQueued: false,
    recoverySmsSent: false,
  };

  if (!input.missedCallEventId) return empty;

  const prisma = getPrisma();
  const [traces, event, consentEvents] = await Promise.all([
    prisma.missedCallTextTrace.findMany({
      where: { missedCallEventId: input.missedCallEventId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.missedCallEvent.findUnique({
      where: { id: input.missedCallEventId },
      select: { status: true, smsSentAt: true, callerE164: true, detectedAt: true },
    }),
    prisma.smartRoutingSmsConsentEvent.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { consentedAt: "desc" },
      take: 5,
    }),
  ]);

  const kinds = new Set(traces.map((t: TraceRow) => t.kind));
  const caller = event?.callerE164 || null;
  const consentForCaller = consentEvents.find(
    (row: { callerNumber: string | null }) => row.callerNumber === caller,
  );

  const existingConsent = isExistingConsentMode(input.consentMode);
  const smsSent =
    kinds.has("sms.send.accepted") ||
    event?.status === "SENT" ||
    Boolean(event?.smsSentAt);

  return {
    callReceived: true,
    greetingPlayed: existingConsent
      ? input.callDetected
      : kinds.has("sms.send.started") || input.callDetected,
    press1Received: existingConsent
      ? true
      : Boolean(consentForCaller) || event?.status === "SENT" || event?.status === "SCHEDULED",
    consentConfirmed:
      existingConsent ||
      Boolean(consentForCaller) ||
      event?.status === "SENT" ||
      event?.status === "SCHEDULED",
    recoverySmsQueued:
      kinds.has("mctb.scheduled") || event?.status === "SCHEDULED" || event?.status === "SENT",
    recoverySmsSent: smsSent,
  };
}

export async function getTryItStatus(workspaceId: string): Promise<TryItStatus> {
  const [demo, consentMode] = await Promise.all([
    getDemoStatus(workspaceId),
    loadMctbConsentMode(workspaceId),
  ]);

  const session = demo.session;
  const callDetected = Boolean(session?.callDetectedAt);
  const checks = await buildTraceChecks({
    workspaceId,
    missedCallEventId: session?.missedCallEventId,
    consentMode,
    callDetected,
  });

  return {
    demoNumberE164: demo.demoNumberE164,
    demoNumberDisplay: demo.demoNumberDisplay,
    consentMode,
    sessionActive: Boolean(
      session &&
        (session.status === "waiting_call" ||
          session.status === "call_detected" ||
          session.status === "text_sent" ||
          session.status === "reply_received"),
    ),
    waitingForCall: session?.status === "waiting_call",
    completed: demo.completed,
    expired: demo.expired,
    checks,
    session,
    callerE164: session?.callerE164 || null,
  };
}
