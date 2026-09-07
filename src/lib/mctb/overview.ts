import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { loadMctbAnalytics } from "@/lib/mctb/analytics";
import { MCTB_CONSENT_MODE_LABELS, normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import { loadMctbOnboardingState, isOnboardingComplete } from "@/lib/mctb/onboarding/state";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  formatRecoveryStatus,
  formatReplyStatus,
} from "@/lib/mctb/recovery-display";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { loadMctbSetupPhoneOptionsWithTelnyxSync } from "@/lib/mctb/setup-telnyx-messaging-sync";
import {
  isMctbSchedulePaused,
  previewMctbPauseState,
  readMctbScheduleFromCustomFields,
} from "@/lib/mctb/schedule";
import { deriveRequiredActions } from "@/lib/compliance-helpers";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { loadMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";

export type MctbOverviewStatus =
  | "setup_incomplete"
  | "paused"
  | "messaging_blocked"
  | "active";

export type MctbOverviewPayload = {
  status: MctbOverviewStatus;
  statusLabel: string;
  pausedUntil: string | null;
  setupComplete: boolean;
  kpis: {
    missedCallsToday: number;
    recoveryTextsToday: number;
    repliesToday: number;
    needsReplyCount: number;
  };
  recentMissedCalls: Array<{
    id: string;
    callerLabel: string;
    missedAt: string;
    recoveryLabel: string;
    replyLabel: string;
  }>;
  recentConversations: Array<{
    id: string;
    label: string;
    preview: string;
    updatedAt: string;
    needsReply: boolean;
    replied: boolean;
  }>;
  setupHealth: {
    businessLine: string | null;
    forwardingLabel: string;
    consentLabel: string;
    senderLabel: string;
    recoveryLabel: string;
    voicemailLabel: string | null;
  };
  performanceSnapshot: {
    missedCalls: number;
    recoveryTexts: number;
    replies: number;
    replyRate: number;
  };
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function loadMctbOverview(workspaceId: string): Promise<MctbOverviewPayload> {
  const prisma = getPrisma();
  const todayStart = startOfToday();

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const customCfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbSettings =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const [
    runtime,
    onboarding,
    solution,
    phoneNumbers,
    compliance,
    reg,
    adminFlags,
    analytics7d,
    recentEvents,
    missedToday,
    sentToday,
    repliedToday,
    needsReplyCount,
    recentConversations,
  ] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
    loadMissedCallTextBack(workspaceId),
    loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
    loadAdminMctbTestFlags(workspaceId),
    loadMctbAnalytics(workspaceId, "7d"),
    prisma.missedCallEvent.findMany({
      where: { workspaceId },
      orderBy: { detectedAt: "desc" },
      take: 5,
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: todayStart } },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: todayStart } },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        status: "CUSTOMER_REPLIED",
        updatedAt: { gte: todayStart },
      },
    }),
    prisma.conversation.count({
      where: {
        workspaceId,
        productSource: appProductSourceToPrisma("mctb"),
        status: "OPEN",
        unread: true,
      },
    }),
    prisma.conversation.findMany({
      where: {
        workspaceId,
        productSource: appProductSourceToPrisma("mctb"),
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        contact: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const requiredActions = deriveRequiredActions(compliance.registration, reg);
  const messagingReady = isMctbSetupMessagingReady({
    phoneNumbers,
    requiredActions,
    adminFlags,
  });

  const scheduleSettings = readMctbScheduleFromCustomFields(customCfg, runtime);
  const effectiveSchedule = previewMctbPauseState(scheduleSettings, runtime);
  const paused = isMctbSchedulePaused(effectiveSchedule, runtime);

  const businessLineE164 =
    (typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null) ||
    onboarding.businessNumberE164 ||
    null;

  const forwardingVerified = Boolean(onboarding.forwardingConnectedAt);
  const hasRuntimeNumber = Boolean(runtime.phoneNumberId);
  const setupComplete =
    isOnboardingComplete(onboarding) || (hasRuntimeNumber && forwardingVerified && messagingReady);

  const consentMode = normalizeMctbConsentMode(
    mctbSettings.consentMode ??
      (solution?.config && typeof solution.config === "object"
        ? (solution.config as Record<string, unknown>).consentMode
        : null),
  );

  const smsPhone = phoneNumbers.find((p) => p.id === runtime.smsPhoneNumberId);
  const senderReady = messagingReady && Boolean(smsPhone);

  let status: MctbOverviewStatus = "active";
  let statusLabel = "Active";
  if (!setupComplete) {
    status = "setup_incomplete";
    statusLabel = "Setup incomplete";
  } else if (paused) {
    status = "paused";
    statusLabel = "Paused";
  } else if (!messagingReady) {
    status = "messaging_blocked";
    statusLabel = "Messaging blocked";
  }

  const recoveryLabel = paused
    ? effectiveSchedule.pauseUntil
      ? `Paused until ${new Date(effectiveSchedule.pauseUntil).toLocaleString()}`
      : "Paused"
    : runtime.enabled
      ? "Active"
      : "Inactive";

  return {
    status,
    statusLabel,
    pausedUntil: effectiveSchedule.pauseUntil ?? null,
    setupComplete,
    kpis: {
      missedCallsToday: missedToday,
      recoveryTextsToday: sentToday,
      repliesToday: repliedToday,
      needsReplyCount,
    },
    recentMissedCalls: recentEvents.map((e: (typeof recentEvents)[number]) => ({
      id: e.id,
      callerLabel: formatMctbPhoneLabel(e.callerE164),
      missedAt: e.detectedAt.toISOString(),
      recoveryLabel: formatRecoveryStatus(e.status, e.suppressionReason),
      replyLabel: formatReplyStatus(e.status),
    })),
    recentConversations: recentConversations.map((c: (typeof recentConversations)[number]) => {
      const lastMsg = c.messages[0];
      const preview = lastMsg?.body?.slice(0, 80) || "No messages yet";
      const name = c.contact?.name || c.fromE164 || "Unknown";
      return {
        id: c.id,
        label: name,
        preview,
        updatedAt: c.updatedAt.toISOString(),
        needsReply: c.status === "OPEN" && c.unread,
        replied: !c.unread && c.status === "OPEN",
      };
    }),
    setupHealth: {
      businessLine: businessLineE164 ? formatMctbPhoneLabel(businessLineE164) : null,
      forwardingLabel: forwardingVerified ? "Verified" : "Not verified",
      consentLabel: MCTB_CONSENT_MODE_LABELS[consentMode].title,
      senderLabel: senderReady
        ? `${smsPhone ? formatMctbPhoneLabel(smsPhone.e164) : "Sender"} · Ready`
        : "Needs attention",
      recoveryLabel,
      voicemailLabel: runtime.sendAfterVoicemail ? "Enabled" : null,
    },
    performanceSnapshot: {
      missedCalls: analytics7d.totalMissed,
      recoveryTexts: analytics7d.textsSent,
      replies: analytics7d.replies,
      replyRate: analytics7d.replyRate,
    },
  };
}
