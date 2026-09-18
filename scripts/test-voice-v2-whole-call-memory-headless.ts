/**
 * Whole-call memory / no-reask (generic custom fields).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-whole-call-memory-headless.ts
 */
import assert from "node:assert/strict";
import { transitionAfterBookingConfirmed } from "../src/lib/voice-receptionist-wizard/booking-workflow";
import {
  resolveVoiceV2CallerFieldState,
  resolveVoiceV2KnownCallerState,
} from "../src/lib/voice-receptionist-wizard/intake/caller-field-state";
import { executeVoiceV2FinalizeCallerRequest } from "../src/lib/voice-receptionist-wizard/finalize-caller-request";
import { applyCallerAniToIntakeState } from "../src/lib/voice-receptionist-wizard/intake/caller-phone";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-receptionist-wizard/intake/save-intake-fields";
import { getIntakeReadiness } from "../src/lib/voice-receptionist-wizard/intake/readiness";
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-receptionist-wizard/intake/session-store";
import type { VoiceV2CallContext, VoiceV2IntakeWizardConfig } from "../src/lib/voice-receptionist-wizard/intake/types";
import { reconcileVoiceV2PostCallRecord } from "../src/lib/voice-receptionist-wizard/post-call/reconciliation";

function check(name: string, ok: boolean) {
  console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  assert.ok(ok, name);
}

function seed(
  wizard: VoiceV2IntakeWizardConfig,
  callerFields?: import("@/lib/receptionist-wizard/advanced-types").CallerFieldRow[],
  overrides?: Partial<VoiceV2CallContext>,
) {
  const schema = intakeSchemaFromWizardOnly(wizard, callerFields);
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:memory-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: overrides?.intakeState ?? {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
    ...overrides,
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function main() {
  clearVoiceV2CallSessions();

  const customFields = [
    { id: "dinosaury", enabled: true, required: true, label: "Dinosaury", askWhen: "when_booking" },
    { id: "mother_s_name", enabled: true, required: true, label: "Mother's name", askWhen: "always" },
  ];

  // A — dinosaury before booking
  seed(
    {
      fields: {
        email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
        service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      },
    },
    customFields,
  );
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "memory-test",
      fields: { dinosaury: "velociraptor", service_reason: "leak" },
    },
    "ws_test",
    "agent_test",
  );
  let ctx = getVoiceV2CallContext("cc:memory-test")!;
  const readyA = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  check("A_DINOSAURY_KNOWN", !readyA.missingBeforeBooking.includes("dinosaury"));

  // B — multi-field same turn
  clearVoiceV2CallSessions();
  seed(
    { fields: { name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } },
    customFields,
  );
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "memory-test",
      fields: { name: "Anthony", mother_s_name: "Patricia", service_reason: "kitchen leak" },
      scheduling_preference: { requested_date: "2026-09-20" },
    },
    "ws_test",
    "agent_test",
  );
  ctx = getVoiceV2CallContext("cc:memory-test")!;
  const knownB = resolveVoiceV2KnownCallerState(ctx);
  check(
    "B_MULTI_FIELD",
    knownB.known.includes("name") &&
      knownB.known.includes("mother_s_name") &&
      knownB.known.includes("service_reason"),
  );

  // F — correction Patrice
  await executeVoiceV2SaveIntakeFields(
    { call_id: "memory-test", fields: { mother_s_name: "Patrice" } },
    "ws_test",
    "agent_test",
  );
  ctx = getVoiceV2CallContext("cc:memory-test")!;
  check("F_CORRECTION", ctx.intakeState.mother_s_name?.value === "Patrice");

  // H — ANI phone
  clearVoiceV2CallSessions();
  seed({ fields: { phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } });
  ctx = applyCallerAniToIntakeState(getVoiceV2CallContext("cc:memory-test")!, "+15551112222");
  setVoiceV2CallContext(ctx);
  const phoneState = resolveVoiceV2CallerFieldState({
    intakeSchema: ctx.intakeSchema,
    intakeState: ctx.intakeState,
    fieldKey: "phone",
  });
  check("H_ANI_PHONE_KNOWN", phoneState.disposition === "KNOWN");

  // J — REQUIRED_FOR_RECORD missing after BOOKED still finalizes
  clearVoiceV2CallSessions();
  seed(
    {
      fields: {
        name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      },
    },
    customFields,
  );
  ctx = transitionAfterBookingConfirmed(getVoiceV2CallContext("cc:memory-test")!);
  setVoiceV2CallContext(ctx);
  const finJ = await executeVoiceV2FinalizeCallerRequest({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "memory-test",
  });
  check(
    "J_RECORD_MISSING_FINALIZED",
    finJ.status === "FINALIZED" && finJ.record_complete === false,
  );

  // K — flagship composition (booking readiness + post-call reconcile)
  clearVoiceV2CallSessions();
  seed(
    {
      fields: {
        name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      },
    },
    customFields,
  );
  await executeVoiceV2SaveIntakeFields(
    {
      call_id: "memory-test",
      fields: {
        name: "Anthony",
        mother_s_name: "Patricia",
        dinosaury: "velociraptor",
        service_reason: "leak",
      },
      scheduling_preference: { requested_date: "2026-09-20" },
    },
    "ws_test",
    "agent_test",
  );
  ctx = getVoiceV2CallContext("cc:memory-test")!;
  const readyK = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  check(
    "K_BOOKING_ONLY_EMAIL",
    readyK.missingBeforeBooking.length === 1 && readyK.missingBeforeBooking[0] === "email",
  );
  await executeVoiceV2SaveIntakeFields(
    { call_id: "memory-test", fields: { email: "anthony@example.com" } },
    "ws_test",
    "agent_test",
  );
  ctx = transitionAfterBookingConfirmed(getVoiceV2CallContext("cc:memory-test")!);
  setVoiceV2CallContext(ctx);
  const recon = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: ctx.intakeSchema,
      intakeState: ctx.intakeState,
      primaryOutcome: "BOOKED",
    },
    transcript: {
      provider: "deepgram",
      model: "nova-3",
      fullText: "Caller: Actually her name is Patrice.",
      callerText: "Actually her name is Patrice.",
      agentText: "",
    },
    candidates: [
      {
        fieldKey: "mother_s_name",
        verdict: "FOUND",
        candidateValue: "Patrice",
        confidence: 0.93,
        isExplicitCorrection: true,
        source: "POST_CALL_LLM_EXTRACTION",
      },
    ],
  });
  check(
    "K_FLAGSHIP_RECONCILE",
    recon.reconciledIntake.mother_s_name?.value === "Patrice" &&
      recon.fields.some((f) => f.fieldKey === "mother_s_name" && f.verdict === "CORRECT"),
  );

  console.log("\nALL_WHOLE_CALL_MEMORY_TESTS_PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
