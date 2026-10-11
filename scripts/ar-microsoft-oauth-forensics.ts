/**
 * Redacted Microsoft OAuth forensics for one workspace (production-safe).
 * WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-microsoft-oauth-forensics.ts
 */
import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { snapshotMicrosoftConnectionDiagnostics } from "@/lib/microsoft/connection-diagnostics";
import { getMicrosoftRedirectUri, getMicrosoftOAuthScopes } from "@/lib/microsoft/oauth-config";

function fp(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const prisma = getPrisma();
  const rows = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: ws, provider: "microsoft" },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=== Microsoft OAuth environment (no secrets) ===\n");
  console.log(
    JSON.stringify(
      {
        redirectUri: getMicrosoftRedirectUri(),
        scopesRequested: getMicrosoftOAuthScopes(),
        note: "Redirect URI must be registered as Web in Entra, not SPA, for long-lived refresh tokens.",
      },
      null,
      2,
    ),
  );

  console.log(`\n=== voiceCalendarConnection microsoft (${ws}) ===\n`);
  const refreshFingerprints: string[] = [];
  for (const row of rows) {
    const cfg = (row.config || {}) as CalendarConfig;
    const snap = snapshotMicrosoftConnectionDiagnostics({
      connectionId: row.id,
      status: row.status,
      config: cfg,
    });
    const rfp = fp(cfg.refreshToken);
    if (rfp) refreshFingerprints.push(rfp);
    console.log(
      JSON.stringify(
        {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
          email: cfg.email ?? null,
          microsoftUserId: cfg.microsoftUserId ?? null,
          tenantId: cfg.tenantId ?? null,
          importCalendarCount: cfg.importCalendarIds?.length ?? 0,
          syncEnabled: cfg.syncEnabled,
          tokenDiagnostics: snap,
          refreshTokenFingerprint: rfp,
          accessTokenFingerprint: fp(cfg.accessToken),
          replacedByConnectionId: (cfg as Record<string, unknown>).replacedByConnectionId ?? null,
        },
        null,
        2,
      ),
    );
  }

  const uniqueRefresh = new Set(refreshFingerprints);
  if (uniqueRefresh.size > 0 && uniqueRefresh.size < refreshFingerprints.length) {
    console.log(
      "\n⚠️  DUPLICATE REFRESH TOKEN FINGERPRINT across connections — concurrent refresh can rotate one copy and invalidate the other (invalid_grant).",
    );
  }

  const successRefresh = rows
    .map((r) => (r.config as CalendarConfig)?.lastTokenRefreshAt)
    .filter(Boolean)
    .sort();
  console.log("\n=== Timeline hints ===\n");
  console.log(
    JSON.stringify(
      {
        connectionCount: rows.length,
        earliestCreated: rows[0]?.createdAt.toISOString(),
        latestUpdated: rows.reduce(
          (max, r) => (r.updatedAt > max ? r.updatedAt : max),
          rows[0]?.updatedAt ?? new Date(0),
        ).toISOString(),
        lastSuccessfulRefreshMarkers: successRefresh,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
