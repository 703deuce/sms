#!/usr/bin/env npx tsx
/**
 * Wizard-driven conversational intake — regression contract (caller-first + BOOK gate).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-wizard-conversational-intake-headless.ts
 */
import type { CallerFieldRow } from "../src/lib/receptionist-wizard/advanced-types";
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-v2/intake/session-store";
import { compileIntakeSchemaParts } from "../src/lib/voice-v2/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import { evaluateBookingIntakeGate } from "../src/lib/voice-v2/intake/booking-gate";
import { buildVoiceV2LiveIntakeInstructions } from "../src/lib/voice-v2/intake/live-intake-instructions";
import { VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS } from "../src/lib/voice-v2/caller-experience-law";
import { validateIntakeFieldPayload } from "../src/lib/voice-v2/intake/validate-fields";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";

const failures: string[] = [];
function pass(id: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${id}: ${detail}` : id);
}

function testWizard() {
  return {
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" as const },
      phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" as const },
      address: { enabled: false },
    },
  };
}

function callerFields(): CallerFieldRow[] {
  return [
    {
      id: "custom_mother_name",
      label: "Mother's name",
      question: "What is your mother's name?",
      required: true,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
    {
      id: "custom_nickname",
      label: "Nickname",
      question: "Do you have a nickname?",
      required: false,
      askWhen: "when_booking",
      confirm: false,
      enabled: true,
    },
    {
      id: "custom_secret_code",
      label: "Secret code",
      question: "Secret?",
      required: true,
      askWhen: "when_booking",
      confirm: false,
      enabled: false,
    },
  ];
}

function seed(sessionKey = "cc:wizard-conv-intake"): VoiceV2CallContext {
  const schema = compileIntakeSchemaParts({
    voiceV2Intake: testWizard(),
    callerFields: callerFields(),
  });
  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function save(fields: Record<string, unknown>, sessionKey = "cc:wizard-conv-intake") {
  const cc = sessionKey.replace(/^cc:/, "");
  return executeVoiceV2SaveIntakeFields(
    { call_id: cc, fields, tool_invocation_id: `wiz-${Date.now()}` },
    "ws_test",
    "agent_test",
  );
}

async function main() {
  clearVoiceV2CallSessions();
  const schema = compileIntakeSchemaParts({
    voiceV2Intake: testWizard(),
    callerFields: callerFields(),
  });

  const instr = buildVoiceV2LiveIntakeInstructions(schema, { oneAmy: true });
  pass("PROMPT_CUSTOM_FIELD", instr.includes("mother_name"));
  pass("PROMPT_NO_INTENT_TOOL", instr.includes("never call voice_v2_save_intake_fields merely"));
  pass("PROMPT_RECORD_NONBLOCK", instr.includes("REQUIRED_FOR_RECORD"));

  // Intent-only — zero blocking save
  const t0 = Date.now();
  const intent = await save({ service_reason: "appointment" });
  const intentMs = Date.now() - t0;
  pass(
    "BOOKING_INTENT_NO_TOOL_PATH",
    intent.status === VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS,
    String(intent.status),
  );
  pass("BOOKING_INTENT_FAST_MS", intentMs < 500, `${intentMs}ms`);

  seed();
  const turn1 = await save({ name: "Anthony Johnson", service_reason: "kitchen leak" });
  pass("TURN1_SAVED", turn1.status === "INTAKE_SAVED", String(turn1.status));
  const ctx1 = getVoiceV2CallContext("cc:wizard-conv-intake")!;
  const r1 = getIntakeReadiness(ctx1.intakeSchema, ctx1.intakeState);
  pass("TURN1_KNOWN_NAME", ctx1.intakeState.name?.value === "Anthony Johnson");
  pass("TURN1_KNOWN_SERVICE", ctx1.intakeState.service_reason?.value === "kitchen leak");
  pass("TURN1_MISSING_EMAIL", r1.missingBeforeBooking.includes("email"));
  pass("TURN1_MISSING_MOTHER", r1.missingBeforeBooking.includes("mother_name"));
  pass("TURN1_PHONE_NOT_REQUIRED_FOR_BOOK", !r1.missingBeforeBooking.includes("phone"));

  const turn2 = await save({ email: "anthony@example.com", mother_name: "Patricia" });
  pass("TURN2_SAVED", turn2.status === "INTAKE_SAVED", String(turn2.status));
  const r2 = getIntakeReadiness(ctx1.intakeSchema, getVoiceV2CallContext("cc:wizard-conv-intake")!.intakeState);
  pass("TURN2_BOOKING_READY", r2.missingBeforeBooking.length === 0);
  pass("TURN2_RECORD_PHONE_STILL_MISSING", r2.missingForRecord.includes("phone"));

  const gateReady = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "wizard-conv-intake",
  });
  pass("GATE_ALLOWS_WITHOUT_PHONE", gateReady.allowed === true);

  clearVoiceV2CallSessions();
  seed("cc:wizard-gate-block");
  await save({ name: "Only Name" }, "cc:wizard-gate-block");
  const gateBlock = await evaluateBookingIntakeGate({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "wizard-gate-block",
  });
  pass("GATE_BLOCKS_INCOMPLETE", gateBlock.allowed === false);
  if (!gateBlock.allowed) {
    pass(
      "GATE_LISTS_MISSING",
      gateBlock.missing_fields.includes("email") && gateBlock.missing_fields.includes("service_reason"),
    );
  }

  const disabled = validateIntakeFieldPayload(schema, { secret_code: "xyz" });
  pass("DISABLED_NOT_VALID", disabled.ok === false || disabled.disabledFields.includes("secret_code"));

  console.log("\n--- Wizard conversational intake metrics ---");
  console.log(
    JSON.stringify(
      {
        booking_intent_tool_calls: 0,
        booking_intent_sync_persist_before_reply_ms: intentMs,
        fields_known_before_book: r2.missingBeforeBooking.length === 0 ? ["name", "service_reason", "email", "mother_name"] : [],
        required_before_booking_missing_before_book: r2.missingBeforeBooking,
        phone_blocks_book: false,
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    console.error("\nFAILURES:\n", failures.join("\n"));
    process.exit(1);
  }
  console.log("\nPASS: wizard conversational intake headless");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
