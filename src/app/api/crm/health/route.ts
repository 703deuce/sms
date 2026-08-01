import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listConnectors, providerEnvReady } from "@/lib/crm/registry";
import { scopeDocumentation } from "@/lib/crm/scopes";
import { connectionUiState } from "@/lib/crm/settings";
import type { CrmProviderId } from "@/lib/crm/types";

/** Sync dashboard / provider health for monitoring without DB access. */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const providerParam = new URL(request.url).searchParams.get("provider");
    const prisma = getPrisma();

    const connectors = listConnectors().filter(
      (c) => !providerParam || c.id === providerParam,
    );

    const data = await Promise.all(
      connectors.map(async (c) => {
        const conn = await prisma.integrationConnection.findUnique({
          where: {
            workspaceId_provider: { workspaceId: auth.workspaceId, provider: c.id },
          },
        });
        const [pendingJobs, failedJobs, deadLetters, webhookPending, lastRuns] =
          await Promise.all([
            prisma.jobQueue.count({
              where: {
                workspaceId: auth.workspaceId,
                jobType: { in: ["crm_sync", "crm_push_event"] },
                status: { in: ["pending", "deferred", "processing"] },
              },
            }),
            prisma.jobQueue.count({
              where: {
                workspaceId: auth.workspaceId,
                jobType: { in: ["crm_sync", "crm_push_event"] },
                status: "failed",
              },
            }),
            prisma.crmDeadLetter.count({
              where: {
                workspaceId: auth.workspaceId,
                provider: c.id,
                resolvedAt: null,
              },
            }),
            prisma.crmWebhookEvent.count({
              where: {
                workspaceId: auth.workspaceId,
                provider: c.id,
                status: "pending",
              },
            }),
            prisma.crmSyncRun.findMany({
              where: { workspaceId: auth.workspaceId, provider: c.id },
              orderBy: { createdAt: "desc" },
              take: 5,
            }),
          ]);

        const tokenStatus =
          !conn?.accessToken
            ? "missing"
            : conn.status === "needs_reauth"
              ? "needs_reauth"
              : conn.expiresAt && conn.expiresAt.getTime() < Date.now()
                ? "expired"
                : conn.refreshToken
                  ? "refreshable"
                  : "access_only";

        return {
          provider: c.id,
          name: c.displayName,
          envConfigured: providerEnvReady(c.id),
          connectionStatus: connectionUiState(conn?.status),
          syncStatus: conn?.syncStatus || "idle",
          tokenStatus,
          tokenExpiresAt: conn?.expiresAt?.toISOString() || null,
          connectedAccountName: conn?.connectedAccountName || null,
          connectedUserId: conn?.connectedUserId || null,
          lastSuccessfulSync: conn?.lastSyncAt?.toISOString() || null,
          lastFailedSync: conn?.lastFailedSyncAt?.toISOString() || null,
          lastError: conn?.lastError || null,
          queue: {
            pendingJobs,
            failedJobs,
            deadLetters,
            webhookPending,
          },
          recentRuns: lastRuns.map((r: {
            id: string;
            kind: string;
            status: string;
            direction: string;
            durationMs: number | null;
            lastError: string | null;
            createdAt: Date;
          }) => ({
            id: r.id,
            kind: r.kind,
            status: r.status,
            direction: r.direction,
            durationMs: r.durationMs,
            lastError: r.lastError,
            createdAt: r.createdAt.toISOString(),
          })),
          scopes: scopeDocumentation(c.id as CrmProviderId),
        };
      }),
    );

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
