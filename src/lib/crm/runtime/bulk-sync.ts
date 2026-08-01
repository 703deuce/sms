/**
 * Bulk / paged synchronization with checkpoint resume and progress reporting.
 * Delegates page draining to sync-engine (adapters already paginate internally).
 */

import { getPrisma } from "@/lib/db";
import { upsertConnection } from "@/lib/integrations/connections";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { writeCrmAudit } from "../logging";
import type { CrmProviderId } from "../types";
import { crmQueueName, priorityScoreForSyncKind } from "./priority";

export type BulkCheckpoint = {
  objectType: "contact" | "company" | "lead" | "deal" | "task" | "note" | "activity";
  cursor: string | null;
  imported: number;
  pages: number;
  done: boolean;
  updatedAt: string;
  lastStats?: Record<string, number>;
};

export async function enqueueCrmBulkSync(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType?: BulkCheckpoint["objectType"];
  triggeredBy?: string | null;
}) {
  const run = await getPrisma().crmSyncRun.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      kind: "initial",
      status: "queued",
      direction: "inbound",
      triggeredBy: input.triggeredBy || "bulk",
      statsJson: {
        bulk: true,
        objectType: input.objectType || "contact",
        checkpoint: null,
      },
    },
  });

  await enqueueJob({
    jobType: "crm_bulk_sync",
    queueName: crmQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityScoreForSyncKind("bulk"),
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      syncRunId: run.id,
      objectType: input.objectType || "contact",
    },
    idempotencyKey: `crm-bulk-${input.provider}-${run.id}`,
  });

  return run;
}

function importedFromSyncStats(stats: Record<string, unknown> | undefined): number {
  if (!stats) return 0;
  const keys = [
    "contactsIn",
    "contactsCreated",
    "contactsUpdated",
    "companiesIn",
    "leadsIn",
    "dealsIn",
    "tasksIn",
    "notesIn",
    "activitiesIn",
  ];
  let n = 0;
  for (const k of keys) {
    const v = stats[k];
    if (typeof v === "number") n += v;
  }
  // Prefer contact+company+lead inbound counts when present; avoid double-counting create+update.
  const inbound =
    Number(stats.contactsIn || 0) +
    Number(stats.companiesIn || 0) +
    Number(stats.leadsIn || 0) +
    Number(stats.dealsIn || 0) +
    Number(stats.tasksIn || 0) +
    Number(stats.notesIn || 0) +
    Number(stats.activitiesIn || 0);
  return inbound > 0 ? inbound : n;
}

export async function runCrmBulkSyncPage(payload: {
  workspaceId: string;
  provider: CrmProviderId;
  syncRunId: string;
  objectType: BulkCheckpoint["objectType"];
  cursor?: string | null;
}) {
  const { runCrmSyncJob } = await import("../sync-engine");
  const prisma = getPrisma();
  const conn = await prisma.integrationConnection.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId: payload.workspaceId,
        provider: payload.provider,
      },
    },
  });
  const cfg = (conn?.configJson || {}) as { bulkCheckpoint?: BulkCheckpoint };
  const checkpoint: BulkCheckpoint = cfg.bulkCheckpoint || {
    objectType: payload.objectType,
    cursor: payload.cursor || null,
    imported: 0,
    pages: 0,
    done: false,
    updatedAt: new Date().toISOString(),
  };

  await prisma.crmSyncRun.update({
    where: { id: payload.syncRunId },
    data: {
      status: "running",
      startedAt: new Date(),
      statsJson: { bulk: true, objectType: payload.objectType, checkpoint },
    },
  });

  // Sync-engine drains all adapter pages for the requested sync kind.
  const result = await runCrmSyncJob({
    workspaceId: payload.workspaceId,
    provider: payload.provider,
    syncRunId: payload.syncRunId,
    kind: "initial",
  });

  const stats = ((result as { stats?: Record<string, unknown> })?.stats ||
    {}) as Record<string, unknown>;
  const pageImported = importedFromSyncStats(stats);

  const next: BulkCheckpoint = {
    objectType: payload.objectType,
    cursor: null,
    imported: checkpoint.imported + pageImported,
    pages: checkpoint.pages + 1,
    // Engine already drains pagination; continuation only if a future adapter returns a resume cursor.
    done: true,
    updatedAt: new Date().toISOString(),
    lastStats: Object.fromEntries(
      Object.entries(stats).filter(([, v]) => typeof v === "number"),
    ) as Record<string, number>,
  };

  await upsertConnection({
    workspaceId: payload.workspaceId,
    provider: payload.provider,
    config: { bulkCheckpoint: next },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId: payload.workspaceId,
    provider: payload.provider,
    category: "sync",
    action: "bulk_page",
    message: `Bulk sync progress: ${next.imported} imported, page ${next.pages}, object=${next.objectType}`,
    detail: next as unknown as Record<string, unknown>,
  });

  if (!next.done) {
    await enqueueJob({
      jobType: "crm_bulk_sync",
      queueName: crmQueueName(payload.provider),
      workspaceId: payload.workspaceId,
      priority: priorityScoreForSyncKind("bulk"),
      payload: {
        workspaceId: payload.workspaceId,
        provider: payload.provider,
        syncRunId: payload.syncRunId,
        objectType: payload.objectType,
        cursor: next.cursor,
      },
      idempotencyKey: `crm-bulk-${payload.provider}-${payload.syncRunId}-p${next.pages}`,
    });
  }

  return { ok: true, checkpoint: next };
}
