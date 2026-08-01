/**
 * Asynchronous CRM synchronization engine.
 * Initial / incremental / manual / scheduled / webhook — never blocks the UI.
 */

import { getPrisma } from "@/lib/db";
import { upsertExternalContact } from "@/lib/integrations/connections";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { ConnectorContext } from "./connector";
import { CrmHttpError } from "./http";
import { appendSyncEvent, writeCrmAudit } from "./logging";
import {
  fingerprintEmail,
  fingerprintPhone,
  getObjectMapping,
  upsertObjectMapping,
} from "./mappings";
import { ensureFreshCrmToken } from "./oauth";
import { getConnector } from "./registry";
import { getCrmSyncPreferences } from "./settings";
import type { CrmProviderId } from "./types";

export type SyncKind = "initial" | "incremental" | "manual" | "webhook" | "scheduled" | "push";

async function buildContext(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");
  const preferences = await getCrmSyncPreferences(workspaceId, provider);
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences,
  };
}

/** Enqueue a background sync — UI returns immediately. */
export async function enqueueCrmSync(input: {
  workspaceId: string;
  provider: CrmProviderId;
  kind?: SyncKind;
  triggeredBy?: string | null;
}) {
  const kind = input.kind || "manual";
  const run = await getPrisma().crmSyncRun.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      kind,
      status: "queued",
      triggeredBy: input.triggeredBy || null,
    },
  });

  await enqueueJob({
    jobType: "crm_sync",
    queueName: "integrations",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      syncRunId: run.id,
      kind,
    },
    idempotencyKey: `crm-sync-${input.provider}-${run.id}`,
  });

  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "sync",
    action: "enqueued",
    message: `Sync ${kind} queued`,
    detail: { syncRunId: run.id },
    actorUserId: input.triggeredBy,
  });

  return run;
}

export async function runCrmSyncJob(payload: {
  workspaceId: string;
  provider: CrmProviderId;
  syncRunId: string;
  kind?: SyncKind;
}) {
  const prisma = getPrisma();
  const { workspaceId, provider, syncRunId } = payload;
  const kind = payload.kind || "manual";

  await prisma.crmSyncRun.update({
    where: { id: syncRunId },
    data: { status: "running", startedAt: new Date() },
  });
  await prisma.integrationConnection
    .updateMany({
      where: { workspaceId, provider },
      data: { status: "syncing" },
    })
    .catch(() => undefined);

  const stats = {
    contactsIn: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsSkipped: 0,
    leadsIn: 0,
    errors: 0,
  };

  try {
    const connector = getConnector(provider);
    const ctx = await buildContext(workspaceId, provider);
    const health = await connector.validateConnection(ctx);
    if (!health.ok) {
      throw new Error(health.message || "Connection validation failed");
    }

    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      action: "validate",
      message: `Validated ${connector.displayName}`,
      detail: { externalAccountId: health.externalAccountId },
    });

    // Inbound contact pull (initial / manual / incremental / scheduled)
    if (kind !== "push" && kind !== "webhook") {
      let cursor: string | null | undefined = null;
      let pages = 0;
      do {
        const page = await connector.listContacts(ctx, cursor);
        for (const remote of page.items) {
          stats.contactsIn += 1;
          try {
            await ingestRemoteContact(workspaceId, provider, syncRunId, remote, stats);
          } catch (err) {
            stats.errors += 1;
            await appendSyncEvent({
              workspaceId,
              syncRunId,
              provider,
              level: "error",
              action: "skip",
              objectType: "contact",
              externalId: remote.id || null,
              message: err instanceof Error ? err.message : "Contact ingest failed",
            });
          }
        }
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor && pages < (kind === "initial" ? 50 : 5));

      if (connector.listLeads && ctx.preferences.autoCreateLeads) {
        cursor = null;
        pages = 0;
        do {
          const page = await connector.listLeads(ctx, cursor);
          stats.leadsIn += page.items.length;
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < 3);
      }
    }

    await prisma.integrationConnection.updateMany({
      where: { workspaceId, provider },
      data: { status: "connected", lastSyncAt: new Date() },
    });

    const status = stats.errors > 0 ? "partial" : "succeeded";
    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt: new Date(),
        statsJson: stats,
        lastError: null,
      },
    });

    await writeCrmAudit({
      workspaceId,
      provider,
      category: "sync",
      action: status,
      message: `Sync ${kind} ${status}`,
      detail: stats,
    });

    return { ok: true, stats, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = err instanceof CrmHttpError ? err.retryable : /rate|timeout|5\d\d/i.test(message);

    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        lastError: message.slice(0, 500),
        statsJson: stats,
      },
    });
    await prisma.integrationConnection
      .updateMany({
        where: { workspaceId, provider },
        data: {
          status: /reauth|refresh|token/i.test(message) ? "needs_reauth" : "error",
        },
      })
      .catch(() => undefined);

    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      level: "error",
      action: "retry",
      message,
    });

    if (retryable) {
      const { JobDeferredError } = await import("@/lib/messaging/types");
      throw new JobDeferredError(`crm_sync_retry:${message.slice(0, 80)}`, 60_000);
    }
    throw err;
  }
}

async function ingestRemoteContact(
  workspaceId: string,
  provider: CrmProviderId,
  syncRunId: string,
  remote: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    companyName?: string | null;
  },
  stats: { contactsCreated: number; contactsUpdated: number; contactsSkipped: number },
) {
  if (!remote.id || !remote.phone) {
    stats.contactsSkipped += 1;
    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      level: "warn",
      action: "skip",
      objectType: "contact",
      externalId: remote.id || null,
      message: "Skipped contact without phone",
    });
    return;
  }

  const existingMap = await getObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    externalId: remote.id,
  });

  const result = await upsertExternalContact({
    workspaceId,
    phone: remote.phone,
    firstName: remote.firstName,
    lastName: remote.lastName,
    email: remote.email,
    company: remote.companyName,
    source: `crm:${provider}`,
  });
  if (!result) {
    stats.contactsSkipped += 1;
    return;
  }

  await upsertObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    internalId: result.contactId,
    externalId: remote.id,
    fingerprint: fingerprintPhone(remote.phone) || fingerprintEmail(remote.email),
  });

  if (existingMap || !result.created) {
    stats.contactsUpdated += 1;
    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      action: "update",
      objectType: "contact",
      internalId: result.contactId,
      externalId: remote.id,
      message: "Updated contact from CRM",
    });
  } else {
    stats.contactsCreated += 1;
    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      action: "create",
      objectType: "contact",
      internalId: result.contactId,
      externalId: remote.id,
      message: "Created contact from CRM",
    });
  }
}

export async function validateCrmConnection(workspaceId: string, provider: CrmProviderId) {
  const connector = getConnector(provider);
  const ctx = await buildContext(workspaceId, provider);
  return connector.validateConnection(ctx);
}

export { buildContext };
