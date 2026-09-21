import type { VoiceV3AgentConfig, VoiceV3ServiceConfig } from "../config/agent-config";
import { parseDaysAhead, parseNoticeMinutes } from "@/lib/solutions/appointment-receptionist/notice-utils";
import { resolveBookingServiceForRuntime } from "../config/resolve-booking-service";
import type { VoiceV3CallContext } from "../state/call-context";

export type ServicePolicyViolation =
  | "SERVICE_DISABLED"
  | "SERVICE_NOT_READY"
  | "BOOKING_NOT_PERMITTED"
  | "BELOW_MIN_NOTICE"
  | "BEYOND_MAX_HORIZON";

export function resolveActiveServicePolicy(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
): VoiceV3ServiceConfig {
  return resolveBookingServiceForRuntime(config, ctx);
}

export function serviceAllowsLiveBooking(service: VoiceV3ServiceConfig): boolean {
  if (service.enabled === false) return false;
  if (service.status === "needs_rules") return false;
  const perm = service.bookingPermission;
  if (perm === "staff_only" || perm === "request_only") return false;
  return perm === "book_directly" || perm === "send_booking_link" || !perm;
}

export function validateSlotAgainstServicePolicy(input: {
  service: VoiceV3ServiceConfig;
  slotStartUtc: string;
  timezone: string;
  now?: Date;
}): ServicePolicyViolation | null {
  const service = input.service;
  if (service.enabled === false) return "SERVICE_DISABLED";
  if (service.status === "needs_rules") return "SERVICE_NOT_READY";
  if (!serviceAllowsLiveBooking(service)) return "BOOKING_NOT_PERMITTED";

  const now = input.now ?? new Date();
  const startMs = new Date(input.slotStartUtc).getTime();
  if (!Number.isFinite(startMs)) return "BELOW_MIN_NOTICE";

  const minNoticeMin = service.minimumBookingNoticeMinutes ?? 0;
  if (minNoticeMin > 0) {
    const earliest = now.getTime() + minNoticeMin * 60_000;
    if (startMs < earliest) return "BELOW_MIN_NOTICE";
  }

  const maxDays = service.maximumBookingDaysAhead ?? 0;
  if (maxDays > 0) {
    const horizon = now.getTime() + maxDays * 24 * 60 * 60_000;
    if (startMs > horizon) return "BEYOND_MAX_HORIZON";
  }

  return null;
}

export function clampFindWindowToServiceHorizon(input: {
  service: VoiceV3ServiceConfig;
  rangeStartUtc: string;
  rangeEndUtc: string;
  now?: Date;
}): { rangeStartUtc: string; rangeEndUtc: string } {
  const now = input.now ?? new Date();
  const minNoticeMin = input.service.minimumBookingNoticeMinutes ?? 0;
  const maxDays = input.service.maximumBookingDaysAhead ?? 0;

  let startMs = new Date(input.rangeStartUtc).getTime();
  let endMs = new Date(input.rangeEndUtc).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { rangeStartUtc: input.rangeStartUtc, rangeEndUtc: input.rangeEndUtc };
  }

  const earliest = now.getTime() + minNoticeMin * 60_000;
  if (startMs < earliest) startMs = earliest;

  if (maxDays > 0) {
    const horizon = now.getTime() + maxDays * 24 * 60 * 60_000;
    if (endMs > horizon) endMs = horizon;
    if (startMs > horizon) startMs = horizon;
  }

  if (endMs <= startMs) {
    endMs = startMs + 60 * 60_000;
  }

  return {
    rangeStartUtc: new Date(startMs).toISOString(),
    rangeEndUtc: new Date(endMs).toISOString(),
  };
}

export function servicePolicyFromWizardType(t: {
  id: string;
  name: string;
  durationMin: number;
  calendar?: string;
  status?: "ready" | "needs_rules";
  location?: string;
  modality?: "in_person" | "phone" | "video";
  description?: string;
  bookingHours?: string;
  minNotice?: string;
  maxDaysAhead?: string;
  requiredFields?: string[];
  bookingPermission?: import("@/lib/solutions/appointment-receptionist/types").BookingPermission;
  enabled: boolean;
}, slotStepMinutes: number): VoiceV3ServiceConfig {
  return {
    id: t.id,
    name: t.name?.trim() || t.id,
    durationMinutes: t.durationMin > 0 ? t.durationMin : 30,
    slotStepMinutes,
    description: t.description?.trim() || undefined,
    enabled: t.enabled,
    calendarId: undefined,
    status: t.status,
    location: t.location,
    modality: t.modality,
    bookingPermission: t.bookingPermission,
    minimumBookingNoticeMinutes: parseNoticeMinutes(t.minNotice),
    maximumBookingDaysAhead: parseDaysAhead(t.maxDaysAhead),
    requiredIntakeKeys: t.requiredFields?.length ? [...t.requiredFields] : undefined,
    bookingHoursProse: t.bookingHours?.trim() || undefined,
  };
}
