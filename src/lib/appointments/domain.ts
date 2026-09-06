/**
 * Provider-neutral appointment domain.
 * Persistence remains `voice_appointments` / VoiceAppointment for stability.
 * New calendar/reminder code should import from here, not voice-specific modules.
 */
import "server-only";

import { getPrisma } from "@/lib/db";

export type WorkspaceAppointmentRecord = {
  id: string;
  workspaceId: string;
  callId: string | null;
  contactId: string | null;
  serviceName: string | null;
  staffName: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string | null;
  status: string;
  externalId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export async function getWorkspaceAppointment(workspaceId: string, appointmentId: string) {
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  return row as WorkspaceAppointmentRecord | null;
}

export async function findWorkspaceAppointmentByExternalId(
  workspaceId: string,
  externalId: string,
) {
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { workspaceId, externalId },
  });
  return row as WorkspaceAppointmentRecord | null;
}

export async function upsertWorkspaceAppointmentByExternalId(input: {
  workspaceId: string;
  externalId: string;
  create: Omit<WorkspaceAppointmentRecord, "id" | "createdAt" | "workspaceId" | "externalId">;
  update: Partial<
    Omit<WorkspaceAppointmentRecord, "id" | "createdAt" | "workspaceId" | "externalId">
  >;
}) {
  const prisma = getPrisma();
  const existing = await prisma.voiceAppointment.findFirst({
    where: { workspaceId: input.workspaceId, externalId: input.externalId },
  });

  if (existing) {
    return prisma.voiceAppointment.update({
      where: { id: existing.id },
      data: input.update as object,
    }) as Promise<WorkspaceAppointmentRecord>;
  }

  try {
    return (await prisma.voiceAppointment.create({
      data: {
        workspaceId: input.workspaceId,
        externalId: input.externalId,
        ...input.create,
      } as object,
    })) as WorkspaceAppointmentRecord;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/unique|duplicate/i.test(message)) throw err;
    const raced = await prisma.voiceAppointment.findFirst({
      where: { workspaceId: input.workspaceId, externalId: input.externalId },
    });
    if (!raced) throw err;
    return prisma.voiceAppointment.update({
      where: { id: raced.id },
      data: input.update as object,
    }) as Promise<WorkspaceAppointmentRecord>;
  }
}
