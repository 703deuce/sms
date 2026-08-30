import { composeMessageBody } from "@/lib/campaigns/compose-draft";
import type { BroadcastCampaignInput, BroadcastScheduleMode } from "@/lib/mass-texting/broadcast/types";
import { formatNumber } from "@/lib/utils";
import type { KimiComposeSnapshot, KimiLaunchReview, KimiReviewSummary } from "./types";

export type AudiencePickerItem = {
  type: "all" | "list" | "segment";
  id: string;
  name: string;
};

export function scheduleModeFromKimi(when: string): BroadcastScheduleMode {
  if (when === "Later") return "later";
  if (when === "Recurring") return "recurring";
  return "now";
}

export function chipsToAudience(
  chips: string[],
  pickerItems: AudiencePickerItem[],
): BroadcastCampaignInput["audience"] {
  const include: BroadcastCampaignInput["audience"]["include"] = [];
  const seen = new Set<string>();

  for (const chip of chips) {
    const normalized = chip.trim().toLowerCase();
    if (!normalized) continue;

    if (normalized === "all contacts" || normalized === "all eligible contacts") {
      const all = pickerItems.find((p) => p.type === "all");
      if (all && !seen.has(all.id)) {
        seen.add(all.id);
        include.push({ type: "all", id: all.id, name: all.name });
      }
      continue;
    }

    const list = pickerItems.find(
      (p) => p.type === "list" && p.name.toLowerCase() === normalized,
    );
    if (list && !seen.has(list.id)) {
      seen.add(list.id);
      include.push({ type: "list", id: list.id, name: list.name });
      continue;
    }

    const segment = pickerItems.find(
      (p) => p.type === "segment" && p.name.toLowerCase() === normalized,
    );
    if (segment && !seen.has(segment.id)) {
      seen.add(segment.id);
      include.push({ type: "segment", id: segment.id, name: segment.name });
    }
  }

  return { include, exclude: [] };
}

export function snapshotToBroadcastPayload(
  snapshot: KimiComposeSnapshot,
  pickerItems: AudiencePickerItem[],
  numberId?: string,
): BroadcastCampaignInput {
  const scheduleMode = scheduleModeFromKimi(snapshot.when);
  return {
    name: snapshot.name.trim(),
    message: composeMessageBody(snapshot.message),
    audience: chipsToAudience(snapshot.chips, pickerItems),
    numberId: numberId || undefined,
    scheduleMode,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    recurrence:
      scheduleMode === "recurring"
        ? {
            startDate: new Date().toISOString().slice(0, 10),
            interval: 1,
            unit: "weeks",
            sendHour: 4,
            sendMinute: 29,
            ampm: "PM",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
            endMode: "after",
            endAfter: 10,
            weekdays: [5],
          }
        : undefined,
    mediaUrls: [],
    trackLinks: false,
    trackedLinks: [],
  };
}

export async function saveKimiCampaign(input: {
  snapshot: KimiComposeSnapshot;
  campaignId?: string;
  pickerItems: AudiencePickerItem[];
  numberId?: string;
}): Promise<string> {
  const payload = snapshotToBroadcastPayload(input.snapshot, input.pickerItems, input.numberId);
  if (!payload.name) throw new Error("Campaign name is required.");
  if (!payload.message.trim()) throw new Error("Message is required.");
  if (payload.audience.include.length === 0) {
    throw new Error("Select at least one audience.");
  }

  const url = input.campaignId
    ? `/api/mass-texting/campaigns/${input.campaignId}`
    : "/api/mass-texting/campaigns";
  const res = await fetch(url, {
    method: input.campaignId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save campaign");
  const id = json.data?.id as string | undefined;
  if (!id) throw new Error("Could not save campaign");
  return id;
}

export async function fetchLaunchReview(campaignId: string): Promise<KimiLaunchReview> {
  const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch-review`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load review");
  return json.data as KimiLaunchReview;
}

export function preSendReviewToKimiSummary(
  review: KimiLaunchReview,
  timing: string,
): KimiReviewSummary {
  const audienceLines =
    review.listNames.length > 0
      ? review.listNames.map((name) => `List: ${name}`)
      : ["All eligible contacts"];

  return {
    audience: audienceLines,
    count: formatNumber(review.finalRecipientCount),
    timing,
    creditsAvailable: formatNumber(review.availableSegments),
    creditsRequired: formatNumber(review.requiredSegments),
    creditsRemaining: formatNumber(Math.max(0, review.availableSegments - review.requiredSegments)),
    canSend: review.canSend,
    blockReason: review.blockReason,
  };
}

export function timingLabelFromSnapshot(snapshot: KimiComposeSnapshot): string {
  if (snapshot.when === "Now") return "Send Immediately";
  if (snapshot.when === "Recurring" && snapshot.recurringSummary) return snapshot.recurringSummary;
  if (snapshot.when === "Later") return "Scheduled";
  return "Send Immediately";
}

export async function launchKimiCampaign(input: {
  campaignId: string;
  confirmLargeSend?: boolean;
}): Promise<void> {
  const res = await fetch(`/api/mass-texting/campaigns/${input.campaignId}/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmLargeSend: input.confirmLargeSend === true }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Launch failed");
}

export async function loadAudiencePickerItems(): Promise<{
  lists: string[];
  segments: string[];
  pickerItems: AudiencePickerItem[];
  defaultNumberId?: string;
}> {
  const [listsJson, segmentsJson, numbersJson] = await Promise.all([
    fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/numbers").then((r) => (r.ok ? r.json() : { data: [] })),
  ]);

  const pickerItems: AudiencePickerItem[] = [
    { type: "all", id: "all-eligible", name: "All Contacts" },
  ];

  const lists = (listsJson.data || []) as Array<{ id: string; name: string }>;
  const segments = (segmentsJson.data || []) as Array<{ id: string; name: string }>;

  for (const list of lists) {
    pickerItems.push({ type: "list", id: list.id, name: list.name });
  }
  for (const segment of segments) {
    pickerItems.push({ type: "segment", id: segment.id, name: segment.name });
  }

  const numbers = (numbersJson.data || []) as Array<{ id: string }>;

  return {
    lists: lists.map((l) => l.name),
    segments: segments.map((s) => s.name),
    pickerItems,
    defaultNumberId: numbers[0]?.id,
  };
}

export async function reloadKimiCampaigns() {
  const res = await fetch("/api/mass-texting/campaigns");
  const json = await res.ok ? await res.json() : { data: [] };
  return json.data || [];
}
