import { getPrisma } from "@/lib/db";
import {
  assertMicrosoftOAuthConfigured,
  exchangeMicrosoftAuthorizationCode,
  fetchMicrosoftMailboxTimezone,
  fetchMicrosoftProfile,
  getMicrosoftAuthorizeUrl,
  getMicrosoftOAuthScopes,
  getMicrosoftRedirectUri,
} from "@/lib/microsoft/oauth-config";
import { createHmac, randomBytes } from "crypto";
import type { CalendarConfig } from "@/lib/calendar/providers";

import {
  CALENDAR_INTEGRATIONS_PATH,
  GOOGLE_OAUTH_CALLBACK_PATH,
  LEGACY_GOOGLE_OAUTH_CALLBACK_PATH,
} from "./constants";

export {
  CALENDAR_INTEGRATIONS_PATH,
  GOOGLE_OAUTH_CALLBACK_PATH,
  LEGACY_GOOGLE_OAUTH_CALLBACK_PATH,
};

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

export function getGoogleOAuthCallbackPath() {
  return GOOGLE_OAUTH_CALLBACK_PATH;
}

function googleRedirectUri(path = GOOGLE_OAUTH_CALLBACK_PATH) {
  return `${appUrl()}${path}`;
}

export function getGoogleOAuthStartUrl(
  connectionId: string,
  workspaceId: string,
  returnTo?: string,
  callbackPath = GOOGLE_OAUTH_CALLBACK_PATH,
) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID not configured");
  const redirect = googleRedirectUri(callbackPath);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state: oauthState(connectionId, workspaceId, returnTo),
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

export async function completeGoogleOAuth(
  code: string,
  state: string,
  callbackPath = GOOGLE_OAUTH_CALLBACK_PATH,
) {
  const parsed = parseOAuthState(state);
  if (!parsed) throw new Error("Invalid OAuth state");

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const redirect = googleRedirectUri(callbackPath);
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
        calendarId: "primary",
      },
    },
  });
  return parsed;
}

export async function completeMicrosoftOAuth(code: string, state: string) {
  const parsed = parseOAuthState(state);
  if (!parsed) throw new Error("Invalid OAuth state");

  const existing = await getPrisma().voiceCalendarConnection.findUnique({
    where: { id: parsed.connectionId },
  });
  const priorConfig = (existing?.config || {}) as CalendarConfig;
  const firstConnect = !priorConfig.accessToken && !priorConfig.refreshToken;

  const tokens = await exchangeMicrosoftAuthorizationCode(code);
  const profile = await fetchMicrosoftProfile(tokens.access_token);
  const mailboxTimezone = await fetchMicrosoftMailboxTimezone(tokens.access_token).catch(() => undefined);
  const label = profile.displayName || profile.email || "Microsoft Outlook";

  const refreshToken = tokens.refresh_token || priorConfig.refreshToken;
  if (firstConnect && !refreshToken) {
    throw new Error(
      "Microsoft did not return a refresh token. Ensure offline_access is granted and the redirect URI is registered as Web (not SPA) in Entra.",
    );
  }

  const config: CalendarConfig = {
    ...priorConfig,
    provider: "microsoft",
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
    grantedScopes: tokens.scope || priorConfig.grantedScopes,
    email: profile.email || priorConfig.email,
    displayName: profile.displayName || priorConfig.displayName,
    microsoftUserId: profile.microsoftUserId || priorConfig.microsoftUserId,
    ...(profile.tenantId ? { tenantId: profile.tenantId } : {}),
    accountType: profile.accountType || priorConfig.accountType || "unknown",
    ...(mailboxTimezone ? { mailboxTimezone } : {}),
    lastVerifiedAt: undefined,
    lastVerificationOk: undefined,
    lastVerificationError: null,
    lastGraphError: null,
    ...(firstConnect ? { syncEnabled: false } : {}),
  };

  await getPrisma().voiceCalendarConnection.update({
    where: { id: parsed.connectionId },
    data: {
      status: "connected",
      name: label,
      config: config as object,
    },
  });

  try {
    const { canonicalizeMicrosoftConnectionAfterOAuth } = await import(
      "@/lib/calendar/microsoft-canonical-connection"
    );
    const canonical = await canonicalizeMicrosoftConnectionAfterOAuth({
      workspaceId: parsed.workspaceId,
      activeConnectionId: parsed.connectionId,
      identity: {
        microsoftUserId: profile.microsoftUserId,
        tenantId: profile.tenantId,
        email: profile.email,
      },
      oauthConfig: config,
    });
    if (canonical.redirectedFromId || canonical.disconnectedIds.length) {
      console.info(
        "[calendar] microsoft_oauth_canonicalized",
        JSON.stringify({
          workspaceId: parsed.workspaceId,
          canonicalConnectionId: canonical.canonicalConnectionId,
          redirectedFromId: canonical.redirectedFromId,
          disconnectedIds: canonical.disconnectedIds,
        }),
      );
      parsed.connectionId = canonical.canonicalConnectionId;
    }
  } catch (err) {
    console.warn(
      "[calendar] microsoft_oauth_canonicalize_failed",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const { migrateMctbAiBookingMicrosoftConnectionPointers } = await import(
      "@/lib/mctb/ai-booking/microsoft-connection"
    );
    const migration = await migrateMctbAiBookingMicrosoftConnectionPointers({
      workspaceId: parsed.workspaceId,
      activeConnectionId: parsed.connectionId,
    });
    if (migration.migrated) {
      console.info(
        "[mctb/ai-booking] microsoft_oauth_pointer_migrated",
        JSON.stringify({
          workspaceId: parsed.workspaceId,
          fromId: migration.fromId,
          toId: migration.toId,
          reason: migration.reason,
        }),
      );
    }
  } catch (err) {
    console.warn(
      "[mctb/ai-booking] microsoft_oauth_pointer_migration_failed",
      err instanceof Error ? err.message : err,
    );
  }

  return parsed;
}

function safeReturnRedirect(oauthKey: string, returnTo?: string, error?: string) {
  const base = appUrl();
  const safeReturn =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  const path = safeReturn || CALENDAR_INTEGRATIONS_PATH;
  const url = new URL(path, base);
  if (error) {
    url.searchParams.set("oauth_error", error);
  } else {
    url.searchParams.set("oauth", oauthKey);
  }
  return url.toString();
}

export function microsoftOAuthSuccessRedirect(returnTo?: string) {
  return safeReturnRedirect("microsoft_ok", returnTo);
}

export function microsoftOAuthErrorRedirect(error: string, returnTo?: string) {
  return safeReturnRedirect("", returnTo, error);
}

export function googleOAuthSuccessRedirect(returnTo?: string) {
  return safeReturnRedirect("google_ok", returnTo);
}

export function googleOAuthErrorRedirect(error: string, returnTo?: string) {
  return safeReturnRedirect("", returnTo, error);
}
