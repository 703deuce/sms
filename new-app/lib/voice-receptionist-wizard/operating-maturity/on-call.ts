import type {
  VoiceV2ActiveOnCallTarget,
  VoiceV2OnCallOperationalOverride,
  VoiceV2OnCallScheduleConfig,
  VoiceV2OnCallScheduleEntry,
  VoiceV2OperatingState,
} from "./types";

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function entryActiveAt(entry: VoiceV2OnCallScheduleEntry, at: Date, tz: string): boolean {
  if (!entry.enabled) return false;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = wdMap[get("weekday")] ?? 0;
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const dateStr = `${y}-${m}-${d}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));

  if (entry.date && entry.date !== dateStr) return false;
  if (entry.dayOfWeek !== undefined && entry.dayOfWeek !== dow) return false;

  const start = parseHm(entry.startTime);
  const end = parseHm(entry.endTime);
  if (end <= start) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

export function resolveActiveOnCallTarget(input: {
  schedule: VoiceV2OnCallScheduleConfig;
  operationalOverride?: VoiceV2OnCallOperationalOverride | null;
  timestamp?: string;
  operatingState?: VoiceV2OperatingState;
}): VoiceV2ActiveOnCallTarget | null {
  const at = input.timestamp ? new Date(input.timestamp) : new Date();
  const tz = input.schedule.timezone || "America/New_York";

  if (input.operationalOverride) {
    const until = Date.parse(input.operationalOverride.effectiveUntil);
    if (!Number.isNaN(until) && at.getTime() <= until) {
      return {
        entryId: "operational_override",
        label: input.operationalOverride.label,
        phoneE164: input.operationalOverride.destination.phoneE164,
        contactId: input.operationalOverride.destination.contactId,
        transferPlanId: input.operationalOverride.destination.transferPlanId,
        source: "OPERATIONAL_OVERRIDE",
      };
    }
  }

  if (!input.schedule.enabled) return null;

  const candidates = input.schedule.entries
    .filter((e) => entryActiveAt(e, at, tz))
    .sort((a, b) => b.priority - a.priority);

  const hit = candidates[0];
  if (!hit) return null;

  return {
    entryId: hit.id,
    label: hit.destination.label || hit.name || "On-call",
    phoneE164: hit.destination.phoneE164,
    contactId: hit.destination.contactId,
    transferPlanId: hit.destination.transferPlanId,
    source: "SCHEDULE",
  };
}

/** Urgent transfer may use on-call plan when office transfer is gated. */
export function resolveOnCallTransferPlanId(input: {
  onCall: VoiceV2ActiveOnCallTarget | null;
  defaultPlanId?: string | null;
}): string | null {
  if (input.onCall?.transferPlanId) return input.onCall.transferPlanId;
  return input.defaultPlanId ?? null;
}
