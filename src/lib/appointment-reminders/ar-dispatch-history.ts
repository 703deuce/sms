import "server-only";

import { getPrisma } from "@/lib/db";

export type ArDispatchHistoryRow = {
  id: string;
  timelineType: string;
  channel: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  providerMessageId: string | null;
};

export async function loadArDispatchHistoryForAppointment(
  workspaceId: string,
  appointmentId: string,
): Promise<ArDispatchHistoryRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.arReminderDispatch.findMany({
    where: { workspaceId, appointmentId },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      timelineType: true,
      status: true,
      intendedFireAt: true,
      claimedAt: true,
      submittingAt: true,
      lastError: true,
      providerMessageId: true,
      telnyxMessageId: true,
      metadata: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => {
    const meta = (r.metadata || {}) as {
      channel?: string;
      sentAt?: string;
      deliveredAt?: string;
    };
    return {
      id: r.id,
      timelineType: r.timelineType,
      channel: meta.channel || "sms",
      status: r.status,
      scheduledFor: r.intendedFireAt.toISOString(),
      sentAt: meta.sentAt || r.submittingAt?.toISOString() || r.claimedAt?.toISOString() || null,
      deliveredAt: meta.deliveredAt || (r.status === "delivered" ? r.updatedAt.toISOString() : null),
      failedAt: r.status === "failed" ? r.updatedAt.toISOString() : null,
      failureReason: r.lastError,
      providerMessageId: r.providerMessageId || r.telnyxMessageId,
    };
  });
}
