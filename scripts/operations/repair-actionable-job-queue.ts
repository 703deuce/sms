/**
 * Safe administrative repair for stranded actionable jobs (NOT retention pruning).
 *
 * DRY_RUN=1 (default): report only.
 * EXECUTE=1: apply terminal transitions + column backfills.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/repair-actionable-job-queue.ts
 */
import { getPrisma } from "@/lib/db";
import { failJob } from "@/lib/messaging/enqueue-advance";
import { syncDbOutboxToBullmq } from "@/lib/jobs/bullmq";

const STALE_MS = Number(process.env.ACTIONABLE_STALE_MS || 14 * 24 * 60 * 60 * 1000);
/** Stranded CRM outbox rows (0 BullMQ depth) — retire after 13d without provider replay. */
const CRM_STALE_MS = Number(process.env.CRM_PUSH_STALE_MS || 13 * 24 * 60 * 60 * 1000);
const BATCH = Math.min(500, Number(process.env.REPAIR_BATCH_SIZE || 200));

/** No customer-facing side effect if processed today; safe to administratively retire when stale. */
const SAFE_ADMIN_RETIRE_TYPES = new Set([
  "campaign_send_batch",
  "integration_automation_event",
  "automation_tick",
  "crm_task_due_scan",
  "job_queue_lifecycle_test",
  "voice_webhook_process",
]);

const ORPHAN_QUEUE_RETIRE = new Set(["ext-internal"]);

/** Observer / history jobs — stale rows should not replay telephony side effects. */
const STALE_OBSERVER_RETIRE_TYPES = new Set([
  "voice_post_call",
  "voice_v3_call_history",
  "voice_v2_ai_call_recovery_settle",
  "voice_outbound_ai_call",
  "voice_webhook_process",
]);

/** Never auto-retire without message-level inspection. */
const CAMPAIGN_SEND_TYPES = new Set(["send_campaign_sms", "send_campaign_email"]);

/** Stale CRM outbox — do not replay month-old external mutations. */
const STALE_CRM_TYPES = new Set(["crm_push_event", "crm_sync"]);

/** Stale automation steps — do not replay old drip/appointment side effects. */
const STALE_AUTOMATION_TYPES = new Set(["drip_campaign_step", "appointment_workflow_step"]);

function payloadWorkspaceId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const w = (payload as Record<string, unknown>).workspaceId;
  return typeof w === "string" && w.trim() ? w.trim() : null;
}

function payloadMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const m = (payload as Record<string, unknown>).messageId;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

async function workspaceExists(workspaceId: string): Promise<boolean> {
  const row = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  return Boolean(row);
}

async function main() {
  const execute = process.env.EXECUTE === "1";
  const prisma = getPrisma();
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const crmStaleCutoff = new Date(now - CRM_STALE_MS);

  const report: Record<string, unknown> = {
    mode: execute ? "execute" : "dry_run",
    staleThresholdDays: STALE_MS / 86400000,
    crmStaleThresholdDays: CRM_STALE_MS / 86400000,
    backfillWorkspaceId: 0,
    administrativelyRetired: 0,
    crmPushRetired: 0,
    automationStepRetired: 0,
    campaignSendRetired: 0,
    observerRetired: 0,
    outboxSync: null as unknown,
    skipped: {
      neverAutoRetire: 0,
      notStaleEnough: 0,
      campaignStillQueued: 0,
      workspaceMissing: 0,
    },
    samples: [] as unknown[],
  };

  const pushSample = (row: Record<string, unknown>) => {
    if ((report.samples as unknown[]).length < 20) (report.samples as unknown[]).push(row);
  };

  // --- Backfill workspaceId column from payload (any age, verified workspace) ---
  const nullWsAnyAge = await prisma.jobQueue.findMany({
    where: { workspaceId: null, status: { in: ["pending", "deferred"] } },
    take: BATCH,
    orderBy: { runAfter: "asc" },
  });
  for (const job of nullWsAnyAge) {
    const pw = payloadWorkspaceId(job.payload);
    if (!pw || !(await workspaceExists(pw))) continue;
    if (execute) {
      await prisma.jobQueue.update({ where: { id: job.id }, data: { workspaceId: pw } });
    }
    (report.backfillWorkspaceId as number) += 1;
  }

  // --- Test pollution (any age) ---
  const testRows = await prisma.jobQueue.findMany({
    where: { jobType: "job_queue_lifecycle_test", status: { in: ["pending", "deferred"] } },
    take: 100,
  });
  for (const job of testRows) {
    if (execute) {
      await failJob(job.id, "administrative_retire:test_pollution", undefined, undefined, true);
    }
    (report.administrativelyRetired as number) += 1;
  }

  // --- Null-workspace campaign_send_batch (coordinator cannot run without tenant) ---
  const orphanBatches = await prisma.jobQueue.findMany({
    where: {
      jobType: "campaign_send_batch",
      workspaceId: null,
      status: { in: ["pending", "deferred"] },
    },
    take: 100,
  });
  for (const job of orphanBatches) {
    if (execute) {
      await failJob(
        job.id,
        "administrative_retire:orphan_campaign_batch_no_workspace",
        undefined,
        undefined,
        true,
      );
    }
    (report.administrativelyRetired as number) += 1;
  }

  // --- Stale CRM push (DB outbox only; BullMQ empty) ---
  const crmPush = await prisma.jobQueue.findMany({
    where: {
      jobType: { in: [...STALE_CRM_TYPES] },
      status: { in: ["pending", "deferred"] },
      runAfter: { lt: crmStaleCutoff },
    },
    take: BATCH,
    orderBy: { runAfter: "asc" },
  });
  for (const job of crmPush) {
    const reason =
      "administrative_retire:stale_crm_push_outbox_no_replay — event superseded; no provider replay";
    if (execute) {
      await failJob(job.id, reason, undefined, undefined, true);
    }
    (report.crmPushRetired as number) += 1;
    pushSample({ action: "crm_push_retire", id: job.id, queueName: job.queueName, workspaceId: job.workspaceId });
  }

  // --- Null-workspace + general stale actionable ---
  const nullWs = await prisma.jobQueue.findMany({
    where: {
      workspaceId: null,
      status: { in: ["pending", "deferred"] },
      runAfter: { lt: staleCutoff },
    },
    take: BATCH,
    orderBy: { runAfter: "asc" },
  });

  for (const job of nullWs) {
    const pw = payloadWorkspaceId(job.payload);
    if (pw && await workspaceExists(pw)) {
      if (execute) {
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: { workspaceId: pw },
        });
      }
      (report.backfillWorkspaceId as number) += 1;
      continue;
    }

    if (CAMPAIGN_SEND_TYPES.has(job.jobType)) {
      const messageId = payloadMessageId(job.payload);
      if (messageId) {
        const msg = await prisma.campaignMessage.findUnique({
          where: { id: messageId },
          select: { status: true, workspaceId: true },
        });
        if (msg?.workspaceId && !job.workspaceId) {
          if (execute) {
            await prisma.jobQueue.update({
              where: { id: job.id },
              data: { workspaceId: msg.workspaceId },
            });
          }
          (report.backfillWorkspaceId as number) += 1;
        }
        const terminalMsg =
          !msg ||
          msg.status === "sent" ||
          msg.status === "delivered" ||
          msg.status === "failed" ||
          msg.status === "cancelled" ||
          msg.status === "canceled" ||
          msg.status === "skipped";
        if (terminalMsg || job.runAfter < staleCutoff) {
          const reason =
            "administrative_retire:stale_campaign_send_no_replay — message no longer queued for send";
          if (execute) {
            await failJob(job.id, reason, undefined, undefined, true);
          }
          (report.campaignSendRetired as number) += 1;
          pushSample({ action: "campaign_send_retire", id: job.id, messageId, msgStatus: msg?.status });
          continue;
        }
        (report.skipped as { campaignStillQueued: number }).campaignStillQueued += 1;
        continue;
      }
    }

    if (ORPHAN_QUEUE_RETIRE.has(job.queueName) && SAFE_ADMIN_RETIRE_TYPES.has(job.jobType)) {
      if (execute) {
        await failJob(
          job.id,
          "administrative_retire:orphan_queue_no_worker — ext-internal has no consumer",
          undefined,
          undefined,
          true,
        );
      }
      (report.administrativelyRetired as number) += 1;
      pushSample({ action: "orphan_queue_retire", id: job.id, jobType: job.jobType });
      continue;
    }

    if (SAFE_ADMIN_RETIRE_TYPES.has(job.jobType)) {
      if (execute) {
        await failJob(job.id, "administrative_retire:stale_actionable_no_side_effect", undefined, undefined, true);
      }
      (report.administrativelyRetired as number) += 1;
      pushSample({ action: "retire", id: job.id, jobType: job.jobType });
    }
  }

  const staleAutomation = await prisma.jobQueue.findMany({
    where: {
      jobType: { in: [...STALE_AUTOMATION_TYPES] },
      status: { in: ["pending", "deferred"] },
      runAfter: { lt: staleCutoff },
    },
    take: BATCH,
    orderBy: { runAfter: "asc" },
  });
  for (const job of staleAutomation) {
    if (execute) {
      await failJob(
        job.id,
        "administrative_retire:stale_automation_step_no_replay",
        undefined,
        undefined,
        true,
      );
    }
    (report.automationStepRetired as number) += 1;
  }

  // --- Stale observer / voice history (any workspace) ---
  const observers = await prisma.jobQueue.findMany({
    where: {
      jobType: { in: [...STALE_OBSERVER_RETIRE_TYPES] },
      status: { in: ["pending", "deferred"] },
      runAfter: { lt: staleCutoff },
    },
    take: BATCH,
    orderBy: { runAfter: "asc" },
  });
  for (const job of observers) {
    if (execute) {
      await failJob(
        job.id,
        "administrative_retire:stale_voice_observer_no_replay",
        undefined,
        undefined,
        true,
      );
    }
    (report.observerRetired as number) += 1;
  }

  if (
    execute &&
    process.env.SKIP_OUTBOX_SYNC !== "1" &&
    process.env.REDIS_URL &&
    process.env.QUEUE_DRIVER === "bullmq"
  ) {
    report.outboxSync = await syncDbOutboxToBullmq(200);
  }

  const actionableAfter = await prisma.jobQueue.count({
    where: { status: { in: ["pending", "deferred", "processing"] } },
  });
  report.actionableAfterCount = actionableAfter;

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect().catch(() => {});
    }
  });
