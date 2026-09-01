import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

export async function listBlockedSenders(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.faxBlockedSender.findMany({
    where: { workspaceId },
    orderBy: { blockedAt: "desc" },
  });
}

export async function isSenderBlocked(workspaceId: string, faxE164: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.faxBlockedSender.findUnique({
    where: { workspaceId_faxE164: { workspaceId, faxE164 } },
  });
  return Boolean(row);
}

export async function blockFaxSender(input: {
  workspaceId: string;
  faxE164: string;
  reason?: string;
}) {
  const prisma = getPrisma();
  return prisma.faxBlockedSender.upsert({
    where: {
      workspaceId_faxE164: { workspaceId: input.workspaceId, faxE164: input.faxE164 },
    },
    create: {
      id: createId(),
      workspaceId: input.workspaceId,
      faxE164: input.faxE164,
      reason: input.reason || "Blocked by user",
    },
    update: { reason: input.reason || "Blocked by user" },
  });
}

export async function unblockFaxSender(workspaceId: string, faxE164: string) {
  const prisma = getPrisma();
  await prisma.faxBlockedSender.deleteMany({ where: { workspaceId, faxE164 } });
}

export async function markTransmissionSpam(input: {
  workspaceId: string;
  transmissionId: string;
  isSpam: boolean;
  blockSender?: boolean;
}) {
  const prisma = getPrisma();
  const tx = await prisma.faxTransmission.findFirst({
    where: { id: input.transmissionId, workspaceId: input.workspaceId },
  });
  if (!tx) throw new Error("FAX_NOT_FOUND");

  await prisma.faxTransmission.update({
    where: { id: tx.id },
    data: {
      isSpam: input.isSpam,
      folder: input.isSpam ? "spam" : "inbox",
    },
  });

  if (input.blockSender && input.isSpam && tx.fromE164) {
    await blockFaxSender({
      workspaceId: input.workspaceId,
      faxE164: tx.fromE164,
      reason: "Marked as spam",
    });
  }

  return tx;
}
