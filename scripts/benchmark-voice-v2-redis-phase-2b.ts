#!/usr/bin/env npx tsx
/**
 * Phase 2B production gate — real Redis L2 latency (requires REDIS_URL).
 * Fails if STORE_MODE !== redis.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/benchmark-voice-v2-redis-phase-2b.ts
 */
import { performance } from "node:perf_hooks";
import {
  resetVoiceV2CallContextStoreSingleton,
  createVoiceV2CallContext,
  loadVoiceV2CallContextRecord,
  resolveVoiceV2SessionKey,
  getVoiceV2CallContextStoreMode,
  getVoiceV2CallContextL1,
  clearVoiceV2CallContextL1ForTests,
  isVoiceV2SessionTerminated,
} from "../src/lib/voice-v2/session/call-context-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import {
  startVoiceV2CallWarmup,
  clearVoiceV2WarmupForTests,
} from "../src/lib/voice-v2/call-warmup";
import { ensureVoiceV2CallContext } from "../src/lib/voice-v2/intake/load-call-context";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const V2_CFG: VoiceAgentConfig = {
  advanced: { voiceV2PstnLiveBooking: true },
} as VoiceAgentConfig;

function pct(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  return { p50: pct(s, 50), p95: pct(s, 95), max: s[s.length - 1] ?? 0 };
}

async function main() {
  if (!process.env.REDIS_URL?.trim()) {
    console.error(
      JSON.stringify({
        PHASE_2B_REDIS_BENCHMARK: "FAIL",
        reason: "REDIS_URL required for production-class L2 measurements",
      }),
    );
    process.exit(1);
  }

  delete process.env.VOICE_V2_ALLOW_MEMORY_L2;
  resetVoiceV2CallContextStoreSingleton();
  clearVoiceV2WarmupForTests();

  const storeMode = getVoiceV2CallContextStoreMode();
  if (storeMode !== "redis") {
    console.error(
      JSON.stringify({
        PHASE_2B_REDIS_BENCHMARK: "FAIL",
        STORE_MODE: storeMode,
        reason: "STORE_MODE must be redis; do not silently benchmark in-memory L2",
      }),
    );
    process.exit(1);
  }

  const creates: number[] = [];
  const gets: number[] = [];
  const aliases: number[] = [];
  const schema = intakeSchemaFromWizardOnly({
    fields: { name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" } },
  });

  for (let i = 0; i < 20; i++) {
    const cc = `redis-bench-${Date.now()}-${i}`;
    const tAlias = performance.now();
    await resolveVoiceV2SessionKey({ callControlId: cc });
    aliases.push(performance.now() - tAlias);

    const tCreate = performance.now();
    await createVoiceV2CallContext(
      {
        payload: {
          sessionKey: `cc:${cc}`,
          workspaceId: "ws_test",
          agentId: "agent_test",
          businessTimezone: "America/New_York",
          intakeSchema: schema,
          intakeState: {},
          askedFields: {},
          compiledAt: new Date().toISOString(),
          intakeSaveCount: 0,
        },
        identity: {
          sessionKey: `cc:${cc}`,
          callId: `call-${i}`,
          workspaceId: "ws_test",
          agentId: "agent_test",
          telnyxCallControlId: cc,
        },
        enrollment: { enrolledAt: new Date().toISOString() },
      },
      { l2Persist: "await" },
    );
    creates.push(performance.now() - tCreate);

    clearVoiceV2CallContextL1ForTests();
    const tGet = performance.now();
    await loadVoiceV2CallContextRecord(`cc:${cc}`);
    gets.push(performance.now() - tGet);
  }

  const warmCallId = `warm-redis-${Date.now()}`;
  const warmCc = `warm-cc-${Date.now()}`;
  await startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: warmCallId,
    callControlId: warmCc,
    agentConfig: V2_CFG,
  });

  const tombstoneSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await isVoiceV2SessionTerminated(`call:${warmCallId}`);
    tombstoneSamples.push(performance.now() - t0);
  }

  const normalWarmedSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const ctx = await ensureVoiceV2CallContext({
      workspaceId: "ws_test",
      agentId: "agent_test",
      callControlId: warmCc,
      trustedPrismaCallId: warmCallId,
    });
    normalWarmedSamples.push(performance.now() - t0);
    if (!ctx || !getVoiceV2CallContextL1(ctx.sessionKey)) {
      console.error(JSON.stringify({ PHASE_2B_REDIS_BENCHMARK: "FAIL", reason: "normal_path_l1_miss" }));
      process.exit(1);
    }
  }

  const l1MissRecoverySamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    clearVoiceV2CallContextL1ForTests();
    const t0 = performance.now();
    await ensureVoiceV2CallContext({
      workspaceId: "ws_test",
      agentId: "agent_test",
      callControlId: warmCc,
      trustedPrismaCallId: warmCallId,
    });
    l1MissRecoverySamples.push(performance.now() - t0);
  }

  const normalWarmed = summarize(normalWarmedSamples);
  const l1MissRecovery = summarize(l1MissRecoverySamples);

  console.log(
    JSON.stringify(
      {
        PHASE_2B_REDIS_BENCHMARK: "PASS",
        STORE_MODE: storeMode,
        REDIS_L2_CREATE_P50_MS: summarize(creates).p50,
        REDIS_L2_CREATE_P95_MS: summarize(creates).p95,
        REDIS_L2_GET_P50_MS: summarize(gets).p50,
        REDIS_L2_GET_P95_MS: summarize(gets).p95,
        REDIS_ALIAS_RESOLVE_P50_MS: summarize(aliases).p50,
        REDIS_ALIAS_RESOLVE_P95_MS: summarize(aliases).p95,
        NORMAL_WARMED_FIRST_TOOL_L1_HIT_RATE: 1,
        NORMAL_WARMED_FIRST_TOOL_CONTEXT_P50_MS: normalWarmed.p50,
        NORMAL_WARMED_FIRST_TOOL_CONTEXT_P95_MS: normalWarmed.p95,
        L1_MISS_RECOVERY_CONTEXT_P50_MS: l1MissRecovery.p50,
        L1_MISS_RECOVERY_CONTEXT_P95_MS: l1MissRecovery.p95,
        TOMBSTONE_CHECK_P50_MS: summarize(tombstoneSamples).p50,
        TOMBSTONE_CHECK_P95_MS: summarize(tombstoneSamples).p95,
        SAME_REPLICA_CONTEXT_P50_MS: normalWarmed.p50,
        SAME_REPLICA_CONTEXT_P95_MS: normalWarmed.p95,
        CROSS_REPLICA_CONTEXT_P50_MS: l1MissRecovery.p50,
        CROSS_REPLICA_CONTEXT_P95_MS: l1MissRecovery.p95,
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
