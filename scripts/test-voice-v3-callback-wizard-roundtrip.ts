#!/usr/bin/env npx tsx
/**
 * Callback required field ids: wizard → compile → operationRequirements.request_callback
 */
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { defaultCallbackRequiredCollectFieldIds } from "../src/lib/solutions/appointment-receptionist/callback-required-field-defaults";

const wizard = createDefaultWizardState();
wizard.capabilities = ["answer_questions", "book_appointments"];
wizard.bookingStrategy = "MICROSOFT_365";
wizard.callbackRequestsEnabled = true;

// Default new agent: name + phone + service (reason)
const defaultIds = defaultCallbackRequiredCollectFieldIds(wizard.collectFields);
assert.deepEqual(wizard.callbackRequiredCollectFieldIds, defaultIds);
const compiledDefault = compileVoiceV3AgentConfig({
  wizard,
  providerConnections: { microsoftConnectionId: "conn_rt" },
});
assert.deepEqual(compiledDefault.operationRequirements?.request_callback, [
  "name",
  "phone",
  "service_reason",
]);
assert.deepEqual(compiledDefault.operationRequirements?.book_appointment?.sort(), [
  "email",
  "name",
  "phone",
  "service_reason",
].sort());

// Custom subset: name, phone, notes only (no email for callback)
wizard.callbackRequiredCollectFieldIds = ["full_name", "phone", "notes"];
const compiledCustom = compileVoiceV3AgentConfig({
  wizard,
  providerConnections: { microsoftConnectionId: "conn_rt" },
});
assert.deepEqual(compiledCustom.operationRequirements?.request_callback, [
  "name",
  "phone",
  "notes",
]);
assert.ok(compiledCustom.callHandling.callbackRequiredCollectFieldIds?.includes("notes"));

// Draft-like mutation then re-compile
wizard.collectFields = [
  ...wizard.collectFields,
  { id: "custom_mothers_name", label: "Mother's name", required: false, enabled: true },
];
wizard.callbackRequiredCollectFieldIds = [
  "full_name",
  "phone",
  "service",
  "custom_mothers_name",
];
const compiledExtended = compileVoiceV3AgentConfig({
  wizard,
  providerConnections: { microsoftConnectionId: "conn_rt" },
});
assert.ok(
  compiledExtended.operationRequirements?.request_callback?.includes("mothers_name"),
  `got ${JSON.stringify(compiledExtended.operationRequirements?.request_callback)}`,
);
assert.equal(
  compiledExtended.operationRequirements?.request_callback?.includes("email"),
  false,
);

console.log("PASS voice-v3 callback wizard roundtrip");
