import type { AdapterContext } from "../framework/types";
import { calendlyApiFetch } from "./calendly-client";

export type NormalizedCalendlyEventType = {
  uri: string;
  name: string;
  active: boolean;
  durationMinutes: number;
  schedulingUrl: string | null;
  poolingType: string | null;
  locations: Array<{ kind?: string; location?: string }>;
  customQuestions: Array<{ name?: string; type?: string; required?: boolean }>;
};

function uuidFromUri(uri: string): string {
  return uri.split("/").filter(Boolean).pop() || uri;
}

export async function listCalendlyEventTypes(
  ctx: AdapterContext,
  opts: { activeOnly?: boolean } = {},
): Promise<NormalizedCalendlyEventType[]> {
  const me = await calendlyApiFetch<{ resource?: { uri?: string } }>("/users/me", ctx, {
    op: "users/me",
  });
  const user = String(me.resource?.uri || "");
  if (!user) return [];
  const params = new URLSearchParams({
    user,
    count: "100",
  });
  if (opts.activeOnly !== false) params.set("active", "true");
  const res = await calendlyApiFetch<{ collection?: Record<string, unknown>[] }>(
    `/event_types?${params}`,
    ctx,
    { op: "event_types/list" },
  );
  return (res.collection || []).map(normalizeEventType).filter((e) => e.uri);
}

export async function getEventTypeDetail(
  ctx: AdapterContext,
  eventTypeUri: string,
): Promise<NormalizedCalendlyEventType> {
  const uuid = uuidFromUri(eventTypeUri);
  const res = await calendlyApiFetch<{ resource?: Record<string, unknown> }>(
    `/event_types/${encodeURIComponent(uuid)}`,
    ctx,
    { op: "event_types/get" },
  );
  return normalizeEventType(res.resource || {});
}

function normalizeEventType(raw: Record<string, unknown>): NormalizedCalendlyEventType {
  const uri = String(raw.uri || "");
  const duration = Number(raw.duration || raw.duration_minutes || 30);
  const questions =
    (raw.custom_questions as Array<{ name?: string; type?: string; required?: boolean }>) || [];
  const locations =
    (raw.locations as Array<{ kind?: string; location?: string }>) || [];
  return {
    uri,
    name: String(raw.name || "Event type"),
    active: raw.active !== false,
    durationMinutes: Number.isFinite(duration) ? duration : 30,
    schedulingUrl: (raw.scheduling_url as string) || null,
    poolingType: (raw.pooling_type as string) || null,
    locations,
    customQuestions: questions,
  };
}

/** CAL-EVT-003 — deterministic eligibility for MCTB AI Booking */
export function isEventTypeAiBookable(et: NormalizedCalendlyEventType): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!et.active) reasons.push("Event type is inactive");
  if (!et.uri) reasons.push("Missing event type URI");
  if (!et.durationMinutes || et.durationMinutes < 1) reasons.push("Duration not resolvable");
  if (et.poolingType && !/solo|round_robin|collective/i.test(et.poolingType)) {
    reasons.push(`Unsupported pooling type: ${et.poolingType}`);
  }
  return { ok: reasons.length === 0, reasons };
}
