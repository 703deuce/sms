import "server-only";

import { createPlatformAppointment } from "@/lib/appointments/booking-platform";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import { getPrisma } from "@/lib/db";

export type RecurringBookingInput = {
  workspaceId: string;
  serviceName: string;
  startsAt: string;
  frequency: "weekly" | "biweekly" | "monthly";
  occurrences: number;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  smsConsent?: boolean;
};

function nextOccurrence(date: Date, frequency: RecurringBookingInput["frequency"]): Date {
  const next = new Date(date);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

export async function createRecurringAppointments(input: RecurringBookingInput) {
  const prisma = getPrisma();
  const series = await prisma.appointmentRecurringSeries.create({
    data: {
      workspaceId: input.workspaceId,
      serviceName: input.serviceName,
      frequency: input.frequency,
      occurrences: input.occurrences,
    },
  });

  const created: string[] = [];
  const conflicts: Array<{ startsAt: string; reason: string }> = [];
  let current = new Date(input.startsAt);

  for (let i = 0; i < input.occurrences; i++) {
    const startsAt = current.toISOString();
    try {
      await assertSlotAvailableForBooking(input.workspaceId, {
        serviceName: input.serviceName,
        startsAt,
      });
      const result = await createPlatformAppointment(input.workspaceId, {
        serviceName: input.serviceName,
        startsAt,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        smsConsent: input.smsConsent,
        source: "public_booking",
      });
      if (result.appointmentId) {
        created.push(result.appointmentId);
        await prisma.voiceAppointment.update({
          where: { id: result.appointmentId },
          data: {
            metadata: {
              recurringSeriesId: series.id,
              recurringOccurrenceIndex: i + 1,
            },
          },
        });
      }
    } catch (err) {
      conflicts.push({
        startsAt,
        reason: err instanceof Error ? err.message : "unavailable",
      });
    }
    current = nextOccurrence(current, input.frequency);
  }

  return { seriesId: series.id, created, conflicts };
}
