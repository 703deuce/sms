import "server-only";

import { loadAvailabilityContext } from "@/lib/appointments/availability-engine";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import {
  checkBookingLimits,
  checkGroupCapacity,
  getExternalBusyIntervals,
  loadSchedulingContext,
  resolveEligibleStaff,
} from "@/lib/appointments/scheduling-domain";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { SlotDiagnostic, SlotUnavailabilityReason } from "@/lib/appointments/scheduling-capabilities";
import { getPrisma } from "@/lib/db";

async function parseSlotStartsAt(
  workspaceId: string,
  serviceName: string,
  raw: string,
): Promise<Date> {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const ctx = await loadAvailabilityContext(workspaceId, serviceName);
    const { wallTimeInZoneToUtc } = await import("@/lib/voice/calendar/timezone-slots");
    const [datePart, timePart] = raw.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return wallTimeInZoneToUtc(ctx.timezone, year, month, day, hour, minute);
  }
  return new Date(raw);
}

export async function diagnoseSlotAvailability(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    staffId?: string;
    attendeeCount?: number;
  },
): Promise<SlotDiagnostic> {
  const startsAt = await parseSlotStartsAt(workspaceId, input.serviceName, input.startsAt);
  const ctx = await loadAvailabilityContext(workspaceId, input.serviceName);
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const scheduling = await loadSchedulingContext(workspaceId, input.serviceName);
  const reasons: SlotUnavailabilityReason[] = [];
  const durationMs = (ctx.durationMinutes || 30) * 60_000;
  const endsAt = new Date(startsAt.getTime() + durationMs);
  const now = new Date();

  const noticeMs = (ctx.minimumNoticeMinutes || 60) * 60_000;
  if (startsAt.getTime() < now.getTime() + noticeMs) {
    reasons.push("past_notice_window");
  }

  const weekly = resolveWeeklyHours(platform);
  const { dayKeyInTimezone } = await import("@/lib/appointments/availability-engine-policy");
  const dayName = dayKeyInTimezone(startsAt.toISOString(), ctx.timezone);
  if (!weekly[dayName]?.length && !platform.dateOverrides?.find((o) => o.date === startsAt.toISOString().slice(0, 10))?.windows?.length) {
    reasons.push("outside_weekly_hours");
  }
  if (dayName === "saturday" || dayName === "sunday") {
    const bookingHours = ctx.svcCfg.bookingHours;
    if (bookingHours?.includes("weekdays")) reasons.push("weekend_closed");
  }

  const dateKey = startsAt.toISOString().slice(0, 10);
  if (platform.blackoutDates?.includes(dateKey)) reasons.push("blackout_date");
  const override = platform.dateOverrides?.find((o) => o.date === dateKey);
  if (override?.closed) reasons.push("date_closed");

  const limits = ctx.svcCfg.bookingLimits || platform.bookingLimits;
  const limitCheck = await checkBookingLimits(workspaceId, input.serviceName, startsAt, limits);
  if (!limitCheck.allowed) {
    if (limitCheck.reason?.includes("Weekly")) reasons.push("booking_limit_weekly");
    else if (limitCheck.reason?.includes("type")) reasons.push("booking_limit_type_daily");
    else reasons.push("booking_limit_daily");
  }

  const monthlyLimit = limits?.maxBookingsPerMonth;
  if (monthlyLimit) {
    const monthStart = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
    const monthEnd = new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 1);
    const count = await getPrisma().voiceAppointment.count({
      where: {
        workspaceId,
        startsAt: { gte: monthStart, lt: monthEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
    });
    if (count >= monthlyLimit) reasons.push("booking_limit_monthly");
  }

  const capacity = ctx.svcCfg.groupBooking?.capacity || 1;
  if (capacity > 1) {
    const group = await checkGroupCapacity(workspaceId, input.serviceName, startsAt, capacity);
    if (!group.available) reasons.push("capacity_full");
  } else {
    const conflict = await getPrisma().voiceAppointment.findFirst({
      where: {
        workspaceId,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
    });
    if (conflict) reasons.push("existing_appointment");
  }

  const externalBusy = await getExternalBusyIntervals(workspaceId, startsAt, endsAt);
  if (externalBusy.some((b) => startsAt < b.end && endsAt > b.start)) {
    reasons.push("external_calendar_busy");
  }

  const schedulingLimits = {
    ...(platform.schedulingLimits || {}),
    ...(ctx.svcCfg.schedulingLimits || {}),
  };
  const { slotStepMinutes, resolveAllowedStartMinutes } = await import(
    "@/lib/appointments/service-booking/fixed-start-times"
  );
  const step = slotStepMinutes(ctx.durationMinutes || 30, schedulingLimits.customStartIntervalMinutes);
  const { minutesInTimezone } = await import("@/lib/appointments/availability-engine-policy");
  const startMin = minutesInTimezone(startsAt.toISOString(), ctx.timezone);
  if (startMin != null && startMin % step !== 0) {
    reasons.push("invalid_start_interval");
  }
  const fixedAllowed = resolveAllowedStartMinutes(
    schedulingLimits.fixedStartTimes,
    startsAt.toISOString(),
    ctx.timezone,
  );
  if (fixedAllowed && startMin != null && !fixedAllowed.has(startMin)) {
    reasons.push("invalid_start_interval");
  }

  if (scheduling.staffAssignment === "collective" && scheduling.svcCfg.collectiveStaffIds?.length) {
    const eligible = resolveEligibleStaff(scheduling).filter((s) =>
      scheduling.svcCfg.collectiveStaffIds!.includes(s.id),
    );
    if (!eligible.length) reasons.push("collective_unavailable");
  } else if (input.staffId) {
    const staff = resolveEligibleStaff(scheduling).find((s) => s.id === input.staffId);
    if (!staff) reasons.push("staff_unavailable");
  }

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    available: reasons.length === 0,
    reasons,
    detail: reasons.length ? reasons.join(", ") : undefined,
  };
}

export async function explainSlotUnavailability(
  workspaceId: string,
  serviceName: string,
  startsAt: string,
): Promise<string> {
  const diag = await diagnoseSlotAvailability(workspaceId, { serviceName, startsAt });
  if (diag.available) return "This slot is available.";
  const labels: Record<SlotUnavailabilityReason, string> = {
    past_notice_window: "Too soon — minimum booking notice not met",
    outside_weekly_hours: "Outside business hours",
    date_closed: "This date is closed",
    blackout_date: "Blackout date",
    booking_limit_daily: "Daily booking limit reached",
    booking_limit_weekly: "Weekly booking limit reached",
    booking_limit_monthly: "Monthly booking limit reached",
    booking_limit_type_daily: "Daily limit for this appointment type reached",
    external_calendar_busy: "Blocked by connected calendar",
    staff_unavailable: "Selected staff member unavailable",
    collective_unavailable: "Not all required hosts are available",
    capacity_full: "Group event is at capacity",
    existing_appointment: "Another appointment occupies this time",
    weekend_closed: "Weekends are not bookable",
    off_hours: "Outside allowed booking hours",
    invalid_start_interval: "Not on the allowed start-time grid for this service",
  };
  return diag.reasons.map((r) => labels[r] || r).join("; ");
}
