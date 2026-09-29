#!/usr/bin/env npx tsx
/**
 * Burst acceptMctbInboundSmsIngress (DB + job enqueue, no real Telnyx).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-scale/bench-inbound-sms-burst.ts
 */
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";

const RATES = (process.env.MCTB_BENCH_SMS_RATES || "10,25,50")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const BURST_SIZE = Number(process.env.MCTB_BENCH_SMS_BURST || 50);

async function createWorkspace() {
  const prisma = getPrisma();
  const id = `mctb_sms_bench_${randomUUID().slice(0, 8)}`;
  await prisma.workspace.create({
    data: {
      id,
      name: "MCTB SMS burst bench",
      slug: `sms-bench-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
      customFieldsConfig: {},
    },
  });
  await grantWorkspaceProductFeature(id, "mctb", "active");
  return id;
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.jobQueue.deleteMany({ where: { workspaceId } });
  await prisma.conversationMessage.deleteMany({ where: { conversation: { workspaceId } } } as never).catch(() => undefined);
  await prisma.conversation.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

async function burst(workspaceId: string, n: number) {
  const latencies: number[] = [];
  let errors = 0;
  const t0 = performance.now();
  const tasks = Array.from({ length: n }, (_, i) => async () => {
    const msgId = `bench_${randomUUID()}`;
    const t1 = performance.now();
    try {
      await acceptMctbInboundSmsIngress({
        workspaceId,
        from: "+1202555" + String(1000 + (i % 9000)).padStart(4, "0"),
        to: "+15555550100",
        body: "bench reply",
        provider: "telnyx",
        providerMessageId: msgId,
      });
      latencies.push(performance.now() - t1);
    } catch {
      errors += 1;
    }
  });
  const concurrency = Math.min(10, n);
  for (let i = 0; i < tasks.length; i += concurrency) {
    await Promise.all(tasks.slice(i, i + concurrency).map((fn) => fn()));
  }
  const totalMs = performance.now() - t0;
  latencies.sort((a, b) => a - b);
  const pct = (p: number) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] : 0;
  return {
    n,
    totalMs,
    eventsPerSec: (n / totalMs) * 1000,
    p50Ms: Math.round(pct(50)),
    p95Ms: Math.round(pct(95)),
    p99Ms: Math.round(pct(99)),
    errorPct: (errors / n) * 100,
  };
}

async function main() {
  const workspaceId = await createWorkspace();
  const results = [];
  try {
    for (const rate of RATES) {
      const n = Math.min(BURST_SIZE, rate);
      const r = await burst(workspaceId, n);
      results.push({
        workload: "inbound_sms_accept_parallel_burst",
        targetRatePerSec: rate,
        testedLevel: n,
        pass: r.errorPct === 0,
        eventsPerSec: Math.round(r.eventsPerSec * 10) / 10,
        p50Ms: r.p50Ms,
        p95Ms: r.p95Ms,
        p99Ms: r.p99Ms,
        errorPct: r.errorPct,
      });
    }
    console.log(JSON.stringify({ event: "mctb_bench_inbound_sms", results }, null, 2));
  } finally {
    await cleanup(workspaceId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
