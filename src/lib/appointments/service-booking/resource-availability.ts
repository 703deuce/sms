import "server-only";

import { assertResourcesAvailable, countResourceUsage, listSchedulingResources } from "./resources";

/** Resource IDs linked to a booking type config + any customer-selected resources. */
export async function resolveResourceIdsForBookingType(
  _workspaceId: string,
  typeConfig?: { resourceIds?: string[] } | null,
  explicitResourceIds?: string[],
): Promise<string[]> {
  const fromConfig = typeConfig?.resourceIds || [];
  const explicit = explicitResourceIds || [];
  return [...new Set([...fromConfig, ...explicit].filter(Boolean))];
}

/** True when every required resource has capacity in the window. */
export async function areResourcesAvailableForSlot(
  workspaceId: string,
  resourceIds: string[],
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  if (!resourceIds.length) return true;
  try {
    for (const resourceId of resourceIds) {
      const used = await countResourceUsage(
        workspaceId,
        resourceId,
        startsAt,
        endsAt,
        excludeAppointmentId,
      );
      const resources = await listSchedulingResources(workspaceId);
      const resource = resources.find((r) => r.id === resourceId);
      if (!resource || !resource.active) return false;
      if (used >= (resource.quantity ?? 1)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function filterSlotsByResourceAvailability(
  workspaceId: string,
  resourceIds: string[],
  slots: Array<{ startsAt: string; endsAt: string }>,
  excludeAppointmentId?: string,
): Promise<Array<{ startsAt: string; endsAt: string }>> {
  if (!resourceIds.length) return slots;
  const kept: Array<{ startsAt: string; endsAt: string }> = [];
  for (const slot of slots) {
    const ok = await areResourcesAvailableForSlot(
      workspaceId,
      resourceIds,
      new Date(slot.startsAt),
      new Date(slot.endsAt),
      excludeAppointmentId,
    );
    if (ok) kept.push(slot);
  }
  return kept;
}

export async function persistAppointmentResources(
  workspaceId: string,
  input: {
    appointmentId: string;
    appointmentTypeId?: string;
    serviceName: string;
    staffId?: string;
    resourceIds: string[];
    startsAt: Date;
    endsAt: Date;
    priceCents?: number;
  },
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  await assertResourcesAvailable(workspaceId, input.resourceIds, input.startsAt, input.endsAt);
  await prisma.appointmentServiceLine.deleteMany({
    where: { workspaceId, appointmentId: input.appointmentId },
  });
  if (!input.resourceIds.length) {
    await prisma.appointmentServiceLine.create({
      data: {
        workspaceId,
        appointmentId: input.appointmentId,
        appointmentTypeId: input.appointmentTypeId,
        serviceName: input.serviceName,
        staffId: input.staffId,
        resourceIds: [],
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        priceCents: input.priceCents ?? 0,
        displayOrder: 0,
        metadata: {},
      },
    });
    return;
  }
  await prisma.appointmentServiceLine.create({
    data: {
      workspaceId,
      appointmentId: input.appointmentId,
      appointmentTypeId: input.appointmentTypeId,
      serviceName: input.serviceName,
      staffId: input.staffId,
      resourceIds: input.resourceIds,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      priceCents: input.priceCents ?? 0,
      displayOrder: 0,
      metadata: {},
    },
  });
}

export async function loadAppointmentResourceLabels(
  workspaceId: string,
  resourceIds: string[],
): Promise<Array<{ id: string; name: string }>> {
  if (!resourceIds.length) return [];
  const resources = await listSchedulingResources(workspaceId);
  return resourceIds
    .map((id) => {
      const row = resources.find((r) => r.id === id);
      return row ? { id, name: row.name } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string }>;
}
