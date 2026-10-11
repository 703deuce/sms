import "server-only";

import { MICROSOFT_GRAPH_V1, inferMicrosoftAccountType } from "@/lib/microsoft/graph-helpers";

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function getMicrosoftClientId(): string {
  return (
    process.env.MICROSOFT_CLIENT_ID?.trim() ||
    process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim() ||
    ""
  );
}

export function getMicrosoftClientSecret(): string {
  return (
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim() ||
    ""
  );
}

export function getMicrosoftTenantId(): string {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim();
  return tenant || "common";
}

export function getMicrosoftRedirectUri(): string {
  const configured = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${appUrl()}/api/integrations/microsoft/callback`;
}

export function getMicrosoftOAuthScopes(): string {
  // Graph permission names are PascalCase; offline_access is required for refresh tokens.
  // openid/profile/email support identity; User.Read + Calendars.ReadWrite for calendar access.
  // @see https://learn.microsoft.com/en-us/graph/auth-v2-user
  return "openid profile email offline_access User.Read Calendars.ReadWrite Contacts.Read";
}

export function getMicrosoftAuthorizeUrl(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftTenantId())}/oauth2/v2.0/authorize`;
}

export function getMicrosoftTokenUrl(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftTenantId())}/oauth2/v2.0/token`;
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(getMicrosoftClientId() && getMicrosoftClientSecret());
}

export function assertMicrosoftOAuthConfigured() {
  const clientId = getMicrosoftClientId();
  const clientSecret = getMicrosoftClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

/** Extract tenant id (tid) from a Microsoft JWT without signature verification. */
export function extractMicrosoftTenantIdFromToken(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      tid?: string;
    };
    return payload.tid;
  } catch {
    return undefined;
  }
}

/** Extract Microsoft object id (oid/sub) from a JWT without signature verification. */
export function extractMicrosoftUserIdFromToken(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      oid?: string;
      sub?: string;
    };
    return payload.oid || payload.sub;
  } catch {
    return undefined;
  }
}

export async function exchangeMicrosoftAuthorizationCode(code: string): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret } = assertMicrosoftOAuthConfigured();
  const redirectUri = getMicrosoftRedirectUri();

  const res = await fetch(getMicrosoftTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: getMicrosoftOAuthScopes(),
    }),
  });

  const tokens = (await res.json()) as MicrosoftTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(tokens.error_description || tokens.error || "Microsoft token exchange failed");
  }
  return tokens;
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string,
): Promise<import("./token-errors").MicrosoftTokenRefreshResult> {
  const { classifyMicrosoftOAuthError, microsoftTokenFailureNeedsReconnect, parseMicrosoftTokenErrorBody } =
    await import("./token-errors");

  const clientId = getMicrosoftClientId();
  const clientSecret = getMicrosoftClientSecret();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      kind: "misconfigured",
      httpStatus: 0,
      error: "missing_client_credentials",
      needsReconnect: false,
    };
  }

  let res: Response;
  try {
    res = await fetch(getMicrosoftTokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: getMicrosoftOAuthScopes(),
      }),
    });
  } catch (err) {
    console.warn("[microsoft-oauth] refresh network error", err);
    return {
      ok: false,
      kind: "transient",
      httpStatus: 0,
      error: "network_error",
      errorDescription: err instanceof Error ? err.message : String(err),
      needsReconnect: false,
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const parsed = parseMicrosoftTokenErrorBody(body);
    const kind = classifyMicrosoftOAuthError({
      httpStatus: res.status,
      error: parsed.error,
      errorDescription: parsed.errorDescription,
    });
    console.warn(
      "[microsoft-oauth] refresh failed",
      res.status,
      parsed.error || "",
      (parsed.errorDescription || "").slice(0, 200),
    );
    return {
      ok: false,
      kind,
      httpStatus: res.status,
      error: parsed.error,
      errorDescription: parsed.errorDescription,
      needsReconnect: microsoftTokenFailureNeedsReconnect(kind),
    };
  }

  const json = (await res.json()) as MicrosoftTokenResponse;
  if (!json.access_token) {
    return {
      ok: false,
      kind: "unknown",
      httpStatus: res.status,
      error: "missing_access_token",
      needsReconnect: false,
    };
  }

  return {
    ok: true,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in || 3600,
    scope: json.scope,
  };
}

export async function fetchMicrosoftProfile(accessToken: string): Promise<{
  email?: string;
  displayName?: string;
  microsoftUserId?: string;
  tenantId?: string;
  accountType?: "personal" | "organizational" | "unknown";
}> {
  const tenantId = extractMicrosoftTenantIdFromToken(accessToken);
  const accountType = inferMicrosoftAccountType(tenantId);

  const res = await fetch(`${MICROSOFT_GRAPH_V1}/me?$select=id,mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return {
      microsoftUserId: extractMicrosoftUserIdFromToken(accessToken),
      ...(tenantId ? { tenantId } : {}),
      accountType,
    };
  }
  const json = (await res.json()) as {
    id?: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  return {
    email: json.mail || json.userPrincipalName,
    displayName: json.displayName,
    microsoftUserId: json.id || extractMicrosoftUserIdFromToken(accessToken),
    ...(tenantId ? { tenantId } : {}),
    accountType,
  };
}

/** Fetch the connected user's Outlook mailbox timezone (provider metadata only). */
export async function fetchMicrosoftMailboxTimezone(accessToken: string): Promise<string | undefined> {
  const res = await fetch(`${MICROSOFT_GRAPH_V1}/me/mailboxSettings?$select=timeZone`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as { timeZone?: string };
  return json.timeZone?.trim() || undefined;
}
