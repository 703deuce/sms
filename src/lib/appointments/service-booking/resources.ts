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
    category?: string;
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const qty = input.quantity ?? 1;
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error("Capacity must be a whole number of at least 1");
  }
  const metaPatch: Record<string, unknown> = {};
  if (input.locationIds != null) metaPatch.locationIds = input.locationIds.filter(Boolean);
  if (input.category != null && input.category.trim()) {
    metaPatch.category = input.category.trim();
  }
  const data = {
    name: input.name.trim(),
    quantity: qty,
    description: input.description,
    eligibleTypeIds: input.eligibleTypeIds || [],
    active: input.active ?? true,
  };
  if (input.id) {
    const existing = await prisma.schedulingResource.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Resource not found");
    const mergedMetadata = {
      ...((existing.metadata as Record<string, unknown>) || {}),
      ...metaPatch,
    };
    return prisma.schedulingResource.update({
      where: { id: input.id, workspaceId },
      data: { ...data, metadata: mergedMetadata },
    });
  }
  const metadata = Object.keys(metaPatch).length ? metaPatch : undefined;
  return prisma.schedulingResource.create({
    data: { workspaceId, ...data, ...(metadata ? { metadata } : {}) },
  });
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
  excludeAppointmentId?: string,
) {
  const prisma = getPrisma();
  for (const resourceId of resourceIds) {
    const resource = await prisma.schedulingResource.findFirst({
      where: { id: resourceId, workspaceId, active: true },
    });
    if (!resource) throw new Error(`Resource ${resourceId} not found`);
    const used = await countResourceUsage(
      workspaceId,
      resourceId,
      startsAt,
      endsAt,
      excludeAppointmentId,
    );
    if (used >= resource.quantity) {
      throw new Error(`Resource ${resource.name} is not available`);
    }
  }
}

/** Peak concurrent usage in a window (for capacity reduction guards). */
export async function maxConcurrentResourceUsage(
  workspaceId: string,
  resourceId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const prisma = getPrisma();
  const lines = await prisma.appointmentServiceLine.findMany({
    where: {
      workspaceId,
      resourceIds: { has: resourceId },
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { startsAt: true, endsAt: true },
  });
  if (!lines.length) return 0;
  const events: Array<{ t: number; delta: number }> = [];
  for (const line of lines) {
    events.push({ t: line.startsAt.getTime(), delta: 1 });
    events.push({ t: line.endsAt.getTime(), delta: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let cur = 0;
  let max = 0;
  for (const e of events) {
    cur += e.delta;
    if (cur > max) max = cur;
  }
  return max;
}
