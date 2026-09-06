#!/usr/bin/env tsx
/**
 * Inspect Microsoft calendar OAuth token state without printing secrets.
 * Run: WORKSPACE_ID=ws_1 npx tsx scripts/diagnose-microsoft-oauth-connection.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

import { getPrisma } from "../src/lib/db";
import type { CalendarConfig } from "../src/lib/calendar/providers";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const ATTEMPT_REFRESH = process.env.ATTEMPT_REFRESH === "1";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { workspaceId: WORKSPACE_ID, provider: "microsoft" },
    orderBy: { updatedAt: "desc" },
  });

  if (!conn) {
    console.log(`No Microsoft connection for workspace ${WORKSPACE_ID}`);
    return;
  }

  const config = (conn.config || {}) as CalendarConfig;
  const now = Date.now();
  const expiresAt = config.expiresAt || null;

  section("Connection");
  console.log(`  id=${conn.id}`);
  console.log(`  name=${conn.name}`);
  console.log(`  status=${conn.status}`);
  console.log(`  email=${config.email || "—"}`);

  section("Stored tokens (sanitized)");
  console.log(`  hasRefreshToken=${Boolean(config.refreshToken)}`);
  console.log(`  hasAccessToken=${Boolean(config.accessToken)}`);
  console.log(
    `  accessExpiresAt=${expiresAt ? new Date(expiresAt).toISOString() : "missing"}`,
  );
  console.log(`  accessExpired=${expiresAt ? expiresAt < now : "unknown"}`);
  console.log(`  grantedScopes=${config.grantedScopes || "missing"}`);
  console.log(`  offline_accessInScopes=${/offline_access/i.test(config.grantedScopes || "")}`);

  section("Diagnostics");
  console.log(`  lastVerifiedAt=${config.lastVerifiedAt || "—"}`);
  console.log(`  lastVerificationOk=${String(config.lastVerificationOk ?? "—")}`);
  console.log(`  lastVerificationError=${config.lastVerificationError || "—"}`);
  const refreshDiag = (config as CalendarConfig & {
    lastTokenRefreshAt?: string;
    lastTokenRefreshError?: string;
    lastTokenRefreshKind?: string;
  });
  console.log(`  lastTokenRefreshAt=${refreshDiag.lastTokenRefreshAt || "—"}`);
  console.log(`  lastTokenRefreshKind=${refreshDiag.lastTokenRefreshKind || "—"}`);
  console.log(`  lastTokenRefreshError=${refreshDiag.lastTokenRefreshError || "—"}`);

  if (!config.refreshToken) {
    section("Diagnosis");
    console.log(
      "  This connection has NO refresh token. It was likely authorized before offline_access was added.",
    );
    console.log("  One manual reconnect is required to seed a refresh token.");
    return;
  }

  if (!ATTEMPT_REFRESH) {
    section("Next step");
    console.log("  Set ATTEMPT_REFRESH=1 to test silent refresh against Microsoft (no token values printed).");
    return;
  }

  section("Refresh attempt");
  const { refreshMicrosoftAccessToken } = await import("../src/lib/microsoft/oauth-config");
  const result = await refreshMicrosoftAccessToken(config.refreshToken);
  if (result.ok) {
    console.log("  result=success");
    console.log(`  expiresIn=${result.expiresIn}s`);
    console.log(`  newRefreshTokenReturned=${Boolean(result.refreshToken)}`);
    console.log(`  scope=${result.scope || "—"}`);
    console.log("\n  Diagnosis: refresh token is valid; prior needs_reauth was likely a code bug.");
  } else {
    console.log("  result=failed");
    console.log(`  kind=${result.kind}`);
    console.log(`  httpStatus=${result.httpStatus}`);
    console.log(`  error=${result.error || "—"}`);
    console.log(`  needsReconnect=${result.needsReconnect}`);
    console.log(`  description=${(result.errorDescription || "").slice(0, 240)}`);
    console.log(
      result.needsReconnect
        ? "\n  Diagnosis: refresh token invalid/revoked — user reconnect required."
        : "\n  Diagnosis: transient/misconfigured refresh — should NOT mark needs_reconnect.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
