import { getPrisma } from "@/lib/db";

const SEND_CLAIMABLE_STATUSES = ["SCHEDULED", "DETECTED"] as const;
const STALE_SENDING_MS = Number(process.env.MCTB_SENDING_STALE_MS || 5 * 60 * 1000);

export type MctbSendClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "already_sent" | "in_progress" | "terminal" | "not_found" };

/**
 * Single-writer gate for recovery SMS — inline send + john_mctb_send worker share this.
 * Only transitions SCHEDULED/DETECTED → SENDING (or reclaims stale SENDING).
 */
export async function claimMctbRecoverySmsSend(input: {
  workspaceId: string;
  missedCallEventId: string;
}): Promise<MctbSendClaimResult> {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
    select: { id: true, smsSentAt: true, status: true },
  });
  if (!event) return { claimed: false, reason: "not_found" };
  if (event.smsSentAt || event.status === "SENT") {
    return { claimed: false, reason: "already_sent" };
  }
  if (event.status === "SUPPRESSED" || event.status === "FAILED") {
    return { claimed: false, reason: "terminal" };
  }

  const claimed = await prisma.missedCallEvent.updateMany({
    where: {
      id: event.id,
      workspaceId: input.workspaceId,
      smsSentAt: null,
      status: { in: [...SEND_CLAIMABLE_STATUSES] },
    },
    data: { status: "SENDING" },
  });
  if (claimed.count === 1) return { claimed: true };

  const staleCutoff = new Date(Date.now() - STALE_SENDING_MS);
  const reclaimed = await prisma.missedCallEvent.updateMany({
    where: {
      id: event.id,
      workspaceId: input.workspaceId,
      smsSentAt: null,
      status: "SENDING",
      updatedAt: { lt: staleCutoff },
    },
    data: { status: "SENDING" },
  });
  if (reclaimed.count === 1) return { claimed: true };

  const fresh = await prisma.missedCallEvent.findFirst({
    where: { id: event.id },
    select: { smsSentAt: true, status: true },
  });
  if (fresh?.smsSentAt || fresh?.status === "SENT") {
    return { claimed: false, reason: "already_sent" };
  }
  return { claimed: false, reason: "in_progress" };
}
