import type { Prisma } from "@prisma/client";

/** `VoiceAppointment` has `createdAt` / `startsAt` only — no `updatedAt`. */
export const voiceAppointmentRecencyOrder: Prisma.VoiceAppointmentOrderByWithRelationInput = {
  startsAt: "desc",
};
