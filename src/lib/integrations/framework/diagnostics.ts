import { getPrisma } from "@/lib/db";
import { getConnection } from "@/lib/integrations/connections";
import { writeIntegrationAudit } from "./audit";
import { buildAdapterContext } from "./context";
import { oauthEnvReady } from "./oauth";
import { getAdapter } from "./registry";
import { getIntegrationPreferences } from "./settings";
import type { ExternalProviderId } from "./types";

export async function getIntegrationDiagnosticsSnapshot(
  workspaceId: string,
  provider: ExternalProviderId,
) {
  const adapter = getAdapter(provider);
  const conn = await getConnection(workspaceId, provider);
  const prefs = await getIntegrationPreferences(workspaceId, provider);
  const prisma = getPrisma();

  const [mappingCount, pendingJobs, failedJobs, deadLetters, recentWebhooks, recentSyncs] =
    await Promise.all([
      prisma.crmObjectMapping.count({ where: { workspaceId, provider } }),
      prisma.jobQueue.count({
        where: {
          workspaceId,
          status: { in: ["pending", "processing", "deferred"] },
          jobType: { startsWith: "integration_" },
        },
      }),
      prisma.jobQueue.count({
        where: {
          workspaceId,
          status: "failed",
          jobType: { startsWith: "integration_" },
        },
      }),
      prisma.crmDeadLetter.count({ where: { workspaceId, provider } }),
      prisma.crmWebhookEvent.count({ where: { workspaceId, provider } }),
      prisma.crmSyncRun.findMany({
        where: { workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  const env =
    adapter.authKind === "oauth"
      ? oauthEnvReady(provider)
      : { ready: true, missing: [] as string[], callbackUrl: null };

  return {
    provider,
    displayName: adapter.displayName,
    authKind: adapter.authKind,
    status: conn?.status || "disconnected",
    syncStatus: conn?.syncStatus || "idle",
    accountId: conn?.externalId || null,
    accountName: conn?.connectedAccountName || null,
    lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
    lastFailedSyncAt: conn?.lastFailedSyncAt?.toISOString() || null,
    lastError: conn?.lastError || null,
    lastWebhookAt: (cfg.lastWebhookAt as string) || null,
    lastValidatedAt: (cfg.lastValidatedAt as string) || null,
    capabilities: cfg.capabilities || adapter.capabilities,
    scopes: cfg.scopesGranted || adapter.oauth?.scopes || [],
    paused: prefs.paused,
    preferences: {
      enableReads: prefs.enableReads,
      enableWrites: prefs.enableWrites,
      webhooks: prefs.webhooks,
      autoCreateContacts: prefs.autoCreateContacts,
    },
    counts: {
      mappings: mappingCount,
      pendingJobs,
      failedJobs,
      deadLetters,
      webhooks: recentWebhooks,
    },
    recentSyncs: recentSyncs.map(
      (s: {
        id: string;
        kind: string;
        status: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        lastError: string | null;
      }) => ({
        id: s.id,
        kind: s.kind,
        status: s.status,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        lastError: s.lastError,
      }),
    ),
    env,
    secretsPresent: {
      accessToken: Boolean(conn?.accessToken),
      refreshToken: Boolean(conn?.refreshToken),
    },
  };
}

export async function runIntegrationProbe(
  workspaceId: string,
  provider: ExternalProviderId,
  probe:
    | "validate"
    | "identify"
    | "read"
    | "write"
    | "force_sync"
    | "register_webhooks",
  actorUserId?: string | null,
) {
  const adapter = getAdapter(provider);
  const started = Date.now();
  try {
    if (probe === "force_sync") {
      const { enqueueIntegrationSync } = await import("./sync");
      const run = await enqueueIntegrationSync({
        workspaceId,
        provider,
        kind: "manual",
        triggeredBy: actorUserId,
      });
      return { ok: true, probe, durationMs: Date.now() - started, data: { syncRunId: run.id } };
    }

    const ctx = await buildAdapterContext(workspaceId, provider);

    if (probe === "validate") {
      const health = await adapter.validateConnection(ctx);
      await writeIntegrationAudit({
        workspaceId,
        provider,
        category: "diagnostics",
        action: "probe_validate",
        message: health.ok ? "Validate OK" : health.message || "Validate failed",
        actorUserId,
      });
      return { ok: health.ok, probe, durationMs: Date.now() - started, data: health };
    }

    if (probe === "identify") {
      const id = await adapter.identifyAccount(ctx);
      return { ok: true, probe, durationMs: Date.now() - started, data: id };
    }

    if (probe === "read") {
      const sample: Record<string, unknown> = {};
      if (adapter.listContacts) {
        sample.contacts = (await adapter.listContacts(ctx, null)).items.slice(0, 3);
      } else if (adapter.listForms) {
        sample.forms = (await adapter.listForms(ctx)).items.slice(0, 3);
      } else if (adapter.listAppointments) {
        sample.appointments = (await adapter.listAppointments(ctx)).items.slice(0, 3);
      } else if (adapter.listOrders) {
        sample.orders = (await adapter.listOrders(ctx)).items.slice(0, 3);
      } else if (adapter.listTickets) {
        sample.tickets = (await adapter.listTickets(ctx)).items.slice(0, 3);
      }
      return { ok: true, probe, durationMs: Date.now() - started, data: sample };
    }

    if (probe === "write") {
      if (!adapter.createTestRecord) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "Write probe not supported",
        };
      }
      const created = await adapter.createTestRecord(ctx);
      const readBack = adapter.readTestRecord
        ? await adapter.readTestRecord(ctx, created.objectType, created.externalId)
        : null;
      if (adapter.updateTestRecord) {
        await adapter.updateTestRecord(ctx, created.objectType, created.externalId);
      }
      if (adapter.cleanupTestRecord) {
        await adapter.cleanupTestRecord(ctx, created.objectType, created.externalId);
      }
      return {
        ok: true,
        probe,
        durationMs: Date.now() - started,
        data: { created, readBack: Boolean(readBack) },
      };
    }

    if (probe === "register_webhooks") {
      if (!adapter.registerWebhooks) {
        return {
          ok: false,
          probe,
          durationMs: Date.now() - started,
          error: "Webhook registration unsupported",
        };
      }
      const { externalWebhookUrl } = await import("./app-url");
      const url = externalWebhookUrl(provider);
      const result = await adapter.registerWebhooks(ctx, url);
      return { ok: true, probe, durationMs: Date.now() - started, data: result };
    }

    return { ok: false, probe, durationMs: Date.now() - started, error: "Unknown probe" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeIntegrationAudit({
      workspaceId,
      provider,
      category: "diagnostics",
      action: `probe_${probe}`,
      message,
      actorUserId,
    });
    return { ok: false, probe, durationMs: Date.now() - started, error: message };
  }
}
