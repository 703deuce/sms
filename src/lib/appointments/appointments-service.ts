import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
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

export async function countAppointments(
  workspaceId: string,
  input?: {
    from?: Date;
    to?: Date;
    status?: string;
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
  return prisma.voiceAppointment.count({ where });
}

export async function listAppointments(
  workspaceId: string,
  input?: {
    from?: Date;
    to?: Date;
    status?: string;
    q?: string;
    take?: number;
    skip?: number;
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
    skip: input?.skip || 0,
  });

  const contactIds = [...new Set(rows.map((r: DbRow) => r.contactId).filter(Boolean))] as string[];
  const contacts =
    contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        })
      : [];
  const contactById = new Map<string, DbRow>(contacts.map((c: DbRow) => [c.id, c]));

  let mapped: AppointmentView[] = rows.map((row: DbRow) =>
    mapAppointmentRow({
      ...(row as Parameters<typeof mapAppointmentRow>[0]),
      contact: row.contactId
        ? (contactById.get(row.contactId) as AppointmentView["contact"]) || null
        : null,
    }),
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
  const [serviceLines, contracts, contractTemplates] = await Promise.all([
    prisma.appointmentServiceLine.findMany({
      where: { appointmentId: id, workspaceId },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.signedBookingContract.findMany({
      where: { appointmentId: id, workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingContractTemplate.findMany({
      where: { workspaceId, active: true },
      select: { id: true, name: true, version: true },
    }),
  ]);
  const base = mapAppointmentRow({ ...row, contact });
  return {
    ...base,
    serviceLines: serviceLines.map((line: {
      id: string;
      serviceName: string;
      staffId: string | null;
      startsAt: Date;
      endsAt: Date;
      displayOrder: number;
    }) => ({
      id: line.id,
      serviceName: line.serviceName,
      staffId: line.staffId,
      startsAt: line.startsAt.toISOString(),
      endsAt: line.endsAt.toISOString(),
      displayOrder: line.displayOrder,
    })),
    contracts: contracts.map((c: {
      id: string;
      status: string;
      templateVersion: string | null;
      signedAt: Date | null;
      createdAt: Date;
    }) => ({
      id: c.id,
      status: c.status,
      templateVersion: c.templateVersion,
      signedAt: c.signedAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    })),
    contractTemplates,
  };
}

export function renderAppointmentTemplate(
  template: string,
  vars: Record<string, string | undefined | null>,
): string {
  return mergeTemplate(template, vars);
}

export function appointmentMergeVars(input: {
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  service?: string | null;
  staffName?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  timezone?: string | null;
  confirmLink?: string | null;
  cancelLink?: string | null;
  rescheduleLink?: string | null;
  manageLink?: string | null;
  reviewLink?: string | null;
  bookingLink?: string | null;
  paymentLink?: string | null;
  meetingLink?: string | null;
  businessPhone?: string | null;
  appointmentLink?: string | null;
  directionsLink?: string | null;
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
  const endInstant = input.endsAt && input.endsAt.getTime() > input.startsAt.getTime() ? input.endsAt : null;
  const endTime = endInstant ? timeFmt.format(endInstant) : "";
  const appointmentTimeRange =
    endInstant && endTime
      ? `${timeFmt.format(input.startsAt)} – ${endTime}`
      : timeFmt.format(input.startsAt);
  return {
    first_name: input.firstName || "there",
    last_name: input.lastName || "",
    business_name: input.businessName || "our team",
    service: input.service || "appointment",
    staff_name: input.staffName || "Team",
    location: input.location || "",
    appointment_date: dateFmt.format(input.startsAt),
    appointment_time: timeFmt.format(input.startsAt),
    appointment_end_time: endTime,
    appointment_time_range: appointmentTimeRange,
    confirm_link: input.confirmLink || "",
    cancel_link: input.cancelLink || "",
    reschedule_link: input.rescheduleLink || "",
    manage_link: input.manageLink || input.rescheduleLink || "",
    review_link: input.reviewLink || "",
    booking_link: input.bookingLink || "",
    payment_link: input.paymentLink || "",
    meeting_link: input.meetingLink || "",
    join_meeting_line: input.meetingLink ? ` Join meeting: ${input.meetingLink}` : "",
    business_phone: input.businessPhone || "",
    appointment_link: input.appointmentLink || input.manageLink || "",
    directions_link: input.directionsLink || "",
  };
}

export type PublicAppointmentCustomerPreview = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone?: string | null;
  meetingLink?: string | null;
  isTransovoVideo?: boolean;
  locationLabel?: string | null;
  resources?: Array<{ id: string; name: string }>;
  addOns?: Array<{ id: string; name: string; quantity?: number }>;
};

export function buildPublicAppointmentCustomerPreview(row: {
  id: string;
  serviceName: string | null;
  startsAt: Date;
  status: string;
  timezone?: string | null;
  metadata?: unknown;
}): PublicAppointmentCustomerPreview {
  const meta = (row.metadata || {}) as AppointmentMetadata;
  const meetingLink = meta.meetingUrl || meta.joinUrl || null;
  const isTransovoVideo =
    meta.locationKind === "transovo_video" || Boolean(meta.videoMeetingId);
  const locationLabel =
    typeof meta.location === "string" && !meta.location.startsWith("http")
      ? meta.location
      : isTransovoVideo
        ? "Transovo Video"
        : null;

  return {
    id: row.id,
    serviceName: row.serviceName,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    timezone: row.timezone,
    meetingLink,
    isTransovoVideo,
    locationLabel,
    resources: Array.isArray(meta.resourceLabels)
      ? (meta.resourceLabels as Array<{ id: string; name: string }>)
      : undefined,
    addOns: Array.isArray(meta.addOnLabels)
      ? (meta.addOnLabels as Array<{ id: string; name: string; quantity?: number }>)
      : undefined,
  };
}
