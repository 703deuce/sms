import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";

/** Keep Service `config.resourceIds` aligned when Resource ↔ Service eligibility changes from Resources page. */
export async function syncResourceServiceAssignments(
  workspaceId: string,
  resourceId: string,
  eligibleTypeIds: string[],
) {
  const prisma = getPrisma();
  const types = await prisma.voiceService.findMany({
    where: { workspaceId },
    select: { id: true, config: true },
  });
  const wanted = new Set(eligibleTypeIds);
  for (const row of types) {
    const cfg = (row.config || {}) as AppointmentTypeConfig;
    const resourceIds = [...(cfg.resourceIds || [])];
    const has = resourceIds.includes(resourceId);
    const shouldHave = wanted.has(row.id);
    if (!shouldHave && has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, resourceIds: resourceIds.filter((id) => id !== resourceId) } as object },
      });
    } else if (shouldHave && !has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, resourceIds: [...resourceIds, resourceId] } as object },
      });
    }
  }
}
