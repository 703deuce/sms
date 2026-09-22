import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function isCallerBlockedForWorkspace(input: {
  workspaceId: string;
  callerE164: string | null | undefined;
}): Promise<boolean> {
  const normalized = normalizeE164(String(input.callerE164 || "").trim());
  if (!normalized) return false;
  const prisma = getPrisma();
  const row = await prisma.voiceCallerBlock.findFirst({
    where: { workspaceId: input.workspaceId, callerE164: normalized },
    select: { id: true },
  });
  return Boolean(row);
}

export async function blockCallerForWorkspace(input: {
  workspaceId: string;
  callerE164: string;
  blockedByUserId?: string | null;
  displayName?: string | null;
  sourceCallId?: string | null;
}): Promise<{ ok: true; callerE164: string } | { ok: false; error: string }> {
  const normalized = normalizeE164(input.callerE164.trim());
  if (!normalized) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  const prisma = getPrisma();
  await prisma.voiceCallerBlock.upsert({
    where: {
      workspaceId_callerE164: { workspaceId: input.workspaceId, callerE164: normalized },
    },
    create: {
      workspaceId: input.workspaceId,
      callerE164: normalized,
      displayName: input.displayName?.trim() || null,
      blockedByUserId: input.blockedByUserId || null,
      sourceCallId: input.sourceCallId || null,
    },
    update: {
      displayName: input.displayName?.trim() || undefined,
      blockedByUserId: input.blockedByUserId || undefined,
      sourceCallId: input.sourceCallId || undefined,
    },
  });
  return { ok: true, callerE164: normalized };
}

export async function unblockCallerForWorkspace(input: {
  workspaceId: string;
  callerE164: string;
}): Promise<void> {
  const normalized = normalizeE164(input.callerE164.trim());
  if (!normalized) return;
  const prisma = getPrisma();
  await prisma.voiceCallerBlock.deleteMany({
    where: { workspaceId: input.workspaceId, callerE164: normalized },
  });
}

export async function listBlockedCallers(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.voiceCallerBlock.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
