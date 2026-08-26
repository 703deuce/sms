import "server-only";

import { getPrisma } from "@/lib/db";
import { emitMassTextOpsEvent } from "@/lib/mass-texting/ops-events";
import { raiseIntegrationAlert } from "@/lib/integrations/framework/alerts";

export type MassTextIncidentKind =
  | "queue_stuck"
  | "provider_5xx_spike"
  | "delivery_failure_spike"
  | "duplicate_job_anomaly";

async function raiseIncident(input: {
  workspaceId: string;
  kind: MassTextIncidentKind;
  message: string;
  detail: Record<string, unknown>;
}) {
  await raiseIntegrationAlert({
    workspaceId: input.workspaceId,
    provider: "telnyx",
    kind: input.kind,
    message: input.message,
    severity: input.kind === "duplicate_job_anomaly" ? "error" : "warn",
    audience: "operator",
    detail: input.detail,
  });
  await emitMassTextOpsEvent({
    workspaceId: input.workspaceId,
    eventType: `mass_text.incident.${input.kind}`,
    payload: input.detail,
    idempotencyKey: `mt-incident:${input.workspaceId}:${input.kind}:${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function detectMassTextingIncidents(workspaceId?: string) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const stale = new Date(Date.now() - 10 * 60 * 1000);
  const whereWs = workspaceId ? { workspaceId } : {};

  const stuck = await prisma.campaignMessage.findMany({
    where: {
      ...whereWs,
      status: "sending",
      updatedAt: { lt: stale },
    },
    take: 50,
    select: { id: true, workspaceId: true, campaignId: true },
  });
  const stuckByWs = new Map<string, number>();
  for (const row of stuck) {
    stuckByWs.set(row.workspaceId, (stuckByWs.get(row.workspaceId) || 0) + 1);
  }
  for (const [ws, count] of stuckByWs) {
    if (count >= 10) {
      await raiseIncident({
        workspaceId: ws,
        kind: "queue_stuck",
        message: `${count} Mass Text messages stuck in sending`,
        detail: { count },
      });
    }
  }

  const failed = await prisma.campaignMessage.findMany({
    where: {
      ...whereWs,
      status: "failed",
      updatedAt: { gte: since },
    },
    take: 200,
    select: { workspaceId: true, error: true },
  });
  const failByWs = new Map<string, { total: number; provider5xx: number }>();
  for (const row of failed) {
    const cur = failByWs.get(row.workspaceId) || { total: 0, provider5xx: 0 };
    cur.total += 1;
    if (/5\d\d|unavailable|timeout|ECONNRESET/i.test(row.error || "")) cur.provider5xx += 1;
    failByWs.set(row.workspaceId, cur);
  }
  for (const [ws, counts] of failByWs) {
    if (counts.provider5xx >= 8) {
      await raiseIncident({
        workspaceId: ws,
        kind: "provider_5xx_spike",
        message: `${counts.provider5xx} provider 5xx/timeouts in 15 minutes`,
        detail: counts,
      });
    } else if (counts.total >= 25) {
      await raiseIncident({
        workspaceId: ws,
        kind: "delivery_failure_spike",
        message: `${counts.total} failed Mass Text messages in 15 minutes`,
        detail: counts,
      });
    }
  }

  const dupJobs = await prisma.jobQueue.findMany({
    where: {
      ...whereWs,
      jobType: { in: ["send_campaign_sms", "campaign_send_batch"] },
      status: { in: ["pending", "processing", "deferred"] },
      createdAt: { gte: since },
    },
    take: 500,
    select: { workspaceId: true, idempotencyKey: true },
  });
  const keyCounts = new Map<string, { workspaceId: string; n: number }>();
  for (const job of dupJobs) {
    if (!job.idempotencyKey) continue;
    const cur = keyCounts.get(job.idempotencyKey) || { workspaceId: job.workspaceId || "", n: 0 };
    cur.n += 1;
    keyCounts.set(job.idempotencyKey, cur);
  }
  for (const [key, info] of keyCounts) {
    if (info.n >= 3 && info.workspaceId) {
      await raiseIncident({
        workspaceId: info.workspaceId,
        kind: "duplicate_job_anomaly",
        message: `Duplicate campaign job key ${key} appeared ${info.n} times`,
        detail: { idempotencyKey: key, count: info.n },
      });
    }
  }

  return { stuck: stuck.length, failed: failed.length };
}
