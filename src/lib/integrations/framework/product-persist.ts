import { getPrisma } from "@/lib/db";
import type {
  NormalizedAppointment,
  NormalizedEvent,
  NormalizedFormSubmission,
  NormalizedOrder,
} from "./types";
import { upsertExternalMapping } from "./mappings";

/**
 * Write-through from native integrations into Transovo product tables
 * (VoiceAppointment, FormSubmission/OptInForm) so Contacts/Messenger/Campaigns can use them.
 */

export async function persistAppointmentFromIntegration(input: {
  workspaceId: string;
  provider: string;
  contactId?: string | null;
  callId?: string | null;
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
    callId: input.callId || undefined,
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
      // Provider-specific extras (host, cancellationReason, questionsAndAnswers,
      // tracking, noShow, …) merged last so callers can enrich the record.
      ...(input.appointment.metadata || {}),
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
    const scheduledEvent =
      (event.payload.scheduledEvent as Record<string, unknown> | undefined) ||
      (event.payload.scheduled_event as Record<string, unknown> | undefined) ||
      undefined;

    // Adapters normalize to startsAt/endsAt; also accept startAt/endAt and the
    // raw Calendly scheduled_event start_time/end_time as fallbacks.
    const startAt =
      (event.payload.startsAt as string) ||
      (event.payload.startAt as string) ||
      (scheduledEvent?.start_time as string) ||
      (event.payload.start_time as string) ||
      event.occurredAt;
    const endAt =
      (event.payload.endsAt as string) ||
      (event.payload.endAt as string) ||
      (scheduledEvent?.end_time as string) ||
      (event.payload.end_time as string) ||
      null;

    const noShow =
      event.eventType === "appointment.no_show" ||
      Boolean(event.payload.noShow);
    const status = noShow
      ? "no_show"
      : event.eventType.includes("canceled")
        ? "canceled"
        : "confirmed";

    // Prefer the event type / meeting name over the invitee's name for the title.
    const title = String(
      event.payload.eventTypeName ||
        (scheduledEvent?.name as string) ||
        event.payload.title ||
        event.payload.name ||
        "Appointment",
    );

    return persistAppointmentFromIntegration({
      workspaceId: event.workspaceId,
      provider: event.provider,
      contactId,
      appointment: {
        id: event.externalObjectId,
        title,
        startAt,
        endAt,
        status,
        inviteeEmail: event.email,
        inviteePhone: event.phone,
        inviteeName: (event.payload.name as string) || null,
        cancelUrl: (event.payload.cancelUrl as string) || null,
        rescheduleUrl: (event.payload.rescheduleUrl as string) || null,
        eventTypeId: (event.payload.eventType as string) || null,
        metadata: {
          host: event.payload.host ?? null,
          cancellationReason: event.payload.cancellationReason ?? null,
          questionsAndAnswers: event.payload.questionsAndAnswers ?? null,
          tracking: event.payload.tracking ?? null,
          ...(noShow ? { noShow: true } : {}),
        },
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

  if (
    event.eventType.startsWith("order.") &&
    (event.externalObjectType === "order" || event.externalObjectType === "ecommerce_customer")
  ) {
    return persistOrderFromIntegration({
      workspaceId: event.workspaceId,
      provider: event.provider,
      contactId,
      order: {
        id: event.externalObjectId,
        number: String(event.payload.number || event.payload.orderNumber || event.externalObjectId),
        status: String(event.payload.status || "unknown"),
        total: event.payload.total != null ? String(event.payload.total) : null,
        currency: (event.payload.currency as string) || null,
        customerEmail: event.email,
        customerPhone: event.phone,
        customerName: (event.payload.customerName as string) || null,
        paidAt: (event.payload.paidAt as string) || null,
        completedAt: (event.payload.completedAt as string) || null,
        createdAt: event.occurredAt,
        providerUrl: (event.payload.providerUrl as string) || null,
        lineItems: event.payload.lineItems,
        shippingAddress: event.payload.shippingAddress || event.payload.shipping,
        raw: event.payload,
      },
    });
  }

  if (event.eventType === "task.created" || event.externalObjectType === "task") {
    return persistTaskFromIntegration({
      workspaceId: event.workspaceId,
      provider: event.provider,
      contactId,
      task: {
        id: event.externalObjectId,
        title: String(event.payload.title || event.payload.subject || "Task"),
        description: (event.payload.description as string) || null,
        status: (event.payload.status as string) || "open",
        dueAt: (event.payload.dueAt as string) || null,
        ownerName: (event.payload.ownerName as string) || null,
        providerUrl: (event.payload.providerUrl as string) || null,
        raw: event.payload,
      },
    });
  }

  return null;
}

export type NormalizedTaskInput = {
  id?: string | null;
  externalId?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  ownerExternalId?: string | null;
  ownerName?: string | null;
  relatedDealId?: string | null;
  relatedCompanyId?: string | null;
  relatedTicketId?: string | null;
  providerUrl?: string | null;
  raw?: Record<string, unknown>;
};

/** Persist provider tasks into IntegrationTask (unified tasks UI). */
export async function persistTaskFromIntegration(input: {
  workspaceId: string;
  provider: string;
  contactId?: string | null;
  task: NormalizedTaskInput;
}) {
  const prisma = getPrisma();
  const externalId = String(input.task.externalId || input.task.id || "").trim();
  if (!externalId) return null;

  const existing = await prisma.integrationTask.findFirst({
    where: { workspaceId: input.workspaceId, provider: input.provider, externalId },
  });

  const data = {
    contactId: input.contactId || null,
    title: input.task.title || "Untitled task",
    status: input.task.status || "open",
    priority: input.task.priority || null,
    dueAt: input.task.dueAt ? new Date(input.task.dueAt) : null,
    ownerExternalId: input.task.ownerExternalId || null,
    ownerName: input.task.ownerName || null,
    relatedDealId: input.task.relatedDealId || null,
    relatedCompanyId: input.task.relatedCompanyId || null,
    relatedTicketId: input.task.relatedTicketId || null,
    syncStatus: "synced",
    externalUrl: input.task.providerUrl || null,
    metadataJson: {
      description: input.task.description || null,
      completedAt: input.task.completedAt || null,
      raw: input.task.raw || undefined,
    } as object,
    lastSyncedAt: new Date(),
  };

  if (existing) {
    return prisma.integrationTask.update({ where: { id: existing.id }, data });
  }
  return prisma.integrationTask.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalId,
      ...data,
    },
  });
}

/** Persist commerce orders into IntegrationOrder. */
export async function persistOrderFromIntegration(input: {
  workspaceId: string;
  provider: string;
  contactId?: string | null;
  order: NormalizedOrder & {
    lineItems?: unknown;
    shippingAddress?: unknown;
    completedAt?: string | null;
    providerUrl?: string | null;
    createdAt?: string | null;
  };
}) {
  const prisma = getPrisma();
  const externalId = String(input.order.id || "").trim();
  if (!externalId) return null;

  const existing = await prisma.integrationOrder.findFirst({
    where: { workspaceId: input.workspaceId, provider: input.provider, externalId },
  });

  const data = {
    contactId: input.contactId || null,
    orderNumber: input.order.number || null,
    status: input.order.status || "unknown",
    total: input.order.total != null ? String(input.order.total) : null,
    currency: input.order.currency || null,
    customerName: input.order.customerName || null,
    customerEmail: input.order.customerEmail || null,
    customerPhone: input.order.customerPhone || null,
    paidAt: input.order.paidAt ? new Date(input.order.paidAt) : null,
    completedAt: input.order.completedAt ? new Date(input.order.completedAt) : null,
    createdExternalAt: input.order.createdAt
      ? new Date(input.order.createdAt)
      : input.order.updatedAt
        ? new Date(input.order.updatedAt)
        : null,
    syncStatus: "synced",
    externalUrl: input.order.providerUrl || null,
    lineItemsJson: (input.order.lineItems || undefined) as object | undefined,
    shippingJson: (input.order.shippingAddress || undefined) as object | undefined,
    metadataJson: (input.order.raw || undefined) as object | undefined,
    lastSyncedAt: new Date(),
  };

  if (existing) {
    return prisma.integrationOrder.update({ where: { id: existing.id }, data });
  }
  return prisma.integrationOrder.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalId,
      ...data,
    },
  });
}
