/**
 * Wizard collectFields → receptionistAdvanced + voiceV2Intake compile path.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-wizard-advanced-bridge.ts
 */
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { getReceptionistCompiledFromAdvanced } from "../src/lib/voice/receptionist/runtime";

const state = createDefaultWizardState();
state.bookingStrategy = "MICROSOFT_365";
state.calendarProvider = "microsoft";
state.calendarConnected = true;
state.collectFields = [
  ...state.collectFields.filter((f) => f.id !== "notes"),
  {
    id: "custom_mothers_name",
    label: "Mother's name",
    required: true,
    enabled: true,
  },
];

const cfg = buildWizardAgentConfig(state);
const advanced = cfg.advanced as Record<string, unknown>;
const receptionistAdvanced = advanced.receptionistAdvanced as {
  callerFields?: Array<{ id: string; enabled: boolean }>;
};

assert.ok(receptionistAdvanced?.callerFields?.some((r) => r.id === "name" && r.enabled));
assert.ok(
  receptionistAdvanced?.callerFields?.some((r) => r.id === "reason" && r.enabled),
  "service maps to reason row",
);

const schema = compileVoiceV2IntakeSchema(cfg);
const mothers = schema.fields.find((f) => f.key === "mothers_name");
assert.ok(mothers, "custom_mothers_name compiles to mothers_name intake key");
assert.equal(mothers?.enabled, true);

const compiled = getReceptionistCompiledFromAdvanced(advanced);
assert.ok(compiled?.voiceV2IntakeAuthority, "booking enables voice v2 intake authority");
assert.match(
  String(compiled?.voiceV2IntakeInstructions || ""),
  /do not ask again/i,
  "intake instructions include no-reask guidance",
);

assert.equal(advanced.capabilityPack, "appointment_receptionist");
assert.equal(advanced.voiceV2PstnLiveBooking, false);

console.log("test-wizard-advanced-bridge: PASS");
