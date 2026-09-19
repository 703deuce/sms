#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { buildUpdateIntakeZodSchema } from "../src/lib/voice-v3/intake-objective/build-intake-tool-schema";
import { bookingRequiredIntakeKeys } from "../src/lib/voice-v3/config/wizard-collect-fields-v3";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { createVoiceV3CallRuntime } from "../src/lib/voice-v3/state/call-runtime";

function baseWizard() {
  const w = createDefaultWizardState();
  w.bookingStrategy = "MICROSOFT_365";
  w.collectFields = [
    { id: "full_name", label: "Name", required: true, enabled: true },
    { id: "address", label: "Address", required: true, enabled: true },
    { id: "email", label: "Email", required: false, enabled: true },
  ];
  return w;
}

function run(): void {
  const versionA = compileVoiceV3AgentConfig({ wizard: baseWizard() });
  assert.deepEqual(bookingRequiredIntakeKeys(versionA.intakeFields).sort(), [
    "address",
    "name",
  ]);
  assert.ok("address" in buildUpdateIntakeZodSchema(versionA).shape);

  const versionBWizard = baseWizard();
  versionBWizard.collectFields.push({
    id: "custom_service_type",
    label: "Service type",
    required: true,
    enabled: true,
  });
  const versionB = compileVoiceV3AgentConfig({ wizard: versionBWizard });
  assert.ok(versionB.intakeFields.some((f) => f.key === "service_type" && f.required));
  assert.ok("service_type" in buildUpdateIntakeZodSchema(versionB).shape);

  const versionCWizard = baseWizard();
  versionCWizard.collectFields = versionCWizard.collectFields.map((f) =>
    f.id === "address" ? { ...f, required: false } : f,
  );
  const versionC = compileVoiceV3AgentConfig({ wizard: versionCWizard });
  assert.ok(!bookingRequiredIntakeKeys(versionC.intakeFields).includes("address"));

  const runtimeA = createVoiceV3CallRuntime({
    liveSessionId: "live_test_republish",
    config: versionA,
  });
  assert.equal(runtimeA.config.configVersion, versionA.configVersion);
  assert.notEqual(runtimeA.config.configVersion, versionB.configVersion);
  assert.equal(runtimeA.config.intakeFields.length, 3);

  console.log("VOICE_V3_WIZARD_REPUBLISH_INTAKE: PASS");
}

run();
