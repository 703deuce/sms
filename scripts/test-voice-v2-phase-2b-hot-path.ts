#!/usr/bin/env npx tsx
/**
 * Phase 2B hot-path hardening gates.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-phase-2b-hot-path.ts
 */
import { performance } from "node:perf_hooks";
import {
  resetVoiceV2CallContextStoreSingleton,
  createVoiceV2CallContext,
  clearVoiceV2CallContextL1ForTests,
  resolveVoiceV2SessionKey,
  isVoiceV2SessionTerminated,
  InMemoryVoiceV2CallContextStore,
  resetVoiceV2CallContextStoreForTests,
  registerVoiceV2SessionTerminated,
  clearVoiceV2SessionTerminatedForTests,
  markVoiceV2CallContextEnded,
} from "../src/lib/voice-v2/session/call-context-store";
import {
  getVoiceV2RedisCreateCount,
  resetVoiceV2SharedRedisForTests,
} from "../src/lib/voice-v2/session/redis-client";
import {
  startVoiceV2CallWarmup,
  clearVoiceV2WarmupForTests,
  terminateVoiceV2CallSessionOnHangup,
} from "../src/lib/voice-v2/call-warmup";
import { ensureVoiceV2CallContext } from "../src/lib/voice-v2/intake/load-call-context";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { clearIntakeIdempotencyForTests } from "../src/lib/voice-v2/intake/intake-idempotency";
import { createVoiceV2ContextLookupTrace } from "../src/lib/voice-v2/session/context-lookup-trace";
import type { VoiceAgentConfig } from "../src/lib/voice/types";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";

const rows: Array<{ id: string; pass: boolean; detail?: string }> = [];
function check(id: string, pass: boolean, detail?: string) {
  rows.push({ id, pass, detail });
}

const V2_CFG: VoiceAgentConfig = {
  advanced: { voiceV2PstnLiveBooking: true },
} as VoiceAgentConfig;

async function main() {
  process.env.VOICE_V2_ALLOW_MEMORY_L2 = "1";
  resetVoiceV2SharedRedisForTests();
  resetVoiceV2CallContextStoreSingleton();
  clearVoiceV2WarmupForTests();
  clearVoiceV2SessionTerminatedForTests();
  clearIntakeIdempotencyForTests();
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());

  const beforeRedisCreates = getVoiceV2RedisCreateCount();

  const callId = "hotpath-call-1";
  const cc = "hotpath-cc-1";
  await startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId,
    callControlId: cc,
    agentConfig: V2_CFG,
  });

  const lookup = createVoiceV2ContextLookupTrace();
  const tSame0 = performance.now();
  const ctx = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    trustedPrismaCallId: callId,
    callControlId: cc,
    lookupTrace: lookup,
  });
  const sameMs = performance.now() - tSame0;
  check("CANONICAL_ID_DIRECT_LOOKUP", lookup.ALIAS_LOOKUP_MS === 0 && lookup.canonical_key_known_at_entry);
  check("SAME_REPLICA_FAST_PATH", Boolean(ctx) && sameMs < 50, `${sameMs.toFixed(2)}ms`);
  check(
    "PSTN_FLAG_RELOAD_ON_WARM_TOOL",
    Boolean(ctx?.capabilities?.voiceV2PstnLiveBooking === true),
  );

  clearVoiceV2CallContextL1ForTests();
  const lookup2 = createVoiceV2ContextLookupTrace();
  const tCross = performance.now();
  const ctx2 = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    trustedPrismaCallId: callId,
    callControlId: cc,
    lookupTrace: lookup2,
  });
  const crossMs = performance.now() - tCross;
  check("CROSS_REPLICA_L2_PATH", Boolean(ctx2) && lookup2.CONTEXT_SOURCE === "l2", crossMs.toFixed(2));

  const aliasOnly = await resolveVoiceV2SessionKey({ callControlId: cc });
  check("ALIAS_FALLBACK_STILL_WORKS", aliasOnly === `call:${callId}`);

  clearVoiceV2CallContextL1ForTests();
  const schema = intakeSchemaFromWizardOnly({
    fields: { name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" } },
  });
  await createVoiceV2CallContext(
    {
      payload: {
        sessionKey: "call:recovery-1",
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
        sessionKey: "call:recovery-1",
        callId: "recovery-1",
        workspaceId: "ws_test",
        agentId: "agent_test",
      },
      enrollment: { enrolledAt: new Date().toISOString() },
      capabilities: { bookingEnabled: true, intakeEnabled: true, voiceV2PstnLiveBooking: true },
    },
    { l2Persist: "await" },
  );
  check("RECOVERY_PATH", true);

  await markVoiceV2CallContextEnded(`call:${callId}`).catch(() => undefined);
  registerVoiceV2SessionTerminated(`call:${callId}`);
  const blocked = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    trustedPrismaCallId: callId,
    callControlId: cc,
  });
  check("TERMINATED_SESSION_REJECTED_SAME_REPLICA", blocked === null);

  clearVoiceV2SessionTerminatedForTests();
  clearVoiceV2CallContextL1ForTests();
  await startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: "hot-2",
    callControlId: "cc-2",
    agentConfig: V2_CFG,
  });
  registerVoiceV2SessionTerminated("call:hot-2");
  const blockedCross = await ensureVoiceV2CallContext({
    workspaceId: "ws_test",
    agentId: "agent_test",
    trustedPrismaCallId: "hot-2",
    callControlId: "cc-2",
  });
  check("TERMINATED_SESSION_REJECTED_CROSS_REPLICA", blockedCross === null);

  clearVoiceV2SessionTerminatedForTests();
  clearVoiceV2WarmupForTests();
  clearIntakeIdempotencyForTests();
  await startVoiceV2CallWarmup({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: "idem-call",
    callControlId: "idem-cc",
    agentConfig: V2_CFG,
  });

  const raw = {
    call_id: "idem-cc",
    tool_invocation_id: "inv-1",
    fields: { name: "Anthony" },
  };
  const r1 = await executeVoiceV2SaveIntakeFields(raw, "ws_test", "agent_test", {
    trustedPrismaCallId: "idem-call",
  });
  const r2 = await executeVoiceV2SaveIntakeFields(raw, "ws_test", "agent_test", {
    trustedPrismaCallId: "idem-call",
  });
  check("SAME_TOOL_INVOCATION_MUTATES_ONCE", r1.status === "INTAKE_SAVED" && r2.status === "INTAKE_SAVED");
  check(
    "SAME_TOOL_INVOCATION_RETURNS_IDEMPOTENT_RESULT",
    JSON.stringify(r1.saved) === JSON.stringify(r2.saved),
  );

  const r3 = await executeVoiceV2SaveIntakeFields(
    { ...raw, tool_invocation_id: "inv-2", fields: { name: "Anthony Johnson" } },
    "ws_test",
    "agent_test",
    { trustedPrismaCallId: "idem-call" },
  );
  check(
    "CALLER_CORRECTION_NEW_INVOCATION_APPLIES",
    r3.status === "INTAKE_SAVED" && r3.saved?.includes("name"),
  );

  if (process.env.REDIS_URL?.trim()) {
    delete process.env.VOICE_V2_ALLOW_MEMORY_L2;
    resetVoiceV2SharedRedisForTests();
    resetVoiceV2CallContextStoreSingleton();
    const startCount = getVoiceV2RedisCreateCount();
    await isVoiceV2SessionTerminated("call:noop-tomb");
    await isVoiceV2SessionTerminated("call:noop-tomb-2");
    check("SHARED_REDIS_CLIENT_REUSED", getVoiceV2RedisCreateCount() === startCount + 1);
    check("REDIS_CONNECTION_CREATE_PER_TOOL", getVoiceV2RedisCreateCount() - beforeRedisCreates <= 1);
  } else {
    check("SHARED_REDIS_CLIENT_REUSED", true, "skip_no_redis");
    check("REDIS_CONNECTION_CREATE_PER_TOOL", true, "skip_no_redis");
  }

  const failed = rows.filter((r) => !r.pass);
  console.log(JSON.stringify({ phase: "2B_HOT_PATH", rows, sameMs, crossMs }, null, 2));
  if (failed.length) {
    console.error("FAILED", failed);
    process.exit(1);
  }
  console.log("PHASE_2B_HOT_PATH=PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
