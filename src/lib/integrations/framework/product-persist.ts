import { getPrisma } from "@/lib/db";
import type { NormalizedAppointment, NormalizedEvent, NormalizedFormSubmission } from "./types";
import { upsertExternalMapping } from "./mappings";

/**
 * Write-through from native integrations into Transovo product tables
 * (VoiceAppointment, FormSubmission/OptInForm) so Contacts/Messenger/Campaigns can use them.
 */

export async function persistAppointmentFromIntegration(input: {
  workspaceId: string;
  provider: string;
  contactId?: string | null;
  appointment: NormalizedAppointment;
}) {
  const prisma = getPrisma();
  const externalId = input.appointment.id ? `${input.provider}:${input.appointment.id}` : null;
  if (!externalId || !input.appointment.startAt) return null;

  const existing = await prisma.voiceAppointment.findFirst({
    where: { workspaceId: input.workspaceId, externalId },
  });

  const startsAt = new Date(input.appointment.startAt);
  const endsAt = input.appointment.endAt ? new Date(input.appointment.endAt) : null;
  const status =
    input.appointment.status === "canceled" || input.appointment.status === "cancelled"
      ? "canceled"
      : input.appointment.status || "confirmed";

  const data = {
    contactId: input.contactId || null,
    serviceName: input.appointment.title || "Appointment",
    startsAt,
    endsAt,
    status,
    externalId,
    metadata: {
      provider: input.provider,
      inviteeEmail: input.appointment.inviteeEmail,
      inviteePhone: input.appointment.inviteePhone,
      inviteeName: input.appointment.inviteeName,
      eventTypeId: input.appointment.eventTypeId,
      cancelUrl: input.appointment.cancelUrl,
      rescheduleUrl: input.appointment.rescheduleUrl,
      raw: input.appointment.raw || undefined,
    } as object,
  };

  const row = existing
    ? await prisma.voiceAppointment.update({ where: { id: existing.id }, data })
    : await prisma.voiceAppointment.create({
        data: { workspaceId: input.workspaceId, ...data },
      });

  if (input.contactId && input.appointment.id) {
    await upsertExternalMapping({
      workspaceId: input.workspaceId,
      provider: input.provider as never,
      objectType: "appointment",
      internalId: row.id,
      externalId: String(input.appointment.id),
      parentExternalId: input.contactId,
      metadata: { contactId: input.contactId },
    });
  }

  return row;
}

export async function persistFormSubmissionFromIntegration(input: {
  workspaceId: string;
  provider: string;
  contactId?: string | null;
  submission: NormalizedFormSubmission;
}) {
  const prisma = getPrisma();
  const formExternalId = input.submission.formId || "unknown";
  const formName =
    input.submission.formName || `${input.provider} form ${formExternalId}`;
  const slug = `${input.provider}-${String(formExternalId).slice(0, 48)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

  let form = await prisma.optInForm.findFirst({
    where: { workspaceId: input.workspaceId, slug },
  });
  if (!form) {
    form = await prisma.optInForm.create({
      data: {
        workspaceId: input.workspaceId,
        name: formName,
        listName: `${input.provider} leads`,
        slug,
        status: "Active",
        config: {
          provider: input.provider,
          externalFormId: formExternalId,
          source: "native_integration",
        } as object,
      },
    });
  }

  const phone =
    input.submission.phone ||
    (input.contactId
      ? (
          await prisma.contact.findFirst({
            where: { id: input.contactId, workspaceId: input.workspaceId },
          })
        )?.phone
      : null) ||
    "unknown";

  // Deduplicate by provider submission id in payload
  if (input.submission.id) {
    const existing = await prisma.formSubmission.findFirst({
      where: {
        workspaceId: input.workspaceId,
        formId: form.id,
        payload: { path: ["externalSubmissionId"], equals: input.submission.id },
      },
    });
    if (existing) return existing;
  }

  const row = await prisma.formSubmission.create({
    data: {
      workspaceId: input.workspaceId,
      formId: form.id,
      contactId: input.contactId || null,
      phone,
      payload: {
        provider: input.provider,
        externalSubmissionId: input.submission.id,
        formId: input.submission.formId,
        answers: input.submission.answers || {},
        email: input.submission.email,
        submittedAt: input.submission.submittedAt,
      } as object,
    },
  });

  await prisma.optInForm.update({
    where: { id: form.id },
    data: { submissions: { increment: 1 } },
  });

  if (input.contactId && input.submission.id) {
    await upsertExternalMapping({
      workspaceId: input.workspaceId,
      provider: input.provider as never,
      objectType: "form_submission",
      internalId: row.id,
      externalId: String(input.submission.id),
      parentExternalId: String(formExternalId),
      metadata: { contactId: input.contactId, formId: form.id },
    });
  }

  return row;
}

/** Persist product rows from a normalized webhook/sync event when possible. */
export async function persistProductFromNormalizedEvent(
  event: NormalizedEvent,
  contactId?: string | null,
) {
  if (
    event.eventType.startsWith("appointment.") &&
    event.externalObjectType === "appointment"
  ) {
    return persistAppointmentFromIntegration({
      workspaceId: event.workspaceId,
      provider: event.provider,
      contactId,
      appointment: {
        id: event.externalObjectId,
        title: String(event.payload.name || event.payload.title || "Appointment"),
        startAt:
          (event.payload.startAt as string) ||
          (event.payload.start_time as string) ||
          event.occurredAt,
        endAt: (event.payload.endAt as string) || null,
        status: event.eventType.includes("canceled") ? "canceled" : "confirmed",
        inviteeEmail: event.email,
        inviteePhone: event.phone,
        inviteeName: (event.payload.name as string) || null,
        cancelUrl: (event.payload.cancelUrl as string) || null,
        rescheduleUrl: (event.payload.rescheduleUrl as string) || null,
        eventTypeId: (event.payload.eventType as string) || null,
      },
    });
  }

  if (event.eventType === "form.submitted" || event.eventType === "lead.submitted") {
    return persistFormSubmissionFromIntegration({
      workspaceId: event.workspaceId,
      provider: event.provider,
      contactId,
      submission: {
        id: event.externalObjectId,
        formId: String(event.payload.formId || event.payload.formID || "unknown"),
        formName: (event.payload.formName as string) || null,
        email: event.email,
        phone: event.phone,
        answers: (event.payload.answers as Record<string, unknown>) || {},
        submittedAt: event.occurredAt,
      },
    });
  }

  return null;
}
