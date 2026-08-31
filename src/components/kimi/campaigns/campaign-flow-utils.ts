import {
  composeMessageBody,
  type AudienceSelection,
  type CampaignComposeDraft,
} from "@/lib/campaigns/compose-draft";

export type CampaignListRow = {
  id: string;
  name: string;
  audience?: string;
  status: string;
  sent?: number;
  delivered?: number;
  clicks?: number;
  replies?: number;
  optOuts?: number;
  scheduledAt?: string | null;
  createdAt?: string;
  configJson?: unknown;
};

export type LaunchReviewData = {
  campaignId: string;
  campaignName: string;
  listNames: string[];
  finalRecipientCount: number;
  estimatedSegments: number;
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
  phoneE164: string | null;
  scheduledAt: string | null;
};

export function draftAudiencePayload(draft: CampaignComposeDraft) {
  return {
    include: draft.audience.map((a) => ({ type: a.type, id: a.id, name: a.name })),
    exclude: draft.excludeAudience.map((a) => ({ type: a.type, id: a.id, name: a.name })),
  };
}

export function toBroadcastPayload(draft: CampaignComposeDraft) {
  const body = composeMessageBody(draft.message);
  let scheduledAt: string | undefined;
  if (draft.scheduleMode === "later" && draft.scheduledDate && draft.scheduledTime) {
    scheduledAt = new Date(`${draft.scheduledDate}T${draft.scheduledTime}`).toISOString();
  }
  const category =
    draft.playbookCategoryId && ["broadcast", "promotion"].includes(draft.playbookCategoryId)
      ? draft.playbookCategoryId
      : undefined;
  return {
    name: draft.name.trim(),
    message: body,
    audience: draftAudiencePayload(draft),
    numberId: draft.numberId || undefined,
    scheduleMode: draft.scheduleMode,
    scheduledAt,
    timezone: draft.timezone,
    recurrence: draft.scheduleMode === "recurring" ? draft.recurrence : undefined,
    mediaUrls: draft.mediaUrls,
    trackLinks: draft.trackedLinks.some((l) => l.tracked),
    trackedLinks: draft.trackedLinks,
    category,
  };
}

export function normalizeCampaignStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

export function displayCampaignStatus(status: string): string {
  const s = normalizeCampaignStatus(status);
  if (s === "completed" || s === "sent") return "Sent";
  if (s === "draft") return "Draft";
  if (s === "scheduled") return "Scheduled";
  if (s === "sending") return "Sending";
  if (s === "failed") return "Failed";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function statusMatchesFilter(status: string, filter: string): boolean {
  if (filter === "all") return true;
  const s = normalizeCampaignStatus(status);
  if (filter === "draft") return s === "draft";
  if (filter === "scheduled") return s === "scheduled";
  if (filter === "sending") return s === "sending" || s === "queued";
  if (filter === "completed") return s === "completed" || s === "sent";
  if (filter === "failed") return s === "failed" || s === "canceled" || s === "cancelled";
  return true;
}

export function formatSavedAt(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Last saved on ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function timingLabel(draft: CampaignComposeDraft): string {
  if (draft.scheduleMode === "now") return "Send Immediately";
  if (draft.scheduleMode === "later" && draft.scheduledDate) {
    return `Scheduled for ${draft.scheduledDate} ${draft.scheduledTime || ""} (${draft.timezone})`;
  }
  if (draft.scheduleMode === "recurring") return "Recurring campaign";
  return "Scheduled";
}

export async function fetchCampaigns(): Promise<CampaignListRow[]> {
  const res = await fetch("/api/mass-texting/campaigns");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load campaigns");
  return json.data || [];
}

export async function duplicateCampaign(campaignId: string): Promise<string> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "duplicate" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not clone campaign");
  return json.data?.id as string;
}

export async function saveCampaignDraft(draft: CampaignComposeDraft): Promise<string> {
  const body = composeMessageBody(draft.message);
  if (!draft.name.trim() || !body.trim()) {
    throw new Error("Campaign name and message are required.");
  }
  if (draft.audience.length === 0) {
    throw new Error("Select at least one audience.");
  }
  const payload = toBroadcastPayload(draft);
  const url = draft.campaignId
    ? `/api/mass-texting/campaigns/${draft.campaignId}`
    : "/api/mass-texting/campaigns";
  const res = await fetch(url, {
    method: draft.campaignId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save campaign");
  return (json.data?.id || draft.campaignId) as string;
}

export async function fetchLaunchReview(campaignId: string): Promise<LaunchReviewData> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch-review`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load review");
  return json.data;
}

export async function launchCampaign(
  campaignId: string,
  finalRecipientCount: number,
): Promise<void> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmLargeSend: finalRecipientCount >= 1000 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Launch failed");
}

export async function previewAudience(
  audience: ReturnType<typeof draftAudiencePayload>,
  campaignId?: string,
): Promise<number> {
  const res = await fetch("/api/mass-texting/campaigns/audience-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audience, campaignId }),
  });
  const json = await res.json();
  if (!res.ok) return 0;
  return json.data?.eligibleCount ?? 0;
}

export type AudiencePickerItem = AudienceSelection & { group: string };

export async function loadAudiencePickerItems(): Promise<AudiencePickerItem[]> {
  const [listsJson, segmentsJson, contactsJson] = await Promise.all([
    fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts?take=100").then((r) => (r.ok ? r.json() : { data: [] })),
  ]);

  const items: AudiencePickerItem[] = [
    {
      type: "all",
      id: "all-eligible",
      name: "All Eligible Contacts",
      count: 0,
      group: "everyone",
    },
  ];

  for (const l of listsJson.data || []) {
    items.push({
      type: "list",
      id: l.id,
      name: l.name,
      count: l.contactCount,
      group: "lists",
    });
  }
  for (const s of segmentsJson.data || []) {
    items.push({
      type: "segment",
      id: s.id,
      name: s.name,
      count: 0,
      group: "segments",
    });
  }
  for (const c of contactsJson.data || []) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
    items.push({
      type: "contact",
      id: c.id,
      name,
      count: 1,
      group: "contacts",
    });
  }

  return items;
}

export async function loadDefaultSendingNumber(): Promise<{ id: string; number: string } | null> {
  const res = await fetch("/api/numbers");
  const json = await res.json();
  const numbers = json.data || [];
  return numbers[0] ? { id: numbers[0].id, number: numbers[0].number } : null;
}
