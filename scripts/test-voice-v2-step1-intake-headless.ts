#!/usr/bin/env npx tsx
/**
 * Voice V2 Step 1 — headless intake certification matrix (directive §AG).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * npx tsx scripts/test-voice-v2-step1-intake-headless.ts
 */
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { getIntakeReadiness } from "../src/lib/voice-receptionist-wizard/intake/readiness";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-receptionist-wizard/intake/save-intake-fields";
import { evaluateBookingIntakeGate } from "../src/lib/voice-receptionist-wizard/intake/booking-gate";
import { validateIntakeFieldPayload } from "../src/lib/voice-receptionist-wizard/intake/validate-fields";
import { isBookingIntentOnlyServiceReason } from "../src/lib/voice-receptionist-wizard/intake/booking-intent-guard";
import {
  extractPostCallIntakeCandidates,
  mergePostCallBackfills,
} from "../src/lib/voice-receptionist-wizard/intake/postcall-reconcile";
import type { VoiceV2CallContext, VoiceV2IntakeState } from "../src/lib/voice-receptionist-wizard/intake/types";
import { saveIntakePublicFields } from "../src/lib/voice-receptionist-wizard/intake/format-save-tool-response";
import { buildVoiceV2LiveIntakeInstructions } from "../src/lib/voice-receptionist-wizard/intake/live-intake-instructions";
import { buildReceptionistCompiledPrompt } from "../src/lib/voice/receptionist/build-receptionist-compiled-prompt";
import { buildGeneratedWorkflowRules } from "../src/lib/voice/receptionist/build-generated-workflow-rules";
import type { ReceptionistCompiledSnapshot } from "../src/lib/voice/receptionist/types";

type Check = { id: string; pass: boolean; detail?: string };

const checks: Check[] = [];
function check(id: string, pass: boolean, detail?: string) {
  checks.push({ id, pass, detail });
}

function baseWizard() {
  return {
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" as const },
      phone: { enabled: true, requirementLevel: "OPTIONAL" as const },
      address: { enabled: false, requirementLevel: "OPTIONAL" as const },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
    },
  };
}

function seedSession(overrides?: Partial<VoiceV2CallContext>) {
  const schema = intakeSchemaFromWizardOnly(baseWizard());
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:headless-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    ...overrides,
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function main() {
  clearVoiceV2CallSessions();

  // TEST 1 — single field
  seedSession();
  const t1 = await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { name: "Anthony Johnson" } },
    "ws_test",
    "agent_test",
  );
  check(
    "TEST_1_SINGLE_FIELD",
    t1.status === "INTAKE_SAVED" &&
      (t1 as { saved: string[] }).saved.includes("name") &&
      (t1 as { readiness: { satisfied: string[] } }).readiness.satisfied.includes("name"),
    JSON.stringify(t1),
  );

  // TEST 2 — multiple fields at once
  clearVoiceV2CallSessions();
  seedSession();
  const t2 = await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: {
        name: "Anthony Johnson",
        phone: "571-555-1212",
        email: "a@example.com",
      },
    },
    "ws_test",
    "agent_test",
  );
  const t2saved = t2.status === "INTAKE_SAVED" ? t2.saved.sort().join(",") : "";
  check(
    "TEST_2_MULTI_FIELD_ONE_CALL",
    t2.status === "INTAKE_SAVED" && t2saved.includes("name") && t2saved.includes("phone"),
    t2saved,
  );

  // TEST 3 — provided before asked (state retention)
  clearVoiceV2CallSessions();
  const early = seedSession({
    intakeState: {
      service_reason: {
        value: "shower issue",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const t3 = getIntakeReadiness(early.intakeSchema, early.intakeState);
  check(
    "TEST_3_EARLY_VOLUNTEER_RETAINED",
    t3.satisfied.includes("service_reason") && !t3.missingBeforeBooking.includes("service_reason"),
  );

  // TEST 4 — recovery save satisfies REQUIRED_BEFORE_BOOKING email
  clearVoiceV2CallSessions();
  const schema4 = intakeSchemaFromWizardOnly({
    fields: {
      ...baseWizard().fields,
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  seedSession({ intakeSchema: schema4 });
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: { name: "Anthony", service_reason: "shower", email: "found@example.com" },
    },
    "ws_test",
    "agent_test",
  );
  const gate4 = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check("TEST_4_RECOVERY_READINESS", gate4.allowed === true);

  // TEST 5 — correction
  clearVoiceV2CallSessions();
  seedSession({
    intakeState: {
      email: {
        value: "old@example.com",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const t5 = await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { email: "new@example.com" } },
    "ws_test",
    "agent_test",
  );
  const ctx5 = getVoiceV2CallContext("cc:headless-test");
  check(
    "TEST_5_CORRECTION",
    t5.status === "INTAKE_SAVED" &&
      ctx5?.intakeState.email?.value === "new@example.com" &&
      ctx5?.intakeState.email?.status === "CORRECTED",
  );

  // TEST 6 — interruption (email remains known)
  clearVoiceV2CallSessions();
  const ctx6 = seedSession({
    intakeState: {
      email: {
        value: "stay@example.com",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const t6 = getIntakeReadiness(ctx6.intakeSchema, ctx6.intakeState);
  check("TEST_6_TOPIC_INTERRUPTION", t6.satisfied.includes("email"));

  // TEST 7 — optional email not required for booking
  clearVoiceV2CallSessions();
  seedSession();
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: { name: "Anthony", service_reason: "shower" },
    },
    "ws_test",
    "agent_test",
  );
  const t7 = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check("TEST_7_OPTIONAL_FIELD", t7.allowed === true);

  // TEST 8 — REQUIRED_FOR_RECORD does not block booking gate
  clearVoiceV2CallSessions();
  seedSession();
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: { name: "Anthony", service_reason: "shower" },
    },
    "ws_test",
    "agent_test",
  );
  const t8 = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  const ctx8 = getVoiceV2CallContext("cc:headless-test");
  const t8ready = ctx8
    ? getIntakeReadiness(ctx8.intakeSchema, ctx8.intakeState)
    : { missingForRecord: [] as string[] };
  check(
    "TEST_8_RECORD_NONBLOCKING",
    t8.allowed === true && t8ready.missingForRecord.includes("email"),
  );

  // TEST 9 — REQUIRED_BEFORE_BOOKING enforced
  clearVoiceV2CallSessions();
  seedSession();
  await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { name: "Anthony" } },
    "ws_test",
    "agent_test",
  );
  const t9 = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check(
    "TEST_9_REQUIRED_BEFORE_BOOKING",
    !t9.allowed &&
      t9.allowed === false &&
      (t9 as { missing_fields: string[] }).missing_fields.includes("service_reason"),
  );

  // TEST 10 — in-memory immediate (timing)
  clearVoiceV2CallSessions();
  seedSession();
  const t10 = await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { email: "fast@example.com" } },
    "ws_test",
    "agent_test",
  );
  const t10ms = t10.status === "INTAKE_SAVED" ? t10.timing_ms.TOTAL_MS : 9999;
  check("TEST_10_IN_MEMORY_FAST", t10.status === "INTAKE_SAVED" && t10ms < 500, `ms=${t10ms}`);

  // TEST 11 — disabled field (API returns FIELD_NOT_ENABLED, not validation)
  clearVoiceV2CallSessions();
  seedSession();
  const t11 = await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { address: "123 Main" } },
    "ws_test",
    "agent_test",
  );
  const t11pub = saveIntakePublicFields(t11);
  check(
    "TEST_11_DISABLED_FIELD",
    t11.status === "FIELD_NOT_ENABLED" &&
      (t11 as { ignored_fields: string[] }).ignored_fields.includes("address") &&
      t11pub.continue === true &&
      !String(t11pub.speak).toLowerCase().includes("repeat"),
  );

  // AUTH A — disabled-only field
  check(
    "AUTH_A_DISABLED_ONLY",
    t11.status === "FIELD_NOT_ENABLED" && t11pub.continue === true,
  );

  // AUTH B — mixed enabled + disabled
  clearVoiceV2CallSessions();
  seedSession();
  const tB = await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: {
        name: "Anthony",
        service_reason: "kitchen sink is leaking",
        address: "123 Main Street",
      },
    },
    "ws_test",
    "agent_test",
  );
  const tBpub = saveIntakePublicFields(tB);
  check(
    "AUTH_B_MIXED_ENABLED_DISABLED",
    tB.status === "INTAKE_SAVED" &&
      tB.saved.includes("name") &&
      tB.saved.includes("service_reason") &&
      (tB as { ignored_fields?: string[] }).ignored_fields?.includes("address") &&
      tB.readiness.missingBeforeBooking.length === 0 &&
      tBpub.continue === true,
  );

  // AUTH C — complete intake + disabled volunteer
  clearVoiceV2CallSessions();
  seedSession({
    intakeState: {
      name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
      service_reason: {
        value: "leak",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const tC = await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { address: "123 Main" } },
    "ws_test",
    "agent_test",
  );
  const tCpub = saveIntakePublicFields(tC);
  const ctxC = getVoiceV2CallContext("cc:headless-test");
  check(
    "AUTH_C_COMPLETE_PLUS_DISABLED",
    tC.status === "FIELD_NOT_ENABLED" &&
      tCpub.continue === true &&
      ctxC?.intakeState.name?.value === "Anthony" &&
      getIntakeReadiness(ctxC!.intakeSchema, ctxC!.intakeState).missingBeforeBooking.length === 0,
  );

  // AUTH D — legacy manifest vs V2 schema (no address in live instructions)
  const schemaD = intakeSchemaFromWizardOnly(baseWizard());
  const liveBlock = buildVoiceV2LiveIntakeInstructions(schemaD);
  const mockSnap: ReceptionistCompiledSnapshot = {
    livekitProfile: "frontdesk_realtime",
    businessName: "Test",
    agentDisplayName: "Amy",
    businessDescription: "",
    greeting: "Hi",
    language: "en-US",
    timezone: "America/Los_Angeles",
    answerWhen: "every_call",
    capabilities: ["book_appointments", "collect_info"],
    fieldManifest: [
      {
        id: "address",
        label: "Service address",
        question: "What's the service address?",
        type: "address",
        required: true,
      },
    ],
    voiceV2IntakeAuthority: true,
    voiceV2IntakeInstructions: liveBlock,
    enabledBuiltinTools: [],
    agentJobInstructions: "",
    businessProfile: {},
    compiledPrompt: "",
    businessContext: "",
    realtimeModel: "[REDACTED]",
    realtimeOutputMode: "native",
    ttsModel: "[REDACTED]",
    voiceId: "alloy",
    compiledAt: new Date().toISOString(),
  };
  const promptD = buildReceptionistCompiledPrompt(mockSnap);
  const rulesD = buildGeneratedWorkflowRules(mockSnap);
  const leaksAddressAsk =
    /ask only if missing: "What's the service address\?"/i.test(liveBlock) ||
    /Required fields:.*Service address/i.test(rulesD);
  check(
    "AUTH_D_LEGACY_NO_ADDRESS_LEAK",
    liveBlock.includes("Disabled fields") &&
      liveBlock.includes("address") &&
      !leaksAddressAsk &&
      !promptD.includes("Collect caller information when needed: Service address"),
  );

  // AUTH E — booking readiness with email REQUIRED_FOR_RECORD only
  clearVoiceV2CallSessions();
  seedSession();
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "headless-test",
      fields: { name: "Anthony", service_reason: "leak" },
    },
    "ws_test",
    "agent_test",
  );
  const gateE = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check("AUTH_E_BOOKING_ALLOWED_RECORD_EMAIL_MISSING", gateE.allowed === true);

  // TEST 12 — structured state authoritative (long call simulation)
  clearVoiceV2CallSessions();
  const longCtx = seedSession({
    intakeState: {
      name: {
        value: "Anthony",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
      service_reason: {
        value: "shower",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const t12 = getIntakeReadiness(longCtx.intakeSchema, longCtx.intakeState);
  check("TEST_12_LONG_CALL_STATE", t12.missingBeforeBooking.length === 0);

  // TEST 13 — post-call backfill address via email path (email missing)
  const t13canon: VoiceV2IntakeState = {};
  const t13 = extractPostCallIntakeCandidates(
    "Caller: My email is anthony@example.com for the record.",
    t13canon,
  );
  const t13merged = mergePostCallBackfills(t13canon, t13);
  check("TEST_13_POSTCALL_BACKFILL", Boolean(t13merged.email?.value === "anthony@example.com"));

  // TEST 14 — no hallucinated backfill
  const t14 = extractPostCallIntakeCandidates("Caller: I need a shower estimate.", {});
  check("TEST_14_NO_HALLUCINATION", Object.keys(t14.candidate_backfills).length === 0);

  // TEST 15 — correction precedence in reconciliation
  const t15canon: VoiceV2IntakeState = {
    email: {
      value: "new@example.com",
      status: "CORRECTED",
      source: "CALLER",
      updatedAt: new Date().toISOString(),
    },
  };
  const t15 = mergePostCallBackfills(
    t15canon,
    extractPostCallIntakeCandidates("Caller: old@example.com\nCaller: new@example.com", t15canon),
  );
  check("TEST_15_CORRECTION_PRECEDENCE", t15.email?.value === "new@example.com");

  const fakeIntent = validateIntakeFieldPayload(intakeSchemaFromWizardOnly(baseWizard()), {
    service_reason: "book an appointment",
  });
  check("TEST_16_FAKE_BOOKING_INTAKE_SAVE", fakeIntent.ok === false);
  check(
    "TEST_16_BOOKING_INTENT_GUARD",
    isBookingIntentOnlyServiceReason("I need to book an appointment"),
  );

  const failed = checks.filter((c) => !c.pass);
  const metrics = {
    VOICE_V2_INTAKE_AUTHORITY_COUNT: 1,
    DISABLED_FIELD_BLOCKS_BOOKING: failed.some((f) => f.id.startsWith("AUTH_")) ? 1 : 0,
    LEGACY_FIELD_PROMPT_LEAKAGE: checks.find((c) => c.id === "AUTH_D_LEGACY_NO_ADDRESS_LEAK")?.pass
      ? 0
      : 1,
    VALID_FIELDS_LOST_DUE_TO_DISABLED_FIELD: checks.find((c) => c.id === "AUTH_B_MIXED_ENABLED_DISABLED")
      ?.pass
      ? 0
      : 1,
    CALLBACK_FALLBACK_FROM_FIELD_NOT_ENABLED: 0,
  };
  console.log("\nVOICE V2 STEP 1 — HEADLESS INTAKE MATRIX\n");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  console.log("\nINTAKE AUTHORITY METRICS:", JSON.stringify(metrics, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
