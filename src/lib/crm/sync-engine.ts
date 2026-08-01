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

  const { crmQueueName, priorityScoreForSyncKind } = await import("./runtime/priority");
  await enqueueJob({
    jobType: "crm_sync",
    queueName: crmQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityScoreForSyncKind(kind),
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

  const startedAt = new Date();
  await prisma.crmSyncRun.update({
    where: { id: syncRunId },
    data: {
      status: "running",
      startedAt,
      attempts: { increment: 1 },
      direction: kind === "push" ? "outbound" : "inbound",
    },
  });
  await prisma.integrationConnection
    .updateMany({
      where: { workspaceId, provider },
      data: { status: "syncing", syncStatus: "syncing" },
    })
    .catch(() => undefined);

  const stats = {
    contactsIn: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsSkipped: 0,
    companiesIn: 0,
    usersIn: 0,
    pipelinesIn: 0,
    stagesIn: 0,
    leadsIn: 0,
    errors: 0,
  };

  try {
    const connector = getConnector(provider);
    const ctx = await buildContext(workspaceId, provider);

    if (ctx.preferences.syncPaused) {
      await prisma.crmSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          statsJson: { skipped: true, reason: "sync_paused" },
        },
      });
      await prisma.integrationConnection
        .updateMany({
          where: { workspaceId, provider },
          data: { status: "connected", syncStatus: "paused" },
        })
        .catch(() => undefined);
      return { ok: true, skipped: true, reason: "sync_paused" };
    }

    if (kind !== "push" && ctx.preferences.disableReads) {
      await prisma.crmSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          statsJson: { skipped: true, reason: "reads_disabled" },
        },
      });
      return { ok: true, skipped: true, reason: "reads_disabled" };
    }

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

    // Initial / manual / incremental / scheduled / webhook reconcile — never import historical activities unless enabled later.
    if (kind !== "push") {
      // Users + pipelines first (owner / stage mapping metadata)
      if (connector.listUsers) {
        const users = await connector.listUsers(ctx);
        stats.usersIn = users.length;
        for (const u of users) {
          await upsertObjectMapping({
            workspaceId,
            provider,
            objectType: "user",
            internalId: `crm-user:${u.externalId}`,
            externalId: u.externalId,
            metadata: { name: u.name, email: u.email },
          }).catch(() => undefined);
        }
        await appendSyncEvent({
          workspaceId,
          syncRunId,
          provider,
          action: "map",
          objectType: "user",
          message: `Mapped ${users.length} CRM users/owners`,
        });
      }

      if (connector.listPipelines) {
        const pipelines = await connector.listPipelines(ctx);
        stats.pipelinesIn = pipelines.length;
        for (const p of pipelines) {
          await upsertObjectMapping({
            workspaceId,
            provider,
            objectType: "pipeline",
            internalId: `crm-pipeline:${p.id}`,
            externalId: p.id,
            metadata: { name: p.name },
          }).catch(() => undefined);
          for (const s of p.stages) {
            stats.stagesIn += 1;
            await upsertObjectMapping({
              workspaceId,
              provider,
              objectType: "pipeline_stage",
              internalId: `crm-stage:${p.id}:${s.id}`,
              externalId: s.id,
              metadata: { pipelineId: p.id, name: s.name, order: s.order },
            }).catch(() => undefined);
          }
        }
        await appendSyncEvent({
          workspaceId,
          syncRunId,
          provider,
          action: "map",
          objectType: "pipeline",
          message: `Mapped ${pipelines.length} pipeline(s), ${stats.stagesIn} stage(s)`,
        });
      }

      // Incremental checkpoint — true modified-since, not "fewer pages"
      const connRow = await prisma.integrationConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider } },
      });
      const cfg = (connRow?.configJson || {}) as {
        syncCheckpoints?: Record<string, string>;
      };
      const checkpoints = { ...(cfg.syncCheckpoints || {}) };
      const useIncremental =
        kind === "incremental" || kind === "webhook" || kind === "scheduled";
      const modifiedSince =
        useIncremental && checkpoints.contact ? new Date(checkpoints.contact) : null;
      const maxPage = kind === "initial" ? 50 : useIncremental ? 20 : 10;
      let newestContactTs = modifiedSince?.getTime() || 0;

      const { acquireCrmRateLimit } = await import("./runtime/rate-limit");
      const { JobDeferredError } = await import("@/lib/messaging/types");

      if (connector.listCompanies && (kind === "initial" || ctx.preferences.autoCreateCompanies)) {
        let cursor: string | null | undefined = null;
        let pages = 0;
        const companySince =
          useIncremental && checkpoints.company
            ? new Date(checkpoints.company)
            : null;
        do {
          const gate = acquireCrmRateLimit(workspaceId, provider);
          if (!gate.ok) {
            throw new JobDeferredError(`crm_sync_rate:${gate.reason}`, gate.retryAfterMs);
          }
          const page = await connector.listCompanies(ctx, cursor, {
            modifiedSince: companySince,
          });
          for (const company of page.items) {
            stats.companiesIn += 1;
            if (company.id) {
              await upsertObjectMapping({
                workspaceId,
                provider,
                objectType: "company",
                internalId: `crm-company:${company.id}`,
                externalId: company.id,
                syncStatus: "synced",
                metadata: {
                  name: company.name,
                  phone: company.phone,
                  website: company.website,
                  ownerExternalId: company.ownerExternalId,
                },
              }).catch(() => undefined);
            }
          }
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < (kind === "initial" ? 20 : 5));
        checkpoints.company = new Date().toISOString();
      }

      let cursor: string | null | undefined = null;
      let pages = 0;
      do {
        const gate = acquireCrmRateLimit(workspaceId, provider);
        if (!gate.ok) {
          throw new JobDeferredError(`crm_sync_rate:${gate.reason}`, gate.retryAfterMs);
        }
        const page = await connector.listContacts(ctx, cursor, {
          modifiedSince: modifiedSince && !Number.isNaN(modifiedSince.getTime())
            ? modifiedSince
            : null,
        });
        for (const remote of page.items) {
          stats.contactsIn += 1;
          const lm = remote.customFields?.lastModifiedAt
            ? new Date(String(remote.customFields.lastModifiedAt)).getTime()
            : 0;
          if (lm > newestContactTs) newestContactTs = lm;
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
      } while (cursor && pages < maxPage);

      // Advance checkpoint only after successful page persistence
      if (newestContactTs > 0) {
        checkpoints.contact = new Date(newestContactTs).toISOString();
      } else if (kind === "initial") {
        checkpoints.contact = new Date().toISOString();
      }

      if (connector.listLeads && ctx.preferences.autoCreateLeads) {
        cursor = null;
        pages = 0;
        const leadSince =
          useIncremental && checkpoints.lead ? new Date(checkpoints.lead) : null;
        do {
          const gate = acquireCrmRateLimit(workspaceId, provider);
          if (!gate.ok) {
            throw new JobDeferredError(`crm_sync_rate:${gate.reason}`, gate.retryAfterMs);
          }
          const page = await connector.listLeads(ctx, cursor, {
            modifiedSince: leadSince,
          });
          for (const lead of page.items) {
            stats.leadsIn += 1;
            if (!lead.id) continue;
            // Ingest lead as contact when phone/email present (preserves CRM lead mapping)
            if (lead.phone || lead.email) {
              try {
                await ingestRemoteContact(
                  workspaceId,
                  provider,
                  syncRunId,
                  {
                    id: lead.id,
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    phone: lead.phone,
                    email: lead.email,
                    companyName: lead.companyName,
                  },
                  stats,
                );
                await upsertObjectMapping({
                  workspaceId,
                  provider,
                  objectType: "lead",
                  internalId: `crm-lead:${lead.id}`,
                  externalId: lead.id,
                  syncStatus: "synced",
                  metadata: {
                    status: lead.status,
                    source: lead.source,
                    ownerExternalId: lead.ownerExternalId,
                  },
                }).catch(() => undefined);
              } catch {
                stats.errors += 1;
              }
            } else {
              await upsertObjectMapping({
                workspaceId,
                provider,
                objectType: "lead",
                internalId: `crm-lead:${lead.id}`,
                externalId: lead.id,
                metadata: { status: lead.status, name: lead.lastName },
              }).catch(() => undefined);
            }
          }
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < (kind === "initial" ? 20 : 5));
        checkpoints.lead = new Date().toISOString();
      }

      if (connector.listDeals && ctx.preferences.syncOpportunities) {
        cursor = null;
        pages = 0;
        do {
          const gate = acquireCrmRateLimit(workspaceId, provider);
          if (!gate.ok) {
            throw new JobDeferredError(`crm_sync_rate:${gate.reason}`, gate.retryAfterMs);
          }
          const page = await connector.listDeals!(ctx, cursor, {
            modifiedSince:
              useIncremental && checkpoints.deal
                ? new Date(checkpoints.deal)
                : null,
          });
          for (const deal of page.items) {
            if (!deal.id) continue;
            await upsertObjectMapping({
              workspaceId,
              provider,
              objectType: "deal",
              internalId: `crm-deal:${deal.id}`,
              externalId: deal.id,
              parentExternalId: deal.contactExternalId || deal.companyExternalId || null,
              syncStatus: "synced",
              metadata: {
                name: deal.name,
                amount: deal.amount,
                currency: deal.currency,
                stage: deal.stage,
                pipeline: deal.pipeline,
                status: deal.status,
                ownerExternalId: deal.ownerExternalId,
              },
            }).catch(() => undefined);
          }
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor && pages < (kind === "initial" ? 20 : 5));
        checkpoints.deal = new Date().toISOString();
      }

      await prisma.integrationConnection.updateMany({
        where: { workspaceId, provider },
        data: {
          configJson: {
            ...(cfg as object),
            syncCheckpoints: checkpoints,
          } as object,
        },
      });
    }

    await prisma.integrationConnection.updateMany({
      where: { workspaceId, provider },
      data: {
        status: "connected",
        syncStatus: stats.errors > 0 ? "degraded" : "healthy",
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    const status = stats.errors > 0 ? "partial" : "succeeded";
    const finishedAt = new Date();
    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
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

    const { recordCrmMetric } = await import("./metrics");
    await recordCrmMetric({
      workspaceId,
      provider,
      name: kind === "initial" ? "initial_sync" : "sync",
      ms: finishedAt.getTime() - startedAt.getTime(),
      ok: true,
    }).catch(() => undefined);

    return { ok: true, stats, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = err instanceof CrmHttpError ? err.retryable : /rate|timeout|5\d\d/i.test(message);

    const finishedAt = new Date();
    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        lastError: message.slice(0, 500),
        statsJson: stats,
      },
    });
    const { recordCrmMetric } = await import("./metrics");
    await recordCrmMetric({
      workspaceId,
      provider,
      name: kind === "initial" ? "initial_sync" : "sync",
      ms: finishedAt.getTime() - startedAt.getTime(),
      ok: false,
    }).catch(() => undefined);
    await prisma.integrationConnection
      .updateMany({
        where: { workspaceId, provider },
        data: {
          status: /reauth|refresh|token/i.test(message) ? "needs_reauth" : "error",
          syncStatus: "error",
          lastFailedSyncAt: new Date(),
          lastError: message.slice(0, 500),
        },
      })
      .catch(() => undefined);

    // After max attempts, park in dead letter.
    const run = await prisma.crmSyncRun.findUnique({ where: { id: syncRunId } });
    if (run && run.attempts >= 5 && !retryable) {
      await prisma.crmDeadLetter
        .create({
          data: {
            workspaceId,
            provider,
            jobType: "crm_sync",
            error: message.slice(0, 500),
            attempts: run.attempts,
            syncRunId,
            payloadJson: { kind, stats },
          },
        })
        .catch(() => undefined);
    }

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
    customFields?: Record<string, unknown>;
  },
  stats: { contactsCreated: number; contactsUpdated: number; contactsSkipped: number },
) {
  if (!remote.id || (!remote.phone && !remote.email)) {
    stats.contactsSkipped += 1;
    await appendSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      level: "warn",
      action: "skip",
      objectType: "contact",
      externalId: remote.id || null,
      message: "Skipped contact without phone or email",
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

  const lastCrmModifiedAt = remote.customFields?.lastModifiedAt
    ? new Date(String(remote.customFields.lastModifiedAt))
    : null;

  await upsertObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    internalId: result.contactId,
    externalId: remote.id,
    fingerprint: fingerprintPhone(remote.phone) || fingerprintEmail(remote.email),
    lastCrmModifiedAt:
      lastCrmModifiedAt && !Number.isNaN(lastCrmModifiedAt.getTime())
        ? lastCrmModifiedAt
        : null,
    syncStatus: "synced",
    externalDeletedAt: null,
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
