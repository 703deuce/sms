/**
 * Native Appointments availability — weekly hours, date overrides, booking rules.
 * Single source of truth for public booking, admin booking, and slot validation.
 * Supports group capacity, collective scheduling, and per-staff availability.
 */
import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentTypeConfig, StaffAssignmentMode } from "@/lib/appointments/types";
import {
  dateKeyFromParts,
  dayKeyInTimezone,
  parseHm,
  resolveWeeklyHours,
  type AvailabilitySlot,
  type DateOverride,
  type WeeklyHours,
} from "@/lib/appointments/availability-engine-policy";
import { parseBookingHours } from "@/lib/solutions/appointment-receptionist/notice-utils";
import {
  filterStaffAvailableForSlot,
  resolveStaffWeeklyHours,
  windowsForStaffDay,
} from "@/lib/appointments/staff-availability";

export type { AvailabilitySlot, DateOverride, WeeklyHours };
export {
  bookingHoursSummary,
  dateKeyInTimezone,
  dayKeyInTimezone,
  defaultWeeklyHours,
  isBlackoutOrClosed,
  isWithinWeeklyHours,
  minutesInTimezone,
  resolveWeeklyHours,
} from "@/lib/appointments/availability-engine-policy";

export async function loadAvailabilityContext(workspaceId: string, serviceName: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const { getPrisma } = await import("@/lib/db");
  const service = await getPrisma().voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const svcCfg = (service?.config || {}) as AppointmentTypeConfig;
  return {
    platform,
    service,
    svcCfg,
    timezone: svcCfg.timezone || platform.timezone,
    minimumNoticeMinutes:
      svcCfg.minimumBookingNoticeMinutes ?? platform.minimumBookingNoticeMinutes ?? 60,
    maximumDaysAhead: svcCfg.maximumBookingDaysAhead ?? platform.maximumBookingDaysAhead ?? 14,
    bufferBeforeMinutes: svcCfg.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: svcCfg.bufferAfterMinutes ?? service?.bufferMinutes ?? 0,
    durationMinutes: service?.durationMinutes ?? 30,
  };
}

/** Generate bookable slots from native weekly hours + overrides (appointments source of truth). */
export async function generateNativeSlots(
  workspaceId: string,
  input: {
    serviceName: string;
    daysAhead?: number;
    timezone?: string;
    maxSlots?: number;
    staffId?: string;
    durationMinutes?: number;
    excludeAppointmentId?: string;
  },
): Promise<{ slots: AvailabilitySlot[]; staffBySlot?: Record<string, string> }> {
  const { addCalendarDays, wallTimeInZoneToUtc, zonedDateParts } = await import(
    "@/lib/voice/calendar/timezone-slots"
  );
  const { getPrisma } = await import("@/lib/db");
  const { loadSchedulingContext, resolveEligibleStaff } = await import(
    "@/lib/appointments/scheduling-domain"
  );

  const ctx = await loadAvailabilityContext(workspaceId, input.serviceName);
  const { platform, service, svcCfg } = ctx;
  if (!service || svcCfg.enabled === false) return { slots: [] };

  const schedulingCtx = await loadSchedulingContext(workspaceId, input.serviceName);
  const staffAssignment = svcCfg.staffAssignment || "any_eligible";
  let eligibleStaff = resolveEligibleStaff(schedulingCtx);
  if (staffAssignment === "collective" && svcCfg.collectiveStaffIds?.length) {
    eligibleStaff = eligibleStaff.filter((s) => svcCfg.collectiveStaffIds!.includes(s.id));
  }
  if (input.staffId) {
    eligibleStaff = eligibleStaff.filter((s) => s.id === input.staffId);
  }

  const tz = input.timezone || ctx.timezone;
  const weeklyHours = resolveWeeklyHours(platform);
  const bookingHours = parseBookingHours(svcCfg.bookingHours || undefined);
  const overrides = platform.dateOverrides || [];
  const days = Math.min(
    Math.max(1, input.daysAhead ?? ctx.maximumDaysAhead),
    ctx.maximumDaysAhead,
  );
  const maxSlots = input.maxSlots ?? 200;
  const durationMinutes = input.durationMinutes ?? ctx.durationMinutes;
  const bufferBefore = ctx.bufferBeforeMinutes * 60_000;
  const bufferAfter = ctx.bufferAfterMinutes * 60_000;
  const noticeMs = ctx.minimumNoticeMinutes * 60_000;
  const now = new Date();
  const prisma = getPrisma();
  const slots: AvailabilitySlot[] = [];
  const staffBySlot: Record<string, string> = {};

  const rangeStart = zonedDateParts(now, tz);
  const rangeEndDay = addCalendarDays(rangeStart.year, rangeStart.month, rangeStart.day, days);
  const rangeEnd = wallTimeInZoneToUtc(tz, rangeEndDay.year, rangeEndDay.month, rangeEndDay.day, 23, 59);

  let externalBusy: Array<{ start: Date; end: Date }> = [];
  try {
    const { getExternalBusyIntervals } = await import("@/lib/appointments/scheduling-domain");
    externalBusy = await getExternalBusyIntervals(workspaceId, now, rangeEnd);
  } catch (err) {
    console.warn("[appointments] external busy lookup failed", err);
  }

  function overlapsExternalBusy(start: Date, end: Date) {
    const bufferedStart = new Date(start.getTime() - bufferBefore);
    const bufferedEnd = new Date(end.getTime() + bufferAfter);
    return externalBusy.some((b) => bufferedStart < b.end && bufferedEnd > b.start);
  }

  const needsStaffCheck =
    eligibleStaff.length > 0 &&
    ["round_robin", "collective", "maximize_availability", "customer_chooses", "specific_staff"].includes(
      staffAssignment,
    );

  for (let d = 0; d < days; d += 1) {
    const day = addCalendarDays(rangeStart.year, rangeStart.month, rangeStart.day, d);
    const dateKey = dateKeyFromParts(day.year, day.month, day.day);
    const override = overrides.find((o) => o.date === dateKey);
    if (override?.closed || platform.blackoutDates?.includes(dateKey)) continue;

    const noon = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, 12, 0);
    const dayName = dayKeyInTimezone(noon.toISOString(), tz);
    if (bookingHours?.weekdaysOnly && (dayName === "saturday" || dayName === "sunday")) {
      continue;
    }

    let windows =
      override?.windows ||
      weeklyHours[dayName] ||
      weeklyHours[dayName.toLowerCase()] ||
      [];

    if (bookingHours) {
      const bookingOpen = `${String(bookingHours.startHour).padStart(2, "0")}:00`;
      const bookingClose = `${String(bookingHours.endHour).padStart(2, "0")}:00`;
      windows = windows
        .map((window) => {
          const openMin = parseHm(window.open);
          const closeMin = parseHm(window.close);
          const bookOpenMin = parseHm(bookingOpen);
          const bookCloseMin = parseHm(bookingClose);
          if (openMin == null || closeMin == null || bookOpenMin == null || bookCloseMin == null) {
            return window;
          }
          const nextOpen = Math.max(openMin, bookOpenMin);
          const nextClose = Math.min(closeMin, bookCloseMin);
          if (nextClose <= nextOpen) return null;
          const fmt = (mins: number) =>
            `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
          return { open: fmt(nextOpen), close: fmt(nextClose) };
        })
        .filter(Boolean) as Array<{ open: string; close: string }>;
      if (!windows.length) continue;
    }

    for (const window of windows) {
      const openMin = parseHm(window.open);
      const closeMin = parseHm(window.close);
      if (openMin == null || closeMin == null) continue;

      for (
        let slotStart = openMin;
        slotStart + durationMinutes <= closeMin;
        slotStart += durationMinutes
      ) {
        const hour = Math.floor(slotStart / 60);
        const minute = slotStart % 60;
        const start = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, hour, minute);
        const end = new Date(start.getTime() + durationMinutes * 60_000);

        if (start.getTime() < now.getTime() + noticeMs) continue;

        const capacity = svcCfg.groupBooking?.enabled
          ? svcCfg.groupBooking.capacity || 1
          : 1;

        if (capacity > 1) {
          const { checkGroupCapacity } = await import("@/lib/appointments/scheduling-domain");
          const group = await checkGroupCapacity(
            workspaceId,
            input.serviceName,
            start,
            capacity,
            input.excludeAppointmentId,
          );
          if (!group.available) continue;
        } else if (!needsStaffCheck) {
          const conflict = await prisma.voiceAppointment.findFirst({
            where: {
              workspaceId,
              id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
              startsAt: { lte: new Date(end.getTime() + bufferAfter) },
              endsAt: { gte: new Date(start.getTime() - bufferBefore) },
              status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
            },
          });
          if (conflict) continue;
        }

        if (overlapsExternalBusy(start, end)) continue;

        if (needsStaffCheck && eligibleStaff.length) {
          const mode = staffAssignment === "collective" ? "all" : "any";
          const availableStaff = await filterStaffAvailableForSlot(
            workspaceId,
            eligibleStaff,
            start,
            end,
            {
              timezone: tz,
              durationMinutes,
              bufferBeforeMs: bufferBefore,
              bufferAfterMs: bufferAfter,
              platform,
              svcCfg,
              mode,
              excludeAppointmentId: input.excludeAppointmentId,
            },
          );
          if (!availableStaff.length) continue;
          staffBySlot[start.toISOString()] = availableStaff[0]!.id;
        }

        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
        if (slots.length >= maxSlots) return { slots, staffBySlot };
      }
    }
  }

  const minimizeMode =
    (svcCfg as { schedulingLimits?: { minimizeGapsMode?: string } }).schedulingLimits
      ?.minimizeGapsMode ||
    (platform as { schedulingLimits?: { minimizeGapsMode?: string } }).schedulingLimits
      ?.minimizeGapsMode ||
    "off";

  if (minimizeMode === "prefer_compact" && slots.length > 1) {
    const { getPrisma } = await import("@/lib/db");
    const { rankSlotsByScheduleDensity } = await import(
      "@/lib/appointments/service-booking/minimize-gaps"
    );
    const prisma = getPrisma();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + input.daysAhead * 86_400_000);
    const existing = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId,
        serviceName,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
      select: { startsAt: true },
    });
    const ranked = rankSlotsByScheduleDensity(
      slots,
      existing.map((r) => r.startsAt),
      "prefer_compact",
    );
    return { slots: ranked, staffBySlot };
  }

  return { slots, staffBySlot };
}

/** Explain which staff members are available at a specific slot. */
export async function getAvailableStaffForSlot(
  workspaceId: string,
  serviceName: string,
  startsAt: string,
  durationMinutes?: number,
): Promise<string[]> {
  const ctx = await loadAvailabilityContext(workspaceId, serviceName);
  const { loadSchedulingContext, resolveEligibleStaff } = await import(
    "@/lib/appointments/scheduling-domain"
  );
  const schedulingCtx = await loadSchedulingContext(workspaceId, serviceName);
  const eligible = resolveEligibleStaff(schedulingCtx);
  const start = new Date(startsAt);
  const duration = durationMinutes ?? ctx.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);
  const mode = schedulingCtx.staffAssignment === "collective" ? "all" : "any";
  const available = await filterStaffAvailableForSlot(workspaceId, eligible, start, end, {
    timezone: ctx.timezone,
    durationMinutes: duration,
    bufferBeforeMs: ctx.bufferBeforeMinutes * 60_000,
    bufferAfterMs: ctx.bufferAfterMinutes * 60_000,
    platform: ctx.platform,
    svcCfg: ctx.svcCfg,
    mode,
  });
  return available.map((s) => s.id);
}
