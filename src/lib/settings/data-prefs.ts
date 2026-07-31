import { getPrisma } from "@/lib/db";

export async function getDataPrefs(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.workspaceDataPrefs.findUnique({ where: { workspaceId } });
}

export async function upsertDataPrefs(
  workspaceId: string,
  patch: { messageRetentionDays?: number; consentRetention?: string },
) {
  const prisma = getPrisma();
  return prisma.workspaceDataPrefs.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      messageRetentionDays: patch.messageRetentionDays ?? 365,
      consentRetention: patch.consentRetention ?? "forever",
    },
    update: patch,
  });
}

export async function exportWorkspaceData(workspaceId: string) {
  const prisma = getPrisma();
  const [contacts, campaigns, conversations, consentRecords] = await Promise.all([
    prisma.contact.findMany({ where: { workspaceId } }),
    prisma.campaign.findMany({ where: { workspaceId } }),
    prisma.conversation.findMany({
      where: { workspaceId },
      include: { messages: true },
    }),
    prisma.consentRecord.findMany({ where: { workspaceId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    workspaceId,
    contacts,
    campaigns,
    conversations,
    consentRecords,
  };
}
