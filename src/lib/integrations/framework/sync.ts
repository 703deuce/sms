import { getPrisma } from "@/lib/db";
import { upsertExternalContact } from "@/lib/integrations/connections";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { appendIntegrationSyncEvent, writeIntegrationAudit } from "./audit";
import { buildAdapterContext } from "./context";
import { upsertExternalMapping } from "./mappings";
import { integrationQueueName, priorityForIntegrationKind } from "./priority";
import { getAdapter } from "./registry";
import { getIntegrationPreferences } from "./settings";
import type { ExternalProviderId } from "./types";

export type IntegrationSyncKind = "initial" | "incremental" | "manual" | "webhook";

export async function enqueueIntegrationSync(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  kind?: IntegrationSyncKind;
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
    jobType: "integration_sync",
    queueName: integrationQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityForIntegrationKind(kind === "initial" ? "initial" : "incremental"),
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      syncRunId: run.id,
      kind,
    },
    idempotencyKey: `ext-sync-${input.provider}-${run.id}`,
  });

  await writeIntegrationAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "sync",
    action: "enqueued",
    message: `Integration sync ${kind} queued`,
    detail: { syncRunId: run.id },
    actorUserId: input.triggeredBy,
  });

  return run;
}

export async function runIntegrationSyncJob(payload: {
  workspaceId: string;
  provider: ExternalProviderId;
  syncRunId: string;
  kind?: IntegrationSyncKind;
}) {
  const prisma = getPrisma();
  const { workspaceId, provider, syncRunId } = payload;
  const kind = payload.kind || "manual";
  const adapter = getAdapter(provider);
  const startedAt = new Date();

  await prisma.crmSyncRun.update({
    where: { id: syncRunId },
    data: { status: "running", startedAt },
  });
  await prisma.integrationConnection.updateMany({
    where: { workspaceId, provider },
    data: { syncStatus: "syncing" },
  });

  const stats = {
    contacts: 0,
    appointments: 0,
    forms: 0,
    submissions: 0,
    orders: 0,
    tickets: 0,
    audiences: 0,
    errors: 0,
  };

  try {
    const prefs = await getIntegrationPreferences(workspaceId, provider);
    if (prefs.paused) {
      throw new Error("Connection is paused");
    }
    if (!prefs.enableReads) {
      throw new Error("Reads disabled in settings");
    }

    const ctx = await buildAdapterContext(workspaceId, provider);
    const modifiedSince =
      kind === "incremental"
        ? (
            await prisma.integrationConnection.findUnique({
              where: { workspaceId_provider: { workspaceId, provider } },
            })
          )?.lastSyncAt || null
        : null;

    if (adapter.listContacts) {
      let cursor: string | null | undefined = null;
      do {
        const page = await adapter.listContacts(ctx, cursor, { modifiedSince });
        for (const c of page.items) {
          try {
            if (!prefs.autoCreateContacts) continue;
            const matched = await upsertExternalContact({
              workspaceId,
              phone: prefs.matchByPhone ? c.phone : null,
              email: prefs.matchByEmail ? c.email : c.email,
              firstName: c.firstName,
              lastName: c.lastName,
              company: c.company,
              source: provider,
              overwrite: prefs.duplicatePolicy === "update",
            });
            if (matched && c.id) {
              await upsertExternalMapping({
                workspaceId,
                provider,
                objectType: "contact",
                internalId: matched.contactId,
                externalId: String(c.id),
                lastProviderModifiedAt: c.updatedAt ? new Date(c.updatedAt) : null,
              });
              stats.contacts++;
            }
          } catch {
            stats.errors++;
          }
        }
        cursor = page.nextCursor;
      } while (cursor);
    }

    if (adapter.listAppointments) {
      const { persistAppointmentFromIntegration } = await import("./product-persist");
      let cursor: string | null | undefined = null;
      do {
        const page = await adapter.listAppointments(ctx, cursor, { modifiedSince });
        stats.appointments += page.items.length;
        for (const a of page.items) {
          if (!a.inviteePhone && !a.inviteeEmail) continue;
          try {
            const matched = await upsertExternalContact({
              workspaceId,
              phone: a.inviteePhone,
              email: a.inviteeEmail,
              firstName: a.inviteeName?.split(" ")[0],
              lastName: a.inviteeName?.split(" ").slice(1).join(" ") || null,
              source: provider,
              createIfMissing: prefs.autoCreateContacts,
            });
            if (a.id) {
              await persistAppointmentFromIntegration({
                workspaceId,
                provider,
                contactId: matched?.contactId || null,
                appointment: a,
              });
            }
          } catch {
            stats.errors++;
          }
        }
        cursor = page.nextCursor;
      } while (cursor);
    }

    if (adapter.listForms) {
      const forms = await adapter.listForms(ctx);
      stats.forms += forms.items.length;
      if (adapter.listFormSubmissions) {
        for (const form of forms.items.slice(0, kind === "initial" ? 25 : 10)) {
          if (!form.id) continue;
          if (prefs.includedIds.length && !prefs.includedIds.includes(String(form.id))) continue;
          let cursor: string | null | undefined = null;
          do {
            const page = await adapter.listFormSubmissions(ctx, String(form.id), cursor, {
              modifiedSince,
            });
            const { persistFormSubmissionFromIntegration } = await import("./product-persist");
            for (const s of page.items) {
              stats.submissions++;
              if (!s.phone && !s.email) continue;
              try {
                const matched = await upsertExternalContact({
                  workspaceId,
                  phone: s.phone,
                  email: s.email,
                  source: provider,
                });
                if (matched && s.id) {
                  await persistFormSubmissionFromIntegration({
                    workspaceId,
                    provider,
                    contactId: matched.contactId,
                    submission: { ...s, formName: form.name },
                  });
                }
              } catch {
                stats.errors++;
              }
            }
            cursor = page.nextCursor;
          } while (cursor);
        }
      }
    }

    if (adapter.listOrders) {
      const { persistOrderFromIntegration } = await import("./product-persist");
      let cursor: string | null | undefined = null;
      do {
        const page = await adapter.listOrders(ctx, cursor, { modifiedSince });
        for (const o of page.items) {
          stats.orders++;
          if (!o.customerPhone && !o.customerEmail) continue;
          try {
            const matched = await upsertExternalContact({
              workspaceId,
              phone: o.customerPhone,
              email: o.customerEmail,
              firstName: o.customerName?.split(" ")[0],
              lastName: o.customerName?.split(" ").slice(1).join(" ") || null,
              source: provider,
            });
            if (matched && o.id) {
              await upsertExternalMapping({
                workspaceId,
                provider,
                objectType: "order",
                internalId: matched.contactId,
                externalId: String(o.id),
              });
              await persistOrderFromIntegration({
                workspaceId,
                provider,
                contactId: matched.contactId,
                order: o,
              });
            }
          } catch {
            stats.errors++;
          }
        }
        cursor = page.nextCursor;
      } while (cursor);
    }

    if (adapter.listTickets) {
      let cursor: string | null | undefined = null;
      do {
        const page = await adapter.listTickets(ctx, cursor, { modifiedSince });
        for (const t of page.items) {
          stats.tickets++;
          if (!t.requesterPhone && !t.requesterEmail) continue;
          const matched = await upsertExternalContact({
            workspaceId,
            phone: t.requesterPhone,
            email: t.requesterEmail,
            source: provider,
          });
          if (matched && t.id) {
            await upsertExternalMapping({
              workspaceId,
              provider,
              objectType: "support_ticket",
              internalId: matched.contactId,
              externalId: String(t.id),
            });
          }
        }
        cursor = page.nextCursor;
      } while (cursor);
    }

    if (adapter.listAudiences) {
      const audiences = await adapter.listAudiences(ctx);
      stats.audiences = audiences.items.length;
    }

    if (adapter.refreshMetadata) {
      const existingConn = await prisma.integrationConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider } },
      });
      const prevConfig = (existingConn?.configJson || {}) as Record<string, unknown>;
      const prevMeta = (prevConfig.metadata || {}) as Record<string, unknown>;
      const meta = await adapter.refreshMetadata(ctx);

      // Calendly: diff event types → normalized event_type.* automation triggers.
      if (provider === "calendly") {
        await publishCalendlyEventTypeDiffs({
          workspaceId,
          prevEventTypes: (prevMeta.eventTypes as Array<Record<string, unknown>>) || [],
          nextEventTypes: (meta.eventTypes as Array<Record<string, unknown>>) || [],
        }).catch(() => undefined);
      }

      await prisma.integrationConnection.updateMany({
        where: { workspaceId, provider },
        data: {
          configJson: {
            ...prevConfig,
            metadata: meta,
            metadataRefreshedAt: new Date().toISOString(),
          } as object,
        },
      });
    }

    const finishedAt = new Date();
    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: stats.errors ? "partial" : "succeeded",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        statsJson: stats as object,
      },
    });
    await prisma.integrationConnection.updateMany({
      where: { workspaceId, provider },
      data: {
        syncStatus: "healthy",
        lastSyncAt: finishedAt,
        lastError: null,
      },
    });
    await appendIntegrationSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      action: "sync",
      message: `${adapter.displayName} sync ${kind} complete`,
      detail: stats,
    });
    return { ok: true, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.crmSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        lastError: message,
        statsJson: stats as object,
      },
    });
    await prisma.integrationConnection.updateMany({
      where: { workspaceId, provider },
      data: {
        syncStatus: "error",
        lastFailedSyncAt: new Date(),
        lastError: message,
      },
    });
    await appendIntegrationSyncEvent({
      workspaceId,
      syncRunId,
      provider,
      level: "error",
      action: "sync",
      message,
    });
    throw err;
  }
}

export async function enqueueIntegrationWebhookProcess(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  webhookEventId: string;
}) {
  await enqueueJob({
    jobType: "integration_webhook_process",
    queueName: integrationQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityForIntegrationKind("webhook"),
    payload: input,
    idempotencyKey: `ext-wh-${input.webhookEventId}`,
  });
}

export async function processIntegrationWebhookJob(payload: {
  workspaceId: string;
  provider: ExternalProviderId;
  webhookEventId: string;
}) {
  const prisma = getPrisma();
  const row = await prisma.crmWebhookEvent.findUnique({ where: { id: payload.webhookEventId } });
  if (!row) return { ok: false, reason: "missing" };
  if (row.status === "completed") return { ok: true, reason: "already_done" };

  await prisma.crmWebhookEvent.update({
    where: { id: row.id },
    data: { status: "processing", attempts: { increment: 1 } },
  });

  try {
    const adapter = getAdapter(payload.provider);
    if (!adapter.normalizeWebhook) throw new Error("Webhook normalize not supported");
    const events = await adapter.normalizeWebhook(
      payload.workspaceId,
      row.payloadJson,
    );
    const { publishNormalizedEvent } = await import("./events");
    for (const event of events) {
      await publishNormalizedEvent(event);
    }
    await prisma.crmWebhookEvent.update({
      where: { id: row.id },
      data: { status: "completed", processedAt: new Date(), lastError: null },
    });
    const conn = await prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: payload.workspaceId,
          provider: payload.provider,
        },
      },
    });
    if (conn) {
      await prisma.integrationConnection.update({
        where: { id: conn.id },
        data: {
          configJson: {
            ...((conn.configJson || {}) as object),
            lastWebhookAt: new Date().toISOString(),
          } as object,
        },
      });
    }
    return { ok: true, count: events.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.crmWebhookEvent.update({
      where: { id: row.id },
      data: { status: "failed", lastError: message },
    });
    throw err;
  }
}

/**
 * Diff Calendly event types between metadata refreshes and enqueue automation events.
 * Event-type lifecycle is not delivered by Calendly webhooks.
 */
async function publishCalendlyEventTypeDiffs(input: {
  workspaceId: string;
  prevEventTypes: Array<Record<string, unknown>>;
  nextEventTypes: Array<Record<string, unknown>>;
}) {
  const prevByUri = new Map(
    input.prevEventTypes
      .map((t) => [String(t.uri || t.uuid || ""), t] as const)
      .filter(([uri]) => Boolean(uri)),
  );
  const nextByUri = new Map(
    input.nextEventTypes
      .map((t) => [String(t.uri || t.uuid || ""), t] as const)
      .filter(([uri]) => Boolean(uri)),
  );

  const enqueue = async (
    eventType:
      | "event_type.created"
      | "event_type.updated"
      | "event_type.activated"
      | "event_type.deactivated",
    uri: string,
    row: Record<string, unknown>,
  ) => {
    const { makeEventIdempotencyKey } = await import("./events");
    const name = String(row.name || row.slug || uri);
    const active = row.active !== false && row.deleted !== true;
    const idempotencyKey = makeEventIdempotencyKey(
      "calendly",
      `${uri}:${eventType}:${active}`,
      eventType,
    );
    try {
      await enqueueJob({
        jobType: "integration_automation_event",
        queueName: "ext-calendly",
        workspaceId: input.workspaceId,
        priority: 35,
        idempotencyKey: `cal-etype-${idempotencyKey}`,
        payload: JSON.parse(
          JSON.stringify({
            workspaceId: input.workspaceId,
            provider: "calendly",
            eventType,
            contactId: null,
            payload: {
              eventTypeUri: uri,
              eventTypeName: name,
              active,
              schedulingUrl:
                typeof row.scheduling_url === "string" ? row.scheduling_url : null,
            },
          }),
        ),
      });
    } catch {
      // duplicate
    }
  };

  for (const [uri, next] of nextByUri) {
    const prev = prevByUri.get(uri);
    if (!prev) {
      await enqueue("event_type.created", uri, next);
      continue;
    }
    const prevActive = prev.active !== false && prev.deleted !== true;
    const nextActive = next.active !== false && next.deleted !== true;
    const changed =
      JSON.stringify({
        name: prev.name,
        active: prevActive,
        scheduling_url: prev.scheduling_url,
        duration: prev.duration,
      }) !==
      JSON.stringify({
        name: next.name,
        active: nextActive,
        scheduling_url: next.scheduling_url,
        duration: next.duration,
      });
    if (changed) {
      await enqueue("event_type.updated", uri, next);
    }
    if (!prevActive && nextActive) {
      await enqueue("event_type.activated", uri, next);
    }
    if (prevActive && !nextActive) {
      await enqueue("event_type.deactivated", uri, next);
    }
  }
}
