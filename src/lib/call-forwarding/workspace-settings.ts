import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type CallForwardingWorkspaceSettingsRecord = {
  id: string;
  workspaceId: string;
  assignedPhoneNumberId: string | null;
  businessNumberE164: string | null;
  controlPhoneNumberId: string | null;
  controlNumberE164: string | null;
  smsOutboundEnabled: boolean;
  setupCompletedAt: Date | null;
};

export async function loadCallForwardingWorkspaceSettings(workspaceId: string) {
  const row = await getPrisma().callForwardingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });
  return row as CallForwardingWorkspaceSettingsRecord | null;
}

export async function ensureCallForwardingWorkspaceSettings(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.callForwardingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing as CallForwardingWorkspaceSettingsRecord;
  const row = await prisma.callForwardingWorkspaceSettings.create({
    data: { workspaceId },
  });
  return row as CallForwardingWorkspaceSettingsRecord;
}

export async function updateCallForwardingWorkspaceSettings(
  workspaceId: string,
  patch: Partial<{
    assignedPhoneNumberId: string | null;
    businessNumberE164: string | null;
    controlPhoneNumberId: string | null;
    controlNumberE164: string | null;
    smsOutboundEnabled: boolean;
    setupCompletedAt: Date | null;
  }>,
) {
  await ensureCallForwardingWorkspaceSettings(workspaceId);
  const data: Record<string, unknown> = {};
  if (patch.assignedPhoneNumberId !== undefined) {
    data.assignedPhoneNumberId = patch.assignedPhoneNumberId;
  }
  if (patch.businessNumberE164 !== undefined) {
    data.businessNumberE164 = patch.businessNumberE164
      ? normalizeE164(patch.businessNumberE164)
      : null;
  }
  if (patch.controlPhoneNumberId !== undefined) {
    data.controlPhoneNumberId = patch.controlPhoneNumberId;
  }
  if (patch.controlNumberE164 !== undefined) {
    data.controlNumberE164 = patch.controlNumberE164
      ? normalizeE164(patch.controlNumberE164)
      : null;
  }
  if (patch.smsOutboundEnabled !== undefined) data.smsOutboundEnabled = patch.smsOutboundEnabled;
  if (patch.setupCompletedAt !== undefined) data.setupCompletedAt = patch.setupCompletedAt;
  const row = await getPrisma().callForwardingWorkspaceSettings.update({
    where: { workspaceId },
    data,
  });
  return row as CallForwardingWorkspaceSettingsRecord;
}
