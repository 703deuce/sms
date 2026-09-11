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

export async function listOccurrencesForSeries(workspaceId: string, seriesId: string) {
  const prisma = getPrisma();
  const occurrences = await prisma.classOccurrence.findMany({
    where: { workspaceId, seriesId },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  const ids = occurrences.map((o) => o.id);
  const counts = ids.length
    ? await prisma.classEnrollment.groupBy({
        by: ["occurrenceId"],
        where: { workspaceId, occurrenceId: { in: ids }, status: "enrolled" },
        _count: { occurrenceId: true },
      })
    : [];
  const countMap = new Map(
    counts.map((c) => [c.occurrenceId, c._count.occurrenceId]),
  );
  return occurrences.map((occ) => ({
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
