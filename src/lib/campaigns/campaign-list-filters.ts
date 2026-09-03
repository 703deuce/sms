import {
  normalizeCampaignStatus,
  type CampaignListRow,
} from "@/lib/campaigns/kimi-campaigns-adapter";

export type CampaignRowFilterKey =
  | "scheduled"
  | "draft"
  | "completed"
  | "failed"
  | "paused"
  | "canceled"
  | "sending"
  | "recurring";

export function isRecurringCampaignRow(row: CampaignListRow): boolean {
  if (!row.configJson || typeof row.configJson !== "object") return false;
  const config = row.configJson as Record<string, unknown>;
  return config.scheduleMode === "recurring" && Boolean(config.recurrence);
}

export function statusRowFilter(status: string) {
  return (row: CampaignListRow) => normalizeCampaignStatus(row.status) === status;
}

export function campaignRowMatchesFilter(
  row: CampaignListRow,
  key: CampaignRowFilterKey,
): boolean {
  if (key === "recurring") return isRecurringCampaignRow(row);
  if (key === "sending") {
    const normalized = normalizeCampaignStatus(row.status);
    return normalized === "sending" || normalized === "queued";
  }
  return normalizeCampaignStatus(row.status) === key;
}

export function filterCampaignRows(
  rows: CampaignListRow[],
  key?: CampaignRowFilterKey,
): CampaignListRow[] {
  if (!key) return rows;
  return rows.filter((row) => campaignRowMatchesFilter(row, key));
}
