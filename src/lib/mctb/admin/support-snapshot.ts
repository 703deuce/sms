/**
 * MCTB operational snapshot for admin/support — one view per workspace.
 */
import { getPrisma } from "@/lib/db";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { loadWorkspaceTfvForPhone } from "@/lib/mctb/tfv/store";
import { mapTfvRecordToUiStatus, tfvStatusLabel } from "@/lib/mctb/onboarding/trial-number";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type MctbSupportSnapshot = {
  workspaceId: string;
  workspaceName: string;
  billingPlan: string | null;
  stripeSubscriptionId: string | null;
  mctbServiceStatus: string;
  canSendAutomaticRecovery: boolean;
  trialSmsSegmentsUsed: number;
  trialSmsSegmentLimit: number | null;
  trialDaysRemaining: number | null;
  tollFree: {
    e164: string | null;
    phoneNumberId: string | null;
    twilioSid: string | null;
    provider: string | null;
    status: string | null;
    voiceStatus: string | null;
    messagingVerificationStatus: string | null;
  };
  tfv: {
    status: string;
    statusLabel: string;
    verificationSid: string | null;
    failureReason: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    lastSyncedAt: string | null;
  };
  onboarding: {
    currentStep: string;
    consentMode: string | null;
    forwardingConnected: boolean;
    businessNumberE164: string | null;
    liveTestPassed: boolean;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
  };
  activity: {
    lastMissedCallAt: string | null;
    lastOutboundSmsAt: string | null;
    lastInboundSmsAt: string | null;
    lastDeliveryError: string | null;
  };
  numberLifecycle: {
    trialEndedAt: string | null;
    trialNumberHoldUntil: string | null;
    trialNumberReleasedAt: string | null;
    trialNumberReleaseScheduled: boolean;
  };
};

export async function loadMctbSupportSnapshot(workspaceId: string): Promise<MctbSupportSnapshot | null> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      stripeSubscriptionId: true,
      customFieldsConfig: true,
      workspaceLimits: { select: { limits: true } },
    },
  });
  if (!ws) return null;

  const [state, entitlement, phoneRow, lastMissed, lastConvMsg] = await Promise.all([
    loadMctbOnboardingState(workspaceId),
    getMctbEntitlement(workspaceId),
    (async () => {
      const wn = getWorkspaceTollFreeNumber(await loadMctbOnboardingState(workspaceId));
      if (!wn?.phoneNumberId) return null;
      return prisma.phoneNumber.findFirst({
        where: { id: wn.phoneNumberId, workspaceId },
        select: {
          id: true,
          e164: true,
          twilioSid: true,
          provider: true,
          status: true,
          settingsJson: true,
        },
      });
    })(),
    prisma.missedCallEvent.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, smsSentAt: true, status: true, suppressionReason: true },
    }),
    prisma.conversationMessage.findFirst({
      where: { conversation: { workspaceId } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, direction: true },
    }),
  ]);

  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  const tfvRecord = await loadWorkspaceTfvForPhone(workspaceId, workspaceNumber?.phoneNumberId);
  const tfvUi = tfvRecord ? mapTfvRecordToUiStatus(tfvRecord.status) : "not_started";
  const limits = asRecord(ws.workspaceLimits?.limits);
  const cfg = asRecord(ws.customFieldsConfig);
  const mctbCfg = asRecord(cfg.mctb);

  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    billingPlan: ws.billingPlan,
    stripeSubscriptionId: ws.stripeSubscriptionId,
    mctbServiceStatus: entitlement.serviceStatus,
    canSendAutomaticRecovery: entitlement.canSendAutomaticRecovery,
    trialSmsSegmentsUsed: entitlement.trialSmsSegmentsUsed,
    trialSmsSegmentLimit: entitlement.trialSmsSegmentLimit,
    trialDaysRemaining: entitlement.trialDaysRemaining,
    tollFree: {
      e164: workspaceNumber?.e164 || phoneRow?.e164 || null,
      phoneNumberId: workspaceNumber?.phoneNumberId || phoneRow?.id || null,
      twilioSid: phoneRow?.twilioSid || null,
      provider: phoneRow?.provider || workspaceNumber?.provider || null,
      status: phoneRow?.status || null,
      voiceStatus: workspaceNumber?.voiceStatus || null,
      messagingVerificationStatus: workspaceNumber?.messagingVerificationStatus || tfvUi,
    },
    tfv: {
      status: tfvRecord?.status || "NOT_STARTED",
      statusLabel: tfvStatusLabel(tfvUi),
      verificationSid: tfvRecord?.twilioVerificationSid || null,
      failureReason: tfvRecord?.failureReason || null,
      submittedAt: tfvRecord?.submittedAt || null,
      approvedAt: tfvRecord?.approvedAt || null,
      lastSyncedAt: tfvRecord?.lastSyncedAt || null,
    },
    onboarding: {
      currentStep: state.currentStep,
      consentMode: state.consentMode || (mctbCfg.consentMode as string) || null,
      forwardingConnected: Boolean(state.forwardingConnectedAt),
      businessNumberE164: state.businessNumberE164 || null,
      liveTestPassed: Boolean(state.liveTestPassedAt),
      trialStartedAt: (limits.trialStartedAt as string) || null,
      trialEndsAt: (limits.trialEndsAt as string) || null,
    },
    activity: {
      lastMissedCallAt: lastMissed?.createdAt?.toISOString() || null,
      lastOutboundSmsAt:
        lastMissed?.smsSentAt?.toISOString() ||
        (lastConvMsg?.direction === "outbound" ? lastConvMsg.createdAt.toISOString() : null),
      lastInboundSmsAt:
        lastConvMsg?.direction === "inbound" ? lastConvMsg.createdAt.toISOString() : null,
      lastDeliveryError:
        lastMissed?.status === "FAILED" ? lastMissed.suppressionReason || "FAILED" : null,
    },
    numberLifecycle: {
      trialEndedAt: (limits.trialEndedAt as string) || null,
      trialNumberHoldUntil: (limits.trialNumberHoldUntil as string) || null,
      trialNumberReleasedAt: (limits.trialNumberReleasedAt as string) || null,
      trialNumberReleaseScheduled: Boolean(limits.trialNumberReleaseScheduled),
    },
  };
}
