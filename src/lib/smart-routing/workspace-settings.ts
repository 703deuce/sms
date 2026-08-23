import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type SmartRoutingWorkspaceSettingsRecord = {
  id: string;
  workspaceId: string;
  publicBusinessE164: string | null;
  routingNumberE164: string | null;
  assignedPhoneNumberId: string | null;
  callbackNumberE164: string | null;
  assignedCallbackPhoneNumberId: string | null;
  routingMode: string;
  callerIdStatus: string;
  callerIdProvider: string | null;
  callerIdProviderRef: string | null;
  callerIdMethod: string | null;
  callerIdVerifiedAt: Date | null;
  callerIdFailedReason: string | null;
  callerIdRequestedAt: Date | null;
  outboundEnabled: boolean;
  scheduleOverrideJson: Record<string, unknown> | null;
  setupCompletedAt: Date | null;
};

export async function loadSmartRoutingWorkspaceSettings(
  workspaceId: string,
): Promise<SmartRoutingWorkspaceSettingsRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });
  return row as SmartRoutingWorkspaceSettingsRecord | null;
}

export async function ensureSmartRoutingWorkspaceSettings(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing as SmartRoutingWorkspaceSettingsRecord;
  const row = await prisma.smartRoutingWorkspaceSettings.create({
    data: { workspaceId },
  });
  return row as SmartRoutingWorkspaceSettingsRecord;
}

export async function updateSmartRoutingWorkspaceSettings(
  workspaceId: string,
  patch: Partial<{
    publicBusinessE164: string | null;
    routingNumberE164: string | null;
    assignedPhoneNumberId: string | null;
    callbackNumberE164: string | null;
    assignedCallbackPhoneNumberId: string | null;
    routingMode: string;
    outboundEnabled: boolean;
    scheduleOverrideJson: Record<string, unknown> | null;
    setupCompletedAt: Date | null;
  }>,
) {
  const prisma = getPrisma();
  await ensureSmartRoutingWorkspaceSettings(workspaceId);
  const data: Record<string, unknown> = {};
  if (patch.publicBusinessE164 !== undefined) {
    data.publicBusinessE164 = patch.publicBusinessE164
      ? normalizeE164(patch.publicBusinessE164)
      : null;
  }
  if (patch.routingNumberE164 !== undefined) {
    data.routingNumberE164 = patch.routingNumberE164
      ? normalizeE164(patch.routingNumberE164)
      : null;
  }
  if (patch.assignedPhoneNumberId !== undefined) {
    data.assignedPhoneNumberId = patch.assignedPhoneNumberId;
  }
  if (patch.callbackNumberE164 !== undefined) {
    data.callbackNumberE164 = patch.callbackNumberE164
      ? normalizeE164(patch.callbackNumberE164)
      : null;
  }
  if (patch.assignedCallbackPhoneNumberId !== undefined) {
    data.assignedCallbackPhoneNumberId = patch.assignedCallbackPhoneNumberId;
  }
  if (patch.routingMode !== undefined) data.routingMode = patch.routingMode;
  if (patch.outboundEnabled !== undefined) data.outboundEnabled = patch.outboundEnabled;
  if (patch.scheduleOverrideJson !== undefined) {
    data.scheduleOverrideJson = patch.scheduleOverrideJson;
  }
  if (patch.setupCompletedAt !== undefined) data.setupCompletedAt = patch.setupCompletedAt;
  const row = await prisma.smartRoutingWorkspaceSettings.update({
    where: { workspaceId },
    data,
  });
  return row as SmartRoutingWorkspaceSettingsRecord;
}

export async function resolveVerifiedBusinessCallerId(workspaceId: string): Promise<string | null> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (!settings || settings.callerIdStatus !== "verified") return null;
  return settings.publicBusinessE164?.trim() || null;
}
