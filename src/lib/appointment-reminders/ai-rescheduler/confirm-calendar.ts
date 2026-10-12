import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { triggerArCalendarWriteBack } from "@/lib/appointment-reminders/calendar-write-back/trigger";

/**
 * Reflect customer attendance confirmation without changing event time or creating a duplicate.
 * Queues calendar write-back (Microsoft) when enabled; Transovo status is always authoritative.
 */
export async function reflectCustomerConfirmationOnProvider(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<{ providerUpdated: boolean; message?: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { providerUpdated: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const confirmedAt = new Date().toISOString();
  const already = meta.arCustomerConfirmedAt;

  if (!already) {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...meta,
          arCustomerConfirmedAt: confirmedAt,
          confirmationSource: meta.confirmationSource || "sms_reminder",
        } as object,
      },
    });
  }

  await triggerArCalendarWriteBack({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    kind: "confirmed",
    atIso: already || confirmedAt,
  });

  return { providerUpdated: true };
}
