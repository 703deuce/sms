import { getPrisma } from "@/lib/db";
import { createHmac, randomBytes } from "crypto";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function oauthState(connectionId: string, workspaceId: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${connectionId}:${workspaceId}:${nonce}`;
  const secret =
    process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

function parseOAuthState(state: string): { connectionId: string; workspaceId: string } | null {
  const parts = state.split(":");
  if (parts.length < 4) return null;
  const connectionId = parts[0];
  const workspaceId = parts[1];
  const nonce = parts[2];
  const sig = parts.slice(3).join(":");
  const payload = `${connectionId}:${workspaceId}:${nonce}`;
  const secret =
    process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (sig !== expected) return null;
  return { connectionId, workspaceId };
}

export function getGoogleOAuthStartUrl(connectionId: string, workspaceId: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID not configured");
  const redirect = `${appUrl()}/api/voice/calendars/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state: oauthState(connectionId, workspaceId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function getMicrosoftOAuthStartUrl(connectionId: string, workspaceId: string) {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
  if (!clientId) throw new Error("MICROSOFT_CALENDAR_CLIENT_ID not configured");
  const redirect = `${appUrl()}/api/voice/calendars/oauth/microsoft/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "offline_access Calendars.ReadWrite",
    state: oauthState(connectionId, workspaceId),
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

export async function completeGoogleOAuth(code: string, state: string) {
  const parsed = parseOAuthState(state);
  if (!parsed) throw new Error("Invalid OAuth state");

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const redirect = `${appUrl()}/api/voice/calendars/oauth/google/callback`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(tokens.error_description || tokens.error || "Token exchange failed");

  await getPrisma().voiceCalendarConnection.update({
    where: { id: parsed.connectionId },
    data: {
      status: "connected",
      config: {
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
    },
  });
  return parsed;
}

export async function completeMicrosoftOAuth(code: string, state: string) {
  const parsed = parseOAuthState(state);
  if (!parsed) throw new Error("Invalid OAuth state");

  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Microsoft OAuth not configured");

  const redirect = `${appUrl()}/api/voice/calendars/oauth/microsoft/callback`;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(tokens.error_description || tokens.error || "Token exchange failed");

  await getPrisma().voiceCalendarConnection.update({
    where: { id: parsed.connectionId },
    data: {
      status: "connected",
      config: {
        provider: "microsoft",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
    },
  });
  return parsed;
}
