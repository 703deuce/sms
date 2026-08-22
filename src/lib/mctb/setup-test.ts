import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { isExistingConsentMode } from "@/lib/mctb/consent-mode";

export type MctbSetupTestChecks = {
  transovoDidReceived: boolean;
  workspaceResolved: boolean;
  consentModeLoaded: boolean;
  greetingPlayed: boolean;
  press1Received: boolean;
  consentRecorded: boolean;
  missedCallEventCreated: boolean;
  smsQueued: boolean;
  smsProviderAccepted: boolean;
};

export type MctbSetupTestStatus = {
  started: boolean;
  verified: boolean;
  startedAt: string | null;
  verifiedAt: string | null;
  consentMode: string;
  assignedNumberE164: string | null;
  checks: MctbSetupTestChecks;
  latestEventId: string | null;
  failureReason: string | null;
};

const SETUP_TEST_WINDOW_MS = 30 * 60 * 1000;

export async function startMctbSetupTest(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          setupTestSession: {
            startedAt: new Date().toISOString(),
            verifiedAt: null,
          },
        },
      },
    },
  });
}

function readSetupTestSession(customFieldsConfig: unknown): {
  startedAt?: string;
  verifiedAt?: string | null;
} | null {
  const cfg =
    customFieldsConfig && typeof customFieldsConfig === "object"
      ? (customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const raw = mctb.setupTestSession;
  if (!raw || typeof raw !== "object") return null;
  return raw as { startedAt?: string; verifiedAt?: string | null };
}

export async function getMctbSetupTestStatus(workspaceId: string): Promise<MctbSetupTestStatus> {
  const prisma = getPrisma();
  const [ws, runtime, consentMode] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    }),
    loadMissedCallTextConfig(workspaceId),
    loadMctbConsentMode(workspaceId),
  ]);

  const session = readSetupTestSession(ws?.customFieldsConfig);
  const startedAt = session?.startedAt || null;
  const started = Boolean(startedAt);

  let assignedNumberE164: string | null = null;
  if (runtime.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: runtime.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    assignedNumberE164 = pn?.e164 || null;
  }

  const emptyChecks: MctbSetupTestChecks = {
    transovoDidReceived: false,
    workspaceResolved: false,
    consentModeLoaded: false,
    greetingPlayed: false,
    press1Received: false,
    consentRecorded: false,
    missedCallEventCreated: false,
    smsQueued: false,
    smsProviderAccepted: false,
  };

  if (!started) {
    return {
      started: false,
      verified: false,
      startedAt: null,
      verifiedAt: null,
      consentMode,
      assignedNumberE164,
      checks: emptyChecks,
      latestEventId: null,
      failureReason: null,
    };
  }

  const since = new Date(
    Math.max(new Date(startedAt!).getTime(), Date.now() - SETUP_TEST_WINDOW_MS),
  );

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const latest = events[0] || null;
  if (!latest) {
    return {
      started: true,
      verified: Boolean(session?.verifiedAt),
      startedAt,
      verifiedAt: session?.verifiedAt || null,
      consentMode,
      assignedNumberE164,
      checks: emptyChecks,
      latestEventId: null,
      failureReason: null,
    };
  }

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { missedCallEventId: latest.id },
    orderBy: { createdAt: "asc" },
  });

  const kinds = new Set(traces.map((t) => t.kind));
  const consentEvents = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: {
      workspaceId,
      callerNumber: latest.callerE164,
      consentedAt: { gte: since },
    },
    take: 1,
    orderBy: { consentedAt: "desc" },
  });

  const checks: MctbSetupTestChecks = {
    transovoDidReceived: true,
    workspaceResolved: latest.workspaceId === workspaceId,
    consentModeLoaded: true,
    greetingPlayed: isExistingConsentMode(consentMode)
      ? true
      : kinds.has("sms.send.started") || latest.status !== "DETECTED",
    press1Received: isExistingConsentMode(consentMode)
      ? true
      : consentEvents.length > 0 || latest.status === "SENT" || latest.status === "SCHEDULED",
    consentRecorded:
      isExistingConsentMode(consentMode) ||
      consentEvents.length > 0 ||
      latest.status === "SENT" ||
      latest.status === "SCHEDULED",
    missedCallEventCreated: true,
    smsQueued: kinds.has("mctb.scheduled") || latest.status === "SCHEDULED" || latest.status === "SENT",
    smsProviderAccepted:
      kinds.has("sms.send.accepted") || latest.status === "SENT" || Boolean(latest.smsSentAt),
  };

  const verified =
    Boolean(session?.verifiedAt) ||
    (checks.missedCallEventCreated &&
      checks.smsQueued &&
      (isExistingConsentMode(consentMode)
        ? checks.smsProviderAccepted
        : checks.press1Received &&
          checks.consentRecorded &&
          checks.smsProviderAccepted));

  if (verified && !session?.verifiedAt) {
    const cfg =
      ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
        ? (ws.customFieldsConfig as Record<string, unknown>)
        : {};
    const mctb =
      cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
    const verifiedAt = new Date().toISOString();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customFieldsConfig: {
          ...cfg,
          mctb: {
            ...mctb,
            setupTestSession: {
              startedAt,
              verifiedAt,
            },
          },
        },
      },
    });
    return {
      started: true,
      verified: true,
      startedAt,
      verifiedAt,
      consentMode,
      assignedNumberE164,
      checks,
      latestEventId: latest.id,
      failureReason: latest.suppressionReason,
    };
  }

  return {
    started: true,
    verified,
    startedAt,
    verifiedAt: session?.verifiedAt || null,
    consentMode,
    assignedNumberE164,
    checks,
    latestEventId: latest.id,
    failureReason: latest.status === "FAILED" ? latest.suppressionReason : null,
  };
}
