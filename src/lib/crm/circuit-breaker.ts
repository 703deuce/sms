/**
 * Connection quarantine when permanent validation errors repeat.
 * Soft state lives on IntegrationConnection.configJson.
 */

import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { writeCrmAudit } from "./logging";
import type { CrmProviderId } from "./types";

const QUARANTINE_THRESHOLD = 5;

export async function noteCrmPermanentFailure(input: {
  workspaceId: string;
  provider: CrmProviderId;
  message: string;
}) {
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = (conn?.configJson || {}) as {
    circuit?: { failures?: number; quarantinedAt?: string | null; lastError?: string };
  };
  const failures = (cfg.circuit?.failures || 0) + 1;
  const quarantined = failures >= QUARANTINE_THRESHOLD;
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    status: quarantined ? "error" : conn?.status,
    syncStatus: quarantined ? "quarantined" : conn?.syncStatus,
    lastError: input.message.slice(0, 500),
    config: {
      circuit: {
        failures,
        quarantinedAt: quarantined
          ? cfg.circuit?.quarantinedAt || new Date().toISOString()
          : null,
        lastError: input.message.slice(0, 500),
      },
    },
    mergeConfig: true,
  }).catch(() => undefined);

  if (quarantined) {
    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "health",
      action: "quarantined",
      message: `Connection quarantined after ${failures} permanent failures`,
      detail: { lastError: input.message.slice(0, 200) },
    }).catch(() => undefined);
    await notifyCrmHealthAlert({
      workspaceId: input.workspaceId,
      provider: input.provider,
      title: `${input.provider} CRM quarantined`,
      body: `Sync paused after repeated permanent failures: ${input.message.slice(0, 160)}`,
    });
  }
  return { failures, quarantined };
}

export async function noteCrmSuccess(input: {
  workspaceId: string;
  provider: CrmProviderId;
}) {
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = (conn?.configJson || {}) as { circuit?: { failures?: number } };
  if (!cfg.circuit?.failures) return;
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    config: {
      circuit: { failures: 0, quarantinedAt: null, lastError: null },
    },
    mergeConfig: true,
  }).catch(() => undefined);
}

export async function isCrmQuarantined(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<boolean> {
  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.configJson || {}) as {
    circuit?: { quarantinedAt?: string | null; failures?: number };
  };
  return Boolean(cfg.circuit?.quarantinedAt) || (cfg.circuit?.failures || 0) >= QUARANTINE_THRESHOLD;
}

/** Admin action — clear quarantine so sync/push can resume after CRM access is fixed. */
export async function clearCrmQuarantine(input: {
  workspaceId: string;
  provider: CrmProviderId;
  actorUserId?: string | null;
}) {
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    status: "connected",
    syncStatus: "idle",
    lastError: null,
    config: {
      circuit: { failures: 0, quarantinedAt: null, lastError: null },
    },
    mergeConfig: true,
  });
  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "health",
    action: "quarantine_cleared",
    message: "CRM quarantine cleared",
    actorUserId: input.actorUserId || undefined,
  }).catch(() => undefined);
  return { ok: true };
}

export async function notifyCrmHealthAlert(input: {
  workspaceId: string;
  provider: CrmProviderId;
  title: string;
  body: string;
}) {
  try {
    const { notifyWorkspace } = await import("@/lib/notifications/in-app");
    await notifyWorkspace(input.workspaceId, {
      type: "system",
      title: input.title,
      body: input.body,
      href: `/integrations/crm/${input.provider}`,
    });
  } catch {
    // notifications are best-effort
  }
}
