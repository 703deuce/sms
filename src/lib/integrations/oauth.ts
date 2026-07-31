import { createHmac, randomBytes } from "crypto";
import { getConnection, upsertConnection } from "./connections";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function googleClientId() {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    ""
  );
}

function googleClientSecret() {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    ""
  );
}

function redirectUri() {
  return `${appUrl()}/api/integrations/google/oauth/callback`;
}

function secret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

function makeState(workspaceId: string, provider: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseState(state: string): { workspaceId: string; provider: string } | null {
  const parts = state.split(":");
  if (parts.length < 4) return null;
  const [workspaceId, provider, nonce] = parts;
  const sig = parts.slice(3).join(":");
  const payload = `${workspaceId}:${provider}:${nonce}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  return { workspaceId, provider };
}

const SCOPES: Record<string, string> = {
  google_contacts: "https://www.googleapis.com/auth/contacts.readonly",
  google_sheets: "https://www.googleapis.com/auth/spreadsheets.readonly",
};

export function getGoogleIntegrationStartUrl(workspaceId: string, provider: string) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
  const scope = SCOPES[provider];
  if (!scope) throw new Error(`Unsupported Google provider: ${provider}`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state: makeState(workspaceId, provider),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeGoogleIntegrationOAuth(code: string, state: string) {
  const parsed = parseState(state);
  if (!parsed) throw new Error("Invalid OAuth state");

  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokens = await res.json();
  if (!res.ok) {
    throw new Error(tokens.error_description || tokens.error || "Token exchange failed");
  }

  await upsertConnection({
    workspaceId: parsed.workspaceId,
    provider: parsed.provider,
    status: "connected",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
    config: { scope: SCOPES[parsed.provider] },
    mergeConfig: true,
  });

  return parsed;
}

/** Return a valid Google access token for a connection, refreshing if needed. */
export async function refreshGoogleToken(
  workspaceId: string,
  provider: string,
): Promise<string | null> {
  const conn = await getConnection(workspaceId, provider);
  if (!conn) return null;

  const notExpired = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (conn.accessToken && notExpired) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken || null;

  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) return conn.accessToken || null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return conn.accessToken || null;
  const json = await res.json();

  await upsertConnection({
    workspaceId,
    provider,
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000),
    mergeConfig: true,
  });
  return json.access_token as string;
}
