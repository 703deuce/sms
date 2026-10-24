import "server-only";

import { getPrisma } from "@/lib/server/db";
import { toPublicAssetUrl } from "@/lib/server/public-url";

export type VoicemailInboxMessage = {
  id: string;
  fromE164: string | null;
  toE164: string | null;
  createdAt: string;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcriptText: string | null;
  aiSummary: string | null;
  isRead: boolean;
  humanCallId: string | null;
  boxId: string;
  phoneNumberId: string | null;
};

export async function listVoicemailInboxMessages(
  workspaceId: string,
  input?: { phoneNumberId?: string; limit?: number },
): Promise<VoicemailInboxMessage[]> {
  const prisma = getPrisma();
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const rows = await prisma.voicemailMessage.findMany({
    where: {
      workspaceId,
      ...(input?.phoneNumberId
        ? { box: { phoneNumberId: input.phoneNumberId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { box: { select: { phoneNumberId: true } } },
  });

  return rows.map((m) => ({
    id: m.id,
    fromE164: m.fromE164,
    toE164: m.toE164,
    createdAt: m.createdAt.toISOString(),
    durationSeconds: m.durationSeconds,
    recordingUrl: m.recordingUrl ? toPublicAssetUrl(m.recordingUrl) : null,
    transcriptText: m.transcriptText ?? m.transcriptEnglish,
    aiSummary: m.aiSummary,
    isRead: m.isRead,
    humanCallId: m.humanCallId,
    boxId: m.boxId,
    phoneNumberId: m.box.phoneNumberId,
  }));
}

export async function markVoicemailMessageRead(
  workspaceId: string,
  messageId: string,
  isRead: boolean,
): Promise<boolean> {
  const prisma = getPrisma();
  const updated = await prisma.voicemailMessage.updateMany({
    where: { id: messageId, workspaceId },
    data: { isRead, isResolved: isRead ? true : undefined },
  });
  return updated.count > 0;
}
