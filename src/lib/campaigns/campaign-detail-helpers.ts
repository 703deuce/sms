import type { Campaign } from "@/lib/types";

export type CampaignTimelineEvent = {
  label: string;
  at: string;
  detail: string;
  emoji: string;
};

export function formatCampaignDateTime(at: string | null, timeZone?: string | null) {
  if (!at) return "—";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "—";
  if (timeZone) {
    const formatted = new Intl.DateTimeFormat(undefined, {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${formatted} (${timeZone})`;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildCampaignTimeline(campaign: Campaign): CampaignTimelineEvent[] {
  const events: CampaignTimelineEvent[] = [
    {
      label: "Campaign created",
      emoji: "📝",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() - 86400000 * 2).toISOString()
        : new Date().toISOString(),
      detail: `Created by ${campaign.createdBy || "—"}`,
    },
  ];

  if (campaign.scheduledAt) {
    events.push({
      label: "Scheduled for send",
      emoji: "📅",
      at: campaign.scheduledAt,
      detail: `Audience: ${campaign.audience}`,
    });
  }

  if (campaign.status === "Sending" || campaign.status === "Completed" || campaign.status === "Failed") {
    events.push({
      label: "Send started",
      emoji: "🚀",
      at: campaign.scheduledAt ?? new Date().toISOString(),
      detail: `${campaign.sent} messages queued`,
    });
  }

  if (campaign.status === "Completed") {
    events.push({
      label: "Send completed",
      emoji: "✅",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() + 3600000).toISOString()
        : new Date().toISOString(),
      detail: `${campaign.delivered} delivered · ${campaign.replies} replies`,
    });
  }

  if (campaign.status === "Failed") {
    events.push({
      label: "Send failed",
      emoji: "⚠️",
      at: campaign.scheduledAt
        ? new Date(new Date(campaign.scheduledAt).getTime() + 1800000).toISOString()
        : new Date().toISOString(),
      detail: `Only ${campaign.delivered} of ${campaign.sent} delivered`,
    });
  }

  if (campaign.status === "Draft") {
    events.push({
      label: "Awaiting schedule",
      emoji: "⏳",
      at: new Date().toISOString(),
      detail: "Complete message and audience before scheduling",
    });
  }

  if (campaign.status === "Scheduled") {
    events.push({
      label: "Queued for delivery",
      emoji: "⏰",
      at: campaign.scheduledAt ?? new Date().toISOString(),
      detail: "Will send automatically at scheduled time",
    });
  }

  return events;
}

export function campaignStatusEmoji(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "sent") return "✅";
  if (s === "sending") return "📤";
  if (s === "scheduled") return "📅";
  if (s === "draft") return "📝";
  if (s === "failed") return "⚠️";
  return "📋";
}
