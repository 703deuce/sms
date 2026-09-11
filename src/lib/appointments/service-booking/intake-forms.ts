import "server-only";

import { getPrisma } from "@/lib/db";
import type { IntakeField } from "./types";

export async function listIntakeForms(workspaceId: string, targetKind?: string) {
  const prisma = getPrisma();
  return prisma.intakeForm.findMany({
    where: { workspaceId, ...(targetKind ? { targetKind } : {}) },
    orderBy: { name: "asc" },
  });
}

export type IntakeFormMetadata = {
  kind?: "form" | "waiver" | "agreement" | "upload" | "questionnaire";
  customerTitle?: string;
  customerInstructions?: string;
  internalDescription?: string;
  /** Only `during_booking` is enforced by public booking today. */
  completionTiming?: "during_booking" | "after_booking" | "before_appointment";
};

export async function getIntakeForm(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.intakeForm.findFirst({ where: { id, workspaceId } });
}

export async function upsertIntakeForm(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    targetKind?: string;
    fields?: IntakeField[];
    active?: boolean;
    metadata?: IntakeFormMetadata | Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  if (input.id) {
    const existing = await prisma.intakeForm.findFirst({ where: { id: input.id, workspaceId } });
    if (!existing) throw new Error("Form not found");
    const fieldsChanged =
      input.fields !== undefined &&
      JSON.stringify(input.fields) !== JSON.stringify(existing.fields ?? []);
    const metadataChanged =
      input.metadata !== undefined &&
      JSON.stringify(input.metadata) !== JSON.stringify(existing.metadata ?? null);
    const bumpVersion = fieldsChanged || metadataChanged;
    return prisma.intakeForm.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        targetKind: input.targetKind || existing.targetKind,
        fields: input.fields ?? existing.fields,
        version: bumpVersion ? existing.version + 1 : existing.version,
        active: input.active ?? existing.active,
        metadata: input.metadata !== undefined ? input.metadata : existing.metadata,
      },
    });
  }
  return prisma.intakeForm.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      targetKind: input.targetKind || "appointment",
      fields: input.fields || [],
      version: 1,
      active: input.active ?? true,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function duplicateIntakeForm(workspaceId: string, sourceId: string) {
  const prisma = getPrisma();
  const source = await prisma.intakeForm.findFirst({ where: { id: sourceId, workspaceId } });
  if (!source) throw new Error("Form not found");
  return prisma.intakeForm.create({
    data: {
      workspaceId,
      name: `${source.name.trim()} (Copy)`,
      targetKind: source.targetKind,
      fields: source.fields,
      version: 1,
      active: true,
      metadata: source.metadata ?? undefined,
    },
  });
}

export async function listIntakeFormResponses(
  workspaceId: string,
  input?: { formId?: string; limit?: number },
) {
  const prisma = getPrisma();
  return prisma.intakeFormResponse.findMany({
    where: {
      workspaceId,
      ...(input?.formId ? { formId: input.formId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input?.limit ?? 500,
  });
}

export async function saveIntakeResponse(
  workspaceId: string,
  input: {
    formId: string;
    contactId?: string;
    appointmentId?: string;
    purchaseId?: string;
    answers: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const form = await prisma.intakeForm.findFirst({ where: { id: input.formId, workspaceId } });
  if (!form) throw new Error("Form not found");
  return prisma.intakeFormResponse.create({
    data: {
      workspaceId,
      formId: input.formId,
      contactId: input.contactId,
      appointmentId: input.appointmentId,
      purchaseId: input.purchaseId,
      answers: input.answers,
      formVersion: form.version,
    },
  });
}
