import "server-only";

import { getPrisma } from "@/lib/db";

export async function findActiveRecoveryCooldown(input: {
  workspaceId: string;
  callerE164: string;
  sendingE164?: string | null;
  cooldownSeconds: number;
}): Promise<{ active: boolean; sessionId?: string }> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - input.cooldownSeconds * 1000);
  const recent = await prisma.voiceV2AiCallRecoverySession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: input.callerE164,
      ...(input.sendingE164 ? { sendingE164: input.sendingE164 } : {}),
      recoverySmsSentAt: { gte: since },
    },
    orderBy: { recoverySmsSentAt: "desc" },
    select: { id: true },
  });
  return { active: Boolean(recent), sessionId: recent?.id };
}

export async function findActiveRecoverySessionForInbound(input: {
  workspaceId: string;
  callerE164: string;
  sendingE164: string;
}) {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.voiceV2AiCallRecoverySession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: input.callerE164,
      sendingE164: input.sendingE164,
      recoverySmsSentAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { recoverySmsSentAt: "desc" },
  });
}
