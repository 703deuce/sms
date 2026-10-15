import type { Prisma } from "@prisma/client";

/** Appointment scheduled start time (calendar / upcoming sort). */
export const voiceAppointmentScheduleOrder: Prisma.VoiceAppointmentOrderByWithRelationInput = {
  startsAt: "desc",
};

/** Last persisted change to the appointment row (reschedule, reminder metadata, etc.). */
export const voiceAppointmentModificationRecencyOrder: Prisma.VoiceAppointmentOrderByWithRelationInput =
  {
    updatedAt: "desc",
  };

/** @deprecated Use voiceAppointmentModificationRecencyOrder or voiceAppointmentScheduleOrder explicitly. */
export const voiceAppointmentRecencyOrder = voiceAppointmentModificationRecencyOrder;
