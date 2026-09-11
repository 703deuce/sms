import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { refreshExternalAccessToken } from "@/lib/integrations/framework/oauth";
import { getAdapter } from "@/lib/integrations/framework/registry";
import { ensureFreshCrmToken } from "@/lib/crm/oauth";
import { getConnector } from "@/lib/crm/registry";
import { getCrmSyncPreferences } from "@/lib/crm/settings";
import {
  asCrmProviderId,
  asNativeProviderId,
  getWorkspaceIntegration,
  isWorkspaceIntegrationConnected,
} from "./workspace-integration";
import type { CertProviderId, ValidateConnectionResult } from "./types";

/**
 * Prove credentials are usable — not merely present.
 * Makes a harmless provider API request; refreshes OAuth once on expiry when supported.
 */
export async function validateIntegrationConnection(
  workspaceId: string,
  provider: CertProviderId,
): Promise<ValidateConnectionResult> {
  const view = await getWorkspaceIntegration({ workspaceId, provider });
  if (!isWorkspaceIntegrationConnected(view)) {
    return {
      ok: false,
      message: view
        ? `Connection status=${view.status} — not connected or missing credentials`
        : "No integration connection record for workspace",
      refreshed: false,
    };
  }

  const crmId = asCrmProviderId(provider);
  if (crmId) {
    return validateCrmConnection(workspaceId, crmId);
  }

  const nativeId = asNativeProviderId(provider);
  if (nativeId) {
    return validateNativeConnection(workspaceId, nativeId);
  }

  return { ok: false, message: `Unsupported provider ${provider}`, refreshed: false };
}

async function validateCrmConnection(
  workspaceId: string,
  provider: NonNullable<ReturnType<typeof asCrmProviderId>>,
): Promise<ValidateConnectionResult> {
  const connector = getConnector(provider);

  async function probe(refreshed: boolean): Promise<ValidateConnectionResult> {
    const conn = await ensureFreshCrmToken(workspaceId, provider);
    if (!conn?.accessToken) {
      return { ok: false, message: "Missing access token after refresh", refreshed };
    }
    const health = await connector.validateConnection({
      workspaceId,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      meta: (conn.configJson || {}) as Record<string, unknown>,
      preferences: await getCrmSyncPreferences(workspaceId, provider),
    });
    return {
      ok: health.ok,
      message: health.ok
        ? health.message || `API reachable (${health.externalAccountName || health.externalAccountId || "ok"})`
        : health.message || "CRM API validation failed",
      refreshed,
      externalAccountId: health.externalAccountId,
      externalAccountName: health.externalAccountName,
    };
  }

  let result = await probe(false);
  if (result.ok) return result;

  const lower = result.message.toLowerCase();
  const maybeExpired =
    lower.includes("401") ||
    lower.includes("expired") ||
    lower.includes("invalid_grant") ||
    lower.includes("unauthorized");

  if (!maybeExpired) return result;

  try {
    await ensureFreshCrmToken(workspaceId, provider);
    result = await probe(true);
    return { ...result, refreshed: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      refreshed: true,
    };
  }
}

async function validateNativeConnection(
  workspaceId: string,
  provider: NonNullable<ReturnType<typeof asNativeProviderId>>,
): Promise<ValidateConnectionResult> {
  const adapter = getAdapter(provider);

  async function probe(refreshed: boolean): Promise<ValidateConnectionResult> {
    const ctx = await buildAdapterContext(workspaceId, provider);
    const health = await adapter.validateConnection(ctx);
    return {
      ok: health.ok,
      message: health.ok
        ? health.message || `API reachable (${health.accountName || health.accountId || "ok"})`
        : health.message || "Native integration API validation failed",
      refreshed,
      externalAccountId: health.accountId,
      externalAccountName: health.accountName,
    };
  }

  let result = await probe(false);
  if (result.ok) return result;

  const lower = result.message.toLowerCase();
  const maybeExpired =
    adapter.authKind === "oauth" &&
    (lower.includes("401") ||
      lower.includes("expired") ||
      lower.includes("invalid_grant") ||
      lower.includes("unauthorized"));

  if (!maybeExpired) return result;

  try {
    await refreshExternalAccessToken(workspaceId, provider);
    result = await probe(true);
    return { ...result, refreshed: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      refreshed: true,
    };
  }
}
