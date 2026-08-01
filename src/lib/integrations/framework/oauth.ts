import { createHmac, randomBytes } from "crypto";
import { getConnection, upsertConnection, disconnectConnection } from "@/lib/integrations/connections";
import { writeIntegrationAudit } from "./audit";
import { deleteMappingsForProvider } from "./mappings";
import { getAdapter, isExternalProvider } from "./registry";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./secrets";
import type { ExternalProviderId } from "./types";

import {
  assertIntegrationRuntimeReady,
  externalOAuthCallbackUrl as buildCallbackUrl,
  getIntegrationAppUrl,
} from "./app-url";

function secret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

export function externalOAuthCallbackUrl(provider: ExternalProviderId) {
  return buildCallbackUrl(provider);
}

function makeState(workspaceId: string, provider: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseExternalOAuthState(
  state: string,
): { workspaceId: string; provider: ExternalProviderId } | null {
  const parts = state.split(":");
  if (parts.length < 4) return null;
  const [workspaceId, provider, nonce] = parts;
  const sig = parts.slice(3).join(":");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  if (!isExternalProvider(provider)) return null;
  return { workspaceId, provider };
}

function envOrThrow(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function useSandbox() {
  return (process.env.INTEGRATIONS_OAUTH_SANDBOX || "").trim() === "1";
}

export async function startExternalOAuth(workspaceId: string, provider: ExternalProviderId) {
  assertIntegrationRuntimeReady({ requireOauth: [provider] });
  const adapter = getAdapter(provider);
  if (adapter.authKind !== "oauth" || !adapter.oauth) {
    throw new Error(`${provider} does not use OAuth`);
  }
  const oauth = adapter.oauth;
  const sandbox = useSandbox() && oauth.sandboxClientIdEnv;
  const clientId = envOrThrow(
    sandbox && oauth.sandboxClientIdEnv ? oauth.sandboxClientIdEnv : oauth.clientIdEnv,
  );
  const authorizeUrl =
    sandbox && oauth.sandboxAuthorizationUrl
      ? oauth.sandboxAuthorizationUrl
      : oauth.authorizationUrl;
  const state = makeState(workspaceId, provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: externalOAuthCallbackUrl(provider),
    response_type: "code",
    state,
    ...(oauth.authorizeParams || {}),
  });
  if (oauth.scopes.length) params.set("scope", oauth.scopes.join(" "));

  await upsertConnection({
    workspaceId,
    provider,
    status: "pending_oauth",
    config: {
      authKind: "oauth",
      oauthStartedAt: new Date().toISOString(),
      sandbox: Boolean(sandbox),
    },
    mergeConfig: true,
  });

  await writeIntegrationAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "authorize_start",
    message: `Started OAuth for ${adapter.displayName}`,
  });

  return { redirectUrl: `${authorizeUrl}?${params}`, state };
}

export async function completeExternalOAuth(input: {
  code: string;
  state: string;
  extra?: Record<string, string | null | undefined>;
}) {
  const parsed = parseExternalOAuthState(input.state);
  if (!parsed) throw new Error("Invalid OAuth state");
  const { workspaceId, provider } = parsed;
  const adapter = getAdapter(provider);
  if (!adapter.oauth || !adapter.parseTokenResponse) {
    throw new Error(`${provider} OAuth adapter incomplete`);
  }

  const existing = await getConnection(workspaceId, provider);
  const sandbox = Boolean((existing?.configJson as Record<string, unknown> | null)?.sandbox);
  const oauth = adapter.oauth;
  const clientId = envOrThrow(
    sandbox && oauth.sandboxClientIdEnv ? oauth.sandboxClientIdEnv : oauth.clientIdEnv,
  );
  const clientSecret = envOrThrow(
    sandbox && oauth.sandboxClientSecretEnv
      ? oauth.sandboxClientSecretEnv
      : oauth.clientSecretEnv,
  );
  const tokenUrl =
    sandbox && oauth.sandboxTokenUrl ? oauth.sandboxTokenUrl : oauth.tokenUrl;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: externalOAuthCallbackUrl(provider),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      String(json.error_description || json.error || json.message || "Token exchange failed"),
    );
  }

  const parsedTokens = adapter.parseTokenResponse(json);
  const meta: Record<string, unknown> = {
    ...(parsedTokens.meta || {}),
    authKind: "oauth",
    scopes: oauth.scopes,
    ...(input.extra || {}),
  };

  await upsertConnection({
    workspaceId,
    provider,
    status: "connected",
    accessToken: encryptIntegrationSecret(parsedTokens.accessToken),
    refreshToken: encryptIntegrationSecret(parsedTokens.refreshToken || null),
    expiresAt: parsedTokens.expiresAt || null,
    externalId: parsedTokens.externalId || null,
    connectedAccountName: (typeof meta.accountName === "string" ? meta.accountName : null),
    config: meta,
    mergeConfig: true,
    lastError: null,
    syncStatus: "idle",
  });

  // Validate before leaving as connected
  const { buildAdapterContext } = await import("./context");
  const ctx = await buildAdapterContext(workspaceId, provider);
  const health = await adapter.validateConnection(ctx);
  if (!health.ok) {
    await upsertConnection({
      workspaceId,
      provider,
      status: "error",
      lastError: health.message || "Validation failed",
    });
    throw new Error(health.message || "Connection validation failed");
  }
  await upsertConnection({
    workspaceId,
    provider,
    status: "connected",
    externalId: health.accountId || parsedTokens.externalId || null,
    connectedAccountName: health.accountName || null,
    config: {
      ...meta,
      ...(health.details || {}),
      capabilities: health.capabilities || [],
      scopesGranted: health.scopes || oauth.scopes,
      lastValidatedAt: new Date().toISOString(),
    },
    mergeConfig: true,
  });

  await writeIntegrationAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "authorize_complete",
    message: `Connected ${adapter.displayName}`,
    detail: { accountId: health.accountId, accountName: health.accountName },
  });

  const { enqueueIntegrationSync } = await import("./sync");
  await enqueueIntegrationSync({
    workspaceId,
    provider,
    kind: "initial",
  });

  return { workspaceId, provider, health };
}

export async function refreshExternalAccessToken(
  workspaceId: string,
  provider: ExternalProviderId,
) {
  const adapter = getAdapter(provider);
  if (!adapter.oauth) throw new Error("Not an OAuth provider");
  const conn = await getConnection(workspaceId, provider);
  if (!conn?.refreshToken) throw new Error("No refresh token");
  const refresh = decryptIntegrationSecret(conn.refreshToken);
  if (!refresh) throw new Error("No refresh token");

  const sandbox = Boolean((conn.configJson as Record<string, unknown> | null)?.sandbox);
  const oauth = adapter.oauth;
  const clientId = envOrThrow(
    sandbox && oauth.sandboxClientIdEnv ? oauth.sandboxClientIdEnv : oauth.clientIdEnv,
  );
  const clientSecret = envOrThrow(
    sandbox && oauth.sandboxClientSecretEnv
      ? oauth.sandboxClientSecretEnv
      : oauth.clientSecretEnv,
  );
  const tokenUrl =
    sandbox && oauth.sandboxTokenUrl ? oauth.sandboxTokenUrl : oauth.tokenUrl;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    await upsertConnection({
      workspaceId,
      provider,
      status: "needs_reauth",
      lastError: String(json.error_description || json.error || "Refresh failed"),
    });
    throw new Error(String(json.error_description || json.error || "Refresh failed"));
  }

  const accessToken = String(json.access_token || "");
  const newRefresh = json.refresh_token ? String(json.refresh_token) : refresh;
  const expiresIn = Number(json.expires_in || 0);
  await upsertConnection({
    workspaceId,
    provider,
    status: "connected",
    accessToken: encryptIntegrationSecret(accessToken),
    refreshToken: encryptIntegrationSecret(newRefresh),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    lastError: null,
  });
  return accessToken;
}

export async function disconnectExternalIntegration(
  workspaceId: string,
  provider: ExternalProviderId,
  actorUserId?: string | null,
) {
  const adapter = getAdapter(provider);
  try {
    const { buildAdapterContext } = await import("./context");
    const ctx = await buildAdapterContext(workspaceId, provider);
    if (adapter.removeWebhooks) await adapter.removeWebhooks(ctx);
  } catch {
    // best-effort webhook cleanup
  }

  await deleteMappingsForProvider(workspaceId, provider);
  await disconnectConnection(workspaceId, provider);
  await upsertConnection({
    workspaceId,
    provider,
    status: "disconnected",
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    externalId: null,
    connectedAccountName: null,
    lastError: null,
    config: { authKind: adapter.authKind, disconnectedAt: new Date().toISOString() },
  });

  await writeIntegrationAudit({
    workspaceId,
    provider,
    category: "oauth",
    action: "disconnect",
    message: `Disconnected ${adapter.displayName}`,
    actorUserId,
  });
  return { ok: true };
}

export function oauthEnvReady(provider: ExternalProviderId): {
  ready: boolean;
  missing: string[];
  callbackUrl: string;
  appUrl: string;
} {
  const adapter = getAdapter(provider);
  const missing: string[] = [];
  if (adapter.authKind !== "oauth" || !adapter.oauth) {
    return {
      ready: false,
      missing: ["not_oauth"],
      callbackUrl: externalOAuthCallbackUrl(provider),
      appUrl: getIntegrationAppUrl(),
    };
  }
  if (!process.env[adapter.oauth.clientIdEnv]?.trim()) missing.push(adapter.oauth.clientIdEnv);
  if (!process.env[adapter.oauth.clientSecretEnv]?.trim()) {
    missing.push(adapter.oauth.clientSecretEnv);
  }
  if (!process.env.APP_URL?.trim() && !process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    missing.push("APP_URL");
  }
  if (!process.env.INTEGRATION_SECRET_KEY?.trim()) missing.push("INTEGRATION_SECRET_KEY");
  return {
    ready: missing.length === 0,
    missing,
    callbackUrl: externalOAuthCallbackUrl(provider),
    appUrl: getIntegrationAppUrl(),
  };
}
