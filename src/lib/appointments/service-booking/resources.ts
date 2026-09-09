import "server-only";

import { getPrisma } from "@/lib/db";

export async function listSchedulingResources(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.schedulingResource.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertSchedulingResource(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    quantity?: number;
    description?: string;
    eligibleTypeIds?: string[];
    locationIds?: string[];
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const metadata =
    input.locationIds != null ? { locationIds: input.locationIds.filter(Boolean) } : undefined;
  const data = {
    name: input.name.trim(),
    quantity: input.quantity ?? 1,
    description: input.description,
    eligibleTypeIds: input.eligibleTypeIds || [],
    active: input.active ?? true,
    ...(metadata ? { metadata } : {}),
  };
  if (input.id) {
    const existing = await prisma.schedulingResource.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Resource not found");
    const mergedMetadata =
      metadata != null
        ? { ...((existing.metadata as Record<string, unknown>) || {}), ...metadata }
        : undefined;
    return prisma.schedulingResource.update({
      where: { id: input.id, workspaceId },
      data: mergedMetadata ? { ...data, metadata: mergedMetadata } : data,
    });
  }
  return prisma.schedulingResource.create({ data: { workspaceId, ...data } });
}

/** Count concurrent usage of a resource in a time window. */
export async function countResourceUsage(
  workspaceId: string,
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
) {
  const prisma = getPrisma();
  const lines = await prisma.appointmentServiceLine.findMany({
    where: {
      workspaceId,
      resourceIds: { has: resourceId },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}),
    },
  });
  return lines.length;
}

export async function assertResourcesAvailable(
  workspaceId: string,
  resourceIds: string[],
  startsAt: Date,
  endsAt: Date,
) {
  const prisma = getPrisma();
  for (const resourceId of resourceIds) {
    const resource = await prisma.schedulingResource.findFirst({
      where: { id: resourceId, workspaceId, active: true },
    });
    if (!resource) throw new Error(`Resource ${resourceId} not found`);
    const used = await countResourceUsage(workspaceId, resourceId, startsAt, endsAt);
    if (used >= resource.quantity) {
      throw new Error(`Resource ${resource.name} is not available`);
    }
  }
}
