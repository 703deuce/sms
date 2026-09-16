import "server-only";

import type { VoiceV2AiCallRecoverySession } from "@prisma/client";
import { getPrisma } from "@/lib/db";

/** Headless cert only — simulate durable sessions without DB. */
let headlessRecoverySessionFixtures: VoiceV2AiCallRecoverySession[] = [];

export function setHeadlessRecoverySessionFixture(
  session: VoiceV2AiCallRecoverySession | null,
): void {
  headlessRecoverySessionFixtures = session ? [session] : [];
}

export function setHeadlessRecoverySessionFixtures(
  sessions: VoiceV2AiCallRecoverySession[],
): void {
  headlessRecoverySessionFixtures = sessions;
}

function headlessSessionMatches(input: {
  workspaceId: string;
  conversationId: string;
  callerE164: string;
  sendingE164: string;
}): VoiceV2AiCallRecoverySession | null {
  if (process.env.VOICE_V2_ACR_HEADLESS !== "1" || !headlessRecoverySessionFixtures.length) {
    return null;
  }
  const active = headlessRecoverySessionFixtures.filter(
    (s) => s.workspaceId === input.workspaceId && s.recoverySmsSentAt,
  );
  const byConversation = active
    .filter((s) => s.smsConversationId === input.conversationId)
    .sort(
      (a, b) =>
        (b.recoverySmsSentAt?.getTime() ?? 0) - (a.recoverySmsSentAt?.getTime() ?? 0),
    )[0];
  if (byConversation) return byConversation;

  if (input.callerE164?.trim() && input.sendingE164?.trim()) {
    return (
      active
        .filter(
          (s) =>
            s.callerE164 === input.callerE164 && s.sendingE164 === input.sendingE164,
        )
        .sort(
          (a, b) =>
            (b.recoverySmsSentAt?.getTime() ?? 0) - (a.recoverySmsSentAt?.getTime() ?? 0),
        )[0] ?? null
    );
  }
  return null;
}

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

/** Prefer SMS thread binding, then workspace + business line + caller (most recent active). */
export async function findRecoverySessionForSmsContinuation(input: {
  workspaceId: string;
  conversationId: string;
  callerE164: string;
  sendingE164: string;
}) {
  const headless = headlessSessionMatches(input);
  if (headless) return headless;

  const prisma = getPrisma();
  const now = new Date();
  const activeWhere = {
    workspaceId: input.workspaceId,
    recoverySmsSentAt: { not: null },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const byConversation = await prisma.voiceV2AiCallRecoverySession.findFirst({
    where: {
      ...activeWhere,
      smsConversationId: input.conversationId,
    },
    orderBy: { recoverySmsSentAt: "desc" },
  });
  if (byConversation) return byConversation;

  if (input.callerE164?.trim() && input.sendingE164?.trim()) {
    return prisma.voiceV2AiCallRecoverySession.findFirst({
      where: {
        ...activeWhere,
        callerE164: input.callerE164,
        sendingE164: input.sendingE164,
      },
      orderBy: { recoverySmsSentAt: "desc" },
    });
  }
  return null;
}
