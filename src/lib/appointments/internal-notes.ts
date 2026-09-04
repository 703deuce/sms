import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { appendTimeline } from "@/lib/appointments/settings";

export async function addInternalNote(
  workspaceId: string,
  appointmentId: string,
  input: { body: string; authorId?: string; authorName?: string },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const note = {
    id: createId(),
    at: new Date().toISOString(),
    authorId: input.authorId,
    authorName: input.authorName || "Staff",
    body: input.body.trim(),
  };
  const notes = [...(meta.internalNotes || []), note];
  const nextMeta = appendTimeline(
    { ...meta, internalNotes: notes },
    { type: "internal_note", label: "Internal note added" },
  ) as AppointmentMetadata;

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: nextMeta as object },
  });

  return note;
}
