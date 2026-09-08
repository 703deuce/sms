import "server-only";

import { getPrisma } from "@/lib/db";
import { assertResourcesAvailable } from "./resources";
import type { ServicePhaseKind } from "./types";

export async function listServicePhaseTemplates(workspaceId: string, appointmentTypeId?: string) {
  const prisma = getPrisma();
  return prisma.servicePhaseTemplate.findMany({
    where: { workspaceId, ...(appointmentTypeId ? { appointmentTypeId } : {}) },
    orderBy: { displayOrder: "asc" },
  });
}

export async function upsertServicePhaseTemplate(
  workspaceId: string,
  input: {
    id?: string;
    appointmentTypeId?: string;
    name: string;
    phaseKind: ServicePhaseKind;
    durationMinutes: number;
    staffRequired?: boolean;
    resourceIds?: string[];
    displayOrder?: number;
  },
) {
  const prisma = getPrisma();
  const data = {
    appointmentTypeId: input.appointmentTypeId,
    name: input.name.trim(),
    phaseKind: input.phaseKind,
    durationMinutes: input.durationMinutes,
    staffRequired: input.staffRequired ?? input.phaseKind === "active_staff",
    resourceIds: input.resourceIds || [],
    displayOrder: input.displayOrder ?? 0,
  };
  if (input.id) {
    return prisma.servicePhaseTemplate.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.servicePhaseTemplate.create({ data: { workspaceId, ...data } });
}

export function computePhasedDurationMinutes(
  phases: Array<{ durationMinutes: number }>,
): number {
  return phases.reduce((sum, p) => sum + p.durationMinutes, 0);
}

export async function validatePhasedSlot(
  workspaceId: string,
  phases: Array<{
    phaseKind: ServicePhaseKind;
    durationMinutes: number;
    staffRequired?: boolean;
    resourceIds?: string[];
  }>,
  slotStart: Date,
) {
  let cursor = slotStart.getTime();
  for (const phase of phases) {
    const start = new Date(cursor);
    const end = new Date(cursor + phase.durationMinutes * 60_000);
    if (phase.resourceIds?.length) {
      await assertResourcesAvailable(workspaceId, phase.resourceIds, start, end);
    }
    cursor = end.getTime();
  }
  return new Date(cursor);
}
