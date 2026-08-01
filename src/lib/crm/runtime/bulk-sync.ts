/**
 * Bulk / paged synchronization with checkpoint resume and progress reporting.
 */

import { getPrisma } from "@/lib/db";
import { upsertConnection } from "@/lib/integrations/connections";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { writeCrmAudit } from "../logging";
import type { CrmProviderId } from "../types";
import { crmQueueName, priorityScoreForSyncKind } from "./priority";

export type BulkCheckpoint = {
  objectType: "contact" | "company" | "lead";
  cursor: string | null;
  imported: number;
  pages: number;
  done: boolean;
  updatedAt: string;
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

export async function runCrmBulkSyncPage(payload: {
  workspaceId: string;
  provider: CrmProviderId;
  syncRunId: string;
  objectType: BulkCheckpoint["objectType"];
  cursor?: string | null;
}) {
  const { runCrmSyncJob } = await import("../sync-engine");
  // Reuse sync engine for a page of work; checkpoint stored on connection + run.
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
      statsJson: { bulk: true, checkpoint },
    },
  });

  // Delegate contact/company ingest to standard sync for now (full incremental page).
  const result = await runCrmSyncJob({
    workspaceId: payload.workspaceId,
    provider: payload.provider,
    syncRunId: payload.syncRunId,
    kind: "incremental",
  });

  const next: BulkCheckpoint = {
    objectType: payload.objectType,
    cursor: null,
    imported: checkpoint.imported + Number((result as { stats?: { contactsIn?: number } })?.stats?.contactsIn || 0),
    pages: checkpoint.pages + 1,
    done: true, // sync-engine currently drains pages internally; mark complete
    updatedAt: new Date().toISOString(),
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
    message: `Bulk sync progress: ${next.imported} imported, page ${next.pages}`,
    detail: next as unknown as Record<string, unknown>,
  });

  // If not done, re-enqueue continuation (future adapters can set done=false + cursor)
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
