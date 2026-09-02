/**
 * Data adapter: maps mass-texting campaign APIs ↔ Kimi campaigns UI types.
 * Lives outside Kimi UI — presentation components stay untouched.
 */
import {
  composeMessageBody,
  type AudienceSelection,
  type CampaignComposeDraft,
} from "@/lib/campaigns/compose-draft";
import {
  formatRecurrenceSummary,
  validateRecurrence,
} from "@/lib/campaigns/recurrence-format";
import { zonedLocalDateTimeToIso, zonedLocalDateTimeToUtc } from "@/lib/campaigns/schedule-time";

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
    scheduledAt = zonedLocalDateTimeToIso(
      draft.scheduledDate,
      draft.scheduledTime,
      draft.timezone,
    );
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
  if (draft.scheduleMode === "recurring" && draft.recurrence) {
    return formatRecurrenceSummary(draft.recurrence, draft.timezone);
  }
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
  if (draft.scheduleMode === "later" && (!draft.scheduledDate || !draft.scheduledTime)) {
    throw new Error("Select a date and time for scheduled sends.");
  }
  if (draft.scheduleMode === "later" && draft.scheduledDate && draft.scheduledTime) {
    const when = zonedLocalDateTimeToUtc(
      draft.scheduledDate,
      draft.scheduledTime,
      draft.timezone,
    );
    if (Number.isNaN(when.getTime())) {
      throw new Error("Invalid scheduled date or time.");
    }
    if (when.getTime() <= Date.now()) {
      throw new Error("Scheduled time must be in the future.");
    }
  }
  if (draft.scheduleMode === "recurring") {
    const recurrenceError = validateRecurrence(draft.recurrence);
    if (recurrenceError) throw new Error(recurrenceError);
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
  if (!res.ok) throw new Error(json.error || "Could not preview audience");
  return json.data?.eligibleCount ?? 0;
}

export type AudiencePickerItem = AudienceSelection & { group: string };

type ContactRow = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export function contactToAudienceItem(contact: ContactRow): AudiencePickerItem | null {
  const phone = contact.phone?.trim();
  if (!phone) return null;
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return {
    type: "contact",
    id: contact.id,
    name: fullName || phone,
    phone,
    count: 1,
    group: "contacts",
  };
}

export async function loadAudiencePickerCatalog(): Promise<AudiencePickerItem[]> {
  const [listsJson, segmentsJson] = await Promise.all([
    fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
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

  return items;
}

/** Search individual contacts (SMS-capable only — must have a phone number). */
export async function searchAudienceContacts(query?: string): Promise<AudiencePickerItem[]> {
  const trimmed = query?.trim();
  const url = trimmed
    ? `/api/contacts?q=${encodeURIComponent(trimmed)}&take=50`
    : "/api/contacts?take=200";

  const contactsJson = await fetch(url).then((r) => (r.ok ? r.json() : { data: [] }));
  return (contactsJson.data || [])
    .map((contact: ContactRow) => contactToAudienceItem(contact))
    .filter((item: AudiencePickerItem | null): item is AudiencePickerItem => Boolean(item));
}

export async function loadAudiencePickerItems(query?: string): Promise<AudiencePickerItem[]> {
  const [catalog, contacts] = await Promise.all([
    loadAudiencePickerCatalog(),
    searchAudienceContacts(query),
  ]);
  return [...catalog, ...contacts];
}

export type CampaignNavPaths = {
  homePath?: string;
  reviewPath?: (campaignId: string) => string;
};

export type ReviewNavPaths = {
  homePath?: string;
  queuePath?: (campaignId: string) => string;
  successPath?: (campaignId: string, mode: string) => string;
};

export async function loadDefaultSendingNumber(): Promise<{ id: string; number: string } | null> {
  const res = await fetch("/api/numbers");
  const json = await res.json();
  const numbers = json.data || [];
  return numbers[0] ? { id: numbers[0].id, number: numbers[0].number } : null;
}
