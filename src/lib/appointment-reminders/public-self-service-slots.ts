import "server-only";

import { getPrisma } from "@/lib/db";
import {
  filterBusyForReschedule,
  generateAvailabilitySlots,
} from "@/lib/calendar/ar-microsoft-primitives";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { fetchBusyForRef } from "@/lib/appointment-reminders/ai-rescheduler/availability-for-reschedule";
import { applyArRescheduleRules } from "@/lib/appointment-reminders/ai-rescheduler/availability-rules";
import {
  arWeeklyToBusinessWindow,
  expandBusyWithBuffer,
} from "@/lib/appointment-reminders/ai-rescheduler/availability-for-reschedule";
import { resolveAiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { deriveAppointmentDurationMinutes } from "@/lib/appointment-reminders/public-self-service-duration";

export { deriveAppointmentDurationMinutes };

export async function listPublicSelfServiceRescheduleSlots(input: {
  workspaceId: string;
  appointmentId: string;
  now?: Date;
}): Promise<
  | { ok: true; slots: Array<{ startsAt: string; endsAt: string }>; durationMinutes: number }
  | { ok: false; reason: string }
> {
  const now = input.now || new Date();
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, reason: "appointment_not_found" };

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const timezone = row.timezone || platform.timezone;
  const durationMinutes = deriveAppointmentDurationMinutes(row.startsAt, row.endsAt, ar);
  if (!durationMinutes) {
    return { ok: false, reason: "duration_unknown" };
  }

  const ref = providerRefFromAppointment(row);
  const rangeStart = new Date(now.getTime() + ar.minimumNoticeMinutes * 60_000);
  const rangeEnd = new Date(now.getTime() + ar.maximumDaysAhead * 24 * 60 * 60 * 1000);

  let rawSlots: Array<{ startsAt: string; endsAt: string }> = [];

  if (ref) {
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
      maxSlots: 14 * 12,
    });
    rawSlots = generated.map((s) => ({
      startsAt: s.startUtc,
      endsAt: s.endUtc,
    }));
  } else {
    const { getAvailability } = await import("@/lib/appointments/booking-platform");
    const availability = await getAvailability(input.workspaceId, {
      serviceName: row.serviceName || "Appointment",
      daysAhead: ar.maximumDaysAhead,
      timezone,
      durationMinutes,
      excludeAppointmentId: row.id,
    });
    rawSlots = availability.slots;
  }

  const filtered = applyArRescheduleRules(
    rawSlots.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
    { timezone, ar, now },
  ).map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt }));

  const future = filtered.filter(
    (s) => new Date(s.startsAt).getTime() > now.getTime() + 60_000,
  );

  return { ok: true, slots: future, durationMinutes };
}
