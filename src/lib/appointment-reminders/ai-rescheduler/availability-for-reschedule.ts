import "server-only";

import { getPrisma } from "@/lib/db";
import type { SchedulingIntent } from "@/lib/appointments/ai-scheduling/intent-schema";
import type { AvailableSlot } from "@/lib/appointments/ai-scheduling/availability-bridge";
import {
  slotMatchesDatePreference,
  slotMatchesTimePreference,
  timeOfDayRange,
} from "@/lib/appointments/ai-scheduling/availability-bridge";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  filterBusyForReschedule,
  generateAvailabilitySlots,
  type BusinessHoursWindow,
  type CalendarBusyInterval,
} from "@/lib/calendar/ar-microsoft-primitives";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";
import { resolveWriteCalendarId } from "@/lib/voice/calendar/providers";
import {
  providerRefFromAppointment,
  type ProviderAppointmentRef,
} from "./provider-mutations";
import { resolveAiReschedulerConfig, type AiReschedulerDayConfig } from "./types";
import { applyArRescheduleRules } from "./availability-rules";

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function arWeeklyToBusinessWindow(
  weeklyHours: Record<string, AiReschedulerDayConfig>,
): BusinessHoursWindow {
  const weekdays: number[] = [];
  for (let i = 0; i < DAY_KEYS.length; i++) {
    const key = DAY_KEYS[i]!;
    if (weeklyHours[key]?.enabled) weekdays.push(i);
  }
  const enabled = Object.values(weeklyHours).filter((d) => d.enabled);
  const open = enabled[0]?.open || "09:00";
  const close = enabled[0]?.close || "17:00";
  return { weekdays, startLocal: open, endLocal: close };
}

function expandBusyWithBuffer(
  busy: CalendarBusyInterval[],
  bufferMinutes: number,
): CalendarBusyInterval[] {
  if (!bufferMinutes) return busy;
  const pad = bufferMinutes * 60_000;
  return busy.map((b) => ({
    ...b,
    startUtc: new Date(new Date(b.startUtc).getTime() - pad).toISOString(),
    endUtc: new Date(new Date(b.endUtc).getTime() + pad).toISOString(),
  }));
}

export async function fetchBusyForRef(
  ref: ProviderAppointmentRef,
  workspaceId: string,
  rangeStartUtc: string,
  rangeEndUtc: string,
  durationMinutes: number,
): Promise<CalendarBusyInterval[] | null> {
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId },
  });
  if (!conn) return null;
  const config = (conn.config || {}) as CalendarConfig;
  const calendarIds = config.importCalendarIds?.length
    ? config.importCalendarIds
    : [resolveWriteCalendarId(config)];

  const request = {
    callId: `ar-sms-${workspaceId}`,
    schedulingGeneration: 1,
    timezone: ref.timezone,
    rangeStartUtc,
    rangeEndUtc,
    durationMinutes,
    calendarIds,
    requestKey: `ar_reschedule|${workspaceId}|${rangeStartUtc}`,
  };

  if (ref.provider === "google") {
    const { fetchGoogleBusyIntervals } = await import(
      "@/lib/voice-v3/calendar/google/google-find-availability"
    );
    const result = await fetchGoogleBusyIntervals({
      request,
      connectionId: ref.connectionId,
      calendarConfig: config,
      calendarIds,
    });
    return result.ok ? result.busy : null;
  }

  const { fetchMicrosoftBusyIntervals } = await import("@/lib/calendar/ar-microsoft-primitives");
  const result = await fetchMicrosoftBusyIntervals({
    request,
    connectionId: ref.connectionId,
    calendarConfig: config,
  });
  return result.ok ? result.busy : null;
}

export async function queryArRescheduleAvailability(input: {
  workspaceId: string;
  appointmentId: string;
  intent: SchedulingIntent;
  serviceName: string;
  now?: Date;
}): Promise<{ slots: AvailableSlot[]; serviceName: string; message: string; noMatch: boolean }> {
  const now = input.now || new Date();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const timezone = input.intent.timezone || platform.timezone;

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) {
    return {
      slots: [],
      serviceName: input.serviceName,
      message: "I couldn't find that appointment.",
      noMatch: true,
    };
  }

  const ref = providerRefFromAppointment(row);
  const durationMinutes =
    ar.durationMode === "fixed" && ar.fixedDurationMinutes
      ? ar.fixedDurationMinutes
      : Math.max(
          15,
          Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000) || 30,
        );

  const rangeStart = new Date(now.getTime() + ar.minimumNoticeMinutes * 60_000);
  const rangeEnd = new Date(now.getTime() + ar.maximumDaysAhead * 24 * 60 * 60 * 1000);

  let rawSlots: AvailableSlot[] = [];

  if (ref && ar.mode === "ai") {
    const busyRaw =
      (await fetchBusyForRef(
        ref,
        input.workspaceId,
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
        durationMinutes,
      )) || [];
    const busy = expandBusyWithBuffer(
      filterBusyForReschedule(busyRaw, {
        startUtc: row.startsAt.toISOString(),
        endUtc: row.endsAt.toISOString(),
      }),
      ar.bufferMinutes,
    );
    const generated = generateAvailabilitySlots({
      timezone,
      rangeStartUtc: rangeStart.toISOString(),
      rangeEndUtc: rangeEnd.toISOString(),
      durationMinutes,
      slotStepMinutes: 15,
      businessHours: arWeeklyToBusinessWindow(ar.weeklyHours),
      busyIntervals: busy,
      maxSlots: 48,
    });
    rawSlots = generated.map((s) => ({ startsAt: s.startUtc, endsAt: s.endUtc }));
    rawSlots = applyArRescheduleRules(rawSlots, { timezone, ar, now });
  } else {
    const { queryAvailabilityForIntent } = await import(
      "@/lib/appointments/ai-scheduling/availability-bridge"
    );
    const fallback = await queryAvailabilityForIntent(
      input.workspaceId,
      input.intent,
      input.serviceName,
    );
    rawSlots = fallback.slots;
  }

  const timePref = timeOfDayRange(
    input.intent.timeOfDay,
    input.intent.preferredTimeStart,
    input.intent.preferredTimeEnd,
  );

  let filtered = rawSlots.filter((slot) => {
    if (
      !slotMatchesDatePreference(
        slot.startsAt,
        timezone,
        input.intent.requestedDate,
        input.intent.requestedDateStart,
        input.intent.requestedDateEnd,
      )
    ) {
      return false;
    }
    return slotMatchesTimePreference(slot.startsAt, timezone, timePref);
  });

  if (!filtered.length) {
    filtered = applyArRescheduleRules(rawSlots, { timezone, ar, now });
  } else {
    filtered = applyArRescheduleRules(filtered, { timezone, ar, now });
  }

  filtered = filtered.slice(0, 3);

  const noMatch = !filtered.length;
  const message = noMatch
    ? "I couldn't find an open time that matches. What other day or time works?"
    : filtered.length === 1
      ? "I found one available time. Does this work?"
      : `I have ${filtered.length} options. Which works best?`;

  return { slots: filtered, serviceName: input.serviceName, message, noMatch };
}
