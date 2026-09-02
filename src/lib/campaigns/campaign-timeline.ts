import type { Campaign } from "@/lib/types";
import type { CampaignTimelineEvent } from "@/lib/campaigns/campaign-detail-helpers";
import { getPrisma } from "@/lib/db";
import { readBroadcastConfig } from "@/lib/mass-texting/broadcast/service";
import { formatRecurrenceSummary } from "@/lib/campaigns/recurrence-format";

export type CampaignTimelineInput = Campaign & {
  createdAt?: string;
};

export async function buildCampaignTimelineFromData(
  workspaceId: string,
  campaign: CampaignTimelineInput,
): Promise<CampaignTimelineEvent[]> {
  const prisma = getPrisma();
  const events: CampaignTimelineEvent[] = [];

  const createdAt =
    campaign.createdAt ||
    (
      await prisma.campaign.findFirst({
        where: { id: campaign.id, workspaceId },
        select: { createdAt: true },
      })
    )?.createdAt.toISOString();

  if (createdAt) {
    events.push({
      label: "Campaign created",
      emoji: "📝",
      at: createdAt,
      detail: `Created by ${campaign.createdBy || "—"}`,
    });
  }

  const config = readBroadcastConfig(campaign.configJson);
  if (config?.scheduleMode === "recurring" && config.recurrence) {
    events.push({
      label: "Recurring schedule configured",
      emoji: "🔁",
      at: campaign.scheduledAt || createdAt || new Date().toISOString(),
      detail: formatRecurrenceSummary(config.recurrence, config.timezone),
    });
  } else if (campaign.scheduledAt) {
    events.push({
      label: "Scheduled for send",
      emoji: "📅",
      at: campaign.scheduledAt,
      detail: `Audience: ${campaign.audience}`,
    });
  }

  const audits = await prisma.campaignLaunchAudit.findMany({
    where: { workspaceId, campaignId: campaign.id },
    orderBy: { confirmedAt: "asc" },
  });

  for (const audit of audits) {
    const meta =
      audit.metadata && typeof audit.metadata === "object"
        ? (audit.metadata as Record<string, unknown>)
        : {};
    const recurringTemplate = meta.recurringTemplate === true;

    events.push({
      label: recurringTemplate ? "Recurring campaign activated" : "Launch confirmed",
      emoji: recurringTemplate ? "🔁" : "🚀",
      at: audit.confirmedAt.toISOString(),
      detail: `${audit.finalRecipientCount.toLocaleString()} recipients · ${audit.estimatedSegments.toLocaleString()} credits estimated`,
    });

    if (audit.scheduledAt && !recurringTemplate) {
      events.push({
        label: "Queued for delivery",
        emoji: "⏰",
        at: audit.scheduledAt.toISOString(),
        detail: "Send will start automatically at the scheduled time",
      });
    }
  }

  const status = campaign.status.toLowerCase();
  if (status === "sending" || status === "completed" || status === "sent" || status === "failed") {
    const firstSend = await prisma.campaignMessage.findFirst({
      where: { workspaceId, campaignId: campaign.id, sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });
    const lastSend = await prisma.campaignMessage.findFirst({
      where: { workspaceId, campaignId: campaign.id, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    if (firstSend?.sentAt) {
      events.push({
        label: "Send started",
        emoji: "📤",
        at: firstSend.sentAt.toISOString(),
        detail: `${campaign.sent.toLocaleString()} messages queued`,
      });
    }

    if (status === "completed" || status === "sent") {
      events.push({
        label: "Send completed",
        emoji: "✅",
        at: lastSend?.sentAt?.toISOString() || campaign.scheduledAt || new Date().toISOString(),
        detail: `${campaign.delivered.toLocaleString()} delivered · ${campaign.replies.toLocaleString()} replies`,
      });
    }

    if (status === "failed") {
      events.push({
        label: "Send failed",
        emoji: "⚠️",
        at: lastSend?.sentAt?.toISOString() || campaign.scheduledAt || new Date().toISOString(),
        detail: `Only ${campaign.delivered.toLocaleString()} of ${campaign.sent.toLocaleString()} delivered`,
      });
    }
  }

  if (status === "draft") {
    events.push({
      label: "Awaiting launch",
      emoji: "⏳",
      at: new Date().toISOString(),
      detail: "Complete message and audience before scheduling or sending",
    });
  }

  if (status === "scheduled" && events.every((e) => e.label !== "Queued for delivery")) {
    events.push({
      label: "Queued for delivery",
      emoji: "⏰",
      at: campaign.scheduledAt || new Date().toISOString(),
      detail: "Will send automatically at the scheduled time",
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
