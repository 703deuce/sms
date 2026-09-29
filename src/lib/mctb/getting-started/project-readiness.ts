import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";
import { getForwardingVerificationStatus } from "@/lib/mctb/onboarding/forwarding-verification";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getLiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { resolveMctbWorkspaceBusinessLineE164 } from "@/lib/mctb/resolve-workspace-business-line";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { buildSetupAttentionItems } from "@/lib/mctb/setup-overview-model";
import {
  isMctbSchedulePaused,
  readMctbScheduleFromCustomFields,
} from "@/lib/mctb/schedule";
import { getMctbRecoveryUsageSnapshot } from "@/lib/mctb/recovery-usage";
import type {
  GettingStartedCapabilityRow,
  GettingStartedEssentialRow,
  MctbGettingStartedPayload,
} from "@/lib/mctb/getting-started/types";

function triggersOn(runtime: {
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
}) {
  return (
    runtime.sendAfterNoAnswer ||
    runtime.sendAfterBusy ||
    runtime.sendAfterRejected ||
    runtime.sendAfterTimeout
  );
}

export async function projectMctbGettingStarted(workspaceId: string): Promise<MctbGettingStartedPayload> {
  const prisma = getPrisma();
  const [
    workspace,
    runtime,
    onboarding,
    forwardingVerification,
    forwardTargetE164,
    liveTest,
    capabilities,
    usage,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, customFieldsConfig: true },
    }),
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
    getForwardingVerificationStatus(workspaceId).catch(() => null),
    getProductionMctbForwardTargetE164(workspaceId),
    getLiveTestStatus(workspaceId),
    resolveMctbCapabilities(workspaceId),
    getMctbRecoveryUsageSnapshot(workspaceId),
  ]);

  const customCfg =
    workspace?.customFieldsConfig && typeof workspace.customFieldsConfig === "object"
      ? (workspace.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbSettings =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const businessLineE164 = resolveMctbWorkspaceBusinessLineE164(
    typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null,
    onboarding.businessNumberE164,
  );

  const consentMode =
    (mctbSettings.consentMode as MctbConsentMode | undefined) ||
    onboarding.consentMode ||
    "press_1";

  const schedule = readMctbScheduleFromCustomFields(customCfg, runtime);
  const recoveryPaused = isMctbSchedulePaused(schedule, runtime) || !runtime.enabled;
  const forwardingVerified = Boolean(
    onboarding.forwardingConnectedAt || forwardingVerification?.verified,
  );

  const messagingReady = capabilities.platformSenderActive || capabilities.customerOwnedSender;

  let notificationDetail = "No notification email configured";
  const recipients = await prisma.mctbNotificationRecipient.findMany({
    where: { workspaceId, enabled: true },
    orderBy: { sortOrder: "asc" },
    take: 3,
    select: { email: true, name: true },
  });
  const primaryEmail = recipients.find((r) => r.email?.trim())?.email;
  if (primaryEmail) {
    notificationDetail = `Replies → ${primaryEmail.trim()}`;
  }

  let voicemailDetail = "Transovo default greeting";
  if (runtime.phoneNumberId) {
    const box = await prisma.voicemailBox.findFirst({
      where: { phoneNumberId: runtime.phoneNumberId },
      select: { greetingText: true, greetingUrl: true },
    });
    if (box?.greetingText?.trim() || box?.greetingUrl?.trim()) {
      voicemailDetail = "Custom greeting · Active";
    }
  }

  const senderPresentation = describeMctbSenderPresentation(
    runtime.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE",
  );
  const msgPreview = runtime.messageTemplate?.trim().replace(/\s+/g, " ").slice(0, 40) || "Standard recovery";
  const recoveryTextDetail = `${msgPreview}${msgPreview.length >= 40 ? "…" : ""} · ${senderPresentation.title}`;

  const businessName = workspace?.name?.trim() || onboarding.businessName?.trim() || "Your business";
  const businessDetail = businessLineE164
    ? `${businessName} · ${formatMctbPhoneLabel(businessLineE164)}`
    : `${businessName} · Business line not set`;

  const forwardDetail = forwardTargetE164
    ? `${formatMctbPhoneLabel(forwardTargetE164)} is ready`
    : runtime.phoneNumberId
      ? "Provisioning your Transovo number…"
      : "Not assigned yet";

  const essentials: GettingStartedEssentialRow[] = [
    {
      id: "business",
      title: "Business information",
      detail: businessDetail,
      statusLabel: businessLineE164 ? "Complete" : "Needs setup",
      tone: businessLineE164 ? "complete" : "needs_setup",
      href: "/settings/business",
      actionLabel: "Review",
      essential: true,
      complete: Boolean(businessLineE164),
    },
    {
      id: "forwarding_number",
      title: "Transovo forwarding number",
      detail: forwardDetail,
      statusLabel: forwardTargetE164 ? "Ready" : "Pending",
      tone: forwardTargetE164 ? "ready" : "pending",
      href: MCTB_ROUTES.phone,
      actionLabel: "View",
      essential: true,
      complete: Boolean(forwardTargetE164),
    },
    {
      id: "connect_phone",
      title: "Connect your business phone",
      detail: "Forward unanswered calls to Transovo.",
      statusLabel: forwardingVerified ? "Ready" : "Needs setup",
      tone: forwardingVerified ? "ready" : "needs_setup",
      href: MCTB_ROUTES.phone,
      actionLabel: forwardingVerified ? "Review" : "Continue",
      essential: true,
      complete: forwardingVerified,
    },
    {
      id: "consent",
      title: "Consent",
      detail:
        consentMode === "press_1"
          ? "Press 1 consent is configured."
          : "Existing permission mode is active.",
      statusLabel: "Ready",
      tone: "ready",
      href: `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
      actionLabel: "Review",
      essential: true,
      complete: true,
    },
    {
      id: "recovery_text",
      title: "Recovery text",
      detail: recoveryTextDetail,
      statusLabel: runtime.messageTemplate?.trim() ? "Ready" : "Needs setup",
      tone: runtime.messageTemplate?.trim() ? "ready" : "needs_setup",
      href: MCTB_ROUTES.textBack,
      actionLabel: "Review",
      essential: true,
      complete: Boolean(runtime.messageTemplate?.trim()),
    },
    {
      id: "voicemail",
      title: "Voicemail greeting",
      detail: voicemailDetail,
      statusLabel: "Ready",
      tone: "ready",
      href: `${MCTB_ROUTES.voicemail}?tab=greeting`,
      actionLabel: "Customize",
      essential: true,
      complete: true,
    },
    {
      id: "notifications",
      title: "Reply notifications",
      detail: notificationDetail,
      statusLabel: primaryEmail ? "Ready" : "Needs setup",
      tone: primaryEmail ? "ready" : "needs_setup",
      href: MCTB_ROUTES.notifications,
      actionLabel: "Review",
      essential: true,
      complete: Boolean(primaryEmail),
    },
    {
      id: "setup_test",
      title: "Test your setup",
      detail: "Place a real missed call and confirm recovery end to end.",
      statusLabel: liveTest.passed ? "Complete" : liveTest.started ? "Testing" : "Not tested",
      tone: liveTest.passed ? "complete" : liveTest.started ? "testing" : "not_tested",
      href: MCTB_ROUTES.setupTest,
      actionLabel: liveTest.passed ? "Review" : "Run test",
      essential: true,
      complete: liveTest.passed,
    },
  ];

  const essentialsComplete = essentials.filter((r) => r.complete).length;
  const essentialsTotal = essentials.length;
  const next = essentials.find((r) => !r.complete) ?? null;

  const attention = buildSetupAttentionItems({
    forwardingVerified,
    messagingReady,
    requiredActions: [],
    triggersOn: triggersOn({
      sendAfterNoAnswer: runtime.sendAfterNoAnswer,
      sendAfterBusy: runtime.sendAfterBusy,
      sendAfterRejected: runtime.sendAfterRejected,
      sendAfterTimeout: runtime.sendAfterTimeout,
    }),
    consentMode,
    existingConsentBlocked:
      consentMode === "existing_consent" && !capabilities.existingConsentCertification,
    voicemailConfigured: true,
  }).map((a) => ({
    id: a.id,
    message: a.message,
    href: a.href,
    actionLabel: a.actionLabel,
  }));

  if (recoveryPaused) {
    attention.unshift({
      id: "recovery_paused",
      message: "Missed-call recovery is paused",
      detail: "Calls can still reach voicemail, but recovery texts are not being sent.",
      href: MCTB_ROUTES.missedCallRecovery,
      actionLabel: "Resume",
    });
  }

  const capabilitiesRows: GettingStartedCapabilityRow[] = [
    {
      id: "existing_consent",
      title: "Existing Consent",
      detail: "Use permission your business already has instead of Press 1.",
      statusLabel: capabilities.existingConsentCertification
        ? "Active"
        : capabilities.recoveryPaid
          ? "Available"
          : "Locked",
      tone: capabilities.existingConsentCertification
        ? "active"
        : capabilities.recoveryPaid
          ? "ready"
          : "locked",
      href: `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
      actionLabel: capabilities.existingConsentCertification ? "Review" : "Configure",
      locked: !capabilities.recoveryPaid && !capabilities.existingConsentCertification,
    },
    {
      id: "booking_link",
      title: "Booking or request link",
      detail: "Give recovered callers a next step after they reply.",
      statusLabel: capabilities.bookingLinks ? "Available" : "Locked",
      tone: capabilities.bookingLinks ? "ready" : "locked",
      href: MCTB_ROUTES.textBack,
      actionLabel: "Configure",
      locked: !capabilities.bookingLinks,
    },
    {
      id: "urgent_alerts",
      title: "Urgent lead alerts",
      detail: "Detect urgent replies and alert your team immediately.",
      statusLabel: capabilities.urgentClassification ? "Available" : "Locked",
      tone: capabilities.urgentClassification ? "ready" : "locked",
      href: MCTB_ROUTES.notifications,
      actionLabel: "Configure",
      locked: !capabilities.urgentClassification,
    },
    {
      id: "ai_recovery",
      title: "AI Recovery",
      detail: "Continue the conversation automatically after callers reply.",
      statusLabel: capabilities.aiRecoveryEntitled ? "Available" : "Locked",
      tone: capabilities.aiRecoveryEntitled ? "ready" : "locked",
      href: MCTB_ROUTES.aiRecovery,
      actionLabel: "Configure",
      locked: !capabilities.aiRecoveryEntitled,
    },
    {
      id: "own_sender",
      title: "Use your own texting number",
      detail: "Send from an approved business toll-free or 10DLC number.",
      statusLabel: capabilities.customerOwnedSender
        ? "Active"
        : capabilities.ownSenderAddOnEntitled
          ? "Pending"
          : "Locked",
      tone: capabilities.customerOwnedSender
        ? "active"
        : capabilities.ownSenderAddOnEntitled
          ? "pending"
          : "locked",
      href: MCTB_ROUTES.phone,
      actionLabel: "Manage",
      locked: !capabilities.ownSenderAddOnEntitled && !capabilities.customerOwnedSender,
    },
  ];

  const operationalReady =
    essentialsComplete === essentialsTotal && !recoveryPaused && forwardingVerified;

  const usageLine = `This month: ${usage.usedInPeriod} of ${usage.limit} recoveries used`;

  return {
    workspaceName: businessName,
    essentialsComplete,
    essentialsTotal,
    nextEssentialId: next?.id ?? null,
    nextEssentialTitle: next?.title ?? null,
    continueSetupHref: next?.href ?? MCTB_ROUTES.home,
    operationalReady,
    recoveryPaused,
    recoveryLabel: recoveryPaused ? "Missed-call recovery is paused" : "Missed-call recovery is ready",
    usageLine: usage.atLimit ? `${usageLine} · allowance reached` : usageLine,
    essentials,
    attention,
    capabilities: capabilitiesRows,
  };
}
