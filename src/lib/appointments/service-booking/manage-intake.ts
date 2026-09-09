import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { listIntakeForms, saveIntakeResponse } from "./intake-forms";
import { evaluateIntakeEditCutoff, resolveSchedulingLimits } from "./scheduling-limits";
import type { IntakeField, SchedulingLimitsConfig } from "./types";

type IntakeFormRow = Awaited<ReturnType<typeof listIntakeForms>>[number];
type IntakeResponseRow = {
  id: string;
  formId: string;
  answers: unknown;
};

export async function getManageAppointmentIntakeContext(workspaceId: string, appointmentId: string) {
  const forms = await listIntakeForms(workspaceId, "appointment");
  const prisma = getPrisma();
  const responses = await prisma.intakeFormResponse.findMany({
    where: { workspaceId, appointmentId },
    orderBy: { createdAt: "desc" },
  });

  const byFormId = new Map<string, IntakeResponseRow>(
    responses.map((r: { id: string; formId: string; answers: unknown }) => [
      r.formId,
      { id: r.id, formId: r.formId, answers: r.answers },
    ]),
  );

  return forms
    .filter((f: IntakeFormRow) => f.active)
    .map((form: IntakeFormRow) => {
      const fields = (form.fields || []) as IntakeField[];
      const existing = byFormId.get(form.id);
      return {
        id: form.id,
        name: form.name,
        version: form.version,
        fields,
        answers: (existing?.answers || {}) as Record<string, unknown>,
        responseId: existing?.id || null,
      };
    });
}

export async function saveManageAppointmentIntake(
  workspaceId: string,
  appointmentId: string,
  input: { formId: string; answers: Record<string, unknown>; contactId?: string },
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) throw new Error("Appointment not found");

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const platformLimits = (platform as { schedulingLimits?: SchedulingLimitsConfig }).schedulingLimits;
  let typeLimits: SchedulingLimitsConfig | undefined;
  if (appointment.serviceName) {
    const service = await prisma.voiceService.findFirst({
      where: { workspaceId, name: appointment.serviceName },
    });
    typeLimits = (service?.config as { schedulingLimits?: SchedulingLimitsConfig } | null)?.schedulingLimits;
  }
  const limits = resolveSchedulingLimits(platformLimits, typeLimits);
  const intakeEdit = evaluateIntakeEditCutoff(limits, new Date(appointment.startsAt));
  if (!intakeEdit.allowed) {
    throw new Error(intakeEdit.reason || "Intake editing is not allowed");
  }

  const contactId =
    input.contactId ||
    (typeof appointment.contactId === "string" ? appointment.contactId : undefined);

  const existing = await prisma.intakeFormResponse.findFirst({
    where: { workspaceId, appointmentId, formId: input.formId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const form = await prisma.intakeForm.findFirst({ where: { id: input.formId, workspaceId } });
    if (!form) throw new Error("Form not found");
    return prisma.intakeFormResponse.update({
      where: { id: existing.id },
      data: {
        answers: input.answers,
        formVersion: form.version,
      },
    });
  }

  return saveIntakeResponse(workspaceId, {
    formId: input.formId,
    appointmentId,
    contactId,
    answers: input.answers,
  });
}
