import "server-only";

import { getPrisma } from "@/lib/db";

/**
 * The database accessor is an untyped Supabase shim, so rows come back as
 * `any`. Every shape this file depends on is declared here instead, which is
 * what actually keeps the callers honest.
 */
type ContactLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
};

const CONTACT_LITE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
} as const;

export async function listClassSeries(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.classSeries.findMany({
    where: { workspaceId },
    include: { occurrences: { orderBy: { startsAt: "asc" }, take: 20 } },
    orderBy: { name: "asc" },
  });
}

export async function upsertClassSeries(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    appointmentTypeId?: string;
    capacity?: number;
    staffId?: string;
    locationId?: string;
    requireFullSeries?: boolean;
    recurrenceRule?: Record<string, unknown>;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    description: input.description,
    appointmentTypeId: input.appointmentTypeId,
    capacity: input.capacity ?? 10,
    staffId: input.staffId,
    locationId: input.locationId,
    requireFullSeries: input.requireFullSeries ?? false,
    recurrenceRule: input.recurrenceRule,
    active: input.active ?? true,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  if (input.id) {
    return prisma.classSeries.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.classSeries.create({ data: { workspaceId, ...data } });
}

/** One series with its occurrences and live enrollment counts, for the editor. */
export async function getClassSeries(workspaceId: string, seriesId: string) {
  const prisma = getPrisma();
  const series = await prisma.classSeries.findFirst({ where: { id: seriesId, workspaceId } });
  if (!series) throw new Error("Class not found");
  const occurrences = await listOccurrencesForSeries(workspaceId, seriesId);
  return { ...series, occurrences };
}

export async function deleteClassSeries(workspaceId: string, seriesId: string) {
  const prisma = getPrisma();
  const series = await prisma.classSeries.findFirst({ where: { id: seriesId, workspaceId } });
  if (!series) throw new Error("Class not found");
  const enrolled = await prisma.classEnrollment.count({
    where: { workspaceId, seriesId, status: "enrolled" },
  });
  // Deleting would take the registration history with it via the cascade, so a
  // class anyone is booked into is deactivated instead.
  if (enrolled > 0) {
    throw new Error(
      `${enrolled} registration${enrolled === 1 ? "" : "s"} exist for this class. Deactivate it instead.`,
    );
  }
  await prisma.classSeries.delete({ where: { id: seriesId } });
  return { id: seriesId, deleted: true };
}

export async function listOccurrencesForSeries(workspaceId: string, seriesId: string) {
  const prisma = getPrisma();
  const occurrences = await prisma.classOccurrence.findMany({
    where: { workspaceId, seriesId },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  const ids = (occurrences as Array<{ id: string }>).map((o) => o.id);
  const counts: Array<{ occurrenceId: string; _count: { occurrenceId: number } }> = ids.length
    ? await prisma.classEnrollment.groupBy({
        by: ["occurrenceId"],
        where: { workspaceId, occurrenceId: { in: ids }, status: "enrolled" },
        _count: { occurrenceId: true },
      })
    : [];
  const countMap = new Map<string, number>(
    counts.map((c) => [c.occurrenceId, c._count.occurrenceId]),
  );
  return (occurrences as Array<{ id: string; capacity: number | null }>).map((occ) => ({
    ...occ,
    enrolled: countMap.get(occ.id) ?? 0,
    remaining: Math.max(0, Number(occ.capacity ?? 0) - Number(countMap.get(occ.id) ?? 0)),
  }));
}

export async function cancelClassOccurrence(workspaceId: string, occurrenceId: string) {
  const prisma = getPrisma();
  const occ = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });
  if (!occ) throw new Error("Occurrence not found");
  return prisma.classOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "cancelled" },
  });
}

export async function updateClassOccurrence(
  workspaceId: string,
  occurrenceId: string,
  input: { startsAt?: string; endsAt?: string; capacity?: number },
) {
  const prisma = getPrisma();
  const occ = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });
  if (!occ) throw new Error("Occurrence not found");
  return prisma.classOccurrence.update({
    where: { id: occurrenceId },
    data: {
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      capacity: input.capacity,
    },
  });
}

async function assertOccurrenceCapacity(
  workspaceId: string,
  occurrenceId: string,
): Promise<void> {
  const prisma = getPrisma();
  const occ = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId, status: "scheduled" },
    include: { series: true },
  });
  if (!occ) throw new Error("Occurrence not found or not open for registration");
  const cap = occ.capacity ?? occ.series?.capacity ?? 0;
  const enrolled = await prisma.classEnrollment.count({
    where: { workspaceId, occurrenceId, status: "enrolled" },
  });
  if (enrolled >= cap) throw new Error("This session is full");
}

export async function generateClassOccurrences(
  workspaceId: string,
  seriesId: string,
  occurrences: Array<{ startsAt: string; endsAt: string; capacity?: number }>,
) {
  const prisma = getPrisma();
  const series = await prisma.classSeries.findFirst({ where: { id: seriesId, workspaceId } });
  if (!series) throw new Error("Class series not found");

  const created = [];
  for (const occ of occurrences) {
    created.push(
      await prisma.classOccurrence.create({
        data: {
          workspaceId,
          seriesId,
          startsAt: new Date(occ.startsAt),
          endsAt: new Date(occ.endsAt),
          capacity: occ.capacity ?? series.capacity,
        },
      }),
    );
  }
  return created;
}

export async function enrollInClass(
  workspaceId: string,
  input: {
    contactId: string;
    occurrenceId?: string;
    seriesId?: string;
    enrollFullSeries?: boolean;
  },
) {
  const prisma = getPrisma();
  if (input.enrollFullSeries && input.seriesId) {
    const occurrences = await prisma.classOccurrence.findMany({
      where: { workspaceId, seriesId: input.seriesId, status: "scheduled" },
    });
    // Every session is checked before any seat is taken. Enrolling session by
    // session and failing halfway used to leave the customer holding a partial
    // series they had already been charged for.
    for (const occ of occurrences) {
      await assertOccurrenceCapacity(workspaceId, occ.id);
    }
    const enrollments = [];
    for (const occ of occurrences) {
      enrollments.push(
        await prisma.classEnrollment.create({
          data: {
            workspaceId,
            occurrenceId: occ.id,
            seriesId: input.seriesId,
            contactId: input.contactId,
            status: "enrolled",
          },
        }),
      );
    }
    return enrollments;
  }
  if (!input.occurrenceId) throw new Error("occurrenceId required");
  await assertOccurrenceCapacity(workspaceId, input.occurrenceId);
  return prisma.classEnrollment.create({
    data: {
      workspaceId,
      occurrenceId: input.occurrenceId,
      seriesId: input.seriesId,
      contactId: input.contactId,
      status: "enrolled",
    },
  });
}

export type ClassRegistrant = {
  id: string;
  occurrenceId: string | null;
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  attendance: string | null;
  createdAt: Date;
  /** How the seat was paid for, when the enrollment recorded one. */
  access: string | null;
};

function contactDisplayName(c: ContactLite): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.phone;
}

/**
 * Registrants for a whole series or a single occurrence. ClassEnrollment has no
 * Contact relation, so the contacts are fetched in one follow-up query rather
 * than one per row.
 */
export async function listClassRegistrants(
  workspaceId: string,
  input: { seriesId?: string; occurrenceId?: string },
): Promise<ClassRegistrant[]> {
  const prisma = getPrisma();
  if (!input.seriesId && !input.occurrenceId) return [];
  const enrollments: Array<{
    id: string;
    occurrenceId: string | null;
    contactId: string;
    status: string;
    attendance: string | null;
    createdAt: Date;
    metadata: unknown;
  }> = await prisma.classEnrollment.findMany({
    where: {
      workspaceId,
      ...(input.occurrenceId ? { occurrenceId: input.occurrenceId } : {}),
      ...(input.seriesId && !input.occurrenceId ? { seriesId: input.seriesId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (enrollments.length === 0) return [];

  const contactIds = [...new Set(enrollments.map((e) => e.contactId))];
  const contacts: ContactLite[] = await prisma.contact.findMany({
    where: { workspaceId, id: { in: contactIds } },
    select: CONTACT_LITE_SELECT,
  });
  const byId = new Map<string, ContactLite>(contacts.map((c) => [c.id, c]));

  return enrollments.map((e) => {
    const contact = byId.get(e.contactId);
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    return {
      id: e.id,
      occurrenceId: e.occurrenceId,
      contactId: e.contactId,
      name: contact ? contactDisplayName(contact) : "Unknown contact",
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      status: e.status,
      attendance: e.attendance,
      createdAt: e.createdAt,
      access: typeof meta.access === "string" ? meta.access : null,
    };
  });
}

/** Check-in and cancellation both land here so attendance stays server-owned. */
export async function updateClassEnrollment(
  workspaceId: string,
  enrollmentId: string,
  input: { status?: string; attendance?: string | null },
) {
  const prisma = getPrisma();
  const existing = await prisma.classEnrollment.findFirst({
    where: { id: enrollmentId, workspaceId },
  });
  if (!existing) throw new Error("Registration not found");
  return prisma.classEnrollment.update({
    where: { id: enrollmentId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.attendance !== undefined ? { attendance: input.attendance } : {}),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Class waitlist
 *
 * There is no class-specific waitlist table. Entries are stored in
 * AppointmentWaitlistEntry — the table the rest of appointments already
 * uses — and tied to a class through metadata, so a class waitlist shows up
 * in the same place operators already look. Position is arrival order.
 * ------------------------------------------------------------------ */

export type ClassWaitlistEntry = {
  id: string;
  position: number;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  offerExpiresAt: string | null;
};

type WaitlistMeta = {
  classSeriesId?: string;
  classOccurrenceId?: string;
  offerExpiresAt?: string;
  name?: string;
};

export async function listClassWaitlist(
  workspaceId: string,
  input: { seriesId: string; occurrenceId?: string },
): Promise<ClassWaitlistEntry[]> {
  const prisma = getPrisma();
  const rows: Array<{
    id: string;
    contactId: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    createdAt: Date;
    metadata: unknown;
  }> = await prisma.appointmentWaitlistEntry.findMany({
    where: { workspaceId, status: { in: ["active", "offered"] } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const mine = rows.filter((r) => {
    const meta = (r.metadata ?? {}) as WaitlistMeta;
    if (meta.classSeriesId !== input.seriesId) return false;
    if (input.occurrenceId) return meta.classOccurrenceId === input.occurrenceId;
    return true;
  });

  const contactIds = [...new Set(mine.map((r) => r.contactId).filter(Boolean))] as string[];
  const contacts: ContactLite[] = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: CONTACT_LITE_SELECT,
      })
    : [];
  const byId = new Map<string, ContactLite>(contacts.map((c) => [c.id, c]));

  return mine.map((r, i) => {
    const meta = (r.metadata ?? {}) as WaitlistMeta;
    const contact = r.contactId ? byId.get(r.contactId) : undefined;
    return {
      id: r.id,
      position: i + 1,
      contactId: r.contactId,
      name: contact ? contactDisplayName(contact) : meta.name || r.email || r.phone || "Waiting customer",
      email: contact?.email ?? r.email,
      phone: contact?.phone ?? r.phone,
      status: r.status,
      createdAt: r.createdAt,
      offerExpiresAt: meta.offerExpiresAt ?? null,
    };
  });
}

export async function joinClassWaitlist(
  workspaceId: string,
  input: { seriesId: string; occurrenceId?: string; contactId: string },
) {
  const prisma = getPrisma();
  const series = await prisma.classSeries.findFirst({
    where: { id: input.seriesId, workspaceId },
  });
  if (!series) throw new Error("Class not found");
  const contact: ContactLite | null = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId },
    select: CONTACT_LITE_SELECT,
  });
  if (!contact) throw new Error("Contact not found");

  return prisma.appointmentWaitlistEntry.create({
    data: {
      workspaceId,
      contactId: contact.id,
      serviceName: series.name,
      email: contact.email,
      phone: contact.phone,
      status: "active",
      metadata: {
        classSeriesId: input.seriesId,
        ...(input.occurrenceId ? { classOccurrenceId: input.occurrenceId } : {}),
        name: contactDisplayName(contact),
      },
    },
  });
}

/**
 * Promotion is a real seat transfer: it enrols the waiting contact through the
 * same capacity-checked path a customer would use, and only then closes the
 * waitlist entry. If the class is still full the entry is left untouched.
 */
export async function promoteClassWaitlistEntry(
  workspaceId: string,
  entryId: string,
  occurrenceId: string,
) {
  const prisma = getPrisma();
  const entry = await prisma.appointmentWaitlistEntry.findFirst({
    where: { id: entryId, workspaceId },
  });
  if (!entry) throw new Error("Waitlist entry not found");
  if (!entry.contactId) throw new Error("This waitlist entry has no linked contact to enrol");
  const meta = (entry.metadata ?? {}) as WaitlistMeta;

  const enrollment = await enrollInClass(workspaceId, {
    contactId: entry.contactId,
    occurrenceId,
    seriesId: meta.classSeriesId,
  });

  await prisma.appointmentWaitlistEntry.update({
    where: { id: entryId },
    data: { status: "converted", metadata: { ...meta, promotedAt: new Date().toISOString() } },
  });
  return enrollment;
}

export async function removeClassWaitlistEntry(workspaceId: string, entryId: string) {
  const prisma = getPrisma();
  const entry = await prisma.appointmentWaitlistEntry.findFirst({
    where: { id: entryId, workspaceId },
  });
  if (!entry) throw new Error("Waitlist entry not found");
  return prisma.appointmentWaitlistEntry.update({
    where: { id: entryId },
    data: { status: "removed" },
  });
}

export async function purchaseAndEnrollClassSeries(
  workspaceId: string,
  contactId: string,
  seriesId: string,
  packageProductId?: string,
) {
  if (packageProductId) {
    const { purchasePackageForContact } = await import("./packages");
    await purchasePackageForContact(workspaceId, packageProductId, contactId);
  }
  return enrollInClass(workspaceId, {
    contactId,
    seriesId,
    enrollFullSeries: true,
  });
}
