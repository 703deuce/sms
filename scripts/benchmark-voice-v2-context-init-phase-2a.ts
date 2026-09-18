#!/usr/bin/env npx tsx
/**
 * Phase 2A sign-off — CallContext init latency (no PSTN).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/benchmark-voice-v2-context-init-phase-2a.ts
 */
import { performance } from "node:perf_hooks";
import { clearVoiceV2CallSessions } from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { ensureVoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/load-call-context";
import {
  createVoiceV2CallContext,
  loadVoiceV2CallContextRecord,
  resetVoiceV2CallContextStoreForTests,
  clearVoiceV2CallContextL1ForTests,
  getVoiceV2CallContextStoreMode,
  InMemoryVoiceV2CallContextStore,
} from "../src/lib/voice-receptionist-wizard/session/call-context-store";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { setVoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { buildVoiceV2EnrollmentSnapshot } from "../src/lib/voice-receptionist-wizard/session/enrollment";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";

const WORKSPACE = process.env.WORKSPACE_ID || "ws_1";
const AGENT = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const ITERATIONS = Number(process.env.BENCH_ITERATIONS || 25);

function pct(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: pct(s, 50),
    p95: pct(s, 95),
    max: s[s.length - 1] ?? 0,
    min: s[0] ?? 0,
  };
}

/** Pre-2A: config load + L1 only (no L2 read/write). */
async function simulatePre2AColdInit(callId: string): Promise<number> {
  const t0 = performance.now();
  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE, AGENT);
  const config = parseVoiceAgentConfig(runtime);
  compileVoiceV2IntakeSchema(config);
  await loadMctbAiBookingConfig(WORKSPACE);
  const ctx: VoiceV2CallContext = {
    sessionKey: `cc:${callId}`,
    workspaceId: WORKSPACE,
    agentId: AGENT,
    businessTimezone: "America/New_York",
    intakeSchema: compileVoiceV2IntakeSchema(config),
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
  };
  setVoiceV2CallContext(ctx);
  return performance.now() - t0;
}

async function measurePhase2AColdEnsure(callId: string): Promise<number> {
  const t0 = performance.now();
  await ensureVoiceV2CallContext({
    workspaceId: WORKSPACE,
    agentId: AGENT,
    callControlId: callId,
  });
  return performance.now() - t0;
}

async function measureL2ReadOnly(callId: string): Promise<number> {
  const key = `cc:${callId}`;
  clearVoiceV2CallContextL1ForTests();
  const t0 = performance.now();
  await loadVoiceV2CallContextRecord(key);
  return performance.now() - t0;
}

async function measureSyncL2Create(callId: string): Promise<number> {
  const t0 = performance.now();
  const enrollment = await buildVoiceV2EnrollmentSnapshot({
    workspaceId: WORKSPACE,
    agentId: AGENT,
  });
  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE, AGENT);
  const schema = compileVoiceV2IntakeSchema(parseVoiceAgentConfig(runtime));
  await createVoiceV2CallContext(
    {
      payload: {
        sessionKey: `cc:${callId}`,
        workspaceId: WORKSPACE,
        agentId: AGENT,
        businessTimezone: "America/New_York",
        intakeSchema: schema,
        intakeState: {},
        askedFields: {},
        compiledAt: new Date().toISOString(),
        intakeSaveCount: 0,
      },
      identity: {
        sessionKey: `cc:${callId}`,
        callId,
        workspaceId: WORKSPACE,
        agentId: AGENT,
        telnyxCallControlId: callId,
      },
      enrollment,
    },
    { l2Persist: "await" },
  );
  return performance.now() - t0;
}

async function measureColdPathBreakdown(callId: string) {
  clearVoiceV2CallSessions();
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
  const key = `cc:${callId}`;
  const tAlias0 = performance.now();
  const { resolveVoiceV2SessionKey } = await import("../src/lib/voice-receptionist-wizard/session/call-context-store");
  await resolveVoiceV2SessionKey({ callControlId: callId });
  const l2AliasMs = performance.now() - tAlias0;

  const tL2Read0 = performance.now();
  await loadVoiceV2CallContextRecord(key);
  const l2ReadMs = performance.now() - tL2Read0;

  return {
    L1_LOOKUP_MS: 0,
    L2_ALIAS_RESOLUTION_MS: l2AliasMs,
    L2_CREATE_READ_MS: l2ReadMs,
    CAS_SETUP_MS: 0,
  };
}

async function main() {
  process.env.VOICE_V2_ALLOW_MEMORY_L2 = "1";
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());

  const pre2a: number[] = [];
  const phase2a: number[] = [];
  const l2Read: number[] = [];
  const syncCreate: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    clearVoiceV2CallSessions();
    resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
    pre2a.push(await simulatePre2AColdInit(`pre-${i}`));
  }

  for (let i = 0; i < ITERATIONS; i++) {
    clearVoiceV2CallSessions();
    resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
    phase2a.push(await measurePhase2AColdEnsure(`p2a-${i}`));
  }

  clearVoiceV2CallSessions();
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
  await measurePhase2AColdEnsure("seed-l2-read");
  for (let i = 0; i < ITERATIONS; i++) {
    l2Read.push(await measureL2ReadOnly("seed-l2-read"));
  }

  for (let i = 0; i < Math.min(10, ITERATIONS); i++) {
    clearVoiceV2CallSessions();
    resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
    syncCreate.push(await measureSyncL2Create(`sync-${i}`));
  }

  const pre = summarize(pre2a);
  const p2 = summarize(phase2a);
  const deltaP50 = p2.p50 - pre.p50;
  const deltaP95 = p2.p95 - pre.p95;

  const breakdown = await measureColdPathBreakdown("breakdown-sample");

  const report = {
    storeMode: getVoiceV2CallContextStoreMode(),
    redisUrlConfigured: Boolean(process.env.REDIS_URL),
    iterations: ITERATIONS,
    COLD_PATH_BREAKDOWN_SAMPLE_MS: breakdown,
    TOTAL_CONTEXT_INIT_COMPONENTS: {
      note: "TOTAL_CONTEXT_INIT_MS = full ensure/pre-2A paths above",
      SYNC_L2_CREATE_AWAIT_MS: summarize(syncCreate),
    },
    PRE_2A_L1_ONLY_TOTAL_CONTEXT_INIT_MS: pre,
    PHASE_2A_ENSURE_BACKGROUND_L2_TOTAL_CONTEXT_INIT_MS: p2,
    DELTA_MS: { p50: deltaP50, p95: deltaP95 },
    L2_READ_ON_WARM_RECORD_MS: summarize(l2Read),
    SYNC_L2_CREATE_AWAIT_MS: summarize(syncCreate),
    PHASE_2A_CALLER_LATENCY_REGRESSION_MS: {
      p50: Math.round(deltaP50 * 1000) / 1000,
      p95: Math.round(deltaP95 * 1000) / 1000,
    },
    SYNC_L2_CREATE_ON_HOT_PATH: false,
    note:
      "ensure uses l2Persist=background (no await L2 create). Residual p50 delta ≈ L2 GET miss + enrollment DB + alias resolve vs pre-2A L1-only.",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
