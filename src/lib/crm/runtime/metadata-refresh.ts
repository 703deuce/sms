/**
 * Incremental metadata refresh — users, pipelines, stages, fields — without reconnect.
 */

import { getPrisma } from "@/lib/db";
import { upsertConnection } from "@/lib/integrations/connections";
import { upsertObjectMapping } from "../mappings";
import { writeCrmAudit } from "../logging";
import { ensureFreshCrmToken } from "../oauth";
import { getConnector } from "../registry";
import { getCrmSyncPreferences } from "../settings";
import { recordCrmMetric } from "../metrics";
import type { CrmProviderId } from "../types";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { crmQueueName, priorityScoreForSyncKind } from "./priority";

export async function enqueueCrmMetadataRefresh(input: {
  workspaceId: string;
  provider: CrmProviderId;
  triggeredBy?: string | null;
}) {
  return enqueueJob({
    jobType: "crm_metadata_refresh",
    queueName: crmQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityScoreForSyncKind("metadata"),
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      triggeredBy: input.triggeredBy || null,
    },
    idempotencyKey: `crm-meta-${input.provider}-${input.workspaceId}-${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function runCrmMetadataRefreshJob(payload: {
  workspaceId: string;
  provider: CrmProviderId;
}) {
  const { workspaceId, provider } = payload;
  const started = Date.now();
  const connector = getConnector(provider);
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");

  const ctx = {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: await getCrmSyncPreferences(workspaceId, provider),
  };

  const stats = { users: 0, pipelines: 0, stages: 0, fields: 0 };

  if (connector.listUsers) {
    const users = await connector.listUsers(ctx);
    for (const u of users) {
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "user",
        internalId: `crm-user:${u.externalId}`,
        externalId: u.externalId,
        metadata: { name: u.name, email: u.email },
      });
      stats.users += 1;
    }
  }

  if (connector.listPipelines) {
    const pipes = await connector.listPipelines(ctx);
    for (const p of pipes) {
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "pipeline",
        internalId: `crm-pipeline:${p.id}`,
        externalId: p.id,
        metadata: { name: p.name },
      });
      stats.pipelines += 1;
      for (const s of p.stages || []) {
        await upsertObjectMapping({
          workspaceId,
          provider,
          objectType: "stage",
          internalId: `crm-stage:${p.id}:${s.id}`,
          externalId: s.id,
          metadata: {
            name: s.name,
            pipelineId: p.id,
            order: s.order,
          },
        });
        stats.stages += 1;
      }
    }
  }

  let fieldHints: Array<{ objectType: string; name: string; label: string }> = [];
  if (connector.listFields) {
    fieldHints = await connector.listFields(ctx);
    stats.fields = fieldHints.length;
  }

  await upsertConnection({
    workspaceId,
    provider,
    config: {
      metadataRefresh: {
        at: new Date().toISOString(),
        stats,
        fieldSample: fieldHints.slice(0, 50),
      },
    },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "sync",
    action: "metadata_refresh",
    message: `Metadata refreshed (${stats.users} users, ${stats.pipelines} pipelines, ${stats.fields} fields)`,
    detail: stats,
  });

  await recordCrmMetric({
    workspaceId,
    provider,
    name: "metadata_refresh",
    ms: Date.now() - started,
    ok: true,
  });

  // Touch a sync run for visibility
  await getPrisma().crmSyncRun.create({
    data: {
      workspaceId,
      provider,
      kind: "scheduled",
      status: "succeeded",
      direction: "inbound",
      startedAt: new Date(started),
      finishedAt: new Date(),
      durationMs: Date.now() - started,
      triggeredBy: "metadata_refresh",
      statsJson: stats,
    },
  });

  return { ok: true, stats };
}

/** Schedule metadata refresh for all connected CRMs in a workspace (hourly idempotency). */
export async function scheduleWorkspaceMetadataRefresh(workspaceId: string) {
  const rows = await getPrisma().integrationConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ["salesforce", "zoho", "pipedrive"] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });
  for (const r of rows) {
    await enqueueCrmMetadataRefresh({
      workspaceId,
      provider: r.provider as CrmProviderId,
      triggeredBy: "schedule",
    }).catch(() => undefined);
  }
  return { scheduled: rows.length };
}
