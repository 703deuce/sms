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

export async function upsertIntakeForm(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    targetKind?: string;
    fields?: IntakeField[];
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  if (input.id) {
    const existing = await prisma.intakeForm.findFirst({ where: { id: input.id, workspaceId } });
    if (!existing) throw new Error("Form not found");
    return prisma.intakeForm.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        targetKind: input.targetKind || existing.targetKind,
        fields: input.fields || existing.fields,
        version: existing.version + 1,
        active: input.active ?? existing.active,
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
    },
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
