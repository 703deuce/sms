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

/** Round-robin staff assignment — concurrency-safe via DB state. */
export async function assignStaffRoundRobin(
  workspaceId: string,
  serviceName: string,
  eligibleStaff: BookableStaffMember[],
): Promise<BookableStaffMember | null> {
  if (!eligibleStaff.length) return null;
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const key = serviceName;
  const state = platform.roundRobinState?.[key] || { counts: {} };
  const counts = state.counts || {};

  let selected = eligibleStaff[0];
  let minCount = counts[selected.id] ?? 0;
  for (const staff of eligibleStaff) {
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

/** Assign staff for a booking based on appointment type configuration. */
export async function resolveStaffForBooking(
  ctx: SchedulingContext,
  options: { preferredStaffId?: string; preferredStaffName?: string },
): Promise<BookableStaffMember | null> {
  const eligible = resolveEligibleStaff(ctx, options.preferredStaffName);
  if (!eligible.length) return null;

  const mode = ctx.staffAssignment;

  if (mode === "customer_chooses" && options.preferredStaffId) {
    return eligible.find((s) => s.id === options.preferredStaffId) || null;
  }

  if (mode === "specific_staff" && ctx.svcCfg.staffIds?.length) {
    const id = ctx.svcCfg.staffIds[0];
    return eligible.find((s) => s.id === id) || eligible[0];
  }

  if (mode === "round_robin") {
    return assignStaffRoundRobin(ctx.workspaceId, ctx.serviceName, eligible);
  }

  if (mode === "collective" && ctx.svcCfg.collectiveStaffIds?.length) {
    return eligible.find((s) => ctx.svcCfg.collectiveStaffIds!.includes(s.id)) || eligible[0];
  }

  return eligible[0];
}

/** Deterministic routing from booking answers. */
export function resolveRoutingDestination(
  rules: RoutingRule[] | undefined,
  answers: Record<string, string>,
): RoutingRule["destination"] | null {
  if (!rules?.length) return null;

  for (const rule of rules) {
    const logic = rule.logic || "and";
    const results = rule.conditions.map((c) => {
      const answer = answers[c.field] || "";
      if (c.operator === "equals") return answer === c.value;
      if (c.operator === "not_equals") return answer !== c.value;
      return false;
    });
    const match = logic === "or" ? results.some(Boolean) : results.every(Boolean);
    if (match) return rule.destination;
  }
  return null;
}

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
  const { getValidAccessToken, getGoogleBusy, getMicrosoftBusy } = await import(
    "@/lib/voice/calendar/providers"
  );

  const connections = await getPrisma().voiceCalendarConnection.findMany({
    where: { workspaceId, provider: { in: ["google", "microsoft"] } },
  });

  const busy: Array<{ start: Date; end: Date }> = [];
  for (const conn of connections) {
    const config = (conn.config || {}) as { accessToken?: string; refreshToken?: string; calendarId?: string };
    const token = await getValidAccessToken(conn.id, conn.provider, config);
    if (!token) continue;

    const calendarIds = platform.externalCalendarBlocking.calendarIds || [config.calendarId || "primary"];
    if (conn.provider === "google") {
      for (const calId of calendarIds) {
        const intervals = await getGoogleBusy(token, calId, timeMin, timeMax);
        busy.push(...intervals);
      }
    } else if (conn.provider === "microsoft") {
      const intervals = await getMicrosoftBusy(token, timeMin, timeMax);
      busy.push(...intervals);
    }
  }
  return busy;
}
