#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  mapServiceRequiredFieldToV3IntakeKey,
  resolveServiceRequiredFieldsForV3,
} from "../src/lib/solutions/appointment-receptionist/required-fields";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";

assert.equal(mapServiceRequiredFieldToV3IntakeKey("full_name"), "name");
assert.equal(mapServiceRequiredFieldToV3IntakeKey("service"), "service_reason");

const v3Keys = resolveServiceRequiredFieldsForV3(
  ["full_name", "phone", "email", "service"],
  [
    { id: "name", enabled: true },
    { id: "phone", enabled: true },
    { id: "email", enabled: true },
    { id: "service", enabled: true },
  ],
);
assert.deepEqual(v3Keys, ["name", "phone", "email", "service_reason"]);

const config = {
  intakeFields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "phone", label: "Phone", type: "phone", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "service_reason", label: "Service", type: "text", required: true },
  ],
  service: {
    id: "svc",
    name: "Visit",
    durationMinutes: 60,
    slotStepMinutes: 30,
    requiredIntakeKeys: ["full_name", "service"],
  },
  services: [],
} as VoiceV3AgentConfig;

const ctx = createInitialVoiceV3CallContext({ callId: "c1", liveSessionId: "lk_c1" });
ctx.dialog.activeGoal = "BOOK_APPOINTMENT";
ctx.intake.values.name = { value: "Ada", source: "caller", updatedAt: new Date().toISOString() };
ctx.intake.values.phone = { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() };
ctx.intake.values.email = { value: "ada@example.com", source: "caller", updatedAt: new Date().toISOString() };
ctx.intake.values.service_reason = {
  value: "Panel upgrade",
  source: "caller",
  updatedAt: new Date().toISOString(),
};

assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx), []);

console.log("TEST_WIZARD_SERVICE_REQUIRED_FIELDS_V3=PASS");
