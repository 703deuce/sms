import "server-only";

import { getPrisma } from "@/lib/db";

export type TreatmentRecordInput = {
  id?: string;
  appointmentId: string;
  contactId?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  providerNotes?: string;
  attachments?: unknown[];
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
};

export async function listTreatmentRecords(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  return prisma.appointmentTreatmentRecord.findMany({
    where: { workspaceId, appointmentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTreatmentRecord(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const record = await prisma.appointmentTreatmentRecord.findFirst({
    where: { id, workspaceId },
  });
  if (!record) throw new Error("Treatment record not found");
  return record;
}

export async function upsertTreatmentRecord(workspaceId: string, input: TreatmentRecordInput) {
  const prisma = getPrisma();
  const data = {
    appointmentId: input.appointmentId,
    contactId: input.contactId,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    providerNotes: input.providerNotes,
    attachments: input.attachments ?? null,
    createdByUserId: input.createdByUserId,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.appointmentTreatmentRecord.update({
      where: { id: input.id, workspaceId },
      data,
    });
  }

  return prisma.appointmentTreatmentRecord.create({
    data: { workspaceId, ...data },
  });
}

export async function deleteTreatmentRecord(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.appointmentTreatmentRecord.delete({
    where: { id, workspaceId },
  });
}
