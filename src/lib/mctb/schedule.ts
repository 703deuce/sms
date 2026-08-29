import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";

export * from "./schedule-shared";

import {
  readMctbScheduleFromCustomFields,
  type MctbScheduleSettings,
} from "./schedule-shared";
export async function loadMctbScheduleSettings(
  workspaceId: string,
  config?: MissedCallTextConfigRecord,
): Promise<MctbScheduleSettings> {
  const prisma = getPrisma();
  const runtime = config ?? (await loadMissedCallTextConfig(workspaceId));
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  return readMctbScheduleFromCustomFields(ws?.customFieldsConfig, runtime);
}
