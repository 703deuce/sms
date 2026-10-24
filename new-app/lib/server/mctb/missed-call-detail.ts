import "server-only";

import { getPrisma } from "@/lib/server/db";

export type MctbMissedCallDetail = {
  id: string;
  callerE164: string;
  businessE164: string;
  status: string;
  suppressionReason: string | null;
  eligible: boolean;
  detectedAt: string;
  smsSentAt: string | null;
  reason: string;
  disposition: string | null;
  phoneNumberId: string | null;
  metadata: Record<string, unknown> | null;
  conversationId: string | null;
};

export async function loadMctbMissedCallDetail(
  workspaceId: string,
  id: string,
): Promise<MctbMissedCallDetail | null> {
  const prisma = getPrisma();
  const row = await prisma.missedCallEvent.findFirst({
    where: { id, workspaceId },
  });
  if (!row) return null;

  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;

  let conversationId: string | null = null;
  if (row.smsMessageId) {
    const msg = await prisma.message.findFirst({
      where: { id: row.smsMessageId, workspaceId },
      select: { conversationId: true },
    });
    conversationId = msg?.conversationId ?? null;
  }

  return {
    id: row.id,
    callerE164: row.callerE164,
    businessE164: row.businessE164,
    status: row.status,
    suppressionReason: row.suppressionReason,
    eligible: row.eligible,
    detectedAt: row.detectedAt.toISOString(),
    smsSentAt: row.smsSentAt?.toISOString() ?? null,
    reason: row.reason,
    disposition: row.disposition,
    phoneNumberId: row.phoneNumberId,
    metadata: meta,
    conversationId,
  };
}
