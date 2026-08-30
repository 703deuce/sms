import { formatNumber } from "@/lib/utils";
import type { KimiCampaign } from "./types";

type ApiCampaign = {
  id: string;
  name: string;
  audience?: string;
  status: string;
  sent?: number;
  clicks?: number;
  replies?: number;
  optOuts?: number;
  scheduledAt?: string | null;
  createdAt?: string;
};

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

function formatSavedAt(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function apiCampaignToKimi(row: ApiCampaign): KimiCampaign {
  const s = normalizeStatus(row.status);
  const isSent = s === "completed" || s === "sent";
  const savedAtRaw = row.scheduledAt || row.createdAt;
  const savedAt = savedAtRaw
    ? `${isSent ? "Sent on" : "Last saved on"} ${formatSavedAt(savedAtRaw)}`
    : "";

  return {
    id: row.id,
    name: row.name,
    savedAt,
    recipients: isSent && row.sent ? formatNumber(row.sent) : "—",
    audience: row.audience || "No Audience",
    hasReply: (row.replies ?? 0) > 0,
    clicks: isSent ? row.clicks ?? 0 : null,
    unsubs: isSent ? row.optOuts ?? 0 : null,
    revenue: isSent ? "$0" : null,
    status: isSent ? "Sent" : "Draft",
  };
}
