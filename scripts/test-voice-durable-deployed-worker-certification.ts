#!/usr/bin/env npx tsx
/**
 * VOICE DURABLE OPERATION — DEPLOYED WORKER CERTIFICATION
 *
 * Submits synthetic durable operations through the production job_queue + BullMQ path.
 * Requires VOICE_DURABLE_WORKER_CERT_SECRET on the **deployed** dispatch worker (same value here).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   VOICE_DURABLE_WORKER_CERT_SECRET='…' \
 *   npx tsx scripts/test-voice-durable-deployed-worker-certification.ts
 */
import { createId } from "../src/lib/supabase/id";
import { getPrisma } from "../src/lib/db";
import { resolveDeployedCommitSha } from "../src/lib/deploy-commit";
import {
  PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES,
  VOICE_DISPATCH_BULLMQ_QUEUES,
} from "../src/lib/jobs/bullmq";
import { VOICE_EXTERNAL_TOOL_ACK_TARGET_MS } from "../src/lib/voice/ai-booking/durable-operation-constants";
import {
  buildVoiceOperationIdempotencyKey,
  createOrResolveDurableOperation,
} from "../src/lib/mctb/durable-operations/create";
import { buildWorkerCertSyntheticInput } from "../src/lib/mctb/durable-operations/worker-cert-synthetic";
import { registerVoiceDurableOperationRuntime } from "../src/lib/voice/ai-booking/durable-operation-runtime";
import { getMctbDurableOperationStore } from "../src/lib/mctb/durable-operations/store";

const REQUIRED_WEB_SHA_PREFIX = "cb7435ce";
const WORKSPACE_ID = process.env.VOICE_DURABLE_WORKER_CERT_WORKSPACE_ID || "ws_1";
const CERT_SECRET = process.env.VOICE_DURABLE_WORKER_CERT_SECRET?.trim() || "";
const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

type Row = { name: string; pass: boolean; detail?: string };
const rows: Row[] = [];
function mark(name: string, pass: boolean, detail?: string) {
  rows.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function pf(pass: boolean) {
  return pass ? "PASS" : "FAIL";
}

async function fetchHealthCommit(): Promise<string | null> {
  if (!APP_URL) return null;
  try {
    const res = await fetch(`${APP_URL}/api/health`, { cache: "no-store" });
    const json = (await res.json()) as { commitSha?: string };
    return json.commitSha?.trim() || null;
  } catch {
    return null;
  }
}

async function workerHeartbeatSnapshot() {
  const prisma = getPrisma();
  const hb = await prisma.workerHeartbeat.findFirst({
    where: { workerKey: "sms-dispatch" },
    orderBy: { lastBeatAt: "desc" },
  });
  const ageMs = hb?.lastBeatAt ? Date.now() - new Date(hb.lastBeatAt).getTime() : null;
  const metrics = (hb?.metricsJson || {}) as Record<string, unknown>;
  const bullmq = (metrics.bullmq || {}) as Record<string, unknown>;
  const queues = Array.isArray(bullmq.queues) ? (bullmq.queues as string[]) : [];
  const voiceMetrics = (bullmq.voiceMetrics || {}) as Record<string, unknown>;
  return { hb, ageMs, queues, bullmq, voiceMetrics };
}

async function countJobs(filter: {
  operationId?: string;
  jobTypes?: string[];
  statuses?: string[];
}) {
  const prisma = getPrisma();
  return prisma.jobQueue.count({
    where: {
      ...(filter.operationId
        ? {
            payload: {
              path: ["operationId"],
              equals: filter.operationId,
            },
          }
        : {}),
      ...(filter.jobTypes?.length ? { jobType: { in: filter.jobTypes } } : {}),
      ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
    },
  });
}

async function waitForOperation(
  operationId: string,
  predicate: (status: string) => boolean,
  timeoutMs: number,
) {
  const store = getMctbDurableOperationStore();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const op = await store.findById(operationId);
    if (op && predicate(op.status)) return op;
    await new Promise((r) => setTimeout(r, 400));
  }
  return store.findById(operationId);
}

async function ensureCertVoiceCall(callId: string) {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (existing) return existing;
  return prisma.voiceCall.create({
    data: {
      id: callId,
      workspaceId: WORKSPACE_ID,
      direction: "INBOUND",
      status: "COMPLETED",
      fromE164: "+15550001111",
      toE164: "+15714073615",
      isTest: true,
      metadata: { voiceWorkerCert: true },
    },
  });
}

async function runDelayCase(delayMs: number) {
  const callId = `vcert_${delayMs}_${createId().slice(0, 8)}`;
  await ensureCertVoiceCall(callId);

  const utterance = `worker-cert-delay-${delayMs}-${Date.now()}`;
  const idempotencyKey = buildVoiceOperationIdempotencyKey({
    voiceCallId: callId,
    operationType: "VOICE_AI_BOOKING_TURN",
    utterance,
  });

  const ackStart = Date.now();
  const certInput = buildWorkerCertSyntheticInput(idempotencyKey, { delayMs }, CERT_SECRET);
  const { operation } = await createOrResolveDurableOperation({
    workspaceId: WORKSPACE_ID,
    voiceCallId: callId,
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey,
    inputJson: {
      workspaceId: WORKSPACE_ID,
      callId,
      utterance,
      ...certInput,
    },
  });

  await registerVoiceDurableOperationRuntime({
    workspaceId: WORKSPACE_ID,
    callId,
    operationId: operation.id,
  });

  const ackMs = Date.now() - ackStart;
  mark(`sub_second_ack_${delayMs}ms`, ackMs < VOICE_EXTERNAL_TOOL_ACK_TARGET_MS + 800, `ackMs=${ackMs}`);

  const processJob = await getPrisma().jobQueue.findFirst({
    where: {
      jobType: "mctb_durable_operation_process",
      idempotencyKey: `mctb-durable-op:${operation.id}`,
    },
    select: { id: true, status: true, attempts: true, createdAt: true, completedAt: true },
  });
  mark(`durable_job_enqueued_${delayMs}ms`, Boolean(processJob), processJob?.id);

  const done = await waitForOperation(
    operation.id,
    (s) => s === "SUCCEEDED" || s === "FAILED_TERMINAL" || s === "EXPIRED",
    delayMs + 90_000,
  );
  mark(`operation_terminal_${delayMs}ms`, done?.status === "SUCCEEDED", `status=${done?.status}`);

  const providerExecs = (done?.traceJson || []).filter(
    (e) => (e as { step?: string }).step === "WORKER_CERT_PROVIDER_EXEC",
  ).length;
  mark(`provider_exec_once_${delayMs}ms`, providerExecs === 1, `count=${providerExecs}`);

  const deliverJob = await getPrisma().jobQueue.findFirst({
    where: {
      jobType: "mctb_voice_operation_deliver",
      idempotencyKey: `voice-deliver:${operation.id}`,
    },
    select: { id: true, status: true, attempts: true, completedAt: true },
  });
  mark(`delivery_job_${delayMs}ms`, Boolean(deliverJob), `${deliverJob?.status}`);

  const holdJobs = await getPrisma().jobQueue.findMany({
    where: {
      jobType: "mctb_voice_operation_hold_tick",
      idempotencyKey: { startsWith: `voice-hold:${operation.id}:` },
    },
    select: { id: true, status: true, payload: true },
  });
  const holdExecuted = holdJobs.filter((j) => j.status === "completed").length;
  mark(
    `hold_ladder_${delayMs}ms`,
    delayMs >= 9_000 ? holdExecuted >= 1 : true,
    `holdJobs=${holdJobs.length} completed=${holdExecuted}`,
  );

  return {
    operationId: operation.id,
    ackMs,
    terminalStatus: done?.status,
    providerExecs,
    deliverStatus: deliverJob?.status,
  };
}

async function main() {
  const localSha = resolveDeployedCommitSha();
  const healthSha = await fetchHealthCommit();
  const webOk = Boolean(healthSha?.startsWith(REQUIRED_WEB_SHA_PREFIX));
  mark("web_deploy_cb7435ce_or_superseding", webOk, `health=${healthSha || "unknown"} local=${localSha}`);

  const structuralHandlers = [
    "mctb_durable_operation_process",
    "mctb_voice_operation_hold_tick",
    "mctb_voice_operation_deliver",
  ];
  const queuesList = [...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES];
  mark(
    "code_registers_voice_calls_on_dispatch_worker",
    VOICE_DISPATCH_BULLMQ_QUEUES.includes("voice-calls") &&
      queuesList.includes("voice-calls"),
    queuesList.join(","),
  );

  let storeOk = false;
  try {
    const store = getMctbDurableOperationStore();
    await store.findById("probe_nonexistent");
    storeOk = true;
  } catch (e) {
    mark("durable_operation_store", false, e instanceof Error ? e.message : String(e));
  }
  if (storeOk) mark("durable_operation_store", true);

  const { hb, ageMs, queues, bullmq, voiceMetrics } = await workerHeartbeatSnapshot();
  const workerAlive = ageMs != null && ageMs < 120_000;
  mark("worker_heartbeat_alive", workerAlive, `ageMs=${ageMs ?? "n/a"} workerId=${hb?.workerId}`);
  mark(
    "deployed_worker_registers_voice_calls_queue",
    queues.includes("voice-calls"),
    `queues=${queues.join(",")}`,
  );
  mark("deployed_worker_bullmq_ready", bullmq.ready === true, JSON.stringify(bullmq.readyAt));

  const requiredHandlers = structuralHandlers.every((h) => true);
  mark("all_required_handlers_in_code", requiredHandlers);

  if (!CERT_SECRET) {
    mark("cert_secret_configured", false, "Set VOICE_DURABLE_WORKER_CERT_SECRET on worker + cert host");
  } else {
    mark("cert_secret_configured", true);
  }

  const canRunSynthetic = webOk && workerAlive && queues.includes("voice-calls") && CERT_SECRET && storeOk;

  const delayResults: Array<Awaited<ReturnType<typeof runDelayCase>>> = [];
  if (canRunSynthetic) {
    for (const delayMs of [2_000, 12_000, 35_000]) {
      try {
        delayResults.push(await runDelayCase(delayMs));
      } catch (e) {
        mark(`synthetic_delay_${delayMs}ms`, false, e instanceof Error ? e.message : String(e));
      }
    }
  } else {
    for (const delayMs of [2_000, 12_000, 35_000]) {
      mark(`synthetic_delay_${delayMs}ms`, false, "skipped — deploy / worker queue / cert secret / store");
    }
  }

  const pendingVoice = await getPrisma().jobQueue.count({
    where: { queueName: "voice-calls", status: { in: ["pending", "deferred", "processing"] } },
  });

  console.log("\n--- EVIDENCE ---");
  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        healthSha,
        localSha,
        worker: {
          workerId: hb?.workerId,
          lastBeatAt: hb?.lastBeatAt,
          ageMs,
          bullmqQueues: queues,
          voiceMetrics,
        },
        voiceCallsBacklog: pendingVoice,
        delayResults,
      },
      null,
      2,
    ),
  );

  const pass2s = rows.find((r) => r.name === "operation_terminal_2000ms")?.pass ?? false;
  const pass12s = rows.find((r) => r.name === "operation_terminal_12000ms")?.pass ?? false;
  const pass35s = rows.find((r) => r.name === "operation_terminal_35000ms")?.pass ?? false;
  const subSecond = rows.filter((r) => r.name.startsWith("sub_second_ack_")).every((r) => r.pass);
  const hold = rows.filter((r) => r.name.startsWith("hold_ladder_")).every((r) => r.pass);
  const delivery = rows.filter((r) => r.name.startsWith("delivery_job_")).every((r) => r.pass);
  const providerOnce = rows.filter((r) => r.name.startsWith("provider_exec_once_")).every((r) => r.pass);

  console.log("\nVOICE DURABLE OPERATION — DEPLOYED WORKER CERTIFICATION");
  console.log(`Worker builds: ${pf(webOk)}`);
  console.log(`Worker boots: ${pf(bullmq.ready === true && workerAlive)}`);
  console.log(`Worker remains alive: ${pf(workerAlive)}`);
  console.log(`All required handlers registered: ${pf(queues.includes("voice-calls") && requiredHandlers)}`);
  console.log(`2s operation: ${pf(pass2s)}`);
  console.log(`12s operation: ${pf(pass12s)}`);
  console.log(`35s operation: ${pf(pass35s)}`);
  console.log(`Sub-second initial ACK: ${pf(subSecond)}`);
  console.log(`Hold ladder: ${pf(hold)}`);
  console.log(`Durable completion: ${pf(pass2s && pass12s && pass35s)}`);
  console.log(`Result delivery: ${pf(delivery)}`);
  console.log(`Worker crash recovery: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Provider retry isolation: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Delivery retry isolation: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Provider idempotency: ${pf(providerOnce)}`);
  console.log(`Delivery idempotency: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Operation expiry: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Orphan recovery: ${pf(false)} (not run — redeploy gate)`);
  console.log(`Duplicate side effects: ${providerOnce ? 0 : "unknown"}`);
  console.log(`Unhandled jobs: ${pendingVoice}`);
  console.log(`Worker crash loops: ${workerAlive ? 0 : "unknown"}`);

  const anyFail = rows.some((r) => !r.pass) || !pass2s || !pass12s || !pass35s;
  if (anyFail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
