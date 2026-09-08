import "server-only";

import { getPrisma } from "@/lib/db";
import type { RecurringEditScope } from "./types";

export async function editRecurringSeries(
  workspaceId: string,
  seriesId: string,
  scope: RecurringEditScope,
  anchorAppointmentId: string,
  patch: { startsAt?: string; status?: string },
) {
  const prisma = getPrisma();
  const anchor = await prisma.voiceAppointment.findFirst({
    where: { id: anchorAppointmentId, workspaceId },
  });
  if (!anchor) throw new Error("Anchor appointment not found");

  const meta = (anchor.metadata || {}) as { recurringSeriesId?: string; recurringOccurrenceIndex?: number };
  if (meta.recurringSeriesId !== seriesId) throw new Error("Appointment not in series");

  const all = await prisma.voiceAppointment.findMany({
    where: { workspaceId },
  });
  const inSeries = all.filter((row) => {
    const m = (row.metadata || {}) as { recurringSeriesId?: string };
    return m.recurringSeriesId === seriesId;
  });

  const anchorIndex = meta.recurringOccurrenceIndex ?? 0;
  const targets =
    scope === "this_only"
      ? inSeries.filter((r) => r.id === anchorAppointmentId)
      : scope === "this_and_future"
        ? inSeries.filter((r) => {
            const idx = ((r.metadata || {}) as { recurringOccurrenceIndex?: number }).recurringOccurrenceIndex ?? 0;
            return idx >= anchorIndex;
          })
        : inSeries;

  const preview = targets.map((t) => ({
    id: t.id,
    from: t.startsAt,
    to: patch.startsAt ? new Date(patch.startsAt) : t.startsAt,
    status: patch.status ?? t.status,
  }));

  const updated = [];
  for (const t of targets) {
    const duration =
      (t.endsAt?.getTime() || t.startsAt.getTime() + 3_600_000) - t.startsAt.getTime();
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : t.startsAt;
    const endsAt = new Date(startsAt.getTime() + duration);
    updated.push(
      await prisma.voiceAppointment.update({
        where: { id: t.id },
        data: {
          startsAt,
          endsAt,
          ...(patch.status ? { status: patch.status } : {}),
        },
      }),
    );
  }

  return { preview, updated, scope };
}

export async function previewHolidaySeriesImpact(
  workspaceId: string,
  holidayDates: string[],
) {
  const prisma = getPrisma();
  const appointments = await prisma.voiceAppointment.findMany({ where: { workspaceId } });
  const affected = appointments.filter((a) => {
    const day = a.startsAt.toISOString().slice(0, 10);
    return holidayDates.includes(day);
  });
  return { count: affected.length, appointments: affected.map((a) => ({ id: a.id, startsAt: a.startsAt })) };
}
