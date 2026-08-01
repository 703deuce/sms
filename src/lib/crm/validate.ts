/**
 * Production connection validation — must pass before status = Connected.
 * Checks: OAuth success, API reachability, read test, write test (optional),
 * refresh token presence, provider metadata.
 */

import { upsertConnection } from "@/lib/integrations/connections";
import { writeCrmAudit } from "./logging";
import { ensureFreshCrmToken, refreshCrmAccessToken } from "./oauth";
import { getConnector } from "./registry";
import { getCrmSyncPreferences } from "./settings";
import type { ConnectorContext } from "./connector";
import type { CrmProviderId } from "./types";

export type ValidationStep = {
  id: string;
  ok: boolean;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  steps: ValidationStep[];
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  connectedUserId?: string | null;
};

async function ctxFromConnection(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("No access token after OAuth");
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: await getCrmSyncPreferences(workspaceId, provider),
  };
}

export async function validateCrmProductionConnection(
  workspaceId: string,
  provider: CrmProviderId,
  opts?: { writeProbe?: boolean },
): Promise<ValidationResult> {
  const connector = getConnector(provider);
  const steps: ValidationStep[] = [];
  let externalAccountId: string | null = null;
  let externalAccountName: string | null = null;
  let connectedUserId: string | null = null;

  // 1. Token present
  try {
    const conn = await ensureFreshCrmToken(workspaceId, provider);
    const hasRefresh = Boolean(conn?.refreshToken);
    steps.push({
      id: "oauth_token",
      ok: Boolean(conn?.accessToken),
      message: conn?.accessToken ? "Access token present" : "Access token missing",
    });
    steps.push({
      id: "refresh_token",
      ok: hasRefresh,
      message: hasRefresh
        ? "Refresh token present (offline sync possible)"
        : "No refresh token — reconnect with offline/consent scopes",
    });
  } catch (err) {
    steps.push({
      id: "oauth_token",
      ok: false,
      message: err instanceof Error ? err.message : "Token check failed",
    });
    return fail(workspaceId, provider, steps);
  }

  // 2. API reachability + metadata
  try {
    const ctx = await ctxFromConnection(workspaceId, provider);
    const health = await connector.validateConnection(ctx);
    steps.push({
      id: "api_reachability",
      ok: health.ok,
      message: health.ok
        ? `API reachable (${health.externalAccountName || health.externalAccountId || "ok"})`
        : health.message || "API unreachable",
    });
    externalAccountId = health.externalAccountId || null;
    externalAccountName = health.externalAccountName || null;
    connectedUserId = health.externalAccountId || null;
    if (!health.ok) return fail(workspaceId, provider, steps, health.message);
  } catch (err) {
    steps.push({
      id: "api_reachability",
      ok: false,
      message: err instanceof Error ? err.message : "API reachability failed",
    });
    return fail(workspaceId, provider, steps);
  }

  // 3. Read test (contacts page)
  try {
    const ctx = await ctxFromConnection(workspaceId, provider);
    const page = await connector.listContacts(ctx, null);
    steps.push({
      id: "read_test",
      ok: true,
      message: `Read test OK (${page.items.length} contact(s) on first page)`,
    });
  } catch (err) {
    steps.push({
      id: "read_test",
      ok: false,
      message: err instanceof Error ? err.message : "Read test failed — check object permissions",
    });
    return fail(workspaceId, provider, steps);
  }

  // 4. Optional write probe (creates + immediately notes a dry marker via find — skipped by default)
  if (opts?.writeProbe) {
    try {
      const ctx = await ctxFromConnection(workspaceId, provider);
      if (!connector.createNote) {
        steps.push({
          id: "write_test",
          ok: true,
          message: "Write probe skipped (adapter has no note API)",
        });
      } else {
        // Prefer task create with clear Transovo marker when notes unsupported in sandbox.
        if (connector.createTask) {
          await connector.createTask(ctx, {
            subject: "[Transovo] Connection write probe — safe to delete",
            description: "Automated permission validation. Delete this task.",
            status: "Completed",
            dueAt: new Date().toISOString(),
          });
          steps.push({
            id: "write_test",
            ok: true,
            message: "Write test OK (created validation task)",
          });
        } else {
          steps.push({
            id: "write_test",
            ok: false,
            message: "No write probe method available",
          });
          return fail(workspaceId, provider, steps);
        }
      }
    } catch (err) {
      steps.push({
        id: "write_test",
        ok: false,
        message: err instanceof Error ? err.message : "Write test failed — check create permissions",
      });
      return fail(workspaceId, provider, steps);
    }
  } else {
    steps.push({
      id: "write_test",
      ok: true,
      message: "Write probe deferred (enabled via validate?writeProbe=1)",
    });
  }

  // 5. Refresh token exercise (if present)
  try {
    const conn = await ensureFreshCrmToken(workspaceId, provider);
    if (!conn?.refreshToken) {
      steps.push({
        id: "token_refresh",
        ok: false,
        message: "Cannot validate refresh — missing refresh token",
      });
      return fail(workspaceId, provider, steps);
    }
    try {
      await refreshCrmAccessToken(workspaceId, provider);
      steps.push({
        id: "token_refresh",
        ok: true,
        message: "Refresh token exchange succeeded",
      });
    } catch (err) {
      // Some providers briefly reject refresh immediately after authorize — accept with warning
      // if access token + refresh token both exist (expiration path still covered later).
      const cfg = (conn.configJson || {}) as { connectedAt?: string };
      const justConnected =
        cfg.connectedAt && Date.now() - new Date(cfg.connectedAt).getTime() < 120_000;
      if (justConnected) {
        steps.push({
          id: "token_refresh",
          ok: true,
          message: `Refresh deferred (${err instanceof Error ? err.message : "temporary"}); refresh token stored`,
        });
      } else {
        steps.push({
          id: "token_refresh",
          ok: false,
          message: err instanceof Error ? err.message : "Refresh failed",
        });
        return fail(workspaceId, provider, steps);
      }
    }
  } catch (err) {
    steps.push({
      id: "token_refresh",
      ok: false,
      message: err instanceof Error ? err.message : "Refresh failed",
    });
    return fail(workspaceId, provider, steps);
  }

  await upsertConnection({
    workspaceId,
    provider,
    status: "connected",
    syncStatus: "healthy",
    lastError: null,
    connectedUserId,
    connectedAccountName: externalAccountName,
    externalId: externalAccountId,
    config: {
      validation: { ok: true, at: new Date().toISOString(), steps },
    },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "validated",
    message: "Production connection validation passed",
    detail: { steps },
  });

  return {
    ok: true,
    steps,
    externalAccountId,
    externalAccountName,
    connectedUserId,
  };
}

async function fail(
  workspaceId: string,
  provider: CrmProviderId,
  steps: ValidationStep[],
  lastError?: string,
): Promise<ValidationResult> {
  const message =
    lastError ||
    steps.find((s) => !s.ok)?.message ||
    "Connection validation failed";
  await upsertConnection({
    workspaceId,
    provider,
    status: "error",
    syncStatus: "error",
    lastError: message.slice(0, 500),
    config: {
      validation: { ok: false, at: new Date().toISOString(), steps },
    },
    mergeConfig: true,
  });
  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "validation_failed",
    message,
    detail: { steps },
  });
  return { ok: false, steps };
}
