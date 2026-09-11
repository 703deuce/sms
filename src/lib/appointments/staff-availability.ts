/**
 * Per-staff availability — weekly hours, holidays, named schedules, calendar busy.
 * Used by collective scheduling, round-robin, and maximize-availability modes.
 */
import "server-only";

import {
  dateKeyFromParts,
  dayKeyInTimezone,
  parseHm,
  resolveWeeklyHours,
} from "@/lib/appointments/availability-engine-policy";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type {
  AppointmentTypeConfig,
  BookableStaffMember,
  DateOverride,
} from "@/lib/appointments/types";
import type {
  HolidayCalendarEntry,
  NamedAvailabilitySchedule,
} from "@/lib/appointments/scheduling-capabilities";
import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
// Imported statically: this is called once per candidate slot, and resolving
// the module on every call dominated the cost of a two-week availability scan.
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "@/lib/voice/calendar/timezone-slots";

export function resolveNamedSchedule(
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  scheduleId?: string,
): NamedAvailabilitySchedule | null {
  const schedules = platform.namedSchedules || [];
  if (scheduleId) {
    return schedules.find((s) => s.id === scheduleId) || null;
  }
  return schedules.find((s) => s.isDefault) || schedules[0] || null;
}

export function resolveStaffWeeklyHours(
  staff: BookableStaffMember,
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  svcCfg?: AppointmentTypeConfig,
): Record<string, Array<{ open: string; close: string }>> {
  if (staff.weeklyHours && Object.keys(staff.weeklyHours).length) {
    return staff.weeklyHours;
  }
  const named = resolveNamedSchedule(platform, svcCfg?.namedScheduleId as string | undefined);
  if (named?.weeklyHours) return named.weeklyHours;
  return resolveWeeklyHours(platform);
}

export function resolveHolidayEntry(
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  dateKey: string,
  scheduleId?: string,
): HolidayCalendarEntry | null {
  const holidays = platform.holidays || [];
  const direct = holidays.find((h) => h.date === dateKey);
  if (direct) return direct;
  const named = resolveNamedSchedule(platform, scheduleId);
  if (named?.holidayCalendarId) {
    return holidays.find((h) => h.date === dateKey) || null;
  }
  return null;
}

export function windowsForStaffDay(
  staff: BookableStaffMember,
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  dateKey: string,
  dayName: string,
  svcCfg?: AppointmentTypeConfig,
): Array<{ open: string; close: string }> {
  const holiday = resolveHolidayEntry(platform, dateKey, svcCfg?.namedScheduleId as string | undefined);
  if (holiday?.closed) return [];
  if (holiday?.windows?.length) return holiday.windows;

  const staffOverride = (staff.dateOverrides || []).find((o) => o.date === dateKey);
  if (staffOverride?.closed) return [];
  if (staffOverride?.windows?.length) return staffOverride.windows;

  const platformOverride = (platform.dateOverrides || []).find((o) => o.date === dateKey);
  if (platformOverride?.closed) return [];
  if (platformOverride?.windows?.length) return platformOverride.windows;

  if (staff.blackoutDates?.includes(dateKey) || platform.blackoutDates?.includes(dateKey)) {
    return [];
  }

  const weekly = resolveStaffWeeklyHours(staff, platform, svcCfg);
  return weekly[dayName] || weekly[dayName.toLowerCase()] || [];
}

export function slotWithinWindows(
  startMin: number,
  durationMinutes: number,
  windows: Array<{ open: string; close: string }>,
): boolean {
  for (const window of windows) {
    const openMin = parseHm(window.open);
    const closeMin = parseHm(window.close);
    if (openMin == null || closeMin == null) continue;
    if (startMin >= openMin && startMin + durationMinutes <= closeMin) return true;
  }
  return false;
}

const BUSY_STATUSES_EXCLUDED = ["canceled", "cancelled", "completed", "no_show"];

/**
 * Every appointment that can block a slot in one window, loaded once.
 *
 * Scanning two weeks of candidate starts asks the same conflict question a few
 * hundred times; issuing a query per question is what made availability take
 * twenty seconds. The rows are small and the window is bounded, so they are
 * fetched once and the overlap test runs in memory against the same
 * inclusive bounds the query used.
 */
export type AppointmentBusyIndex = {
  byStaff: Map<string, Array<{ start: number; end: number }>>;
  all: Array<{ start: number; end: number }>;
};

export async function loadAppointmentBusyIndex(
  workspaceId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
): Promise<AppointmentBusyIndex> {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { notIn: BUSY_STATUSES_EXCLUDED },
      startsAt: { lte: to },
      endsAt: { gte: from },
    },
    select: { startsAt: true, endsAt: true, metadata: true },
  });

  const index: AppointmentBusyIndex = { byStaff: new Map(), all: [] };
  for (const row of rows) {
    // A null end never satisfied `endsAt >= bufferedStart`, so it never blocked
    // a slot and must not start doing so here.
    if (!row.endsAt) continue;
    const interval = { start: row.startsAt.getTime(), end: row.endsAt.getTime() };
    index.all.push(interval);
    const staffId = (row.metadata as { staffId?: unknown } | null)?.staffId;
    if (typeof staffId === "string" && staffId) {
      const bucket = index.byStaff.get(staffId);
      if (bucket) bucket.push(interval);
      else index.byStaff.set(staffId, [interval]);
    }
  }
  return index;
}

export function busyIndexHasConflict(
  intervals: Array<{ start: number; end: number }> | undefined,
  bufferedStart: number,
  bufferedEnd: number,
): boolean {
  if (!intervals?.length) return false;
  return intervals.some((i) => i.start <= bufferedEnd && i.end >= bufferedStart);
}

export async function getStaffAppointmentConflicts(
  workspaceId: string,
  staffId: string,
  start: Date,
  end: Date,
  bufferBeforeMs: number,
  bufferAfterMs: number,
  excludeAppointmentId?: string,
  busyIndex?: AppointmentBusyIndex,
): Promise<boolean> {
  const bufferedStart = new Date(start.getTime() - bufferBeforeMs);
  const bufferedEnd = new Date(end.getTime() + bufferAfterMs);
  if (busyIndex) {
    return busyIndexHasConflict(
      busyIndex.byStaff.get(staffId),
      bufferedStart.getTime(),
      bufferedEnd.getTime(),
    );
  }
  const prisma = getPrisma();
  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { notIn: BUSY_STATUSES_EXCLUDED },
      startsAt: { lte: bufferedEnd },
      endsAt: { gte: bufferedStart },
      metadata: { path: ["staffId"], equals: staffId },
    },
  });
  return Boolean(conflict);
}

export async function getStaffExternalBusy(
  workspaceId: string,
  staff: BookableStaffMember,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const connectionId = staff.calendarConnectionId;
  if (!connectionId) return [];

  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, status: "connected" },
  });
  if (!conn) return [];

  const { getValidAccessToken, getGoogleBusy, getMicrosoftBusy, resolveBlockingCalendarIds } =
    await import("@/lib/calendar/providers");
  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) return [];

  const busy: Array<{ start: Date; end: Date }> = [];
  try {
    if (conn.provider === "google") {
      for (const calId of resolveBlockingCalendarIds(config, conn.provider)) {
        const intervals = await getGoogleBusy(token, calId, timeMin, timeMax);
        busy.push(...intervals);
      }
    } else if (conn.provider === "microsoft") {
      const calendarIds = resolveBlockingCalendarIds(config, conn.provider);
      if (calendarIds.length) {
        for (const calId of calendarIds) {
          const intervals = await getMicrosoftBusy(token, timeMin, timeMax, {
            calendarId: calId,
            ctx: { connectionId: conn.id, config },
          });
          busy.push(...intervals);
        }
      } else {
        const intervals = await getMicrosoftBusy(token, timeMin, timeMax, {
          ctx: { connectionId: conn.id, config },
          smtp: config.email,
        });
        busy.push(...intervals);
      }
    }
  } catch (err) {
    console.warn("[staff-availability] external busy lookup failed", staff.id, err);
  }
  return busy;
}

export async function isStaffAvailableAtSlot(input: {
  workspaceId: string;
  staff: BookableStaffMember;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  durationMinutes: number;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>;
  svcCfg?: AppointmentTypeConfig;
  externalBusy?: Array<{ start: Date; end: Date }>;
  excludeAppointmentId?: string;
  busyIndex?: AppointmentBusyIndex;
}): Promise<boolean> {
  const parts = zonedDateParts(input.startsAt, input.timezone);
  const dateKey = dateKeyFromParts(parts.year, parts.month, parts.day);
  const dayName = dayKeyInTimezone(input.startsAt.toISOString(), input.timezone);
  const windows = windowsForStaffDay(
    input.staff,
    input.platform,
    dateKey,
    dayName,
    input.svcCfg,
  );
  if (!windows.length) return false;

  const startMin = parts.hour * 60 + parts.minute;
  if (!slotWithinWindows(startMin, input.durationMinutes, windows)) return false;

  if (
    await getStaffAppointmentConflicts(
      input.workspaceId,
      input.staff.id,
      input.startsAt,
      input.endsAt,
      input.bufferBeforeMs,
      input.bufferAfterMs,
      input.excludeAppointmentId,
      input.busyIndex,
    )
  ) {
    return false;
  }

  const staffBusy =
    input.externalBusy ||
    (await getStaffExternalBusy(input.workspaceId, input.staff, input.startsAt, input.endsAt));
  const bufferedStart = new Date(input.startsAt.getTime() - input.bufferBeforeMs);
  const bufferedEnd = new Date(input.endsAt.getTime() + input.bufferAfterMs);
  if (staffBusy.some((b) => bufferedStart < b.end && bufferedEnd > b.start)) return false;

  return true;
}

export async function filterStaffAvailableForSlot(
  workspaceId: string,
  staff: BookableStaffMember[],
  startsAt: Date,
  endsAt: Date,
  opts: {
    timezone: string;
    durationMinutes: number;
    bufferBeforeMs: number;
    bufferAfterMs: number;
    platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>;
    svcCfg?: AppointmentTypeConfig;
    mode: "any" | "all";
    excludeAppointmentId?: string;
    busyIndex?: AppointmentBusyIndex;
    externalBusyByStaff?: Map<string, Array<{ start: Date; end: Date }>>;
  },
): Promise<BookableStaffMember[]> {
  const available: BookableStaffMember[] = [];
  for (const member of staff) {
    const ok = await isStaffAvailableAtSlot({
      workspaceId,
      staff: member,
      startsAt,
      endsAt,
      timezone: opts.timezone,
      durationMinutes: opts.durationMinutes,
      bufferBeforeMs: opts.bufferBeforeMs,
      bufferAfterMs: opts.bufferAfterMs,
      platform: opts.platform,
      svcCfg: opts.svcCfg,
      excludeAppointmentId: opts.excludeAppointmentId,
      busyIndex: opts.busyIndex,
      externalBusy: opts.externalBusyByStaff?.get(member.id),
    });
    if (ok) available.push(member);
  }
  if (opts.mode === "all") {
    return available.length === staff.length ? staff : [];
  }
  return available;
}

export async function countStaffOpenSlots(
  workspaceId: string,
  staff: BookableStaffMember[],
  dayStart: Date,
  dayEnd: Date,
  opts: {
    timezone: string;
    durationMinutes: number;
    platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>;
    svcCfg?: AppointmentTypeConfig;
  },
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const member of staff) counts.set(member.id, 0);

  const startParts = zonedDateParts(dayStart, opts.timezone);
  const endParts = zonedDateParts(dayEnd, opts.timezone);

  for (let d = 0; d < 14; d += 1) {
    const day = addCalendarDays(startParts.year, startParts.month, startParts.day, d);
    if (day.year > endParts.year || (day.year === endParts.year && day.month > endParts.month)) break;
    if (day.year === endParts.year && day.month === endParts.month && day.day > endParts.day) break;

    for (const member of staff) {
      const dateKey = dateKeyFromParts(day.year, day.month, day.day);
      const noon = wallTimeInZoneToUtc(opts.timezone, day.year, day.month, day.day, 12, 0);
      const dayName = dayKeyInTimezone(noon.toISOString(), opts.timezone);
      const windows = windowsForStaffDay(member, opts.platform, dateKey, dayName, opts.svcCfg);
      for (const window of windows) {
        const openMin = parseHm(window.open);
        const closeMin = parseHm(window.close);
        if (openMin == null || closeMin == null) continue;
        const slotCount = Math.floor((closeMin - openMin) / opts.durationMinutes);
        counts.set(member.id, (counts.get(member.id) || 0) + slotCount);
      }
    }
  }
  return counts;
}
