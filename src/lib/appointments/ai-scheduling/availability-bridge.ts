import "server-only";

import { generateNativeSlots } from "@/lib/appointments/availability-engine";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { SchedulingIntent } from "./intent-schema";

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  staffName?: string;
  locationName?: string;
};

export type AvailabilityQueryResult = {
  slots: AvailableSlot[];
  serviceName: string;
  message: string;
  noMatch: boolean;
};

export function timeOfDayRange(
  timeOfDay: string | undefined,
  preferredStart?: string,
  preferredEnd?: string,
): { startMinutes?: number; endMinutes?: number } {
  if (preferredStart) {
    const [h, m] = preferredStart.split(":").map(Number);
    return { startMinutes: h * 60 + (m || 0) };
  }
  switch (timeOfDay) {
    case "morning":
      return { startMinutes: 6 * 60, endMinutes: 12 * 60 };
    case "afternoon":
      return { startMinutes: 12 * 60, endMinutes: 17 * 60 };
    case "evening":
      return { startMinutes: 17 * 60, endMinutes: 21 * 60 };
    default:
      return {};
  }
}

export function slotMatchesTimePreference(
  startsAt: string,
  timezone: string,
  pref: { startMinutes?: number; endMinutes?: number },
): boolean {
  if (!pref.startMinutes && !pref.endMinutes) return true;
  const date = new Date(startsAt);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const mins = hour * 60 + minute;
  if (pref.startMinutes !== undefined && mins < pref.startMinutes) return false;
  if (pref.endMinutes !== undefined && mins >= pref.endMinutes) return false;
  return true;
}

export function slotMatchesDatePreference(
  startsAt: string,
  timezone: string,
  requestedDate?: string,
  requestedDateStart?: string,
  requestedDateEnd?: string,
): boolean {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startsAt));

  if (requestedDate && dateKey !== requestedDate) return false;
  if (requestedDateStart && dateKey < requestedDateStart) return false;
  if (requestedDateEnd && dateKey > requestedDateEnd) return false;
  return true;
}

/**
 * Query the authoritative availability engine — AI never invents slots.
 */
export async function queryAvailabilityForIntent(
  workspaceId: string,
  intent: SchedulingIntent,
  serviceName: string,
): Promise<AvailabilityQueryResult> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const timezone = intent.timezone || platform.timezone;

  const daysAhead = platform.maximumBookingDaysAhead || 14;
  const { slots: rawSlots } = await generateNativeSlots(workspaceId, {
    serviceName,
    daysAhead,
    timezone,
    maxSlots: 100,
  });

  const timePref = timeOfDayRange(
    intent.timeOfDay,
    intent.preferredTimeStart,
    intent.preferredTimeEnd,
  );

  let filtered = rawSlots.filter((slot) => {
    if (
      !slotMatchesDatePreference(
        slot.startsAt,
        timezone,
        intent.requestedDate,
        intent.requestedDateStart,
        intent.requestedDateEnd,
      )
    ) {
      return false;
    }
    return slotMatchesTimePreference(slot.startsAt, timezone, timePref);
  });

  if (!filtered.length) {
    filtered = rawSlots.slice(0, 5);
  } else {
    filtered = filtered.slice(0, 8);
  }

  const slots: AvailableSlot[] = filtered.map((s) => ({
    startsAt: s.startsAt,
    endsAt: s.endsAt,
  }));

  const noMatch = !filtered.length;
  const message = noMatch
    ? "No matching times were found. Here are some nearby options, or try a different day."
    : slots.length === 1
      ? "I found one available time. Does this work?"
      : `I found ${slots.length} available times. Which works best?`;

  return { slots, serviceName, message, noMatch };
}

export function formatSlotsForDisplay(
  slots: AvailableSlot[],
  timezone: string,
): string {
  if (!slots.length) return "No available times found.";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return slots
    .slice(0, 5)
    .map((s) => `• ${formatter.format(new Date(s.startsAt))}`)
    .join("\n");
}
