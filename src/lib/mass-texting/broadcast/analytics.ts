import "server-only";

import { getPrisma } from "@/lib/db";
import type { BroadcastRecipientRow } from "./types";

import { normalizeDeliveryError } from "@/lib/messaging/delivery-errors";

function recipientDisplayStatus(
  workflowStatus: string,
  messages: Array<{
    status: string;
    sentAt: Date | null;
    error: string | null;
    providerErrorCode?: string | null;
    failureCategory?: string | null;
  }>,
): { status: string; failureReason: string | null } {
  const latest = messages[messages.length - 1];
  if (workflowStatus === "opted_out") return { status: "Opted out", failureReason: null };
  if (workflowStatus === "failed" || latest?.status === "failed" || latest?.status === "undelivered") {
    const normalized = latest?.failureCategory
      ? null
      : normalizeDeliveryError({
          errorCode: latest?.providerErrorCode,
          errorDetail: latest?.error,
        });
    return {
      status: latest?.status === "undelivered" ? "Undelivered" : "Failed",
      failureReason: latest?.error || normalized?.explanation || "send_failed",
    };
  }
  if (latest?.status === "delivered") return { status: "Delivered", failureReason: null };
  if (latest?.status === "sent" || latest?.sentAt) return { status: "Sent", failureReason: null };
  if (latest?.status === "queued") return { status: "Queued", failureReason: null };
  if (workflowStatus === "stopped") return { status: "Skipped", failureReason: null };
  return { status: workflowStatus, failureReason: null };
}

export async function listBroadcastRecipients(
  workspaceId: string,
  campaignId: string,
): Promise<BroadcastRecipientRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.campaignRecipient.findMany({
    where: { workspaceId, campaignId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          sentAt: true,
          deliveredCounted: true,
          clickedCounted: true,
          providerId: true,
          error: true,
          providerErrorCode: true,
          failureCategory: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return rows.map((row: (typeof rows)[number]) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    type MsgRow = (typeof row.messages)[number];
    const deliveredMsg = row.messages.find((m: MsgRow) => m.status === "delivered" || m.deliveredCounted);
    const sentMsg = row.messages.find((m: MsgRow) => m.sentAt || m.status === "sent");
    const clickedMsg = row.messages.find((m: MsgRow) => m.clickedCounted);
    const { status, failureReason } = recipientDisplayStatus(row.workflowStatus, row.messages);

    return {
      id: row.id,
      contactId: row.contactId,
      name: row.displayName || row.phone || "Unknown",
      phone: row.phone || "",
      status,
      skippedReason: row.stopReason,
      sentAt: sentMsg?.sentAt?.toISOString() ?? null,
      deliveredAt: deliveredMsg?.updatedAt?.toISOString() ?? null,
      clickedAt: clickedMsg?.updatedAt?.toISOString() ?? null,
      repliedAt: typeof meta.repliedAt === "string" ? meta.repliedAt : null,
      optedOutAt:
        row.workflowStatus === "opted_out"
          ? row.completedAt?.toISOString() ?? null
          : typeof meta.optedOutAt === "string"
            ? meta.optedOutAt
            : null,
      failureReason,
      providerMessageId: sentMsg?.providerId ?? null,
    };
  });
}

export async function getBroadcastCampaignStats(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      sent: true,
      delivered: true,
      failed: true,
      clicks: true,
      replies: true,
      optOuts: true,
      status: true,
    },
  });
  if (!campaign) return null;

  const recipientCount = await prisma.campaignRecipient.count({
    where: { campaignId, workspaceId },
  });

  return {
    recipients: recipientCount,
    sent: campaign.sent,
    delivered: campaign.delivered,
      failed: campaign.failed ?? Math.max(0, campaign.sent - campaign.delivered),
    clicks: campaign.clicks,
    replies: campaign.replies,
    optOuts: campaign.optOuts,
    status: campaign.status,
  };
}
