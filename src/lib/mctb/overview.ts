import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { loadMctbOverviewKpis } from "@/lib/mctb/overview-kpis";
import { MCTB_CONSENT_MODE_LABELS, normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import { loadMctbOnboardingState, isOnboardingComplete } from "@/lib/mctb/onboarding/state";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  formatRecoveryStatus,
  formatReplyStatus,
} from "@/lib/mctb/recovery-display";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { loadMctbSetupPhoneOptions } from "@/lib/numbers/workspace-accessible-numbers";
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
import { loadLeadRecoveryConfigPersisted } from "@/lib/mctb/lead-recovery/config";
import { buildMctbOverviewLeadRecoveryCard } from "@/lib/mctb/overview-lead-recovery-card";
import { INBOUND_HANDLING_MODE_LABELS } from "@/lib/mctb/inbound-handling/types";
import type { MctbOverviewPayload, MctbOverviewStatus } from "@/lib/mctb/overview-types";

export type { MctbOverviewPayload, MctbOverviewStatus } from "@/lib/mctb/overview-types";

export type MctbOverviewEnrichment = Pick<MctbOverviewPayload, "leadRecovery">;

const OVERVIEW_LEAD_RECOVERY_PLACEHOLDER: MctbOverviewPayload["leadRecovery"] = {
  enabled: false,
  activePolicyCount: 0,
  policySummary: "Loading…",
  status: "disabled",
  statusLabel: "—",
  attentionReason: null,
  attentionHref: null,
};

const OVERVIEW_CALL_HANDLING_PLACEHOLDER: MctbOverviewPayload["callHandling"] = {
  mode: "MCTB_RECOVERY",
  modeLabel: INBOUND_HANDLING_MODE_LABELS.MCTB_RECOVERY,
  forwardingLabel: "—",
  ingressE164: null,
};

/** Tier 1 — dashboard KPIs, recent activity, setup health (no AI booking / lead-recovery health). */
export async function loadMctbOverviewCore(workspaceId: string): Promise<MctbOverviewPayload> {
  const core = await loadMctbOverviewShared(workspaceId);
  return {
    ...core,
    performanceSnapshot: null,
    callHandling: OVERVIEW_CALL_HANDLING_PLACEHOLDER,
    leadRecovery: OVERVIEW_LEAD_RECOVERY_PLACEHOLDER,
  };
}

/** Tier 2 — AI Recovery card (persisted V1 config; no direct-booking provider readiness). */
export async function loadMctbOverviewEnrichment(workspaceId: string): Promise<MctbOverviewEnrichment> {
  const lrConfig = await loadLeadRecoveryConfigPersisted(workspaceId);
  const leadRecovery = await buildMctbOverviewLeadRecoveryCard(workspaceId, lrConfig);
  return { leadRecovery };
}

export async function loadMctbOverview(workspaceId: string): Promise<MctbOverviewPayload> {
  const [core, enrichment] = await Promise.all([
    loadMctbOverviewCore(workspaceId),
    loadMctbOverviewEnrichment(workspaceId),
  ]);
  return { ...core, ...enrichment };
}

async function loadMctbOverviewShared(workspaceId: string): Promise<Omit<MctbOverviewPayload, "leadRecovery" | "callHandling" | "performanceSnapshot">> {
  void import("@/lib/mctb/forwarding-degraded-notify").then((m) =>
    m.maybeNotifyForwardingDegraded(workspaceId).catch(() => undefined),
  );

  const prisma = getPrisma();

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

  const workspaceNumbersPromise = loadPhoneNumbers(workspaceId, { includeLinked: true });

  const [
    runtime,
    onboarding,
    solution,
    phoneNumbers,
    compliance,
    workspaceNumbers,
    adminFlags,
    overviewKpis,
    recentEvents,
    recentConversations,
  ] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
    loadMissedCallTextBack(workspaceId),
    loadMctbSetupPhoneOptions(workspaceId),
    workspaceNumbersPromise.then((nums) => loadComplianceOverview(workspaceId, { phoneNumbers: nums })),
    workspaceNumbersPromise,
    loadAdminMctbTestFlags(workspaceId),
    loadMctbOverviewKpis(workspaceId),
    prisma.missedCallEvent.findMany({
      where: { workspaceId },
      orderBy: { detectedAt: "desc" },
      take: 8,
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

  const requiredActions = deriveRequiredActions(compliance.registration, workspaceNumbers);
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
  const onboardingComplete = isOnboardingComplete(onboarding);
  const setupComplete =
    onboardingComplete ||
    (hasRuntimeNumber && forwardingVerified && messagingReady);

  const consentMode = normalizeMctbConsentMode(
    mctbSettings.consentMode ??
      (solution?.config && typeof solution.config === "object"
        ? (solution.config as Record<string, unknown>).consentMode
        : null),
  );

  const smsPhone = phoneNumbers.find((p) => p.id === runtime.smsPhoneNumberId);
  const senderMode = runtime.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  const senderReady =
    messagingReady && (senderMode === "PLATFORM" || Boolean(smsPhone));

  let status: MctbOverviewStatus = "active";
  let statusLabel = "Active";
  if (!setupComplete) {
    status = "setup_incomplete";
    statusLabel = "Setup incomplete";
  } else if (!messagingReady && onboardingComplete) {
    status = "messaging_blocked";
    statusLabel = "Messaging blocked";
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
      windowLabel: overviewKpis.windowLabel,
      timeZone: overviewKpis.timeZone,
      missedCallsToday: overviewKpis.missedCalls,
      recoveryTextsToday: overviewKpis.recoveryTextsSent,
      repliesToday: overviewKpis.customerReplies,
      needsReplyCount: overviewKpis.needsReplyCount,
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
        ? senderMode === "PLATFORM"
          ? "Platform sender · Ready"
          : `${smsPhone ? formatMctbPhoneLabel(smsPhone.e164) : "Sender"} · Ready`
        : "Needs attention",
      recoveryLabel,
      voicemailLabel: runtime.sendAfterVoicemail ? "Enabled" : null,
    },
  };
}
