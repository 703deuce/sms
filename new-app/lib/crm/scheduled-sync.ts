/**
 * Periodic incremental reconcile for all connected CRM workspaces.
 * Complements webhooks — never rely on webhooks alone.
 */

import { getPrisma } from "@/lib/server/db";
import { CRM_PROVIDER_IDS } from "./registry";
import { enqueueCrmSync } from "./sync-engine";
import type { CrmProviderId } from "./types";

export async function enqueueScheduledCrmIncrementalSyncs() {
  const prisma = getPrisma();
  const connections = await prisma.integrationConnection.findMany({
    where: {
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
      accessToken: { not: null },
    },
    select: { workspaceId: true, provider: true, syncStatus: true, configJson: true },
    take: 200,
  });

  const enqueued: Array<{ workspaceId: string; provider: string; syncRunId: string }> = [];
  for (const conn of connections) {
    if (!CRM_PROVIDER_IDS.includes(conn.provider as CrmProviderId)) continue;
    if (conn.syncStatus === "quarantined" || conn.syncStatus === "paused") continue;
    const cfg = (conn.configJson || {}) as {
      crmSyncPreferences?: { syncPaused?: boolean; disableReads?: boolean };
      circuit?: { quarantinedAt?: string | null };
    };
    if (cfg.crmSyncPreferences?.syncPaused || cfg.crmSyncPreferences?.disableReads) continue;
    if (cfg.circuit?.quarantinedAt) continue;

    const hourKey = new Date().toISOString().slice(0, 13);
    const run = await enqueueCrmSync({
      workspaceId: conn.workspaceId,
      provider: conn.provider as CrmProviderId,
      kind: "scheduled",
      triggeredBy: "scheduler",
      idempotencyKey: `crm-scheduled-${conn.provider}-${conn.workspaceId}-${hourKey}`,
    });
    enqueued.push({
      workspaceId: conn.workspaceId,
      provider: conn.provider,
      syncRunId: run.id,
    });
  }
  return { enqueued: enqueued.length, runs: enqueued };
}
