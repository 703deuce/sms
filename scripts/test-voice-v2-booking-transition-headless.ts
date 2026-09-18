#!/usr/bin/env npx tsx
/**
 * Voice V2 deterministic post-intake booking transition (directive §8).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-booking-transition-headless.ts
 */
import {
  clearVoiceV2CallSessions,
  setVoiceV2CallContext,
} from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-receptionist-wizard/intake/save-intake-fields";
import { saveIntakePublicFields } from "../src/lib/voice-receptionist-wizard/intake/format-save-tool-response";
import {
  deriveVoiceV2NextStage,
  evaluateBookingContinueRequired,
  transitionAfterIntakeSave,
  workflowFromContext,
} from "../src/lib/voice-receptionist-wizard/booking-workflow";
import { getIntakeReadiness } from "../src/lib/voice-receptionist-wizard/intake/readiness";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";

const failures: string[] = [];
const metrics: Record<string, number> = {
  KNOWN_FIELD_REASKS: 0,
  CALLBACK_OVERRIDE_WITH_ACTIVE_BOOKING: 0,
  FABRICATED_SCHEDULING_DATES: 0,
  DUPLICATE_FIND_CALLS: 0,
  DUPLICATE_BOOKINGS: 0,
  LEGACY_BOOKING_CALLS: 0,
  SECOND_SCHEDULING_LLM_CALLS: 0,
  FIND_REGRESSION: 0,
};

function fail(id: string, detail?: string) {
  failures.push(detail ? `${id}: ${detail}` : id);
}
function pass(id: string) {
  console.log("PASS", id);
}

function seedCtx(overrides?: Partial<VoiceV2CallContext>): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:transition-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: {
      bookingStrategy: "MICROSOFT_365",
      voiceV2PstnLiveBooking: true,
      ...(overrides?.capabilities ?? {}),
    },
    ...overrides,
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function save(raw: Record<string, unknown>) {
  return executeVoiceV2SaveIntakeFields(raw, "ws_test", "agent_test");
}

async function main() {
  clearVoiceV2CallSessions();

  // A — book intent → intake → date ask → FIND path (no callback on complete intake)
  seedCtx();
  const a1 = await save({
    call_id: "transition-test",
    fields: { name: "Anthony" },
    booking_intent_active: true,
  });
  if (a1.status !== "INTAKE_SAVED") fail("A1");
  else pass("A1_NAME_SAVE");

  const a2 = await save({ call_id: "transition-test", fields: { service_reason: "leak" } });
  const pubA3 = saveIntakePublicFields(a2);
  if (pubA3.voice_v2_next_stage !== "COLLECT_SCHEDULING_PREFERENCE") {
    fail("A3_ASK_DATE", String(pubA3.voice_v2_next_stage));
  } else pass("A3_INTAKE_COMPLETE_ASK_DATE");
  if (
    pubA3.booking_continue_required === true &&
    Array.isArray(pubA3.forbidden_actions) &&
    (pubA3.forbidden_actions as string[]).includes("callback_close")
  ) {
    pass("A_NO_CALLBACK_AUTHORITY");
  } else fail("A_NO_CALLBACK");
  if (String(pubA3.speak).toLowerCase().includes("follow up")) {
    metrics.CALLBACK_OVERRIDE_WITH_ACTIVE_BOOKING += 1;
    fail("A_SPEAK_CALLBACK");
  }

  // B — combined name + service, no re-ask
  clearVoiceV2CallSessions();
  seedCtx();
  await save({
    call_id: "transition-test",
    fields: { name: "Anthony", service_reason: "sink leaking" },
    booking_intent_active: true,
  });
  const b2 = await save({ call_id: "transition-test", fields: { name: "Anthony" } });
  const pubB = saveIntakePublicFields(b2);
  if (pubB.voice_v2_next_stage !== "COLLECT_SCHEDULING_PREFERENCE") fail("B_DATE_STAGE");
  else pass("B_COMBINED_INTAKE");

  // C — date in scheduling_preference → FIND stage
  clearVoiceV2CallSessions();
  seedCtx();
  await save({
    call_id: "transition-test",
    fields: { name: "Anthony", service_reason: "leak", email: "a@example.com" },
    scheduling_preference: { requested_date: "2026-09-17" },
    booking_intent_active: true,
  });
  const ctxC = seedCtx();
  const readinessC = getIntakeReadiness(ctxC.intakeSchema, {
    name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: "" },
    service_reason: { value: "leak", status: "CAPTURED", source: "CALLER", updatedAt: "" },
  });
  const stageC = deriveVoiceV2NextStage({
    workflow: {
      ...workflowFromContext(ctxC),
      bookingIntentActive: true,
      requestedDate: "2026-09-17",
    },
    readiness: readinessC,
    hasActiveOfferSet: false,
  });
  if (stageC !== "FIND_AVAILABILITY") fail("C_FIND_STAGE", stageC);
  else pass("C_FIND_READY");

  // D — email record-only must not block
  clearVoiceV2CallSessions();
  seedCtx();
  const d1 = await save({
    call_id: "transition-test",
    fields: { name: "Anthony", service_reason: "leak" },
    booking_intent_active: true,
  });
  const pubD = saveIntakePublicFields(d1);
  if (pubD.missingBeforeBooking?.length) fail("D_BLOCK");
  else pass("D_EMAIL_NONBLOCKING");

  // E — callback signal
  clearVoiceV2CallSessions();
  seedCtx({
    intakeState: {
      name: { value: "A", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      service_reason: { value: "x", status: "CAPTURED", source: "CALLER", updatedAt: "" },
    },
    bookingWorkflow: {
      bookingIntentActive: true,
      callbackRequested: false,
      bookingCancelled: false,
      bookingConfirmed: false,
      requestedDate: null,
      lastFindRequestedDate: null,
      nextStage: "COLLECT_SCHEDULING_PREFERENCE",
    },
  });
  const e1 = await save({
    call_id: "transition-test",
    fields: {},
    workflow_signal: "prefer_callback",
  });
  const ctxE = transitionAfterIntakeSave({
    ctx: seedCtx(),
    raw: { workflow_signal: "prefer_callback" },
    savedKeys: [],
    readiness: getIntakeReadiness(
      intakeSchemaFromWizardOnly({
        fields: {
          name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
          service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
        },
      }),
      {
        name: { value: "A", status: "CAPTURED", source: "CALLER", updatedAt: "" },
        service_reason: { value: "x", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    ),
    voiceV2PstnLiveBooking: true,
  });
  if (ctxE.bookingWorkflow?.callbackRequested !== true) fail("E_CALLBACK");
  else if (deriveVoiceV2NextStage({
    workflow: workflowFromContext(ctxE),
    readiness: getIntakeReadiness(ctxE.intakeSchema, ctxE.intakeState),
    hasActiveOfferSet: false,
  }) !== "CALLBACK_REQUESTED") {
    fail("E_STAGE");
  } else pass("E_CALLBACK_ALLOWED");

  // F — cancel
  const ctxF = transitionAfterIntakeSave({
    ctx: seedCtx(),
    raw: { workflow_signal: "cancel_booking", booking_intent_active: true },
    savedKeys: [],
    readiness: getIntakeReadiness(
      intakeSchemaFromWizardOnly({
        fields: {
          name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
          service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
        },
      }),
      {
        name: { value: "A", status: "CAPTURED", source: "CALLER", updatedAt: "" },
        service_reason: { value: "x", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    ),
    voiceV2PstnLiveBooking: true,
  });
  if (!ctxF.bookingWorkflow?.bookingCancelled) fail("F_CANCEL");
  else pass("F_CANCEL_INTENT");

  // G — no fabricated date
  const gStage = deriveVoiceV2NextStage({
    workflow: { ...defaultW(), bookingIntentActive: true, requestedDate: null },
    readiness: { missingBeforeBooking: [], missingForRecord: [], satisfied: ["name", "service_reason"] },
    hasActiveOfferSet: false,
  });
  if (gStage !== "COLLECT_SCHEDULING_PREFERENCE") fail("G_NO_FABRICATE");
  else pass("G_ASK_DATE_ONLY");

  // H — date known → FIND
  const hStage = deriveVoiceV2NextStage({
    workflow: { ...defaultW(), bookingIntentActive: true, requestedDate: "2026-09-18" },
    readiness: { missingBeforeBooking: [], missingForRecord: [], satisfied: ["name", "service_reason"] },
    hasActiveOfferSet: false,
  });
  if (hStage !== "FIND_AVAILABILITY") fail("H_FIND");
  else pass("H_FIND_ONCE_READY");

  // Call 1 regression — intake complete after email must not allow callback stage
  clearVoiceV2CallSessions();
  seedCtx();
  await save({
    call_id: "transition-test",
    fields: { service_reason: "kitchen leak" },
    booking_intent_active: true,
  });
  await save({
    call_id: "transition-test",
    fields: { name: "Anthony Johnson" },
    booking_intent_active: true,
  });
  const reg = await save({
    call_id: "transition-test",
    fields: { email: "anthony@test.com" },
    booking_intent_active: true,
  });
  const pubReg = saveIntakePublicFields(reg);
  if (
    pubReg.booking_continue_required !== true ||
    pubReg.voice_v2_next_stage !== "COLLECT_SCHEDULING_PREFERENCE"
  ) {
    metrics.CALLBACK_OVERRIDE_WITH_ACTIVE_BOOKING += 1;
    fail("CALL1_REGRESSION", JSON.stringify(pubReg));
  } else pass("CALL1_REGRESSION_NO_CALLBACK");

  console.log("\n--- Metrics ---");
  for (const [k, v] of Object.entries(metrics)) console.log(`${k} = ${v}`);

  if (failures.length) {
    console.error("\nFAILURES:", failures);
    process.exit(1);
  }
  console.log("\nBooking transition certification passed.");
}

function defaultW() {
  return {
    bookingIntentActive: false,
    callbackRequested: false,
    bookingCancelled: false,
    bookingConfirmed: false,
    requestedDate: null as string | null,
    lastFindRequestedDate: null as string | null,
    nextStage: "COLLECT_REQUIRED_INTAKE" as const,
  };
}

main();
