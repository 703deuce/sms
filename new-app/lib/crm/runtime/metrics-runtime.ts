/**
 * Runtime metrics aggregation for monitoring dashboards.
 */

import { getPrisma } from "@/lib/server/db";
import { getCrmPerfSummary } from "../metrics";
import { getCrmRateLimitSnapshot } from "./rate-limit";
import type { CrmProviderId } from "../types";
import { CRM_PROVIDER_IDS } from "../registry";

export async function getCrmRuntimeMetrics(workspaceId: string, provider?: CrmProviderId) {
  const providers = provider ? [provider] : [...CRM_PROVIDER_IDS];
  const prisma = getPrisma();

  const rows = await Promise.all(
    providers.map(async (p) => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [runs, failed, succeeded, pendingJobs, deadLetters, webhooks, perf] =
        await Promise.all([
          prisma.crmSyncRun.count({
            where: { workspaceId, provider: p, createdAt: { gte: since } },
          }),
          prisma.crmSyncRun.count({
            where: {
              workspaceId,
              provider: p,
              status: "failed",
              createdAt: { gte: since },
            },
          }),
          prisma.crmSyncRun.count({
            where: {
              workspaceId,
              provider: p,
              status: { in: ["succeeded", "partial"] },
              createdAt: { gte: since },
            },
          }),
          prisma.jobQueue.count({
            where: {
              workspaceId,
              queueName: `crm-${p}`,
              status: { in: ["pending", "deferred", "processing"] },
            },
          }),
          prisma.crmDeadLetter.count({
            where: { workspaceId, provider: p, resolvedAt: null },
          }),
          prisma.crmWebhookEvent.findMany({
            where: { workspaceId, provider: p, createdAt: { gte: since } },
            select: { createdAt: true, processedAt: true, status: true },
            take: 100,
          }),
          getCrmPerfSummary(workspaceId, p),
        ]);

      const delays = webhooks
        .filter((w: { processedAt: Date | null }) => w.processedAt)
        .map(
          (w: { processedAt: Date | null; createdAt: Date }) =>
            w.processedAt!.getTime() - w.createdAt.getTime(),
        );
      const webhookDelayAvg =
        delays.length > 0
          ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length)
          : null;

      const successRate = runs > 0 ? Math.round((succeeded / runs) * 100) : null;
      const failureRate = runs > 0 ? Math.round((failed / runs) * 100) : null;

      return {
        provider: p,
        syncSuccessRate: successRate,
        syncFailureRate: failureRate,
        runs24h: runs,
        failed24h: failed,
        averageSyncTimeMs: perf.averages.sync?.avgMs ?? perf.averages.initial_sync?.avgMs ?? null,
        queueLength: pendingJobs,
        deadLetters,
        webhookDelayAvgMs: webhookDelayAvg,
        retrySamples: perf.averages,
        rateLimit: getCrmRateLimitSnapshot(workspaceId, p),
        uptimeHint:
          failureRate == null ? "unknown" : failureRate < 5 ? "healthy" : failureRate < 20 ? "degraded" : "poor",
      };
    }),
  );

  return { generatedAt: new Date().toISOString(), providers: rows };
}
