import "server-only";

import { filterBusyForReschedule } from "@/lib/voice-v3/calendar/slot-generator";
import type { CalendarBusyInterval } from "@/lib/voice-v3/calendar/types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import { providerRefFromAppointment } from "./provider-mutations";
import { resolveAiReschedulerConfig } from "./types";
import { slotPassesArWeeklyHours } from "./availability-rules";

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

function slotOverlapsBusy(
  startsAt: Date,
  endsAt: Date,
  busy: CalendarBusyInterval[],
): boolean {
  return busy.some((b) => {
    const bStart = new Date(b.startUtc).getTime();
    const bEnd = new Date(b.endUtc).getTime();
    return startsAt.getTime() < bEnd && endsAt.getTime() > bStart;
  });
}


/**
 * Live revalidation before calendar commit (SMS AI or staff approval).
 */
export async function revalidateArSlotBeforeCommit(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = input.now || new Date();
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: "Invalid appointment time" };
  }

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const timezone = platform.timezone;

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const durationMinutes =
    ar.durationMode === "fixed" && ar.fixedDurationMinutes
      ? ar.fixedDurationMinutes
      : Math.max(
          15,
          Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000) || 30,
        );
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const minStart = now.getTime() + ar.minimumNoticeMinutes * 60_000;
  const maxStart = now.getTime() + ar.maximumDaysAhead * 24 * 60 * 60 * 1000;
  if (start.getTime() < minStart) {
    return { ok: false, message: "That time is too soon. Please pick a later slot." };
  }
  if (start.getTime() > maxStart) {
    return { ok: false, message: "That time is outside the booking window." };
  }
  if (!slotPassesArWeeklyHours(start.toISOString(), end.toISOString(), timezone, ar.weeklyHours)) {
    return { ok: false, message: "That time is outside business hours." };
  }

  const ref = providerRefFromAppointment(row);
  if (!ref) {
    return { ok: true };
  }

  const padMs = 2 * 60 * 60 * 1000;
  const rangeStart = new Date(start.getTime() - padMs).toISOString();
  const rangeEnd = new Date(end.getTime() + padMs).toISOString();
  const { fetchBusyForRef } = await import("./availability-for-reschedule");
  const busyRaw =
    (await fetchBusyForRef(ref, input.workspaceId, rangeStart, rangeEnd, durationMinutes)) || [];
  const busy = expandBusyWithBuffer(
    filterBusyForReschedule(busyRaw, {
      startUtc: row.startsAt.toISOString(),
      endUtc: row.endsAt.toISOString(),
    }),
    ar.bufferMinutes,
  );
  if (slotOverlapsBusy(start, end, busy)) {
    return { ok: false, message: "That time is no longer available. Please choose another option." };
  }

  return { ok: true };
}
