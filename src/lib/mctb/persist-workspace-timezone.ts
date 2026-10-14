import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { upsertMessagingRuntimeSettings } from "@/lib/messaging/messaging-settings";
import { resolveMctbUsTimezoneChoice } from "@/lib/mctb/us-timezone-options";

/** Canonical workspace timezone for MCTB display, pause, and shared messaging settings. */
export async function persistMctbWorkspaceTimezone(
  workspaceId: string,
  timezone: string,
): Promise<string> {
  const tz = resolveMctbUsTimezoneChoice(timezone);
  await loadMissedCallTextConfig(workspaceId);
  const prisma = getPrisma();
  await prisma.missedCallTextConfig.update({
    where: { workspaceId },
    data: { timezone: tz },
  });
  await upsertMessagingRuntimeSettings(workspaceId, { timezone: tz });
  return tz;
}
