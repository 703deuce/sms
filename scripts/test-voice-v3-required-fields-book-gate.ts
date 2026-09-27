#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";

function baseConfig(): VoiceV3AgentConfig {
  return {
    workspaceId: "ws_test",
    businessName: "Test",
    identity: { agentName: "Amy" },
    intakeFields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "phone", label: "Phone", type: "phone", required: false },
      { key: "email", label: "Email", type: "email", required: false },
    ],
    service: {
      id: "svc_a",
      name: "Consult",
      durationMinutes: 30,
      slotStepMinutes: 15,
      enabled: true,
      requiredIntakeKeys: ["name", "phone"],
    },
    services: [
      {
        id: "svc_a",
        name: "Consult",
        durationMinutes: 30,
        slotStepMinutes: 15,
        enabled: true,
        requiredIntakeKeys: ["name", "phone"],
      },
      {
        id: "svc_b",
        name: "Follow-up",
        durationMinutes: 30,
        slotStepMinutes: 15,
        enabled: true,
        requiredIntakeKeys: ["name", "email"],
      },
    ],
    scheduling: { bookingStrategy: "MICROSOFT_CALENDAR", primaryServiceId: "svc_a", services: [] },
    callHandling: {} as VoiceV3AgentConfig["callHandling"],
    telephony: {},
    qualification: { enabled: false, rules: [], matchMode: "ALL" },
    operatingPolicy: {},
    spamProtection: {},
    knowledge: { hotContext: {}, retrieval: { enabled: false, knowledgeBaseIds: [] } },
    bookingStrategyDetail: {},
    transferPolicy: { enabled: false, destinations: [], routes: [], routing: "single", defaultFallback: "RETURN_TO_AGENT", defaultRingingTimeoutSeconds: 30, telephony: { outboundSipTrunkId: null, outboundCallerIdE164: null } },
  } as VoiceV3AgentConfig;
}

const config = baseConfig();
const ctx = createInitialVoiceV3CallContext({ callId: "c1", liveSessionId: "lk_c1" });
ctx.dialog.activeGoal = "BOOK_APPOINTMENT";
ctx.intake.values.name = { value: "Ada", source: "caller", updatedAt: new Date().toISOString() };

assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx), ["phone"]);

ctx.intake.values.phone = { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() };
assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx), []);

ctx.intake.values.booking_service_id = {
  value: "svc_b",
  source: "caller",
  updatedAt: new Date().toISOString(),
};
assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx), ["email"]);

ctx.intake.values.email = { value: "ada@example.com", source: "caller", updatedAt: new Date().toISOString() };
assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx), []);

console.log("VOICE_V3_REQUIRED_FIELDS_BOOK_GATE=PASS");
