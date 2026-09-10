/**
 * Shared scheduling domain — single source for availability, booking validation, routing.
 * All booking surfaces (manual, AI, staff, API, waitlist) must use these functions.
 */
import "server-only";

import { loadAvailabilityContext } from "@/lib/appointments/availability-engine";
import {
  evaluateCancellationPolicy as evalCancelPolicy,
  evaluateReschedulePolicy as evalReschedulePolicy,
} from "@/lib/appointments/scheduling-policy";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type {
  AppointmentTypeConfig,
  BookableStaffMember,
  BookingLimitConfig,
  CancellationPolicy,
  ReschedulePolicy,
  RoutingRule,
  StaffAssignmentMode,
} from "@/lib/appointments/types";
import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { countStaffOpenSlots, filterStaffAvailableForSlot } from "@/lib/appointments/staff-availability";

export type SchedulingContext = {
  workspaceId: string;
  serviceName: string;
  serviceId?: string;
  svcCfg: AppointmentTypeConfig;
  staffMembers: BookableStaffMember[];
  staffAssignment: StaffAssignmentMode;
};

export async function loadSchedulingContext(
  workspaceId: string,
  serviceName: string,
): Promise<SchedulingContext> {
  const ctx = await loadAvailabilityContext(workspaceId, serviceName);
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const svcCfg = ctx.svcCfg;
  const staffMembers = (platform.staff || []).filter((s) => s.active !== false);
  const staffAssignment = svcCfg.staffAssignment || "any_eligible";

  return {
    workspaceId,
    serviceName,
    serviceId: ctx.service?.id,
    svcCfg,
    staffMembers,
    staffAssignment,
  };
}

/** Resolve eligible staff for an appointment type. */
export function resolveEligibleStaff(
  ctx: SchedulingContext,
  preferredStaffName?: string,
): BookableStaffMember[] {
  const { svcCfg, staffMembers } = ctx;
  let eligible = staffMembers;

  if (svcCfg.staffIds?.length) {
    eligible = eligible.filter((s) => svcCfg.staffIds!.includes(s.id));
  }

  if (preferredStaffName) {
    const match = eligible.find(
      (s) => s.name.toLowerCase() === preferredStaffName.toLowerCase(),
    );
    if (match) return [match];
  }

  return eligible;
}

/** Round-robin staff assignment — concurrency-safe via DB state, filtered by slot availability. */
export async function assignStaffRoundRobin(
  workspaceId: string,
  serviceName: string,
  eligibleStaff: BookableStaffMember[],
  slotContext?: {
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    durationMinutes: number;
    bufferBeforeMs: number;
    bufferAfterMs: number;
    svcCfg: AppointmentTypeConfig;
  },
): Promise<BookableStaffMember | null> {
  if (!eligibleStaff.length) return null;

  let pool = eligibleStaff;
  if (slotContext) {
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    pool = await filterStaffAvailableForSlot(workspaceId, eligibleStaff, slotContext.startsAt, slotContext.endsAt, {
      timezone: slotContext.timezone,
      durationMinutes: slotContext.durationMinutes,
      bufferBeforeMs: slotContext.bufferBeforeMs,
      bufferAfterMs: slotContext.bufferAfterMs,
      platform,
      svcCfg: slotContext.svcCfg,
      mode: "any",
    });
    if (!pool.length) return null;
  }

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const key = serviceName;
  const state = platform.roundRobinState?.[key] || { counts: {} };
  const counts = state.counts || {};

  let selected = pool[0];
  let minCount = counts[selected.id] ?? 0;
  for (const staff of pool) {
    const c = counts[staff.id] ?? 0;
    if (c < minCount) {
      minCount = c;
      selected = staff;
    }
  }

  counts[selected.id] = (counts[selected.id] ?? 0) + 1;
  const { saveAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
  await saveAppointmentPlatformConfig(workspaceId, {
    roundRobinState: {
      ...(platform.roundRobinState || {}),
      [key]: { lastAssignedStaffId: selected.id, counts },
    },
  });

  return selected;
}

/** Maximize availability — pick staff member with most open slots in range. */
export async function assignStaffMaximizeAvailability(
  workspaceId: string,
  eligibleStaff: BookableStaffMember[],
  slotContext: {
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    durationMinutes: number;
    bufferBeforeMs: number;
    bufferAfterMs: number;
    svcCfg: AppointmentTypeConfig;
  },
): Promise<BookableStaffMember | null> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const available = await filterStaffAvailableForSlot(
    workspaceId,
    eligibleStaff,
    slotContext.startsAt,
    slotContext.endsAt,
    {
      timezone: slotContext.timezone,
      durationMinutes: slotContext.durationMinutes,
      bufferBeforeMs: slotContext.bufferBeforeMs,
      bufferAfterMs: slotContext.bufferAfterMs,
      platform,
      svcCfg: slotContext.svcCfg,
      mode: "any",
    },
  );
  if (!available.length) return null;

  const dayStart = new Date(slotContext.startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 14);
  const counts = await countStaffOpenSlots(workspaceId, available, dayStart, dayEnd, {
    timezone: slotContext.timezone,
    durationMinutes: slotContext.durationMinutes,
    platform,
    svcCfg: slotContext.svcCfg,
  });

  return available.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))[0] || null;
}

/** Assign staff for a booking based on appointment type configuration. */
export async function resolveStaffForBooking(
  ctx: SchedulingContext,
  options: {
    preferredStaffId?: string;
    preferredStaffName?: string;
    startsAt?: Date;
    endsAt?: Date;
    durationMinutes?: number;
  },
): Promise<BookableStaffMember | null> {
  const eligible = resolveEligibleStaff(ctx, options.preferredStaffName);
  if (!eligible.length) return null;

  const mode = ctx.staffAssignment;
  const platform = await loadAppointmentPlatformConfig(ctx.workspaceId);
  const bufferBeforeMs = (ctx.svcCfg.bufferBeforeMinutes ?? 0) * 60_000;
  const bufferAfterMs = (ctx.svcCfg.bufferAfterMinutes ?? 0) * 60_000;
  const durationMinutes = options.durationMinutes ?? 30;
  const slotContext =
    options.startsAt && options.endsAt
      ? {
          startsAt: options.startsAt,
          endsAt: options.endsAt,
          timezone: ctx.svcCfg.timezone || platform.timezone,
          durationMinutes,
          bufferBeforeMs,
          bufferAfterMs,
          svcCfg: ctx.svcCfg,
        }
      : undefined;

  if (mode === "customer_chooses" && options.preferredStaffId) {
    const match = eligible.find((s) => s.id === options.preferredStaffId);
    if (!match) return null;
    if (slotContext) {
      const available = await filterStaffAvailableForSlot(
        ctx.workspaceId,
        [match],
        slotContext.startsAt,
        slotContext.endsAt,
        { ...slotContext, platform, mode: "any" },
      );
      return available[0] || null;
    }
    return match;
  }

  if (mode === "specific_staff" && ctx.svcCfg.staffIds?.length) {
    const id = ctx.svcCfg.staffIds[0];
    const match = eligible.find((s) => s.id === id) || eligible[0];
    if (slotContext) {
      const available = await filterStaffAvailableForSlot(
        ctx.workspaceId,
        [match],
        slotContext.startsAt,
        slotContext.endsAt,
        { ...slotContext, platform, mode: "any" },
      );
      return available[0] || null;
    }
    return match;
  }

  if (mode === "round_robin") {
    return assignStaffRoundRobin(ctx.workspaceId, ctx.serviceName, eligible, slotContext);
  }

  if (mode === "maximize_availability" && slotContext) {
    return assignStaffMaximizeAvailability(ctx.workspaceId, eligible, slotContext);
  }

  if (mode === "collective" && ctx.svcCfg.collectiveStaffIds?.length) {
    const collective = eligible.filter((s) => ctx.svcCfg.collectiveStaffIds!.includes(s.id));
    if (!collective.length) return null;
    if (slotContext) {
      const available = await filterStaffAvailableForSlot(
        ctx.workspaceId,
        collective,
        slotContext.startsAt,
        slotContext.endsAt,
        { ...slotContext, platform, mode: "all" },
      );
      return available[0] || null;
    }
    return collective[0];
  }

  if (slotContext) {
    const available = await filterStaffAvailableForSlot(
      ctx.workspaceId,
      eligible,
      slotContext.startsAt,
      slotContext.endsAt,
      { ...slotContext, platform, mode: "any" },
    );
    return available[0] || eligible[0];
  }

  return eligible[0];
}

export { resolveRoutingDestination } from "@/lib/appointments/routing-resolution";

/** Check booking limits for a date. */
export async function checkBookingLimits(
  workspaceId: string,
  serviceName: string,
  startsAt: Date,
  limits?: BookingLimitConfig,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!limits) return { allowed: true };

  const prisma = getPrisma();
  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  if (limits.maxBookingsPerDay) {
    const count = await prisma.voiceAppointment.count({
      where: {
        workspaceId,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
    });
    if (count >= limits.maxBookingsPerDay) {
      return { allowed: false, reason: "Daily booking limit reached" };
    }
  }

  if (limits.maxPerTypePerDay) {
    const count = await prisma.voiceAppointment.count({
      where: {
        workspaceId,
        serviceName,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
    });
    if (count >= limits.maxPerTypePerDay) {
      return { allowed: false, reason: "Appointment type daily limit reached" };
    }
  }

  if (limits.maxBookingsPerWeek) {
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = await prisma.voiceAppointment.count({
      where: {
        workspaceId,
        startsAt: { gte: weekStart, lt: weekEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
    });
    if (count >= limits.maxBookingsPerWeek) {
      return { allowed: false, reason: "Weekly booking limit reached" };
    }
  }

  if (limits.maxBookingsPerMonth) {
    const monthStart = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
    const monthEnd = new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 1);
    const count = await prisma.voiceAppointment.count({
      where: {
        workspaceId,
        startsAt: { gte: monthStart, lt: monthEnd },
        status: { notIn: ["canceled", "cancelled"] },
      },
    });
    if (count >= limits.maxBookingsPerMonth) {
      return { allowed: false, reason: "Monthly booking limit reached" };
    }
  }

  return { allowed: true };
}

/** Group booking capacity check. */
export async function checkGroupCapacity(
  workspaceId: string,
  serviceName: string,
  startsAt: Date,
  capacity: number,
  excludeAppointmentId?: string,
): Promise<{ available: boolean; reserved: number; remaining: number }> {
  const prisma = getPrisma();
  const appointments = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      serviceName,
      startsAt,
      status: { notIn: ["canceled", "cancelled"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });
  const reserved = appointments.length;
  return {
    available: reserved < capacity,
    reserved,
    remaining: Math.max(0, capacity - reserved),
  };
}

export function evaluateCancellationPolicy(
  policy: CancellationPolicy | undefined,
  startsAt: Date,
  now = new Date(),
) {
  return evalCancelPolicy(policy, startsAt, now);
}

export function evaluateReschedulePolicy(
  policy: ReschedulePolicy | undefined,
  startsAt: Date,
  now = new Date(),
) {
  return evalReschedulePolicy(policy, startsAt, now);
}

/** Calendar provider abstraction for external busy-time blocking. */
export type CalendarProvider = {
  id: string;
  listCalendars(accessToken: string): Promise<Array<{ id: string; name: string }>>;
  getBusyTimes(
    accessToken: string,
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<Array<{ start: Date; end: Date }>>;
  createEvent?(
    accessToken: string,
    calendarId: string,
    event: { summary: string; start: Date; end: Date; description?: string },
  ): Promise<string | null>;
  updateEvent?(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: { summary?: string; start?: Date; end?: Date },
  ): Promise<void>;
  deleteEvent?(accessToken: string, calendarId: string, eventId: string): Promise<void>;
};

export async function getExternalBusyIntervals(
  workspaceId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  if (!platform.externalCalendarBlocking?.enabled) return [];

  const { getPrisma } = await import("@/lib/db");
  const {
    getValidAccessToken,
    getGoogleBusy,
    getMicrosoftBusy,
    resolveBlockingCalendarIds,
  } = await import("@/lib/calendar/providers");

  const blocking = platform.externalCalendarBlocking;
  const selectedConnectionIds = blocking.connectionIds?.length
    ? blocking.connectionIds
    : blocking.calendarIds?.length
      ? blocking.calendarIds
      : null;

  const connections = await getPrisma().voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
      status: "connected",
      ...(selectedConnectionIds ? { id: { in: selectedConnectionIds } } : {}),
    },
  });

  const busy: Array<{ start: Date; end: Date }> = [];
  for (const conn of connections) {
    const config = (conn.config || {}) as CalendarConfig;
    const token = await getValidAccessToken(conn.id, conn.provider, config);
    if (!token) continue;

    if (conn.provider === "google") {
      const calendarIds = resolveBlockingCalendarIds(config, conn.provider);
      for (const calId of calendarIds) {
        try {
          const intervals = await getGoogleBusy(token, calId, timeMin, timeMax);
          busy.push(...intervals);
        } catch (err) {
          console.warn("[calendar] google busy lookup failed", conn.id, calId, err);
        }
      }
    } else if (conn.provider === "microsoft") {
      const calendarIds = resolveBlockingCalendarIds(config, conn.provider);
      try {
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
      } catch (err) {
        console.warn("[calendar] microsoft busy lookup failed", conn.id, err);
      }
    }
  }
  return busy;
}
