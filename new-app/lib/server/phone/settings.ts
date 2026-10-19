import { getPrisma } from "@/lib/server/db";

export type PhoneSettingsDto = {
  defaultCallerIdNumber: string | null;
  recordCalls: boolean;
  transcribeVoicemail: boolean;
  noiseSuppression: boolean;
};

export async function getPhoneSettings(workspaceId: string): Promise<PhoneSettingsDto> {
  const prisma = getPrisma();
  const row = await prisma.workspacePhoneSettings.findUnique({ where: { workspaceId } });
  return {
    defaultCallerIdNumber: row?.defaultCallerIdNumber ?? null,
    recordCalls: row?.recordCalls ?? true,
    transcribeVoicemail: row?.transcribeVoicemail ?? true,
    noiseSuppression: row?.noiseSuppression ?? true,
  };
}

export async function upsertPhoneSettings(
  workspaceId: string,
  patch: Partial<PhoneSettingsDto>,
): Promise<PhoneSettingsDto> {
  const prisma = getPrisma();
  const row = await prisma.workspacePhoneSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultCallerIdNumber: patch.defaultCallerIdNumber ?? null,
      recordCalls: patch.recordCalls ?? true,
      transcribeVoicemail: patch.transcribeVoicemail ?? true,
      noiseSuppression: patch.noiseSuppression ?? true,
    },
    update: {
      ...(patch.defaultCallerIdNumber !== undefined
        ? { defaultCallerIdNumber: patch.defaultCallerIdNumber }
        : {}),
      ...(patch.recordCalls !== undefined ? { recordCalls: patch.recordCalls } : {}),
      ...(patch.transcribeVoicemail !== undefined
        ? { transcribeVoicemail: patch.transcribeVoicemail }
        : {}),
      ...(patch.noiseSuppression !== undefined ? { noiseSuppression: patch.noiseSuppression } : {}),
    },
  });
  return {
    defaultCallerIdNumber: row.defaultCallerIdNumber,
    recordCalls: row.recordCalls,
    transcribeVoicemail: row.transcribeVoicemail,
    noiseSuppression: row.noiseSuppression,
  };
}

export async function resolveCallerIdNumber(
  workspaceId: string,
  requested?: string | null,
): Promise<string | null> {
  const prisma = getPrisma();
  if (requested) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: requested, status: "Active" },
    });
    if (pn) return pn.e164;
  }
  const settings = await getPhoneSettings(workspaceId);
  if (settings.defaultCallerIdNumber) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: settings.defaultCallerIdNumber, status: "Active" },
    });
    if (pn) return pn.e164;
  }
  const fallback = await prisma.phoneNumber.findFirst({
    where: { workspaceId, status: "Active" },
    orderBy: { purchasedAt: "asc" },
  });
  return fallback?.e164 ?? null;
}
