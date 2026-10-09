import "server-only";

import { getPrisma } from "@/lib/db";

const DISPATCH_STATUS_RANK: Record<string, number> = {
  pending: 0,
  failed: 1,
  claimed: 2,
  submitting: 3,
  accepted: 4,
  sent: 5,
  delivered: 6,
  unknown: 3,
  suppressed: 7,
};

function mapTelnyxDeliveryToDispatchStatus(internalStatus: string): string | null {
  const s = internalStatus.toLowerCase();
  if (s === "queued" || s === "sending") return "accepted";
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "failed" || s === "undelivered" || s === "expired") return "failed";
  return null;
}

/**
 * Reconcile AR reminder dispatch rows when Telnyx delivery webhooks arrive.
 * Does not resubmit SMS — only advances durable dispatch state from provider evidence.
 */
export async function reconcileArReminderDispatchFromTelnyxDelivery(input: {
  providerMessageId: string;
  internalStatus: string;
  errorDetail?: string | null;
}): Promise<{ matched: boolean; dispatchId?: string; previousStatus?: string; nextStatus?: string }> {
  const sid = input.providerMessageId?.trim();
  if (!sid) return { matched: false };

  const prisma = getPrisma();
  const row = await prisma.arReminderDispatch.findFirst({
    where: {
      OR: [{ telnyxMessageId: sid }, { providerMessageId: sid }],
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return { matched: false };

  const mapped = mapTelnyxDeliveryToDispatchStatus(input.internalStatus);
  if (!mapped) return { matched: true, dispatchId: row.id, previousStatus: row.status };

  const currentRank = DISPATCH_STATUS_RANK[row.status] ?? 0;
  const nextRank = DISPATCH_STATUS_RANK[mapped] ?? 0;
  if (nextRank < currentRank && row.status !== "unknown") {
    return { matched: true, dispatchId: row.id, previousStatus: row.status, nextStatus: row.status };
  }

  if (row.status === mapped) {
    return { matched: true, dispatchId: row.id, previousStatus: row.status, nextStatus: mapped };
  }

  await prisma.arReminderDispatch.update({
    where: { id: row.id },
    data: {
      status: mapped,
      telnyxMessageId: row.telnyxMessageId || sid,
      providerMessageId: row.providerMessageId || sid,
      lastError: mapped === "failed" ? input.errorDetail || row.lastError : null,
      unknownSince: mapped === "unknown" ? row.unknownSince : null,
    },
  });

  return { matched: true, dispatchId: row.id, previousStatus: row.status, nextStatus: mapped };
}
