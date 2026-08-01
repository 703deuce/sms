import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getCapabilityMatrixTable } from "@/lib/crm/capability";
import { getCrmDiagnosticsSnapshot } from "@/lib/crm/diagnostics";
import { listPendingConflicts } from "@/lib/crm/conflicts-ui";
import { getCrmPerfSummary } from "@/lib/crm/metrics";
import { redactSensitive } from "@/lib/crm/redact";
import { isCrmProvider } from "@/lib/crm/registry";
import { getConnection } from "@/lib/integrations/connections";
import { getCrmSyncPreferences } from "@/lib/crm/settings";

/** Support pack — connection + queues + logs without raw secrets. */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider")?.trim();
    const download = url.searchParams.get("download") === "1";
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const conn = await getConnection(auth.workspaceId, provider);
    const [
      snapshot,
      prefs,
      perf,
      conflicts,
      runs,
      audit,
      webhooks,
      deadLetters,
    ] = await Promise.all([
      getCrmDiagnosticsSnapshot(auth.workspaceId, provider),
      getCrmSyncPreferences(auth.workspaceId, provider),
      getCrmPerfSummary(auth.workspaceId, provider),
      listPendingConflicts(auth.workspaceId, provider),
      prisma.crmSyncRun.findMany({
        where: { workspaceId: auth.workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.crmAuditLog.findMany({
        where: { workspaceId: auth.workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.crmWebhookEvent.findMany({
        where: { workspaceId: auth.workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.crmDeadLetter.findMany({
        where: { workspaceId: auth.workspaceId, provider },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const pack = redactSensitive({
      generatedAt: new Date().toISOString(),
      workspaceId: auth.workspaceId,
      provider,
      connection: conn
        ? {
            status: conn.status,
            syncStatus: conn.syncStatus,
            tokenStatus: snapshot.tokenStatus,
            tokenValid: snapshot.tokenValid,
            expiresAt: conn.expiresAt?.toISOString() || null,
            hasAccessToken: Boolean(conn.accessToken),
            hasRefreshToken: Boolean(conn.refreshToken),
            tokensEncrypted: Boolean(
              conn.accessToken?.startsWith("enc:v1:") ||
                (conn.configJson as { tokensEncrypted?: boolean } | null)?.tokensEncrypted,
            ),
            connectedAccountName: conn.connectedAccountName,
            connectedUserId: conn.connectedUserId,
            externalId: conn.externalId,
            lastSyncAt: conn.lastSyncAt?.toISOString() || null,
            lastFailedSyncAt: conn.lastFailedSyncAt?.toISOString() || null,
            lastError: conn.lastError,
            meta: {
              instanceUrl: (conn.configJson as { instanceUrl?: string } | null)?.instanceUrl,
              apiDomain: (conn.configJson as { api_domain?: string } | null)?.api_domain,
              setupDiscovery: (conn.configJson as { setupDiscovery?: unknown } | null)
                ?.setupDiscovery,
            },
          }
        : null,
      snapshot,
      preferences: prefs,
      performance: perf,
      pendingConflicts: conflicts,
      capabilityMatrix: getCapabilityMatrixTable().map((row) => ({
        feature: row.feature,
        label: row.label,
        support: row.cells[provider].support,
        notes: row.cells[provider].notes,
      })),
      recentRuns: runs,
      audit,
      webhooks,
      deadLetters,
      queue: snapshot.queue,
    });

    if (download) {
      return new NextResponse(JSON.stringify(pack, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="crm-support-${provider}.json"`,
        },
      });
    }

    return NextResponse.json({ data: pack });
  } catch (err) {
    return jsonError(err, 500);
  }
}
