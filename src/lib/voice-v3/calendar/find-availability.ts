import type { NormalizedSchedulingPreference } from "../time/scheduling-types";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveBookingServiceForRuntime } from "../config/resolve-booking-service";
import { clampFindWindowToServiceHorizon, serviceAllowsLiveBooking } from "../policy/service-policy";
import type { VoiceV3CallContext } from "../state/call-context";
import type { FindAvailabilityRequest, RequiredRuntimeAction } from "./types";
import { parseVoiceV3LocalIsoToDate } from "./microsoft/microsoft-time-adapter";
import { wallTimeInZoneToUtc } from "../time/timezone";

export function buildFindAvailabilityRequestKey(req: FindAvailabilityRequest): string {
  return [
    req.callId,
    String(req.schedulingGeneration),
    req.rangeStartUtc,
    req.rangeEndUtc,
    String(req.durationMinutes),
    req.calendarIds.join(","),
  ].join("|");
}

export function resolveSearchWindowFromNormalized(
  normalized: NormalizedSchedulingPreference,
  timezone: string,
  durationMinutes = 60,
): { rangeStartUtc: string; rangeEndUtc: string } | null {
  if (normalized.precision === "UNRESOLVED") return null;

  if (normalized.utcStart && normalized.utcEnd) {
    const startMs = new Date(normalized.utcStart).getTime();
    const endMs = new Date(normalized.utcEnd).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    if (endMs <= startMs) {
      const durationMs = Math.max(15, durationMinutes) * 60_000;
      return {
        rangeStartUtc: new Date(startMs).toISOString(),
        rangeEndUtc: new Date(startMs + durationMs).toISOString(),
      };
    }
    return { rangeStartUtc: normalized.utcStart, rangeEndUtc: normalized.utcEnd };
  }

  if (normalized.utcStart && !normalized.utcEnd && normalized.localDate) {
    const start = new Date(normalized.utcStart);
    const end = new Date(start.getTime() + 8 * 60 * 60_000);
    return { rangeStartUtc: start.toISOString(), rangeEndUtc: end.toISOString() };
  }

  if (normalized.localStartDateTime && normalized.localEndDateTime) {
    const start = parseVoiceV3LocalIsoToDate(normalized.localStartDateTime, timezone);
    const end = parseVoiceV3LocalIsoToDate(normalized.localEndDateTime, timezone);
    if (start && end) {
      return { rangeStartUtc: start.toISOString(), rangeEndUtc: end.toISOString() };
    }
  }

  if (normalized.localDate) {
    const [y, m, d] = normalized.localDate.split("-").map(Number);
    const start = wallTimeInZoneToUtc(timezone, y, m, d, 9, 0);
    const end = wallTimeInZoneToUtc(timezone, y, m, d, 17, 0);
    return { rangeStartUtc: start.toISOString(), rangeEndUtc: end.toISOString() };
  }

  return null;
}

export function buildFindAvailabilityRequest(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
): FindAvailabilityRequest | null {
  const normalized = ctx.scheduling.normalized;
  if (!normalized) return null;

  const service = resolveBookingServiceForRuntime(config, ctx);
  if (!serviceAllowsLiveBooking(service)) return null;

  const windowRaw = resolveSearchWindowFromNormalized(
    normalized,
    ctx.business.timezone,
    service.durationMinutes,
  );
  if (!windowRaw) return null;
  const window = clampFindWindowToServiceHorizon({
    service,
    rangeStartUtc: windowRaw.rangeStartUtc,
    rangeEndUtc: windowRaw.rangeEndUtc,
  });

  const calendar = config.calendar;
  if (!calendar?.calendarIds?.length) return null;
  const calendarIds = service.calendarId?.trim()
    ? [service.calendarId.trim()]
    : [...calendar.calendarIds];

  const req: FindAvailabilityRequest = {
    callId: ctx.callId,
    schedulingGeneration: ctx.scheduling.generation,
    timezone: ctx.business.timezone,
    rangeStartUtc: window.rangeStartUtc,
    rangeEndUtc: window.rangeEndUtc,
    durationMinutes: service.durationMinutes,
    calendarIds,
    requestKey: "",
  };
  req.requestKey = buildFindAvailabilityRequestKey(req);
  return req;
}

export function shouldDispatchFindAvailability(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  mayFindAvailability: boolean,
): boolean {
  if (!mayFindAvailability) return false;
  const req = buildFindAvailabilityRequest(ctx, config);
  if (!req) return false;
  if (ctx.availability.lastDispatchedRequestKey === req.requestKey) return false;
  if (ctx.availability.inFlightGeneration === ctx.scheduling.generation) return false;
  return true;
}
