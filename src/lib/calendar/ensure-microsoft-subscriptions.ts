import "server-only";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";

/**
 * Register Graph change notifications for Microsoft connections that import calendars
 * but have no persisted subscription (common after legacy setup or silent register failures).
 */
export async function ensureMicrosoftCalendarSubscriptionsForWorkspace(
  workspaceId: string,
): Promise<{ ensured: string[]; failed: string[] }> {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: "microsoft", status: "connected" },
    select: { id: true, config: true },
  });

  const ensured: string[] = [];
  const failed: string[] = [];

  for (const conn of connections) {
    const config = (conn.config || {}) as CalendarConfig;
    if (!shouldImportFromConnection(config)) continue;
    if (config.microsoftSubscription?.id) {
      const exp = config.microsoftSubscription.expiresAt;
      if (exp && new Date(exp).getTime() > Date.now() + 3600_000) continue;
    }

    const sub = await ensureMicrosoftCalendarSubscription(workspaceId, conn.id);
    if (sub?.id) ensured.push(conn.id);
    else failed.push(conn.id);
  }

  return { ensured, failed };
}
