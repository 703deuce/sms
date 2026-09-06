import "server-only";

import { MICROSOFT_GRAPH_V1 } from "@/lib/microsoft/graph-helpers";

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
  // @see https://learn.microsoft.com/en-us/graph/auth-v2-user
  return "User.Read Calendars.ReadWrite offline_access";
}

export function getMicrosoftAuthorizeUrl(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftTenantId())}/oauth2/v2.0/authorize`;
}

export function getMicrosoftTokenUrl(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftTenantId())}/oauth2/v2.0/token`;
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
};

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
): Promise<MicrosoftTokenResponse | null> {
  const clientId = getMicrosoftClientId();
  const clientSecret = getMicrosoftClientSecret();
  if (!clientId || !clientSecret) return null;

  const res = await fetch(getMicrosoftTokenUrl(), {
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      "[microsoft-oauth] refresh failed",
      res.status,
      body.slice(0, 500) || res.statusText,
    );
    return null;
  }
  return (await res.json()) as MicrosoftTokenResponse;
}

export async function fetchMicrosoftProfile(accessToken: string): Promise<{
  email?: string;
  displayName?: string;
}> {
  const res = await fetch(`${MICROSOFT_GRAPH_V1}/me?$select=mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  const json = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  return {
    email: json.mail || json.userPrincipalName,
    displayName: json.displayName,
  };
}
