#!/usr/bin/env npx tsx
/**
 * Microsoft OAuth + AI Booking readiness audit for a workspace connection.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/microsoft-oauth-production-audit.ts
 */
import { getPrisma } from "../src/lib/db";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "../src/lib/mctb/ai-booking/readiness";
import {
  getMicrosoftAuthorizeUrl,
  getMicrosoftOAuthScopes,
  getMicrosoftRedirectUri,
  getMicrosoftTokenUrl,
  isMicrosoftOAuthConfigured,
  refreshMicrosoftAccessToken,
} from "../src/lib/microsoft/oauth-config";
import { getMicrosoftCalendarCapabilities } from "../src/lib/microsoft/calendar-capabilities";
import {
  getValidAccessToken,
  hasOAuthTokens,
  listMicrosoftCalendarsForConnection,
  type CalendarConfig,
} from "../src/lib/microsoft/token-manager";
import { findAvailableTimes } from "../src/lib/mctb/ai-booking/service";
import { resolveCanonicalBookingTimezone } from "../src/lib/mctb/ai-booking/booking-timezone";

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
  line("OAuth client on this host", isMicrosoftOAuthConfigured() ? "CONFIGURED" : "MISSING_ENV");

  if (!conn) {
    line("connection row", "MISSING");
    return;
  }

  const calCfg = (conn.config || {}) as CalendarConfig;
  console.log("\n=== CONNECTION (DB) ===\n");
  line("connection id", conn.id);
  line("status", conn.status);
  line("refresh token present", hasOAuthTokens(calCfg) && Boolean(calCfg.refreshToken) ? "YES" : "NO");
  line(
    "access token expiry",
    calCfg.expiresAt ? new Date(calCfg.expiresAt).toISOString() : "unknown",
  );
  line("last successful refresh", calCfg.lastTokenRefreshAt || "never");
  line("last refresh error", calCfg.lastTokenRefreshError || "none");
  line("granted scopes (stored)", calCfg.grantedScopes || calCfg.scope || "unknown");

  console.log("\n=== TOKEN REFRESH PROBE ===\n");
  const token = await getValidAccessToken(conn.id, "microsoft", calCfg);
  line("getValidAccessToken", token ? "PASS" : "FAIL");

  if (calCfg.refreshToken && isMicrosoftOAuthConfigured()) {
    const raw = await refreshMicrosoftAccessToken(calCfg.refreshToken);
    line(
      "refresh rotation (new refresh_token in response)",
      raw.ok && raw.refreshToken ? "YES" : raw.ok ? "NO (Microsoft omitted — keep stored)" : "N/A",
    );
    if (!raw.ok) {
      line("refresh error kind", raw.kind);
      line("needs reconnect", raw.needsReconnect ? "YES" : "NO");
    }
  }

  const caps = await getMicrosoftCalendarCapabilities(WORKSPACE_ID, {
    calendarConnectionId: conn.id,
  });
  console.log("\n=== GRAPH READINESS ===\n");
  line("health", caps.health);
  line("can read events", caps.canReadEvents ? "YES" : "NO");
  line("calendar selected", caps.calendarSelected ? "YES" : "NO");
  line("calendar writable", caps.calendarEditable ? "YES" : "NO");
  line("can create booking", caps.canCreateBooking ? "YES" : "NO");

  if (token) {
    try {
      const cals = await listMicrosoftCalendarsForConnection(conn.id, calCfg);
      line("calendar list/read", cals.length ? `PASS (${cals.length})` : "FAIL (empty)");
    } catch (e) {
      line("calendar list/read", `FAIL (${e instanceof Error ? e.message : e})`);
    }
  }

  const readiness = await evaluateMctbAiBookingReadiness(WORKSPACE_ID);
  line("evaluateMctbAiBookingReadiness", readiness.ready ? "TRUE" : `FALSE (${readiness.reason})`);

  if (readiness.ready) {
    const tz = await resolveCanonicalBookingTimezone(WORKSPACE_ID);
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600_000);
    const avail = await findAvailableTimes({
      workspaceId: WORKSPACE_ID,
      windowStartUtc: now.toISOString(),
      windowEndUtc: end.toISOString(),
      timezone: tz,
      maxResults: 3,
    });
    line("availability call", avail.ok ? `PASS (${avail.slots?.length ?? 0} slots)` : `FAIL (${avail.reason})`);
  }

  line(
    "ONE_TIME_RECONNECT_REQUIRED",
    !token && conn.status === "needs_reauth" ? "YES" : !token ? "LIKELY YES" : "NO",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
