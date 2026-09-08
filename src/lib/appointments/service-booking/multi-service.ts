import "server-only";

import { getPrisma } from "@/lib/db";
import { assertResourcesAvailable } from "./resources";

export type MultiServiceLineInput = {
  appointmentTypeId?: string;
  serviceName: string;
  staffId?: string;
  resourceIds?: string[];
  startsAt: string;
  endsAt: string;
  priceCents?: number;
  displayOrder?: number;
};

export async function createMultiServiceAppointment(
  workspaceId: string,
  appointmentId: string,
  lines: MultiServiceLineInput[],
) {
  const prisma = getPrisma();
  const sorted = [...lines].sort((a, b) => a.displayOrder! - b.displayOrder!);
  for (const line of sorted) {
    await assertResourcesAvailable(
      workspaceId,
      line.resourceIds || [],
      new Date(line.startsAt),
      new Date(line.endsAt),
    );
    await prisma.appointmentServiceLine.create({
      data: {
        workspaceId,
        appointmentId,
        appointmentTypeId: line.appointmentTypeId,
        serviceName: line.serviceName,
        staffId: line.staffId,
        resourceIds: line.resourceIds || [],
        startsAt: new Date(line.startsAt),
        endsAt: new Date(line.endsAt),
        priceCents: line.priceCents ?? 0,
        displayOrder: line.displayOrder ?? 0,
      },
    });
  }
  const totalCents = sorted.reduce((s, l) => s + (l.priceCents ?? 0), 0);
  return { appointmentId, lineCount: sorted.length, totalCents };
}

export async function findChainedAvailability(
  workspaceId: string,
  lines: Array<{ durationMinutes: number; staffId?: string; resourceIds?: string[] }>,
  candidateStart: Date,
) {
  let cursor = candidateStart.getTime();
  const schedule: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (const line of lines) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor + line.durationMinutes * 60_000);
    if (line.resourceIds?.length) {
      await assertResourcesAvailable(workspaceId, line.resourceIds, startsAt, endsAt);
    }
    schedule.push({ startsAt, endsAt });
    cursor = endsAt.getTime();
  }
  return schedule;
}
