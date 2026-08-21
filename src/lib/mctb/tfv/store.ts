import { getPrisma } from "@/lib/db";
import {
  complianceStatusToA2p,
  type TollFreeVerificationRecord,
  type TollFreeVerificationStatus,
} from "@/lib/messaging/compliance/messaging-compliance";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseTfvFromSettings(
  workspaceId: string,
  phoneNumberId: string,
  phoneE164: string,
  settingsJson: unknown,
): TollFreeVerificationRecord | null {
  const settings = asRecord(settingsJson);
  const raw = asRecord(settings.tollFreeVerification);
  if (!raw.status) return null;
  return {
    workspaceId,
    phoneNumberId,
    phoneE164,
    provider: "twilio",
    status: String(raw.status) as TollFreeVerificationStatus,
    twilioVerificationSid: (raw.twilioVerificationSid as string) || null,
    externalReferenceId: String(raw.externalReferenceId || workspaceId),
    submissionSnapshot: asRecord(raw.submissionSnapshot),
    providerStatusRaw: (raw.providerStatusRaw as string) || null,
    submittedAt: (raw.submittedAt as string) || null,
    approvedAt: (raw.approvedAt as string) || null,
    rejectedAt: (raw.rejectedAt as string) || null,
    actionRequiredAt: (raw.actionRequiredAt as string) || null,
    failureReason: (raw.failureReason as string) || null,
    lastSyncedAt: (raw.lastSyncedAt as string) || null,
  };
}

export async function loadTfvForPhoneNumber(
  phoneNumberId: string,
): Promise<TollFreeVerificationRecord | null> {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      settingsJson: true,
    },
  });
  if (!pn) return null;
  return parseTfvFromSettings(pn.workspaceId, pn.id, pn.e164, pn.settingsJson);
}

export async function saveTfvForPhoneNumber(
  record: TollFreeVerificationRecord,
): Promise<TollFreeVerificationRecord> {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: record.phoneNumberId, workspaceId: record.workspaceId },
    select: { settingsJson: true },
  });
  if (!pn) throw new Error("Trial phone number not found for workspace");

  const settings = asRecord(pn.settingsJson);
  const nextSettings = {
    ...settings,
    messagingCompliance: {
      type: "TOLL_FREE_VERIFICATION",
      status: record.status,
    },
    tollFreeVerification: {
      status: record.status,
      twilioVerificationSid: record.twilioVerificationSid,
      externalReferenceId: record.externalReferenceId,
      submissionSnapshot: record.submissionSnapshot,
      providerStatusRaw: record.providerStatusRaw,
      submittedAt: record.submittedAt,
      approvedAt: record.approvedAt,
      rejectedAt: record.rejectedAt,
      actionRequiredAt: record.actionRequiredAt,
      failureReason: record.failureReason,
      lastSyncedAt: record.lastSyncedAt,
    },
  };

  await prisma.phoneNumber.update({
    where: { id: record.phoneNumberId },
    data: {
      settingsJson: nextSettings,
      a2pStatus: complianceStatusToA2p(record.status),
    },
  });

  return record;
}

export async function loadWorkspaceTfvForPhone(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<TollFreeVerificationRecord | null> {
  if (!phoneNumberId) return null;
  const record = await loadTfvForPhoneNumber(phoneNumberId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

/** @deprecated Use loadWorkspaceTfvForPhone */
export const loadTrialTfvForWorkspace = loadWorkspaceTfvForPhone;
