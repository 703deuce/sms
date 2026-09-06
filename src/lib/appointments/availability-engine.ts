/**
 * Native Appointments availability — weekly hours, date overrides, booking rules.
 * Single source of truth for public booking, admin booking, and slot validation.
 */
import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
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
  },
): Promise<{ slots: AvailabilitySlot[] }> {
  const { addCalendarDays, wallTimeInZoneToUtc, zonedDateParts } = await import(
    "@/lib/voice/calendar/timezone-slots"
  );
  const { getPrisma } = await import("@/lib/db");

  const ctx = await loadAvailabilityContext(workspaceId, input.serviceName);
  const { platform, service, svcCfg } = ctx;
  if (!service || svcCfg.enabled === false) return { slots: [] };

  const tz = input.timezone || ctx.timezone;
  const weeklyHours = resolveWeeklyHours(platform);
  const bookingHours = parseBookingHours(svcCfg.bookingHours || undefined);
  const overrides = platform.dateOverrides || [];
  const days = Math.min(
    Math.max(1, input.daysAhead ?? ctx.maximumDaysAhead),
    ctx.maximumDaysAhead,
  );
  const maxSlots = input.maxSlots ?? 200;
  const durationMinutes = ctx.durationMinutes;
  const bufferBefore = ctx.bufferBeforeMinutes * 60_000;
  const bufferAfter = ctx.bufferAfterMinutes * 60_000;
  const noticeMs = ctx.minimumNoticeMinutes * 60_000;
  const now = new Date();
  const prisma = getPrisma();
  const slots: AvailabilitySlot[] = [];

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

        const conflict = await prisma.voiceAppointment.findFirst({
          where: {
            workspaceId,
            startsAt: { lte: new Date(end.getTime() + bufferAfter) },
            endsAt: { gte: new Date(start.getTime() - bufferBefore) },
            status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
          },
        });
        if (conflict) continue;
        if (overlapsExternalBusy(start, end)) continue;

        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
        if (slots.length >= maxSlots) return { slots };
      }
    }
  }

  return { slots };
}
