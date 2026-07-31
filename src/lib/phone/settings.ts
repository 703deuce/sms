import { getPrisma } from "@/lib/db";

export async function getPhoneSettings(workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.workspacePhoneSettings.findUnique({
    where: { workspaceId },
  });
  return row ?? { defaultCallerIdNumber: null };
}

export async function upsertPhoneSettings(
  workspaceId: string,
  patch: { defaultCallerIdNumber?: string | null },
) {
  const prisma = getPrisma();
  return prisma.workspacePhoneSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultCallerIdNumber: patch.defaultCallerIdNumber ?? null,
    },
    update: {
      defaultCallerIdNumber: patch.defaultCallerIdNumber ?? null,
    },
  });
}

export async function resolveCallerIdNumber(workspaceId: string, requested?: string | null) {
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
