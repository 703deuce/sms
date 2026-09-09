import "server-only";

import { getPrisma } from "@/lib/db";

export async function listClassSeries(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.classSeries.findMany({
    where: { workspaceId },
    include: {
      occurrences: {
        orderBy: { startsAt: "asc" },
        take: 20,
        include: { enrollments: { where: { status: "enrolled" } } },
      },
    },
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
  };
  if (input.id) {
    return prisma.classSeries.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.classSeries.create({ data: { workspaceId, ...data } });
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

export async function findSeriesByAppointmentTypeId(workspaceId: string, appointmentTypeId: string) {
  const prisma = getPrisma();
  return prisma.classSeries.findFirst({
    where: { workspaceId, appointmentTypeId },
    include: {
      occurrences: {
        where: { status: "scheduled" },
        orderBy: { startsAt: "asc" },
        take: 30,
        include: {
          enrollments: { where: { status: "enrolled" } },
        },
      },
    },
  });
}

export async function getClassOccurrenceDetail(workspaceId: string, occurrenceId: string) {
  const prisma = getPrisma();
  const occurrence = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
    include: {
      series: true,
      enrollments: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!occurrence) return null;

  const contactIds = [
    ...new Set(occurrence.enrollments.map((e: { contactId: string }) => e.contactId)),
  ];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : [];
  const contactMap = new Map(
    contacts.map((c: { id: string }) => [c.id, c] as const),
  );

  const enrolledCount = occurrence.enrollments.filter(
    (e: { status: string }) => e.status === "enrolled",
  ).length;
  const capacity = occurrence.capacity ?? occurrence.series.capacity;

  let appointmentTypeConfig: Record<string, unknown> | null = null;
  if (occurrence.series.appointmentTypeId) {
    const voiceService = await prisma.voiceService.findFirst({
      where: { id: occurrence.series.appointmentTypeId, workspaceId },
      select: { config: true },
    });
    appointmentTypeConfig = (voiceService?.config as Record<string, unknown>) || null;
  }

  return {
    occurrence,
    series: occurrence.series,
    enrollments: occurrence.enrollments.map((e: (typeof occurrence.enrollments)[number]) => ({
      ...e,
      contact: contactMap.get(e.contactId) || null,
      partySize:
        typeof (e.metadata as { partySize?: number } | null)?.partySize === "number"
          ? (e.metadata as { partySize: number }).partySize
          : 1,
    })),
    enrolledCount,
    capacity,
    remaining: Math.max(0, capacity - enrolledCount),
    classPresentation:
      (appointmentTypeConfig?.classPresentation as string) || "recurring_class",
  };
}

export async function updateClassOccurrence(
  workspaceId: string,
  occurrenceId: string,
  input: {
    startsAt?: string;
    endsAt?: string;
    capacity?: number;
    status?: string;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });
  if (!existing) throw new Error("Occurrence not found");
  return prisma.classOccurrence.update({
    where: { id: occurrenceId },
    data: {
      ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.capacity != null ? { capacity: input.capacity } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });
}

export async function cancelClassEnrollment(workspaceId: string, enrollmentId: string) {
  const prisma = getPrisma();
  const row = await prisma.classEnrollment.findFirst({
    where: { id: enrollmentId, workspaceId },
  });
  if (!row) throw new Error("Enrollment not found");
  return prisma.classEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "cancelled" },
  });
}
