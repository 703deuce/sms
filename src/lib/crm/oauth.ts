/**
 * Reusable OAuth system for CRM providers.
 * Adapters supply URLs/scopes; the framework owns authorize → callback → store → refresh → revoke.
 */

import { createHmac, randomBytes } from "crypto";
import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { assertCrmOAuthEnv } from "./env-check";
import { getConnector, isCrmProvider } from "./registry";
import { writeCrmAudit } from "./logging";
import { decryptCrmSecret, encryptCrmSecret } from "./secrets";
import type { CrmProviderId } from "./types";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function secret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

export function crmOAuthCallbackUrl() {
  return `${appUrl()}/api/crm/oauth/callback`;
}

function makeState(workspaceId: string, provider: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseCrmOAuthState(
  state: string,
): { workspaceId: string; provider: CrmProviderId } | null {
  const parts = state.split(":");
  if (parts.length < 4) return null;
  const [workspaceId, provider, nonce] = parts;
  const sig = parts.slice(3).join(":");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  if (!isCrmProvider(provider)) return null;
  return { workspaceId, provider };
}

function envOrThrow(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

/** Zoho multi-DC: map callback `location` → Accounts host for token exchange. */
const ZOHO_ACCOUNTS_BY_LOCATION: Record<string, string> = {
  us: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.com.au",
  jp: "https://accounts.zoho.jp",
  ca: "https://accounts.zohocloud.ca",
  sa: "https://accounts.zoho.sa",
  uk: "https://accounts.zoho.uk",
  cn: "https://accounts.zoho.com.cn",
};

export function resolveZohoAccountsServer(input?: {
  accountsServer?: string | null;
  location?: string | null;
}): string {
  const fromEnv = process.env.ZOHO_ACCOUNTS_DOMAIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const explicit = input?.accountsServer?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const loc = (input?.location || "").trim().toLowerCase();
  if (loc && ZOHO_ACCOUNTS_BY_LOCATION[loc]) return ZOHO_ACCOUNTS_BY_LOCATION[loc];
  return "https://accounts.zoho.com";
}

function tokenEndpointForProvider(
  provider: CrmProviderId,
  connectorTokenUrl: string,
  opts?: { accountsServer?: string | null; location?: string | null; storedAccountsServer?: string | null },
) {
  if (provider === "zoho") {
    const host = resolveZohoAccountsServer({
      accountsServer: opts?.accountsServer || opts?.storedAccountsServer,
      location: opts?.location,
    });
    return `${host}/oauth/v2/token`;
  }
  return connectorTokenUrl;
}

/** Build the provider authorize URL and mark connection pending_oauth. */
export async function startCrmOAuth(workspaceId: string, provider: CrmProviderId) {
  assertCrmOAuthEnv(provider);
  const connector = getConnector(provider);
  const clientId = envOrThrow(connector.oauth.clientIdEnv);
  const state = makeState(workspaceId, provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: crmOAuthCallbackUrl(),
    response_type: "code",
    state,
    ...(connector.oauth.authorizeParams || {}),
  });
  // Bigin uses ZohoBigin.* scopes when the workspace selected that product profile.
  let scopes = connector.oauth.scopes;
  if (provider === "zoho") {
    try {
      const { getCrmSyncPreferences } = await import("./settings");
      const { scopesForProvider } = await import("./scopes");
      const prefs = await getCrmSyncPreferences(workspaceId, provider);
      scopes = scopesForProvider("zoho", { zohoProduct: prefs.zohoProduct || "crm" });
    } catch {
      // keep connector defaults
    }
  }
  if (scopes.length) {
    params.set("scope", scopes.join(" "));
  }
  // Google-style offline access when requested by adapter authorizeParams or Salesforce/Zoho.
  if (!params.has("access_type") && connector.oauth.scopes.includes("offline_access")) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  await upsertConnection({
    workspaceId,
    provider,
    status: "pending_oauth",
    config: { oauthStartedAt: new Date().toISOString() },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "authorize_start",
    message: `Started OAuth for ${connector.displayName}`,
  });

  return {
    redirectUrl: `${connector.oauth.authorizationUrl}?${params}`,
    state,
  };
}

export async function completeCrmOAuth(
  code: string,
  state: string,
  opts?: { accountsServer?: string | null; location?: string | null },
) {
  const parsed = parseCrmOAuthState(state);
  if (!parsed) throw new Error("Invalid OAuth state");
  const { workspaceId, provider } = parsed;
  const connector = getConnector(provider);
  const clientId = envOrThrow(connector.oauth.clientIdEnv);
  const clientSecret = envOrThrow(connector.oauth.clientSecretEnv);

  const existing = await getConnection(workspaceId, provider);
  const prevConfig = (existing?.configJson || {}) as Record<string, unknown>;
  const tokenUrl = tokenEndpointForProvider(provider, connector.oauth.tokenUrl, {
    accountsServer: opts?.accountsServer,
    location: opts?.location,
    storedAccountsServer:
      typeof prevConfig.accountsServer === "string" ? prevConfig.accountsServer : null,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: crmOAuthCallbackUrl(),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      String(json.error_description || json.error || json.message || `Token exchange failed (${res.status})`);
    await upsertConnection({
      workspaceId,
      provider,
      status: "error",
      config: { lastOAuthError: msg, accountsServerUsed: tokenUrl },
      mergeConfig: true,
    });
    await writeCrmAudit({
      workspaceId,
      provider,
      category: "oauth",
      action: "token_exchange_failed",
      message: msg,
      detail: { ...json, tokenUrl },
    });
    throw new Error(msg);
  }

  const parsedTokens = connector.parseTokenResponse(json);
  const accountsServer =
    provider === "zoho"
      ? resolveZohoAccountsServer({
          accountsServer:
            (typeof json.accounts_server === "string" && json.accounts_server) ||
            opts?.accountsServer ||
            (typeof parsedTokens.meta?.accountsServer === "string"
              ? String(parsedTokens.meta.accountsServer)
              : null),
          location:
            (typeof json.location === "string" && json.location) || opts?.location || null,
        })
      : null;

  const priorRefresh = decryptCrmSecret(existing?.refreshToken) || existing?.refreshToken || null;
  await upsertConnection({
    workspaceId,
    provider,
    status: "pending_oauth",
    syncStatus: "idle",
    accessToken: encryptCrmSecret(parsedTokens.accessToken),
    refreshToken: encryptCrmSecret(parsedTokens.refreshToken ?? priorRefresh),
    expiresAt: parsedTokens.expiresAt ?? null,
    externalId: parsedTokens.externalId ?? existing?.externalId ?? null,
    lastError: null,
    config: {
      ...prevConfig,
      ...(parsedTokens.meta || {}),
      ...(accountsServer ? { accountsServer } : {}),
      ...(opts?.location ? { zohoLocation: opts.location } : {}),
      lastOAuthError: null,
      connectedAt: new Date().toISOString(),
      tokensEncrypted: Boolean(process.env.INTEGRATION_SECRET_KEY?.trim()),
    },
    mergeConfig: false,
  });

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "token_exchanged",
    message: `OAuth tokens stored for ${connector.displayName} — running validation`,
    detail: { externalId: parsedTokens.externalId },
  });

  // Production gate: do not mark Connected until validation passes.
  const { validateCrmProductionConnection } = await import("./validate");
  const validation = await validateCrmProductionConnection(workspaceId, provider);
  if (!validation.ok) {
    throw new Error(
      validation.steps.find((s) => !s.ok)?.message || "CRM connection validation failed",
    );
  }

  return { workspaceId, provider, validation };
}

/** Connection row with decrypted tokens for API use. */
export async function getDecryptedCrmConnection(workspaceId: string, provider: CrmProviderId) {
  const conn = await getConnection(workspaceId, provider);
  if (!conn) return null;
  return {
    ...conn,
    accessToken: decryptCrmSecret(conn.accessToken),
    refreshToken: decryptCrmSecret(conn.refreshToken),
  };
}

/** Refresh access token when expired or near expiry. */
export async function refreshCrmAccessToken(workspaceId: string, provider: CrmProviderId) {
  const connector = getConnector(provider);
  const conn = await getDecryptedCrmConnection(workspaceId, provider);
  if (!conn?.refreshToken) {
    await upsertConnection({ workspaceId, provider, status: "needs_reauth" });
    throw new Error("No refresh token — reconnect required");
  }

  const clientId = envOrThrow(connector.oauth.clientIdEnv);
  const clientSecret = envOrThrow(connector.oauth.clientSecretEnv);
  const cfg = (conn.configJson || {}) as Record<string, unknown>;
  const tokenUrl = tokenEndpointForProvider(provider, connector.oauth.tokenUrl, {
    storedAccountsServer: typeof cfg.accountsServer === "string" ? cfg.accountsServer : null,
    location: typeof cfg.zohoLocation === "string" ? cfg.zohoLocation : null,
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    await upsertConnection({ workspaceId, provider, status: "needs_reauth" });
    await writeCrmAudit({
      workspaceId,
      provider,
      category: "oauth",
      action: "refresh_failed",
      message: String(json.error_description || json.error || "Refresh failed"),
      detail: { ...json, tokenUrl },
    });
    throw new Error("Token refresh failed — reconnect required");
  }

  const parsedTokens = connector.parseTokenResponse(json);
  await upsertConnection({
    workspaceId,
    provider,
    status: "connected",
    accessToken: encryptCrmSecret(parsedTokens.accessToken),
    refreshToken: encryptCrmSecret(parsedTokens.refreshToken ?? conn.refreshToken),
    expiresAt: parsedTokens.expiresAt ?? null,
    config: {
      ...(parsedTokens.meta || {}),
      ...(typeof cfg.accountsServer === "string" ? { accountsServer: cfg.accountsServer } : {}),
      ...(typeof cfg.zohoLocation === "string" ? { zohoLocation: cfg.zohoLocation } : {}),
    },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "token_refreshed",
    message: "Access token refreshed",
  });

  return getDecryptedCrmConnection(workspaceId, provider);
}

export async function ensureFreshCrmToken(workspaceId: string, provider: CrmProviderId) {
  const conn = await getDecryptedCrmConnection(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");
  if (conn.status === "needs_reauth") throw new Error("CRM needs reauthentication");
  const skewMs = 2 * 60 * 1000;
  if (conn.expiresAt && conn.expiresAt.getTime() - Date.now() < skewMs) {
    return refreshCrmAccessToken(workspaceId, provider);
  }
  return conn;
}

export async function disconnectCrm(workspaceId: string, provider: CrmProviderId, userId?: string) {
  const { disconnectConnection } = await import("@/lib/integrations/connections");
  await disconnectConnection(workspaceId, provider);
  await writeCrmAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "disconnected",
    message: "CRM disconnected",
    actorUserId: userId,
  });
}
