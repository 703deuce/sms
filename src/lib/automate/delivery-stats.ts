import { getPrisma } from "@/lib/db";

export type DeliveryStats = {
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
};

const DELIVERED_STATUSES = new Set(["delivered", "sent", "read"]);
const FAILED_STATUSES = new Set(["failed", "undelivered", "rejected", "bounced"]);
const PENDING_STATUSES = new Set(["queued", "sending", "pending", "accepted"]);

export function summarizeDeliveryStatuses(
  statuses: string[],
): DeliveryStats {
  let delivered = 0;
  let failed = 0;
  let pending = 0;
  for (const raw of statuses) {
    const s = raw.toLowerCase();
    if (DELIVERED_STATUSES.has(s)) delivered += 1;
    else if (FAILED_STATUSES.has(s)) failed += 1;
    else if (PENDING_STATUSES.has(s)) pending += 1;
    else delivered += 1;
  }
  const sent = statuses.length;
  return {
    sent,
    delivered,
    failed,
    pending,
    deliveryRate: sent ? delivered / sent : 0,
  };
}

export async function loadDeliveryStatsByIdempotencyPrefix(
  workspaceId: string,
  prefix: string,
  limit = 200,
): Promise<DeliveryStats & { recent: Array<{ id: string; to: string; status: string; sentAt: string }> }> {
  const messages = await getPrisma().message.findMany({
    where: { workspaceId, idempotencyKey: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, to: true, status: true, createdAt: true },
  });
  const stats = summarizeDeliveryStatuses(messages.map((m) => m.status));
  return {
    ...stats,
    recent: messages.map((m) => ({
      id: m.id,
      to: m.to,
      status: m.status,
      sentAt: m.createdAt.toISOString(),
    })),
  };
}

export function deliveryStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (DELIVERED_STATUSES.has(s)) return "Delivered";
  if (FAILED_STATUSES.has(s)) return "Failed";
  if (PENDING_STATUSES.has(s)) return "Pending";
  return status;
}

export function deliveryStatusTone(status: string): "green" | "orange" | "red" | "gray" {
  const s = status.toLowerCase();
  if (DELIVERED_STATUSES.has(s)) return "green";
  if (FAILED_STATUSES.has(s)) return "red";
  if (PENDING_STATUSES.has(s)) return "orange";
  return "gray";
}
