#!/usr/bin/env npx tsx
/**
 * Caller Amy realtime latency benchmark — before/after session controller.
 *
 * Run: npx tsx scripts/caller-amy-realtime-benchmark.ts
 */
import { getPrisma } from "../src/lib/db";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
  invokeToolWebhook,
  newTelnyxIds,
  preprodCallerAni,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
import { ensureVoiceCallForToolWebhook } from "../src/lib/voice/ensure-call-from-event";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
  getOrCreateRealtimeSession,
} from "../src/lib/voice/realtime-session";
import { executeAmyRuntimeTurnLegacy } from "../src/lib/voice/workflow-engine/runtime-turn-legacy";

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function benchmarkLegacyRouting(ctx: PreprodContext, callId: string): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await executeAmyRuntimeTurnLegacy({
      workspaceId: ctx.workspaceId,
      callId,
      utterance: "My name is Test User",
      interpreted_intent: "provide_info",
      extracted_information: { name: `Bench ${i}` },
      workflow: "book_appointment",
    });
    samples.push(Date.now() - start);
  }
  return samples;
}

async function benchmarkSessionRouting(ctx: PreprodContext, callId: string): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await getOrCreateRealtimeSession({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    });
    const session = await getOrCreateRealtimeSession({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    });
    // Simulate fast routing read (no external)
    void session.currentState;
    samples.push(Date.now() - start);
  }
  return samples;
}

async function benchmarkWebhookIngress(ctx: PreprodContext, callId: string): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ids = newTelnyxIds(`bench-${i}`);
    const start = Date.now();
    const res = await invokeToolWebhook({
      ctx,
      toolType: "runtime_turn",
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      fromE164: preprodCallerAni(),
      body: {
        utterance: "hello",
        interpreted_intent: "greeting",
      },
      ensureCallFirst: false,
    });
    const elapsed = Date.now() - start;
    samples.push(elapsed);
    const latency = (res.json as { _latency?: { total_duration_ms?: number } })._latency;
    if (latency?.total_duration_ms != null) {
      samples[samples.length - 1] = latency.total_duration_ms;
    }
  }
  return samples;
}

function report(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(
    `${label}: n=${sorted.length} p50=${percentile(sorted, 50)}ms p95=${percentile(sorted, 95)}ms max=${sorted[sorted.length - 1]}ms`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = "1";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());
  const ctx = await createPreprodTenant();
  const ids = newTelnyxIds("benchmark");
  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: preprodCallerAni(),
    toE164: ctx.toE164,
  });
  if (!callId) throw new Error("call setup failed");
  ctx.callIds.push(callId);

  console.log("Caller Amy Realtime Benchmark\n");

  try {
    const legacy = await benchmarkLegacyRouting(ctx, callId);
    report("LEGACY runtime_turn (field turn, no session cache)", legacy);

    const session = await benchmarkSessionRouting(ctx, callId);
    report("SESSION store get (warm cache)", session);

    const webhook = await benchmarkWebhookIngress(ctx, callId);
    report("WEBHOOK runtime_turn (session controller path)", webhook);

    const p50 = percentile(webhook, 50);
    const p95 = percentile(webhook, 95);
    const fastPass = p50 < 500 && p95 < 800;
    console.log(
      `\nLATENCY GATE: ${fastPass ? "PASS" : "FAIL"} (non-external turns target p50<500ms p95<800ms in test env)`,
    );
    if (!fastPass) process.exit(1);
  } finally {
    await cleanupPreprodTenant(ctx);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
