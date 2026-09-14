#!/usr/bin/env npx tsx
/**
 * READ-ONLY Microsoft OAuth + connection audit (no token refresh, no DB mutation).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/microsoft-oauth-production-audit.ts
 */
process.env.CERTIFICATION_READ_ONLY = "1";
process.env.TRANSOVO_OAUTH_MUTATION_SOURCE = "certification";

import { getPrisma } from "../src/lib/db";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import {
  getMicrosoftAuthorizeUrl,
  getMicrosoftOAuthScopes,
  getMicrosoftRedirectUri,
  getMicrosoftTokenUrl,
  isMicrosoftOAuthConfigured,
} from "../src/lib/microsoft/oauth-config";
import { snapshotMicrosoftConnectionDiagnostics } from "../src/lib/microsoft/connection-diagnostics";
import type { CalendarConfig } from "../src/lib/calendar/providers";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

function line(k: string, v: string) {
  console.log(`${k.padEnd(36, ".")} ${v}`);
}

async function main() {
  const cfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const connId = cfg.calendarId || "";
  const prisma = getPrisma();
  const conn = connId
    ? await prisma.voiceCalendarConnection.findFirst({
        where: { id: connId, workspaceId: WORKSPACE_ID, provider: "microsoft" },
      })
    : null;

  console.log("\n=== MICROSOFT OAUTH (app config) ===\n");
  line("AUTHORIZATION ENDPOINT", getMicrosoftAuthorizeUrl());
  line("TOKEN ENDPOINT", getMicrosoftTokenUrl());
  line("redirect_uri used by app", getMicrosoftRedirectUri());
  line(
    "redirect URI platform type in Entra",
    "VERIFY IN PORTAL — must be Web, not SPA (SPA refresh = 24h per Microsoft docs)",
  );
  line("scopes requested", getMicrosoftOAuthScopes());
  line("offline_access in scopes", getMicrosoftOAuthScopes().includes("offline_access") ? "YES" : "NO");
  line("Calendars.ReadWrite in scopes", getMicrosoftOAuthScopes().includes("Calendars.ReadWrite") ? "YES" : "NO");
  line("CERTIFICATION_HOST_OAUTH_CONFIGURED", isMicrosoftOAuthConfigured() ? "YES" : "NO");
  line("PRODUCTION_WEB_OAUTH_CONFIGURED", "UNVERIFIED");

  if (!conn) {
    line("connection row", "MISSING");
    return;
  }

  const snap = snapshotMicrosoftConnectionDiagnostics({
    connectionId: conn.id,
    status: conn.status,
    config: (conn.config || {}) as CalendarConfig,
  });

  console.log("\n=== CONNECTION (DB, read-only) ===\n");
  line("connection id", snap.connectionId);
  line("status", snap.status);
  line("refresh token present", snap.refreshTokenPresent ? "YES" : "NO");
  line("access token expiry", snap.accessTokenExpiresAt || "unknown");
  line("access token valid now (no refresh)", snap.accessTokenCurrentlyValid ? "YES" : "NO");
  line("lastTokenRefreshAt (stored)", snap.lastTokenRefreshAt || "never");
  line("lastTokenRefreshKind (stored)", snap.lastTokenRefreshKind || "none");
  line("lastTokenRefreshError (stored)", snap.lastTokenRefreshError || "none");
  line("lastTokenRefreshSource (stored)", snap.lastTokenRefreshSource || "unknown");
  line("lastTokenRefreshBuildSha (stored)", snap.lastTokenRefreshBuildSha || "unknown");
  line("post-connect verification OK", snap.lastVerificationOk === true ? "YES" : "NO/UNKNOWN");
  line("granted scopes (stored)", snap.grantedScopes || "unknown");

  console.log("\n=== LIVE REFRESH (skipped) ===\n");
  line(
    "getValidAccessToken",
    "SKIPPED — certification host must not refresh production tokens. Test from production web after deploy.",
  );
  line("PRODUCTION_REFRESH_AFTER_EXPIRY", "UNVERIFIED");

  if (
    snap.lastTokenRefreshError === "missing_client_credentials" &&
    snap.lastTokenRefreshSource !== "production_web"
  ) {
    line(
      "CERTIFICATION_POLLUTION_SUSPECT",
      "stored error may be from non-production diagnostic; check lastTokenRefreshSource",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
