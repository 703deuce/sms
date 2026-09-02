export const CAMPAIGN_COMPOSE_STORAGE_KEY = "transovo-campaign-compose-draft";

export type AudienceSelection = {
  type: "all" | "list" | "segment" | "contact";
  id: string;
  name: string;
  count?: number;
};

export type CampaignComposeDraft = {
  name: string;
  description?: string;
  /** Set when opened from /playbooks (broadcast engine). */
  playbookCategoryId?: string;
  audience: AudienceSelection[];
  excludeAudience: AudienceSelection[];
  message: string;
  mediaUrls: string[];
  numberId: string;
  senderLabel: string;
  scheduleMode: "now" | "later" | "recurring";
  scheduledDate?: string;
  scheduledTime?: string;
  timezone: string;
  recurrence?: {
    startDate: string;
    interval: number;
    unit: "days" | "weeks" | "months";
    sendHour: number;
    sendMinute: number;
    ampm: "AM" | "PM";
    endMode: "never" | "on" | "after";
    endDate?: string;
    endAfter?: number;
    weekdays?: number[];
  };
  campaignId?: string;
  trackedLinks: Array<{ url: string; name: string; tracked: boolean }>;
};

export function defaultComposeDraft(): CampaignComposeDraft {
  return {
    name: "",
    audience: [],
    excludeAudience: [],
    message: "",
    mediaUrls: [],
    numberId: "",
    senderLabel: "",
    scheduleMode: "now",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    trackedLinks: [],
  };
}

export function loadComposeDraft(): CampaignComposeDraft {
  if (typeof window === "undefined") return defaultComposeDraft();
  try {
    const raw = sessionStorage.getItem(CAMPAIGN_COMPOSE_STORAGE_KEY);
    if (!raw) return defaultComposeDraft();
    return { ...defaultComposeDraft(), ...JSON.parse(raw) };
  } catch {
    return defaultComposeDraft();
  }
}

export function saveComposeDraft(draft: CampaignComposeDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CAMPAIGN_COMPOSE_STORAGE_KEY, JSON.stringify(draft));
}

export function clearComposeDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CAMPAIGN_COMPOSE_STORAGE_KEY);
}

/** Fresh composer state — clears any saved session draft. */
export function startFreshComposeDraft(): CampaignComposeDraft {
  clearComposeDraft();
  return defaultComposeDraft();
}

const FOOTER = "\n\nReply STOP to opt out. Msg & data rates may apply.";

export function composeMessageBody(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (trimmed.includes("STOP")) return trimmed;
  return `${trimmed}${FOOTER}`;
}

export function audienceSummary(selection: AudienceSelection[]): string {
  if (selection.length === 0) return "No audience selected";
  return selection.map((s) => s.name).join(", ");
}

export function estimatedRecipientCount(selection: AudienceSelection[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const item of selection) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.type === "all") return item.count ?? 0;
    total += item.count ?? 0;
  }
  return total;
}
