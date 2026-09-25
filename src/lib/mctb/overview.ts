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
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { loadMctbLineInboundConfig } from "@/lib/mctb/inbound-handling/line-config";
import { resolveInboundHandlingDecision } from "@/lib/mctb/inbound-handling/router";
import { INBOUND_HANDLING_MODE_LABELS } from "@/lib/mctb/inbound-handling/types";
import type { MctbOverviewPayload, MctbOverviewStatus } from "@/lib/mctb/overview-types";

export type { MctbOverviewPayload, MctbOverviewStatus } from "@/lib/mctb/overview-types";

export async function loadMctbOverview(workspaceId: string): Promise<MctbOverviewPayload> {
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

  const [
    runtime,
    onboarding,
    solution,
    phoneNumbers,
    compliance,
    reg,
    adminFlags,
    overviewKpis,
    recentEvents,
    recentConversations,
  ] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
    loadMissedCallTextBack(workspaceId),
    loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
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

  const lrConfig = await loadLeadRecoveryConfig(workspaceId);
  const [lrHealth, aiReadiness] = await Promise.all([
    computeLeadRecoveryPolicyHealth(workspaceId, lrConfig),
    evaluateMctbAiBookingReadiness(workspaceId),
  ]);
  const activePolicies = LEAD_RECOVERY_SCENARIO_DEFS.filter((d) => lrConfig.enabledScenarios[d.key]);
  const policySummary = activePolicies.map((d) => d.title.split(" ")[0]).slice(0, 4).join(" · ");
  let lrStatus: "ready" | "needs_attention" | "disabled" = lrConfig.enabled ? "ready" : "disabled";
  let attentionReason: string | null = null;
  let attentionHref: string | null = null;
  if (lrConfig.enabled) {
    if (lrHealth.overall === "PROVIDER_BLOCKED" || lrHealth.overall === "NEEDS_CONFIGURATION") {
      lrStatus = "needs_attention";
      if (!aiReadiness.providerConnected) {
        attentionReason = `${aiReadiness.reason === "provider_disconnected" ? "Calendar provider disconnected" : "Booking provider needs setup"}`;
        attentionHref = "/integrations?provider=microsoft";
      } else {
        attentionReason = "One or more policies need configuration";
        attentionHref = "/mctb/ai-recovery";
      }
    }
  }

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
        ? `${smsPhone ? formatMctbPhoneLabel(smsPhone.e164) : "Sender"} · Ready`
        : "Needs attention",
      recoveryLabel,
      voicemailLabel: runtime.sendAfterVoicemail ? "Enabled" : null,
    },
    performanceSnapshot: null,
    callHandling: await (async () => {
      const line = await loadMctbLineInboundConfig({ workspaceId });
      const decision = await resolveInboundHandlingDecision({ workspaceId });
      const mode = line?.inboundHandlingMode ?? "MCTB_RECOVERY";
      return {
        mode,
        modeLabel: INBOUND_HANDLING_MODE_LABELS[mode],
        forwardingLabel: line?.forwardingVerified ? "Already connected" : "Pending",
        ingressE164: line?.ingressE164 ?? null,
      };
    })(),
    leadRecovery: {
      enabled: lrConfig.enabled,
      activePolicyCount: activePolicies.length,
      policySummary: policySummary || "No policies",
      status: lrStatus,
      statusLabel:
        lrStatus === "ready"
          ? "Ready"
          : lrStatus === "needs_attention"
            ? "Needs attention"
            : "Disabled",
      attentionReason,
      attentionHref,
    },
  };
}
