import { mapTfvRecordToUiStatus } from "@/lib/mctb/onboarding/trial-number";
import { recordFunnelEvent, saveMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber, withWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import {
  type TollFreeVerificationRecord,
  type TollFreeVerificationStatus,
} from "@/lib/messaging/compliance/messaging-compliance";
import { loadTfvForPhoneNumber, saveTfvForPhoneNumber } from "./store";

const TFV_STATUS_RANK: Record<TollFreeVerificationStatus, number> = {
  NOT_STARTED: 0,
  DRAFT: 10,
  SUBMITTED: 20,
  PENDING: 30,
  ACTION_REQUIRED: 40,
  REJECTED: 70,
  APPROVED: 100,
};

export function mergeTfvStatuses(
  existing: TollFreeVerificationStatus,
  incoming: TollFreeVerificationStatus,
): TollFreeVerificationStatus {
  if (existing === "APPROVED") return "APPROVED";
  if (existing === "REJECTED" && incoming !== "APPROVED") return "REJECTED";
  return TFV_STATUS_RANK[incoming] >= TFV_STATUS_RANK[existing] ? incoming : existing;
}

export type TfvStatusUpdateInput = {
  source: "webhook" | "poll" | "submit";
  workspaceId: string;
  phoneNumberId: string;
  phoneE164: string;
  externalReferenceId: string;
  mappedStatus: TollFreeVerificationStatus;
  verificationSid?: string | null;
  providerStatusRaw?: string | null;
  rejectionReason?: string | null;
  submissionSnapshot?: Record<string, unknown> | null;
  submittedAt?: string | null;
};

export type TfvStatusUpdateResult = {
  applied: boolean;
  skipped?: string;
  record: TollFreeVerificationRecord;
  statusChanged: boolean;
  previousStatus?: TollFreeVerificationStatus;
};

import { isMctbTfvExternalReferenceId } from "./external-reference";

/** Single canonical TFV state transition used by submit, polling, and webhooks. */
export async function applyTfvStatusUpdate(
  input: TfvStatusUpdateInput,
): Promise<TfvStatusUpdateResult> {
  if (!isMctbTfvExternalReferenceId(input.workspaceId, input.phoneNumberId, input.externalReferenceId)) {
    throw new Error("TFV external reference does not match workspace phone scope.");
  }

  const existing = await loadTfvForPhoneNumber(input.phoneNumberId);
  if (existing && existing.workspaceId !== input.workspaceId) {
    throw new Error("TFV record workspace mismatch.");
  }

  if (
    existing?.twilioVerificationSid &&
    input.verificationSid &&
    existing.twilioVerificationSid !== input.verificationSid
  ) {
    return {
      applied: false,
      skipped: "unknown_verification_sid",
      record: existing,
      statusChanged: false,
      previousStatus: existing.status,
    };
  }

  const previousStatus = existing?.status || ("NOT_STARTED" as TollFreeVerificationStatus);
  const mergedStatus = mergeTfvStatuses(previousStatus, input.mappedStatus);
  const statusChanged = mergedStatus !== previousStatus;
  const now = new Date().toISOString();

  const record: TollFreeVerificationRecord = {
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    phoneE164: input.phoneE164,
    provider: "twilio",
    status: mergedStatus,
    twilioVerificationSid: input.verificationSid || existing?.twilioVerificationSid || null,
    externalReferenceId: input.externalReferenceId,
    submissionSnapshot: input.submissionSnapshot ?? existing?.submissionSnapshot ?? null,
    providerStatusRaw: input.providerStatusRaw ?? existing?.providerStatusRaw ?? null,
    submittedAt: input.submittedAt || existing?.submittedAt || (input.source === "submit" ? now : null),
    approvedAt:
      mergedStatus === "APPROVED"
        ? existing?.approvedAt || now
        : existing?.approvedAt || null,
    rejectedAt:
      mergedStatus === "REJECTED"
        ? existing?.rejectedAt || now
        : existing?.rejectedAt || null,
    actionRequiredAt:
      mergedStatus === "ACTION_REQUIRED"
        ? existing?.actionRequiredAt || now
        : existing?.actionRequiredAt || null,
    failureReason:
      input.rejectionReason ||
      (mergedStatus === "ACTION_REQUIRED" || mergedStatus === "REJECTED"
        ? input.rejectionReason || existing?.failureReason || input.providerStatusRaw || null
        : existing?.failureReason || null),
    lastSyncedAt: now,
  };

  await saveTfvForPhoneNumber(record);

  const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
  const state = await loadMctbOnboardingState(input.workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  if (workspaceNumber?.phoneNumberId === input.phoneNumberId) {
    const uiStatus = mapTfvRecordToUiStatus(record.status);
    await saveMctbOnboardingState(input.workspaceId, {
      ...withWorkspaceTollFreeNumber(state, {
        ...workspaceNumber,
        messagingVerificationStatus: uiStatus,
        verificationId: record.twilioVerificationSid,
      }),
      ...(mergedStatus === "APPROVED" ? { tfvApprovedAt: record.approvedAt || now } : {}),
      ...(mergedStatus === "REJECTED" ? { tfvRejectedAt: record.rejectedAt || now } : {}),
      ...(input.source === "submit" ? { tfvSubmittedAt: record.submittedAt || now } : {}),
      currentStep:
        mergedStatus === "APPROVED" && state.currentStep === "pending"
          ? "connect"
          : state.currentStep,
    });
  }

  if (statusChanged && mergedStatus === "APPROVED") {
    await applyTfvApprovalSideEffects(input.workspaceId, record);
  } else if (statusChanged && mergedStatus === "ACTION_REQUIRED") {
    await recordFunnelEvent(input.workspaceId, "MCTB_TFV_ACTION_REQUIRED", {
      reason: record.failureReason || record.providerStatusRaw,
    });
  } else if (statusChanged && mergedStatus === "REJECTED") {
    await recordFunnelEvent(input.workspaceId, "MCTB_TFV_REJECTED", {
      reason: record.failureReason || record.providerStatusRaw,
    });
  }

  return {
    applied: true,
    record,
    statusChanged,
    previousStatus,
  };
}

export async function applyTfvApprovalSideEffects(
  workspaceId: string,
  record: TollFreeVerificationRecord,
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  await prisma.messagingRegistration.updateMany({
    where: { workspaceId },
    data: {
      registrationApprovedAt: new Date(record.approvedAt || new Date().toISOString()),
      messagingEnabled: true,
    },
  });

  const state = await (await import("@/lib/mctb/onboarding/state")).loadMctbOnboardingState(
    workspaceId,
  );
  if (!state.funnelEvents?.MCTB_TFV_APPROVED) {
    await recordFunnelEvent(workspaceId, "MCTB_TFV_APPROVED", {
      verificationSid: record.twilioVerificationSid,
      phoneNumberId: record.phoneNumberId,
    });
  }
}
