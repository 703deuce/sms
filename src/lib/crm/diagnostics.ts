/**
 * CRM Compatibility / Test Console probes.
 * Support-facing diagnostics so operators don't need SSH/logs for common failures.
 */

import { getPrisma } from "@/lib/db";
import type { ConnectorContext } from "./connector";
import { checkCrmEnvironment } from "./env-check";
import { isFeatureSupported } from "./feature-matrix";
import { CrmHttpError } from "./http";
import { humanizeCrmError } from "./human-errors";
import { writeCrmAudit } from "./logging";
import {
  ensureFreshCrmToken,
  getDecryptedCrmConnection,
  refreshCrmAccessToken,
} from "./oauth";
import { getConnector } from "./registry";
import { getCrmSyncPreferences } from "./settings";
import { enqueueCrmSync } from "./sync-engine";
import type { CrmProviderId } from "./types";

export type ProbeId =
  | "env"
  | "oauth"
  | "token_refresh"
  | "api_reachable"
  | "contact_create"
  | "lead_create"
  | "task_create"
  | "call_logging"
  | "sms_logging"
  | "recording_attach"
  | "transcript_attach"
  | "webhook_delivery"
  | "rate_limit"
  | "force_resync"
  | "retry_failed";

export type ProbeResult = {
  id: ProbeId;
  label: string;
  ok: boolean;
  skipped?: boolean;
  message: string;
  humanMessage: string;
  durationMs: number;
  raw?: unknown;
  externalId?: string | null;
};

export type DiagnosticsSnapshot = {
  provider: CrmProviderId;
  connected: boolean;
  tokenValid: boolean;
  tokenStatus: string;
  lastSyncAt: string | null;
  lastFailedSyncAt: string | null;
  lastError: string | null;
  objectsSynced: Record<string, number>;
  queue: {
    pending: number;
    failed: number;
    deadLetters: number;
    webhookPending: number;
  };
  rateLimit: {
    recent429: number;
    status: "ok" | "throttled" | "unknown";
  };
  envReady: boolean;
  callbackUrl: string;
};

const PROBE_LABELS: Record<ProbeId, string> = {
  env: "Environment variables",
  oauth: "OAuth connection",
  token_refresh: "Token refresh",
  api_reachable: "API reachable",
  contact_create: "Contact creation",
  lead_create: "Lead creation",
  task_create: "Task creation",
  call_logging: "Call logging",
  sms_logging: "SMS logging",
  recording_attach: "Recording attachment",
  transcript_attach: "Transcript attachment",
  webhook_delivery: "Webhook delivery",
  rate_limit: "Rate-limit status",
  force_resync: "Force initial resync",
  retry_failed: "Retry failed syncs",
};

async function buildCtx(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: await getCrmSyncPreferences(workspaceId, provider),
  };
}

async function runTimed(
  id: ProbeId,
  fn: () => Promise<Omit<ProbeResult, "id" | "label" | "durationMs" | "humanMessage">>,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      id,
      label: PROBE_LABELS[id],
      durationMs: Date.now() - started,
      humanMessage: humanizeCrmError(result.message),
      ...result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const raw = err instanceof CrmHttpError ? err.body : undefined;
    return {
      id,
      label: PROBE_LABELS[id],
      ok: false,
      message,
      humanMessage: humanizeCrmError(err),
      durationMs: Date.now() - started,
      raw,
    };
  }
}

export async function getCrmDiagnosticsSnapshot(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<DiagnosticsSnapshot> {
  const prisma = getPrisma();
  const env = checkCrmEnvironment(provider);
  const conn = await getDecryptedCrmConnection(workspaceId, provider);

  const [
    objectGroups,
    pending,
    failed,
    deadLetters,
    webhookPending,
    recent429,
  ] = await Promise.all([
    prisma.crmObjectMapping.groupBy({
      by: ["objectType"],
      where: { workspaceId, provider },
      _count: { _all: true },
    }),
    prisma.jobQueue.count({
      where: {
        workspaceId,
        jobType: { in: ["crm_sync", "crm_push_event"] },
        status: { in: ["pending", "deferred", "processing"] },
      },
    }),
    prisma.jobQueue.count({
      where: {
        workspaceId,
        jobType: { in: ["crm_sync", "crm_push_event"] },
        status: "failed",
      },
    }),
    prisma.crmDeadLetter.count({
      where: { workspaceId, provider, resolvedAt: null },
    }),
    prisma.crmWebhookEvent.count({
      where: { workspaceId, provider, status: "pending" },
    }),
    prisma.crmSyncEvent.count({
      where: {
        workspaceId,
        provider,
        level: "error",
        message: { contains: "429" },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
  ]);

  const objectsSynced: Record<string, number> = {};
  for (const g of objectGroups) {
    objectsSynced[g.objectType] = g._count._all;
  }

  const tokenStatus =
    !conn?.accessToken
      ? "missing"
      : conn.status === "needs_reauth"
        ? "needs_reauth"
        : conn.expiresAt && conn.expiresAt.getTime() < Date.now()
          ? "expired"
          : conn.refreshToken
            ? "refreshable"
            : "access_only";

  return {
    provider,
    connected: conn?.status === "connected",
    tokenValid:
      Boolean(conn?.accessToken) &&
      conn?.status !== "needs_reauth" &&
      !(conn?.expiresAt && conn.expiresAt.getTime() < Date.now()),
    tokenStatus,
    lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
    lastFailedSyncAt: conn?.lastFailedSyncAt?.toISOString() || null,
    lastError: conn?.lastError || null,
    objectsSynced,
    queue: { pending, failed, deadLetters, webhookPending },
    rateLimit: {
      recent429,
      status: recent429 > 0 ? "throttled" : "ok",
    },
    envReady: env.providers[0]?.oauthReady ?? false,
    callbackUrl: env.callbackUrl,
  };
}

export async function runCrmDiagnosticProbe(input: {
  workspaceId: string;
  provider: CrmProviderId;
  probe: ProbeId;
  actorUserId?: string;
}): Promise<ProbeResult> {
  const { workspaceId, provider, probe, actorUserId } = input;
  const connector = getConnector(provider);
  const marker = `transovo-diag-${Date.now().toString(36)}`;

  const result = await (async (): Promise<ProbeResult> => {
    switch (probe) {
      case "env":
        return runTimed("env", async () => {
          const check = checkCrmEnvironment(provider);
          const missing = check.providers[0]?.missing || [];
          return {
            ok: check.providers[0]?.oauthReady ?? false,
            message: missing.length
              ? `Missing: ${missing.join(", ")}`
              : `Env ready. Callback must be exactly: ${check.callbackUrl}`,
            raw: check,
          };
        });

      case "oauth":
      case "api_reachable":
        return runTimed(probe === "oauth" ? "oauth" : "api_reachable", async () => {
          const ctx = await buildCtx(workspaceId, provider);
          const health = await connector.validateConnection(ctx);
          return {
            ok: health.ok,
            message: health.ok
              ? `Connected as ${health.externalAccountName || health.externalAccountId || "ok"}`
              : health.message || "OAuth/API check failed",
            raw: health,
          };
        });

      case "token_refresh":
        return runTimed("token_refresh", async () => {
          const conn = await getDecryptedCrmConnection(workspaceId, provider);
          if (!conn?.refreshToken) {
            return {
              ok: false,
              message: "No refresh token — reconnect with offline/consent scopes",
            };
          }
          const refreshed = await refreshCrmAccessToken(workspaceId, provider);
          return {
            ok: Boolean(refreshed?.accessToken),
            message: refreshed?.accessToken
              ? "Refresh token exchange succeeded"
              : "Refresh returned no access token",
            raw: {
              expiresAt: refreshed?.expiresAt?.toISOString() || null,
              status: refreshed?.status,
            },
          };
        });

      case "contact_create":
        return runTimed("contact_create", async () => {
          if (!isFeatureSupported(provider, "contacts")) {
            return {
              ok: true,
              skipped: true,
              message: "Contacts unsupported for this provider",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const created = await connector.upsertContact(ctx, {
            firstName: "Transovo",
            lastName: `Diag ${marker}`,
            email: `${marker}@example.invalid`,
            phone: null,
            companyName: "Transovo Diagnostics",
            source: "Transovo Diagnostics",
          });
          return {
            ok: Boolean(created.externalId),
            message: `Probe contact ${created.created ? "created" : "upserted"}`,
            externalId: created.externalId,
            raw: created,
          };
        });

      case "lead_create":
        return runTimed("lead_create", async () => {
          if (!isFeatureSupported(provider, "leads") || !connector.upsertLead) {
            return {
              ok: true,
              skipped: true,
              message: "Leads unsupported — skipped gracefully",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const created = await connector.upsertLead(ctx, {
            firstName: "Transovo",
            lastName: `Lead ${marker}`,
            email: `${marker}-lead@example.invalid`,
            phone: null,
            companyName: "Transovo Diagnostics",
            source: "Transovo Diagnostics",
          });
          return {
            ok: Boolean(created.externalId),
            message: `Probe lead ${created.created ? "created" : "upserted"}`,
            externalId: created.externalId,
            raw: created,
          };
        });

      case "task_create":
        return runTimed("task_create", async () => {
          if (!isFeatureSupported(provider, "tasks") || !connector.createTask) {
            return {
              ok: true,
              skipped: true,
              message: "Tasks unsupported — skipped",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const created = await connector.createTask(ctx, {
            subject: `[Transovo] Diagnostics task ${marker} — safe to delete`,
            description: "Automated CRM diagnostics probe. Delete anytime.",
            status: "Completed",
            dueAt: new Date().toISOString(),
          });
          return {
            ok: Boolean(created.externalId),
            message: "Probe task created",
            externalId: created.externalId,
            raw: created,
          };
        });

      case "call_logging":
        return runTimed("call_logging", async () => {
          if (!isFeatureSupported(provider, "calls") || !connector.logCall) {
            return {
              ok: true,
              skipped: true,
              message: "Call logging unsupported — skipped",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const created = await connector.logCall(ctx, {
            direction: "outbound",
            from: "+15555550100",
            to: "+15555550199",
            durationSeconds: 42,
            disposition: "completed",
            notes: `[Transovo] Diagnostics call ${marker}`,
            recordingUrl: null,
            transcriptText: null,
            transcriptUrl: null,
            aiSummary: null,
            contactExternalId: null,
            startedAt: new Date().toISOString(),
          });
          if (created.externalId) {
            const { persistMappedCallActivity } = await import("./call-lifecycle");
            await persistMappedCallActivity({
              workspaceId,
              provider,
              callId: `diag-call-${marker}`,
              externalId: created.externalId,
            }).catch(() => undefined);
          }
          return {
            ok: Boolean(created.externalId),
            message: "Probe call logged",
            externalId: created.externalId,
            raw: created,
          };
        });

      case "sms_logging":
        return runTimed("sms_logging", async () => {
          if (!isFeatureSupported(provider, "sms") || !connector.logSms) {
            return {
              ok: true,
              skipped: true,
              message: "SMS logging unsupported — skipped",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const created = await connector.logSms(ctx, {
            direction: "outbound",
            from: "+15555550100",
            to: "+15555550199",
            body: `[Transovo] Diagnostics SMS ${marker}`,
            status: "delivered",
            sentAt: new Date().toISOString(),
            contactExternalId: null,
          });
          return {
            ok: Boolean(created.externalId),
            message: "Probe SMS logged",
            externalId: created.externalId,
            raw: created,
          };
        });

      case "recording_attach":
        return runTimed("recording_attach", async () => {
          if (!isFeatureSupported(provider, "recording_links") || !connector.logCall) {
            return {
              ok: true,
              skipped: true,
              message: "Recording links unsupported — skipped",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const { getMappedCallActivity, persistMappedCallActivity } = await import(
            "./call-lifecycle"
          );
          const mapped = await getMappedCallActivity({
            workspaceId,
            provider,
            callId: `diag-call-${marker}`,
          });
          const result = await connector.logCall(ctx, {
            id: mapped?.externalId || undefined,
            direction: "inbound",
            from: "+15555550111",
            to: "+15555550122",
            durationSeconds: 90,
            disposition: "completed",
            notes: `[Transovo] Diagnostics recording ${marker}`,
            recordingUrl: `https://example.invalid/recordings/${marker}.mp3`,
            transcriptText: null,
            transcriptUrl: null,
            aiSummary: null,
            contactExternalId: null,
            startedAt: new Date().toISOString(),
          });
          await persistMappedCallActivity({
            workspaceId,
            provider,
            callId: `diag-call-${marker}`,
            externalId: result.externalId,
          }).catch(() => undefined);
          return {
            ok: Boolean(result.externalId),
            message: mapped?.externalId
              ? "Updated existing probe call with recording URL"
              : "Probe call with recording URL logged",
            externalId: result.externalId,
            raw: result,
          };
        });

      case "transcript_attach":
        return runTimed("transcript_attach", async () => {
          if (!isFeatureSupported(provider, "transcript_links") || !connector.logCall) {
            return {
              ok: true,
              skipped: true,
              message: "Transcript links unsupported — skipped",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const { getMappedCallActivity, persistMappedCallActivity } = await import(
            "./call-lifecycle"
          );
          const mapped = await getMappedCallActivity({
            workspaceId,
            provider,
            callId: `diag-call-${marker}`,
          });
          const result = await connector.logCall(ctx, {
            id: mapped?.externalId || undefined,
            direction: "inbound",
            from: "+15555550133",
            to: "+15555550144",
            durationSeconds: 120,
            disposition: "completed",
            notes: `[Transovo] Diagnostics transcript ${marker}`,
            recordingUrl: null,
            transcriptText: `Diagnostics transcript ${marker}`,
            transcriptUrl: `https://example.invalid/transcripts/${marker}.txt`,
            aiSummary: null,
            contactExternalId: null,
            startedAt: new Date().toISOString(),
          });
          await persistMappedCallActivity({
            workspaceId,
            provider,
            callId: `diag-call-${marker}`,
            externalId: result.externalId,
          }).catch(() => undefined);
          return {
            ok: Boolean(result.externalId),
            message: mapped?.externalId
              ? "Updated existing probe call with transcript URL"
              : "Probe call with transcript URL logged",
            externalId: result.externalId,
            raw: result,
          };
        });

      case "webhook_delivery":
        return runTimed("webhook_delivery", async () => {
          if (!isFeatureSupported(provider, "webhooks_inbound")) {
            return {
              ok: true,
              skipped: true,
              message:
                "Inbound CRM webhooks unsupported for this provider edition — outbound Transovo events still push to the CRM",
            };
          }
          if (!connector.handleWebhook) {
            return {
              ok: false,
              message: "Adapter missing handleWebhook despite webhooks_inbound support",
            };
          }
          const ctx = await buildCtx(workspaceId, provider);
          const probe = await connector.handleWebhook(
            ctx,
            { "x-transovo-probe": "1" },
            { source: "transovo_diagnostics", type: "probe" },
          );
          return {
            ok: Boolean(probe?.accepted),
            message: probe?.accepted
              ? "Webhook handler accepted diagnostics probe payload"
              : "Webhook handler rejected probe payload",
            raw: probe,
          };
        });

      case "rate_limit":
        return runTimed("rate_limit", async () => {
          const snap = await getCrmDiagnosticsSnapshot(workspaceId, provider);
          return {
            ok: snap.rateLimit.status !== "throttled",
            message:
              snap.rateLimit.status === "throttled"
                ? `${snap.rateLimit.recent429} rate-limit error(s) in the last hour`
                : "No recent rate-limit errors",
            raw: snap.rateLimit,
          };
        });

      case "force_resync":
        return runTimed("force_resync", async () => {
          const run = await enqueueCrmSync({
            workspaceId,
            provider,
            kind: "initial",
            triggeredBy: actorUserId || "diagnostics",
          });
          return {
            ok: true,
            message: `Initial resync queued (${run.id})`,
            raw: { syncRunId: run.id },
            externalId: run.id,
          };
        });

      case "retry_failed":
        return runTimed("retry_failed", async () => {
          const prisma = getPrisma();
          const failed = await prisma.jobQueue.findMany({
            where: {
              workspaceId,
              jobType: { in: ["crm_sync", "crm_push_event"] },
              status: "failed",
            },
            take: 25,
            orderBy: { updatedAt: "desc" },
          });
          let retried = 0;
          for (const job of failed) {
            await prisma.jobQueue.update({
              where: { id: job.id },
              data: {
                status: "pending",
                runAfter: new Date(),
                lastError: null,
                lockedAt: null,
              },
            });
            retried += 1;
          }
          const dead = await prisma.crmDeadLetter.updateMany({
            where: { workspaceId, provider, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
          return {
            ok: true,
            message: `Requeued ${retried} failed job(s); marked ${dead.count} dead-letter(s) resolved for retry cycle`,
            raw: { retried, deadLettersResolved: dead.count },
          };
        });

      default:
        return {
          id: probe,
          label: PROBE_LABELS[probe] || probe,
          ok: false,
          message: `Unknown probe: ${probe}`,
          humanMessage: "Unknown diagnostics action",
          durationMs: 0,
        };
    }
  })();

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "diagnostics",
    action: probe,
    message: result.ok
      ? `Diagnostics OK: ${result.label}`
      : `Diagnostics failed: ${result.label} — ${result.message}`,
    actorUserId,
    detail: {
      ok: result.ok,
      skipped: result.skipped,
      durationMs: result.durationMs,
      externalId: result.externalId,
    },
  });

  return result;
}

export const DIAGNOSTIC_PROBE_IDS: ProbeId[] = [
  "env",
  "oauth",
  "token_refresh",
  "api_reachable",
  "contact_create",
  "lead_create",
  "task_create",
  "call_logging",
  "sms_logging",
  "recording_attach",
  "transcript_attach",
  "webhook_delivery",
  "rate_limit",
  "force_resync",
  "retry_failed",
];
