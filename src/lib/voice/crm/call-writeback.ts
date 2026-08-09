import { getPrisma } from "@/lib/db";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function writebackBookingToCrm(input: {
  workspaceId: string;
  callId: string;
  appointmentId: string;
  session: AmyRealtimeSession;
  serviceName?: string | null;
}): Promise<{ ok: boolean; detail: string }> {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!appt) return { ok: false, detail: "appointment_not_found" };

  const collected = input.session.collectedFields || {};
  const noteParts = [
    `Booked via voice call ${input.callId}`,
    collected.fld_custom_problem_desc || collected.problem || collected.fld_problem
      ? `Problem: ${collected.fld_custom_problem_desc || collected.problem || collected.fld_problem}`
      : null,
    input.session.runtime.session_runtime?.classifications?.urgency
      ? `Urgency: ${input.session.runtime.session_runtime.classifications.urgency}`
      : null,
  ].filter(Boolean);
  const noteText = noteParts.join("\n");

  if (appt.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: appt.contactId, workspaceId: input.workspaceId },
      select: { customFields: true },
    });
    const customFields = asRecord(contact?.customFields);
    await prisma.contact.updateMany({
      where: { id: appt.contactId, workspaceId: input.workspaceId },
      data: {
        customFields: {
          ...customFields,
          voiceNotes: noteText,
          lastVoiceCallId: input.callId,
        },
        updatedAt: new Date(),
      },
    });
  }

  const meta = (appt.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: appt.id },
    data: {
      metadata: {
        ...meta,
        crmWriteback: {
          at: new Date().toISOString(),
          callId: input.callId,
          collectedFields: collected,
          serviceName: input.serviceName || appt.serviceName,
        },
      },
    },
  });

  return { ok: true, detail: "local_contact_and_appointment_updated" };
}
