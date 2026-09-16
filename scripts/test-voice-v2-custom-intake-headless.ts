#!/usr/bin/env npx tsx
/**
 * Generic custom wizard intake fields — headless acceptance (Voice V2).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-custom-intake-headless.ts
 */
import type { CallerFieldRow } from "../src/lib/receptionist-wizard/advanced-types";
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-v2/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import { validateIntakeFieldPayload } from "../src/lib/voice-v2/intake/validate-fields";
import { evaluateBookingIntakeGate } from "../src/lib/voice-v2/intake/booking-gate";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function baseWizard() {
  return {
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" as const },
    },
  };
}

function seedContext(callerFields: CallerFieldRow[], sessionKey = "cc:custom-intake-test"): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly(baseWizard(), callerFields);
  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {
      phone: {
        value: "+15551234567",
        status: "PREFILLED",
        source: "CALLER_ID",
        updatedAt: new Date().toISOString(),
      },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function save(raw: Record<string, unknown>, sessionKey = "cc:custom-intake-test") {
  const cc = sessionKey.replace(/^cc:/, "");
  return executeVoiceV2SaveIntakeFields({ call_id: cc, ...raw }, "ws_test", "agent_test");
}

async function main() {
  clearVoiceV2CallSessions();

  // CASE 1 — custom field remembered
  seedContext([
    {
      id: "mothers_name",
      label: "Mother's name",
      question: "What is your mother's name?",
      required: false,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
  ]);
  const c1 = await save({ fields: { mothers_name: "Patricia" } });
  pass("CASE1_SAVED", c1.status === "INTAKE_SAVED", String(c1.status));
  const ctx1 = getVoiceV2CallContext("cc:custom-intake-test")!;
  pass("CASE1_VALUE", ctx1.intakeState.mothers_name?.value === "Patricia");
  const ready1 = getIntakeReadiness(ctx1.intakeSchema, ctx1.intakeState);
  pass("CASE1_NOT_MISSING", !ready1.missingBeforeBooking.includes("mothers_name"));
  pass("CASE1_SATISFIED", ready1.satisfied.includes("mothers_name"));

  // CASE 2 — correction
  const c2 = await save({ fields: { mothers_name: "Patrice" } });
  pass("CASE2_SAVED", c2.status === "INTAKE_SAVED");
  const ctx2 = getVoiceV2CallContext("cc:custom-intake-test")!;
  pass("CASE2_VALUE", ctx2.intakeState.mothers_name?.value === "Patrice");
  pass("CASE2_CORRECTED", ctx2.intakeState.mothers_name?.status === "CORRECTED");

  clearVoiceV2CallSessions();

  // CASE 3 — multiple custom fields one utterance
  seedContext([
    {
      id: "pet_name",
      label: "Pet name",
      required: false,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
    {
      id: "vehicle_year",
      label: "Vehicle year",
      required: false,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
  ]);
  const c3 = await save({
    fields: { pet_name: "Max", vehicle_year: "2021" },
  });
  pass("CASE3_SAVED", c3.status === "INTAKE_SAVED");
  const ctx3 = getVoiceV2CallContext("cc:custom-intake-test")!;
  pass("CASE3_PET", ctx3.intakeState.pet_name?.value === "Max");
  pass("CASE3_YEAR", ctx3.intakeState.vehicle_year?.value === "2021");

  clearVoiceV2CallSessions();

  // CASE 4 — built-in + custom together
  seedContext([
    {
      id: "mothers_name",
      label: "Mother's name",
      required: false,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
  ]);
  const c4 = await save({
    fields: {
      name: "Anthony",
      service_reason: "kitchen leak",
      mothers_name: "Patricia",
    },
  });
  pass("CASE4_SAVED", c4.status === "INTAKE_SAVED");
  const ctx4 = getVoiceV2CallContext("cc:custom-intake-test")!;
  pass("CASE4_NAME", ctx4.intakeState.name?.value === "Anthony");
  pass("CASE4_SERVICE", ctx4.intakeState.service_reason?.value === "kitchen leak");
  pass("CASE4_CUSTOM", ctx4.intakeState.mothers_name?.value === "Patricia");
  const ready4 = getIntakeReadiness(ctx4.intakeSchema, ctx4.intakeState);
  pass(
    "CASE4_NONE_MISSING",
    !ready4.missingBeforeBooking.includes("name") &&
      !ready4.missingBeforeBooking.includes("service_reason") &&
      !ready4.missingBeforeBooking.includes("mothers_name"),
  );

  clearVoiceV2CallSessions();

  // CASE 5 — unknown field key
  seedContext([]);
  const schema5 = intakeSchemaFromWizardOnly(baseWizard(), []);
  const v5 = validateIntakeFieldPayload(schema5, { not_in_schema: "x" });
  pass("CASE5_REJECT_UNKNOWN", v5.disabledFields.includes("not_in_schema"));
  pass("CASE5_NO_NORMALIZED", !v5.normalized.not_in_schema);

  clearVoiceV2CallSessions();

  // CASE 6 — requirement semantics
  seedContext([
    {
      id: "gate_code",
      label: "Gate code",
      required: true,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
    {
      id: "insurance_provider",
      label: "Insurance",
      required: true,
      askWhen: "every_caller",
      confirm: false,
      enabled: true,
    },
  ]);
  const ctx6 = getVoiceV2CallContext("cc:custom-intake-test")!;
  const gateBefore = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "custom-intake-test",
  });
  pass(
    "CASE6_BLOCKS_REQUIRED_BEFORE_BOOKING",
    gateBefore.allowed === false &&
      gateBefore.status === "MISSING_REQUIRED_FIELDS" &&
      gateBefore.missing_fields.includes("gate_code"),
    JSON.stringify(gateBefore),
  );
  pass(
    "CASE6_RECORD_NOT_BLOCKING",
    !gateBefore.allowed && !gateBefore.missing_fields.includes("insurance_provider"),
  );
  await save({ fields: { name: "A", service_reason: "leak", gate_code: "1234" } });
  const gateAfter = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "custom-intake-test",
  });
  pass("CASE6_ALLOWED_AFTER_GATE", gateAfter.allowed === true, JSON.stringify(gateAfter));

  clearVoiceV2CallSessions();

  // CASE 7 — scheduling regression (delegate to scheduling test file; quick smoke)
  seedContext([]);
  const sched = await save({
    fields: {},
    scheduling_preference: { requested_date: "2026-09-17" },
    booking_intent_active: true,
  });
  pass("CASE7_SCHED_NOT_INTAKE", sched.status === "SCHEDULING_PREFERENCE_NOTED", String(sched.status));
  const step7b = await save({
    fields: { name: "Anthony", service_reason: "kitchen leak" },
  });
  pass("CASE7_INTAKE", step7b.status === "INTAKE_SAVED", String(step7b.status));
  const ctx7 = getVoiceV2CallContext("cc:custom-intake-test")!;
  const wf7 = ctx7.bookingWorkflow;
  pass("CASE7_FIND_DATE", wf7?.requestedDate === "2026-09-17" || wf7?.stage === "FIND_AVAILABILITY");

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS: voice-v2-custom-intake-headless (" + 20 + " checks)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
