import "server-only";

import { getPrisma } from "@/lib/db";
import { mergeTemplate } from "@/lib/messaging/template";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type AppointmentView = {
  id: string;
  workspaceId: string;
  contactId: string | null;
  serviceName: string | null;
  staffName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
  externalId: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  reminderStatus: string | null;
  metadata: AppointmentMetadata;
  contact?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    email: string | null;
  } | null;
};

function pickMeta(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return null;
}

export function mapAppointmentRow(
  row: {
    id: string;
    workspaceId: string;
    contactId: string | null;
    serviceName: string | null;
    staffName: string | null;
    startsAt: Date;
    endsAt: Date | null;
    timezone: string | null;
    status: string;
    externalId: string | null;
    metadata: unknown;
    contact?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string;
      email: string | null;
    } | null;
  },
): AppointmentView {
  const meta = (row.metadata || {}) as AppointmentMetadata;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    contactId: row.contactId,
    serviceName: row.serviceName,
    staffName: row.staffName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() || null,
    timezone: row.timezone,
    status: row.status,
    externalId: row.externalId,
    inviteeName: pickMeta(meta, "inviteeName", "name") || (row.contact
      ? `${row.contact.firstName || ""} ${row.contact.lastName || ""}`.trim()
      : null),
    inviteeEmail: pickMeta(meta, "inviteeEmail", "email") || row.contact?.email || null,
    inviteePhone: pickMeta(meta, "inviteePhone", "phone") || row.contact?.phone || null,
    reminderStatus: pickMeta(meta, "reminderStatus", "reminder_status"),
    metadata: meta,
    contact: row.contact || null,
  };
}

export async function listAppointments(
  workspaceId: string,
  input?: {
    from?: Date;
    to?: Date;
    status?: string;
    q?: string;
    take?: number;
  },
) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { workspaceId };
  if (input?.from || input?.to) {
    where.startsAt = {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lte: input.to } : {}),
    };
  }
  if (input?.status && input.status !== "all") {
    where.status = input.status === "canceled" ? { in: ["canceled", "cancelled"] } : input.status;
  }

  const rows = await prisma.voiceAppointment.findMany({
    where,
    orderBy: { startsAt: input?.from ? "asc" : "desc" },
    take: input?.take || 200,
  });

  const contactIds = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
  const contacts =
    contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        })
      : [];
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  let mapped = rows.map((row) =>
    mapAppointmentRow({ ...row, contact: row.contactId ? contactById.get(row.contactId) || null : null }),
  );
  if (input?.q?.trim()) {
    const q = input.q.trim().toLowerCase();
    mapped = mapped.filter(
      (a) =>
        (a.inviteeName || "").toLowerCase().includes(q) ||
        (a.inviteePhone || "").includes(q) ||
        (a.inviteeEmail || "").toLowerCase().includes(q) ||
        (a.serviceName || "").toLowerCase().includes(q),
    );
  }
  return mapped;
}

export async function getAppointment(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id, workspaceId },
  });
  if (!row) return null;
  const contact = row.contactId
    ? await prisma.contact.findFirst({
        where: { id: row.contactId, workspaceId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : null;
  return mapAppointmentRow({ ...row, contact });
}

export function renderAppointmentTemplate(
  template: string,
  vars: Record<string, string | undefined | null>,
): string {
  return mergeTemplate(template, vars);
}

export function appointmentMergeVars(input: {
  firstName?: string | null;
  businessName?: string | null;
  service?: string | null;
  startsAt: Date;
  timezone?: string | null;
  confirmLink?: string | null;
  cancelLink?: string | null;
  rescheduleLink?: string | null;
  reviewLink?: string | null;
  bookingLink?: string | null;
  paymentLink?: string | null;
  meetingLink?: string | null;
}): Record<string, string> {
  const tz = input.timezone || "America/New_York";
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    first_name: input.firstName || "there",
    business_name: input.businessName || "our team",
    service: input.service || "appointment",
    appointment_date: dateFmt.format(input.startsAt),
    appointment_time: timeFmt.format(input.startsAt),
    confirm_link: input.confirmLink || "",
    cancel_link: input.cancelLink || "",
    reschedule_link: input.rescheduleLink || "",
    review_link: input.reviewLink || "",
    booking_link: input.bookingLink || "",
    payment_link: input.paymentLink || "",
    meeting_link: input.meetingLink || "",
  };
}
