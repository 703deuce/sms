import "server-only";

import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { getPrisma } from "@/lib/db";
import { resolveMctbMessagingInBusinessHoursFromSchedule } from "@/lib/mctb/messaging-business-hours";
import { readMctbScheduleFromCustomFields } from "@/lib/mctb/schedule-shared";

export async function resolveMctbMessagingInBusinessHours(
  workspaceId: string,
  config: MissedCallTextConfigRecord,
  now = new Date(),
): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const settings = readMctbScheduleFromCustomFields(ws?.customFieldsConfig, config);
  return resolveMctbMessagingInBusinessHoursFromSchedule(
    config,
    settings.weeklySchedule,
    now,
  );
}
