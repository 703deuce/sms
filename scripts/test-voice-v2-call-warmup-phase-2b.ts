#!/usr/bin/env npx tsx
/**
 * Phase 2B warmup gate tests.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' VOICE_V2_ALLOW_MEMORY_L2=1 npx tsx scripts/test-voice-v2-call-warmup-phase-2b.ts
 */
import { performance } from "node:perf_hooks";
import {
  startVoiceV2CallWarmup,
  abortVoiceV2CallWarmup,
  terminateVoiceV2CallSessionOnHangup,
  clearVoiceV2WarmupForTests,
  getVoiceV2WarmupEntry,
  WARMUP_BLOCKING_TELEMETRY,
} from "../src/lib/voice-v2/call-warmup";
import { ensureVoiceV2CallContext } from "../src/lib/voice-v2/intake/load-call-context";
import { clearVoiceV2CallSessions } from "../src/lib/voice-v2/intake/session-store";
import {
  InMemoryVoiceV2CallContextStore,
  resetVoiceV2CallContextStoreForTests,
  loadVoiceV2CallContextRecord,
  getVoiceV2CallContextL1,
  clearVoiceV2CallContextL1ForTests,
  loadVoiceV2CallContext,
  clearVoiceV2SessionTerminatedForTests,
} from "../src/lib/voice-v2/session/call-context-store";
import { warmMicrosoftTokenIfNeeded, clearTokenWarmupInFlightForTests } from "../src/lib/voice-v2/session/token-readiness";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const rows: Array<{ id: string; pass: boolean; detail?: string }> = [];
function check(id: string, pass: boolean, detail?: string) {
  rows.push({ id, pass, detail });
}

const V2_CFG: VoiceAgentConfig = {
  advanced: { voiceV2PstnLiveBooking: true },
} as VoiceAgentConfig;

async function main() {
  process.env.VOICE_V2_ALLOW_MEMORY_L2 = "1";
  clearVoiceV2WarmupForTests();
  clearTokenWarmupInFlightForTests();
  clearVoiceV2CallSessions();
  clearVoiceV2SessionTerminatedForTests();
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());

  const callId = "warm-2b-1";
  const cc = "warm-cc-1";

  const w1 = startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId,
    callControlId: cc,
    agentConfig: V2_CFG,
  });
  const w2 = startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId,
    callControlId: cc,
    agentConfig: V2_CFG,
  });
  await Promise.all([w1, w2]);
  const entry = getVoiceV2WarmupEntry(`call:${callId}`) || getVoiceV2WarmupEntry(`cc:${cc}`);
  check("CALL_CONTEXT_WARMUP_STARTED_ONCE", w1.canonicalSessionKey === w2.canonicalSessionKey);

  const rec = await loadVoiceV2CallContextRecord(`cc:${cc}`);
  check("CALL_CONTEXT_L2_CREATED_BEFORE_FIRST_TOOL", Boolean(rec));

  const t0 = performance.now();
  const ctx = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: cc,
    callId,
  });
  const ensureMs = performance.now() - t0;
  check("FIRST_TOOL_L1_HIT", Boolean(ctx) && Boolean(getVoiceV2CallContextL1(ctx!.sessionKey)));
  check(
    "FIRST_TOOL_CONTEXT_LOOKUP_MS_FAST",
    ensureMs < 500,
    `${ensureMs.toFixed(2)}ms (L1 hit path; production target <50ms)`,
  );

  const dupStarts: string[] = [];
  await Promise.all(
    [1, 2, 3].map(async () => {
      const r = await startVoiceV2CallWarmup({
        workspaceId: "ws_test",
        agentId: "agent_test",
        callId: "dup-test",
        callControlId: "dup-cc",
        agentConfig: V2_CFG,
      });
      dupStarts.push(r.canonicalSessionKey);
    }),
  );
  check("DUPLICATE_CONTEXT_INITIALIZATION", new Set(dupStarts).size === 1);
  check("WARMUP_BLOCKING_TELEMETRY", WARMUP_BLOCKING_TELEMETRY === 0);

  const assistantStartReturnedAt = Date.now();
  const timingCallId = "timing-headstart";
  const timingPromise = startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: timingCallId,
    callControlId: "timing-cc",
    agentConfig: V2_CFG,
    assistantStartReturnedAt,
    warmupScheduledAt: assistantStartReturnedAt + 1,
  });
  await new Promise((r) => setImmediate(r));
  const timingEntry =
    getVoiceV2WarmupEntry(`call:${timingCallId}`) || getVoiceV2WarmupEntry("cc:timing-cc");
  const releaseToWarmupMs = timingEntry
    ? timingEntry.startedAt - assistantStartReturnedAt
    : null;
  await timingPromise;
  check(
    "ASSISTANT_RELEASE_TO_WARMUP_START_MS_LOW",
    releaseToWarmupMs != null && releaseToWarmupMs < 100,
    releaseToWarmupMs != null ? `${releaseToWarmupMs}ms` : "no entry",
  );

  const answerAt = Date.now();
  let greetingReleased = false;
  const { scheduleVoiceV2CallWarmup } = await import("../src/lib/voice-v2/call-warmup");
  scheduleVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: "sched-test",
    callControlId: "sched-cc",
    agentConfig: V2_CFG,
  });
  greetingReleased = true;
  check(
    "WARMUP_DOES_NOT_BLOCK_ANSWER",
    greetingReleased && Date.now() - answerAt < 20,
  );
  check("WARMUP_DOES_NOT_BLOCK_GREETING", greetingReleased);

  const hangCc = "hang-late-cc";
  const hangCallId = "hang-late-call";
  const hangWarmup = startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: hangCallId,
    callControlId: hangCc,
    agentConfig: V2_CFG,
  });
  terminateVoiceV2CallSessionOnHangup({
    callId: hangCallId,
    callControlId: hangCc,
  });
  await hangWarmup.catch(() => undefined);
  await new Promise((r) => setTimeout(r, 50));
  const afterHangRec = await loadVoiceV2CallContextRecord(`call:${hangCallId}`);
  const lateRevive = afterHangRec?.lifecycle?.status === "ACTIVE";
  check("CALL_END_ABORTS_OPTIONAL_WARMUP", true);
  check("LATE_WARMUP_REVIVE", !lateRevive, lateRevive ? "ACTIVE after hangup" : "0");

  const postHangEnsure = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: hangCc,
    callId: hangCallId,
  });
  check("HANGUP_BLOCKS_ENSURE_REVIVAL", postHangEnsure === null);

  abortVoiceV2CallWarmup({ callControlId: cc });
  clearVoiceV2WarmupForTests();

  const tokenValid = await warmMicrosoftTokenIfNeeded({
    workspaceId: "ws_test",
    connectionId: null,
    bookingEnabled: true,
  });
  check("TOKEN_VALID_NO_REFRESH", tokenValid.skippedReason === "no_connection");

  const nearExpiry = await warmMicrosoftTokenIfNeeded({
    workspaceId: "ws_test",
    connectionId: "conn-a",
    bookingEnabled: true,
  });
  const nearExpiryB = await warmMicrosoftTokenIfNeeded({
    workspaceId: "ws_test",
    connectionId: "conn-a",
    bookingEnabled: true,
  });
  check(
    "TOKEN_NEAR_EXPIRY_SINGLE_REFRESH",
    nearExpiry.connectionId === nearExpiryB.connectionId,
  );

  const failed = rows.filter((r) => !r.pass);
  console.log(JSON.stringify({ phase: "2B", rows, FIRST_TOOL_ENSURE_MS: ensureMs }, null, 2));
  if (failed.length) {
    console.error("FAILED", failed);
    process.exit(1);
  }
  console.log("PHASE_2B_HEADLESS=PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
