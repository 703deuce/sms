import { getPrisma } from "@/lib/db";
import {
  assertMicrosoftOAuthConfigured,
  exchangeMicrosoftAuthorizationCode,
  fetchMicrosoftProfile,
  getMicrosoftAuthorizeUrl,
  getMicrosoftOAuthScopes,
  getMicrosoftRedirectUri,
} from "@/lib/microsoft/oauth-config";
import { createHmac, randomBytes } from "crypto";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function oauthSecret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

function oauthState(connectionId: string, workspaceId: string, returnTo?: string) {
  const nonce = randomBytes(16).toString("hex");
  const returnSegment = returnTo ? Buffer.from(returnTo, "utf8").toString("base64url") : "";
  const payload = `${connectionId}:${workspaceId}:${nonce}:${returnSegment}`;
  const sig = createHmac("sha256", oauthSecret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseOAuthState(
  state: string,
): { connectionId: string; workspaceId: string; returnTo?: string } | null {
  const parts = state.split(":");
  if (parts.length < 5) return null;
  const connectionId = parts[0];
  const workspaceId = parts[1];
  const nonce = parts[2];
  const returnSegment = parts[3] || "";
  const sig = parts.slice(4).join(":");
  const payload = `${connectionId}:${workspaceId}:${nonce}:${returnSegment}`;
  const expected = createHmac("sha256", oauthSecret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  const returnTo = returnSegment
    ? Buffer.from(returnSegment, "base64url").toString("utf8")
    : undefined;
  return { connectionId, workspaceId, returnTo };
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

export function getMicrosoftOAuthStartUrl(
  connectionId: string,
  workspaceId: string,
  returnTo?: string,
) {
  const { clientId } = assertMicrosoftOAuthConfigured();
  const redirect = getMicrosoftRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    response_mode: "query",
    scope: getMicrosoftOAuthScopes(),
    state: oauthState(connectionId, workspaceId, returnTo),
    prompt: "consent",
  });
  return `${getMicrosoftAuthorizeUrl()}?${params}`;
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

  const tokens = await exchangeMicrosoftAuthorizationCode(code);
  const profile = await fetchMicrosoftProfile(tokens.access_token);
  const label = profile.displayName || profile.email || "Microsoft Outlook";

  await getPrisma().voiceCalendarConnection.update({
    where: { id: parsed.connectionId },
    data: {
      status: "connected",
      name: label,
      config: {
        provider: "microsoft",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email: profile.email,
        displayName: profile.displayName,
      },
    },
  });
  return parsed;
}

export function microsoftOAuthSuccessRedirect(returnTo?: string) {
  const base = appUrl();
  const safeReturn =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  if (safeReturn) {
    const url = new URL(safeReturn, base);
    url.searchParams.set("oauth", "microsoft_ok");
    return url.toString();
  }
  return `${base}/voice/calendars?oauth=microsoft_ok`;
}

export function microsoftOAuthErrorRedirect(error: string, returnTo?: string) {
  const base = appUrl();
  const safeReturn =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  if (safeReturn) {
    const url = new URL(safeReturn, base);
    url.searchParams.set("oauth_error", error);
    return url.toString();
  }
  return `${base}/voice/calendars?oauth_error=${encodeURIComponent(error)}`;
}
