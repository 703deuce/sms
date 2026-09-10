import "server-only";

import { getPrisma } from "@/lib/db";

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
