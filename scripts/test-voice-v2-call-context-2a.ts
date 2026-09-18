#!/usr/bin/env npx tsx
/**
 * Phase 2A — Voice V2 CallContext L1/L2 + versioning gate.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-call-context-2a.ts
 */
import {
  InMemoryVoiceV2CallContextStore,
  createVoiceV2CallContext,
  loadVoiceV2CallContextRecord,
  patchVoiceV2CallContext,
  markVoiceV2CallContextEnded,
  resetVoiceV2CallContextStoreForTests,
  resetVoiceV2CallContextStoreSingleton,
  clearVoiceV2CallContextL1ForTests,
  getVoiceV2CallContextL1,
  getVoiceV2CallContextStore,
  DISTRIBUTED_TOKEN_LOCK_PRIMITIVE,
  tryRecoverVoiceV2CallContext,
} from "../src/lib/voice-receptionist-wizard/session/call-context-store";
import {
  VoiceV2SharedSessionUnavailableError,
  isVoiceV2ProductionMemoryL2Blocked,
} from "../src/lib/voice-receptionist-wizard/session/store-config";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";
import { VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION } from "../src/lib/voice-receptionist-wizard/session/types";

type Row = { id: string; pass: boolean; detail?: string };
const rows: Row[] = [];
function assert(id: string, pass: boolean, detail?: string) {
  rows.push({ id, pass, detail });
}

function basePayload(sessionKey: string): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  return {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/New_York",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
  };
}

async function main() {
  const shared = new InMemoryVoiceV2CallContextStore();
  resetVoiceV2CallContextStoreForTests(shared);

  const key = "cc:phase-2a";
  await createVoiceV2CallContext({
    payload: basePayload(key),
    identity: {
      sessionKey: key,
      callId: "call_phase_2a",
      workspaceId: "ws_test",
      agentId: "agent_test",
      telnyxCallControlId: "phase-2a",
    },
    enrollment: {
      enrolledAt: new Date().toISOString(),
      publishedConfigRevision: "ver_enroll_1",
      agentRevision: "ver_enroll_1",
      revisionGaps: ["providerConfigRevision"],
    },
  });

  assert("L1_HIT", Boolean(getVoiceV2CallContextL1(key)), "after create");

  clearVoiceV2CallContextL1ForTests();
  assert("L1_MISS", !getVoiceV2CallContextL1(key));
  const fromL2 = await loadVoiceV2CallContextRecord(key);
  assert("L1_MISS_L2_HIT", Boolean(fromL2) && Boolean(getVoiceV2CallContextL1(key)));

  const replicaKey = "cc:replica";
  await createVoiceV2CallContext({
    payload: basePayload(replicaKey),
    identity: {
      sessionKey: replicaKey,
      callId: "call_replica",
      workspaceId: "ws_test",
      agentId: "agent_test",
      telnyxCallControlId: "replica",
    },
    enrollment: { enrolledAt: new Date().toISOString(), publishedConfigRevision: "v1" },
  });
  await patchVoiceV2CallContext({
    canonicalKey: replicaKey,
    expectedVersion: 0,
    writeClass: "A",
    mutate: (r) => ({
      ...r,
      bookingPreference: { requestedDate: "2026-09-16", updatedAt: new Date().toISOString() },
    }),
  });
  clearVoiceV2CallContextL1ForTests();
  const replicaRead = await loadVoiceV2CallContextRecord(replicaKey);
  assert(
    "REPLICA_A_WRITE_REPLICA_B_READ",
    replicaRead?.bookingPreference?.requestedDate === "2026-09-16",
  );

  let rec = await loadVoiceV2CallContextRecord(key);
  const v0 = rec!.stateVersion;
  const p1 = await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: v0,
    writeClass: "B",
    mutate: (r) => ({ ...r, booking: { ...r.booking, stage: "FIND" } }),
  });
  rec = await loadVoiceV2CallContextRecord(key);
  assert(
    "STATE_VERSION_INCREMENT",
    p1.applied && rec!.stateVersion === v0 + 1,
    `v${rec?.stateVersion}`,
  );

  const stale = await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: v0,
    writeClass: "A",
    mutate: (r) => ({
      ...r,
      bookingPreference: { requestedDate: "2026-09-17", updatedAt: new Date().toISOString() },
    }),
  });
  assert("STALE_CAS_REJECTED", !stale.applied && stale.reason === "STALE_VERSION");

  await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: rec!.stateVersion,
    writeClass: "A",
    mutate: (r) => ({
      ...r,
      bookingPreference: { requestedDate: "2026-09-18", updatedAt: new Date().toISOString() },
    }),
  });
  const lateTuesday = await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: v0,
    writeClass: "A",
    mutate: (r) => ({
      ...r,
      bookingPreference: { requestedDate: "2026-09-17", updatedAt: new Date().toISOString() },
    }),
  });
  const afterRace = await loadVoiceV2CallContextRecord(key);
  assert(
    "STALE_VALUE_NOT_REAPPLIED",
    !lateTuesday.applied &&
      afterRace?.bookingPreference?.requestedDate === "2026-09-18",
    afterRace?.bookingPreference?.requestedDate,
  );

  const recovery = await tryRecoverVoiceV2CallContext({
    callId: "missing_call",
    workspaceId: "ws_test",
    agentId: "agent_test",
    requireExistingEnrollment: false,
  });
  assert(
    "ACTIVE_CALL_L2_MISS_FAILS_SAFE",
    !recovery.ok && recovery.code === "CALL_CONTEXT_RECOVERY_UNAVAILABLE",
  );

  const preserved = await loadVoiceV2CallContextRecord(key);
  assert(
    "CONFIG_REVISION_PRESERVED",
    preserved?.enrollment.publishedConfigRevision === "ver_enroll_1",
  );

  await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: preserved!.stateVersion,
    writeClass: "A",
    mutate: (r) => ({
      ...r,
      booking: {
        ...r.booking,
        currentOffer: { offerSetId: "v2offer_xyz", slotIds: ["slot_1"] },
      },
    }),
  });
  clearVoiceV2CallContextL1ForTests();
  const offerRead = await loadVoiceV2CallContextRecord(key);
  assert(
    "OFFER_REFERENCE_SURVIVES_REPLICA",
    offerRead?.booking.currentOffer?.offerSetId === "v2offer_xyz",
  );

  const ended = await markVoiceV2CallContextEnded(key);
  assert("MARK_ENDED", ended.applied === true);
  const endedRec = await loadVoiceV2CallContextRecord(key);
  const endedWrite = await patchVoiceV2CallContext({
    canonicalKey: key,
    expectedVersion: endedRec!.stateVersion,
    writeClass: "B",
    mutate: (r) => ({ ...r, booking: { ...r.booking, stage: "X" } }),
  });
  assert(
    "ENDED_SESSION_REJECTS_LATE_WRITE",
    !endedWrite.applied && endedWrite.reason === "SESSION_ENDED",
  );

  const finalRec = await loadVoiceV2CallContextRecord(key);
  assert(
    "SCHEMA_VERSION_SEPARATE_FROM_STATE_VERSION",
    finalRec!.schemaVersion === VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION &&
      finalRec!.stateVersion > 0 &&
      finalRec!.schemaVersion !== finalRec!.stateVersion,
  );

  assert(
    "DISTRIBUTED_TOKEN_LOCK_PRIMITIVE",
    DISTRIBUTED_TOKEN_LOCK_PRIMITIVE.includes("acquireLock"),
    DISTRIBUTED_TOKEN_LOCK_PRIMITIVE,
  );

  const prevNode = process.env.NODE_ENV;
  const prevRedis = process.env.REDIS_URL;
  const prevAllow = process.env.VOICE_V2_ALLOW_MEMORY_L2;
  process.env.NODE_ENV = "production";
  delete process.env.REDIS_URL;
  delete process.env.VOICE_V2_ALLOW_MEMORY_L2;
  resetVoiceV2CallContextStoreSingleton();
  let prodBlocked = false;
  try {
    getVoiceV2CallContextStore();
  } catch (e) {
    prodBlocked =
      e instanceof VoiceV2SharedSessionUnavailableError ||
      isVoiceV2ProductionMemoryL2Blocked();
  }
  process.env.NODE_ENV = prevNode;
  if (prevRedis) process.env.REDIS_URL = prevRedis;
  else delete process.env.REDIS_URL;
  if (prevAllow) process.env.VOICE_V2_ALLOW_MEMORY_L2 = prevAllow;
  resetVoiceV2CallContextStoreForTests(new InMemoryVoiceV2CallContextStore());
  assert("PRODUCTION_L2_MISSING_FAILS_CLOSED", prodBlocked);

  const failed = rows.filter((r) => !r.pass);
  console.log(JSON.stringify({ phase: "2A", rows, DISTRIBUTED_TOKEN_LOCK_PRIMITIVE }, null, 2));
  if (failed.length) {
    console.error("FAILED", failed);
    process.exit(1);
  }
  console.log("PHASE_2A_GATE=PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
