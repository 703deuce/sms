import "server-only";

import { createPlatformAppointment } from "@/lib/appointments/booking-platform";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import {
  generateRecurringOccurrences,
  type RecurringFrequency,
} from "@/lib/appointments/recurring-schedule";
import { getPrisma } from "@/lib/db";

export type RecurringBookingInput = {
  workspaceId: string;
  serviceName: string;
  startsAt: string;
  frequency: RecurringFrequency | "weekly" | "biweekly" | "monthly";
  occurrences: number;
  weekdays?: number[];
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  smsConsent?: boolean;
};

function normalizeFrequency(freq: RecurringBookingInput["frequency"]): RecurringFrequency {
  if (freq === "biweekly") return "biweekly";
  if (freq === "monthly") return "monthly";
  if (freq === "weekly") return "weekly";
  return freq;
}

export async function createRecurringAppointments(input: RecurringBookingInput) {
  const prisma = getPrisma();
  const frequency = normalizeFrequency(input.frequency);
  const series = await prisma.appointmentRecurringSeries.create({
    data: {
      workspaceId: input.workspaceId,
      serviceName: input.serviceName,
      frequency,
      occurrences: input.occurrences,
    },
  });

  const dates = generateRecurringOccurrences({
    startsAt: input.startsAt,
    frequency,
    occurrences: input.occurrences,
    weekdays: input.weekdays,
  });

  const created: string[] = [];
  const conflicts: Array<{ startsAt: string; reason: string }> = [];

  for (let i = 0; i < dates.length; i++) {
    const startsAt = dates[i];
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
  }

  return { seriesId: series.id, created, conflicts, dates };
}
