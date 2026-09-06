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

export async function diagnoseSlotAvailability(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    staffId?: string;
    attendeeCount?: number;
  },
): Promise<SlotDiagnostic> {
  const startsAt = new Date(input.startsAt);
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
  };
  return diag.reasons.map((r) => labels[r] || r).join("; ");
}
