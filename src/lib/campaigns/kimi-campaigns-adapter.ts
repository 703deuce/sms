/**
 * Data adapter: maps mass-texting campaign APIs ↔ Kimi campaigns UI types.
 * Lives outside Kimi UI — presentation components stay untouched.
 */
import {
  composeMessageBody,
  type AudienceSelection,
  type CampaignComposeDraft,
  saveComposeDraft,
} from "@/lib/campaigns/compose-draft";
import {
  formatRecurrenceSummary,
  validateRecurrence,
} from "@/lib/campaigns/recurrence-format";
import { formatZonedScheduleLabel, zonedLocalDateTimeToIso, zonedLocalDateTimeToUtc } from "@/lib/campaigns/schedule-time";

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
  recipientCount?: number;
  scheduledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  configJson?: unknown;
};

export function mapBroadcastRowToListRow(row: {
  id: string;
  name: string;
  audience: string;
  status: string;
  sent: number;
  delivered: number;
  clicks: number;
  replies: number;
  optOuts: number;
  scheduledAt: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  configJson?: unknown;
  recipientCount?: number;
}): CampaignListRow {
  return {
    id: row.id,
    name: row.name,
    audience: row.audience,
    status: row.status,
    sent: row.sent,
    delivered: row.delivered,
    clicks: row.clicks,
    replies: row.replies,
    optOuts: row.optOuts,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    configJson: row.configJson,
    recipientCount: row.recipientCount,
  };
}

export type LaunchReviewData = {
  campaignId: string;
  campaignName: string;
  listNames: string[];
  rawContactCount: number;
  duplicateRemoved: number;
  invalidRemoved: number;
  suppressedRemoved: number;
  finalRecipientCount: number;
  estimatedSegments: number;
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
  phoneE164: string | null;
  scheduledAt: string | null;
  timezone: string | null;
};

export type AudiencePreviewData = {
  selectedCount: number;
  duplicateRemoved: number;
  excludedCount: number;
  suppressedRemoved: number;
  invalidRemoved: number;
  unsubscribedRemoved: number;
  eligibleCount: number;
};

export function formatAudiencePreviewSummary(preview: AudiencePreviewData): string {
  const adjustments: string[] = [];
  if (preview.duplicateRemoved > 0) {
    adjustments.push(`${preview.duplicateRemoved.toLocaleString()} duplicate${preview.duplicateRemoved === 1 ? "" : "s"} removed`);
  }
  if (preview.suppressedRemoved > 0) {
    adjustments.push(`${preview.suppressedRemoved.toLocaleString()} opted out`);
  }
  if (preview.invalidRemoved > 0) {
    adjustments.push(`${preview.invalidRemoved.toLocaleString()} invalid`);
  }
  if (preview.excludedCount > 0) {
    adjustments.push(`${preview.excludedCount.toLocaleString()} excluded`);
  }
  const base = `${preview.eligibleCount.toLocaleString()} eligible recipient${preview.eligibleCount === 1 ? "" : "s"}`;
  return adjustments.length ? `${base} (${adjustments.join(", ")})` : base;
}

export function formatLaunchReviewAudienceSummary(review: LaunchReviewData): string | null {
  const adjustments: string[] = [];
  if (review.duplicateRemoved > 0) {
    adjustments.push(`${review.duplicateRemoved.toLocaleString()} duplicate${review.duplicateRemoved === 1 ? "" : "s"} removed`);
  }
  if (review.suppressedRemoved > 0) {
    adjustments.push(`${review.suppressedRemoved.toLocaleString()} opted out`);
  }
  if (review.invalidRemoved > 0) {
    adjustments.push(`${review.invalidRemoved.toLocaleString()} invalid`);
  }
  if (!adjustments.length) return null;
  const raw =
    review.rawContactCount > review.finalRecipientCount
      ? `From ${review.rawContactCount.toLocaleString()} selected: `
      : "";
  return `${raw}${adjustments.join(", ")}.`;
}

export function parseCampaignConfigJson(configJson: unknown): Record<string, unknown> | null {
  if (!configJson) return null;
  if (typeof configJson === "string") {
    try {
      const parsed = JSON.parse(configJson) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof configJson === "object" && !Array.isArray(configJson)) {
    return configJson as Record<string, unknown>;
  }
  return null;
}

export function stripCampaignComplianceFooter(body: string): string {
  return body
    .replace(/\n\nReply STOP to opt out\.?\s*Msg(?:age)?\s*&\s*data rates may apply\.?/i, "")
    .trim();
}

export function draftAudiencePayload(draft: CampaignComposeDraft) {
  const mapItem = (a: AudienceSelection) => ({
    type: a.type,
    id: a.id,
    name: a.name,
    ...(a.type === "appointment_preset" && a.bookingTypeName
      ? { bookingTypeName: a.bookingTypeName }
      : {}),
  });
  return {
    include: draft.audience.map(mapItem),
    exclude: draft.excludeAudience.map(mapItem),
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
  if (s === "paused") return "Paused";
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
  if (filter === "paused") return s === "paused";
  if (filter === "completed") return s === "completed" || s === "sent";
  if (filter === "failed") return s === "failed";
  if (filter === "canceled") return s === "canceled" || s === "cancelled";
  return true;
}

export function readCampaignTimezone(configJson: unknown): string | null {
  const config = parseCampaignConfigJson(configJson);
  const tz = config?.timezone;
  return typeof tz === "string" && tz.trim() ? tz : null;
}

export function formatScheduledAt(value?: string | null, timeZone?: string | null): string {
  if (!value) return "";
  if (timeZone) {
    return formatZonedScheduleLabel(value, timeZone, { prefix: "Scheduled" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Scheduled ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
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

export async function fetchCampaigns(opts?: {
  status?: string;
  take?: number;
}): Promise<CampaignListRow[]> {
  const params = new URLSearchParams();
  params.set("take", String(opts?.take ?? 200));
  if (opts?.status && opts.status !== "all") {
    params.set("status", opts.status);
  }
  const res = await fetch(`/api/mass-texting/campaigns?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load campaigns");
  return (json.data || []).map((row: CampaignListRow & { _count?: { recipients?: number } }) => ({
    ...row,
    recipientCount: row.recipientCount ?? row._count?.recipients,
  }));
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

export async function saveCampaignDraft(
  draft: CampaignComposeDraft,
  options?: { forReview?: boolean },
): Promise<string> {
  const forReview = options?.forReview ?? false;
  const body = composeMessageBody(draft.message);
  if (!draft.name.trim() || !body.trim()) {
    throw new Error("Campaign name and message are required.");
  }
  if (draft.audience.length === 0) {
    throw new Error("Select at least one audience.");
  }
  if (forReview && draft.scheduleMode === "later" && (!draft.scheduledDate || !draft.scheduledTime)) {
    throw new Error("Select a date and time for scheduled sends.");
  }
  if (forReview && draft.scheduleMode === "later" && draft.scheduledDate && draft.scheduledTime) {
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
  if (forReview && draft.scheduleMode === "recurring") {
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
  const id = (json.data?.id || draft.campaignId) as string;
  saveComposeDraft({ ...draft, campaignId: id });
  return id;
}

export async function fetchLaunchReview(campaignId: string): Promise<LaunchReviewData> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch-review`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load review");
  const data = json.data || {};
  return {
    campaignId: data.campaignId ?? campaignId,
    campaignName: data.campaignName ?? "",
    listNames: Array.isArray(data.listNames) ? data.listNames : [],
    rawContactCount: data.rawContactCount ?? 0,
    duplicateRemoved: data.duplicateRemoved ?? 0,
    invalidRemoved: data.invalidRemoved ?? 0,
    suppressedRemoved: data.suppressedRemoved ?? 0,
    finalRecipientCount: data.finalRecipientCount ?? 0,
    estimatedSegments: data.estimatedSegments ?? 0,
    availableSegments: data.availableSegments ?? 0,
    requiredSegments: data.requiredSegments ?? data.estimatedSegments ?? 0,
    shortage: data.shortage ?? 0,
    canSend: Boolean(data.canSend),
    blockReason: data.blockReason ?? null,
    phoneE164: data.phoneE164 ?? null,
    scheduledAt: data.scheduledAt ?? null,
    timezone: typeof data.timezone === "string" ? data.timezone : null,
  };
}

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  timezone: string | null;
};

export async function fetchCampaignById(campaignId: string): Promise<CampaignSummary | null> {
  const res = await fetch(`/api/mass-texting/campaigns/${encodeURIComponent(campaignId)}`);
  const json = await res.json();
  if (!res.ok) return null;
  const row = json.data as
    | { id?: string; name?: string; status?: string; scheduledAt?: string | Date | null; configJson?: unknown }
    | undefined;
  if (!row?.id) return null;
  const scheduledAt =
    row.scheduledAt == null
      ? null
      : typeof row.scheduledAt === "string"
        ? row.scheduledAt
        : new Date(row.scheduledAt).toISOString();
  return {
    id: row.id,
    name: row.name || "",
    status: row.status || "DRAFT",
    scheduledAt,
    timezone: readCampaignTimezone(row.configJson),
  };
}

const LAUNCH_PENDING_PREFIX = "campaign-launch-pending:";

export function markCampaignLaunchPending(campaignId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${LAUNCH_PENDING_PREFIX}${campaignId}`, String(Date.now()));
}

export function clearCampaignLaunchPending(campaignId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${LAUNCH_PENDING_PREFIX}${campaignId}`);
}

export function isCampaignLaunchPending(campaignId: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(`${LAUNCH_PENDING_PREFIX}${campaignId}`));
}

export async function launchCampaign(
  campaignId: string,
  _finalRecipientCount: number,
  confirmLargeSend = false,
): Promise<{ idempotentReplay?: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  markCampaignLaunchPending(campaignId);
  try {
    const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmLargeSend,
        idempotencyKey: `launch:${campaignId}`,
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Launch failed");
    clearCampaignLaunchPending(campaignId);
    return { idempotentReplay: Boolean(json.data?.idempotentReplay) };
  } catch (err) {
    clearCampaignLaunchPending(campaignId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Launch timed out — try again in a moment");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteCampaignDraft(campaignId: string): Promise<void> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Could not delete campaign");
}

export async function cancelScheduledCampaign(campaignId: string): Promise<void> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Could not cancel campaign");
}

export async function previewAudience(
  audience: ReturnType<typeof draftAudiencePayload>,
  campaignId?: string,
): Promise<AudiencePreviewData> {
  const res = await fetch("/api/mass-texting/campaigns/audience-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audience, campaignId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not preview audience");
  const data = json.data || {};
  return {
    selectedCount: data.selectedCount ?? 0,
    duplicateRemoved: data.duplicateRemoved ?? 0,
    excludedCount: data.excludedCount ?? 0,
    suppressedRemoved: data.suppressedRemoved ?? 0,
    invalidRemoved: data.invalidRemoved ?? 0,
    unsubscribedRemoved: data.unsubscribedRemoved ?? 0,
    eligibleCount: data.eligibleCount ?? 0,
  };
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
  const [listsJson, segmentsJson, eligibleJson] = await Promise.all([
    fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/mass-texting/campaigns/audience-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: { include: [{ type: "all", id: "all-eligible", name: "All Eligible Contacts" }], exclude: [] },
      }),
    }).then((r) => (r.ok ? r.json() : { data: { eligibleCount: 0 } })),
  ]);

  const items: AudiencePickerItem[] = [
    {
      type: "all",
      id: "all-eligible",
      name: "All Eligible Contacts",
      count: eligibleJson.data?.eligibleCount ?? 0,
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

  const segments = segmentsJson.data || [];
  const segmentCounts = await Promise.all(
    segments.map(async (s: { id: string; name: string; conditions?: unknown }) => {
      try {
        const res = await fetch("/api/contacts/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conditions: s.conditions || {} }),
        });
        const json = await res.json();
        return json.data?.count ?? 0;
      } catch {
        return 0;
      }
    }),
  );

  segments.forEach((s: { id: string; name: string }, index: number) => {
    items.push({
      type: "segment",
      id: s.id,
      name: s.name,
      count: segmentCounts[index] ?? 0,
      group: "segments",
    });
  });

  const APPOINTMENT_PRESETS = [
    { id: "booked_tomorrow", name: "Booked tomorrow" },
    { id: "membership_customers", name: "Active members" },
    { id: "low_credits", name: "Low package credits" },
    { id: "inactive_60_days", name: "Not seen in 60 days" },
    { id: "booking_type", name: "Customers of a booking type" },
  ] as const;

  const presetCounts = await Promise.all(
    APPOINTMENT_PRESETS.map(async (preset) => {
      try {
        const res = await fetch(
          `/api/appointments/service-booking/appointment-segments?preset=${preset.id}`,
        );
        const json = await res.json();
        return (json.data?.contacts || []).length;
      } catch {
        return 0;
      }
    }),
  );

  APPOINTMENT_PRESETS.forEach((preset, index) => {
    items.push({
      type: "appointment_preset",
      id: preset.id,
      name: preset.name,
      count: presetCounts[index] ?? 0,
      group: "suggested",
    });
  });

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
