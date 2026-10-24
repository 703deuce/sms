#!/usr/bin/env npx tsx
/**
 * Simulates mid-call intent switches via get_intake_state operation overrides + planner snapshots.
 */
import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";
import { defaultNestedFromFlat } from "@/lib/server/voice-v3/config/default-nested-config";
import { createInitialVoiceV3CallContext } from "@/lib/server/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "@/lib/server/voice-v3/time/call-clock";
import { VoiceV3CallRuntime } from "@/lib/server/voice-v3/state/call-runtime";
import { mergeDialogActiveGoalFromOperation } from "@/lib/server/voice-v3/intake/merge-intake-state";
import { deriveIntakeObjective } from "@/lib/server/voice-v3/intake-objective";
import { planAgentState } from "@/lib/server/voice-v3/agent/agent-planner";
import {
  getVoiceIntentProfile,
  listVoiceIntentSummaryForReport,
} from "@/lib/server/voice-v3/intent/voice-operation-intent-catalog";
import type { VoiceOperationName } from "@/lib/server/voice-v3/intake-objective/operation-requirements";
import {
  clearAgentSnapshotStore,
  getLastAgentSnapshotForCall,
} from "@/lib/server/voice-v3/agent/after-state-change";

const HARNESS_CONFIG: VoiceV3AgentConfig = {
  businessName: "Transovo Test",
  timezone: "America/New_York",
  scheduling: { bookingStrategy: "SEND_LINK" },
  intakeFields: [
    { key: "name", label: "Name", type: "text", required: true, description: "Full name" },
    { key: "email", label: "Email", type: "email", required: true, description: "Email" },
    {
      key: "mothers_name",
      label: "Mother's name",
      type: "text",
      required: true,
      description: "Mother's name",
    },
  ],
  service: {
    id: "consultation",
    name: "Consultation",
    durationMinutes: 60,
    slotStepMinutes: 30,
  },
  businessHours: { weekdays: [1, 2, 3, 4, 5], startLocal: "09:00", endLocal: "17:00" },
  calendar: {
    provider: "microsoft",
    connectionId: "harness",
    calendarIds: ["primary"],
    smtp: null,
  },
  ...defaultNestedFromFlat({
    businessName: "Transovo Test",
    timezone: "America/New_York",
    service: {
      id: "consultation",
      name: "Consultation",
      durationMinutes: 60,
      slotStepMinutes: 30,
    },
    agentName: "Amy",
  }),
};

function simulateOperationSwitch(
  runtime: VoiceV3CallRuntime,
  operation: VoiceOperationName,
): { goal: string; missing: string[]; primaryTool: string } {
  let snap = runtime.getSnapshot();
  snap = mergeDialogActiveGoalFromOperation(snap, operation);
  runtime.replaceContext(snap);
  const objective = deriveIntakeObjective(runtime.config, snap, operation);
  const profile = getVoiceIntentProfile(operation);
  assert.ok(profile, `catalog missing ${operation}`);
  assert.equal(snap.dialog.activeGoal, profile.activeGoal, `goal for ${operation}`);
  const planned = planAgentState(snap, runtime.config);
  assert.equal(planned.activeGoal, profile.activeGoal, `planner goal for ${operation}`);
  return {
    goal: snap.dialog.activeGoal,
    missing: [...objective.missingRequiredFields].sort(),
    primaryTool: profile.primaryTools[0]!,
  };
}

async function main(): Promise<void> {
clearAgentSnapshotStore();
const clock = buildVoiceV3CallClock(HARNESS_CONFIG.timezone);
const ctx = createInitialVoiceV3CallContext({
  callId: "call_multi_intent",
  liveSessionId: "live_multi_intent",
  clock,
});
const runtime = new VoiceV3CallRuntime({ config: HARNESS_CONFIG, context: ctx });

runtime.commitContext(runtime.getSnapshot(), "test_start");

const steps: Array<{ op: VoiceOperationName; expectGoal: string; expectTool: string }> = [
  { op: "send_booking_link", expectGoal: "BOOK_APPOINTMENT", expectTool: "get_intake_state" },
  { op: "transfer_call", expectGoal: "REQUEST_TRANSFER", expectTool: "transfer_call" },
  { op: "send_booking_link", expectGoal: "BOOK_APPOINTMENT", expectTool: "get_intake_state" },
  { op: "search_business_knowledge", expectGoal: "GENERAL", expectTool: "search_business_knowledge" },
  { op: "request_callback", expectGoal: "REQUEST_CALLBACK", expectTool: "request_callback" },
  { op: "take_message", expectGoal: "TAKE_MESSAGE", expectTool: "take_message" },
  { op: "cancel_appointment", expectGoal: "CANCEL_APPOINTMENT", expectTool: "cancel_appointment" },
  { op: "reschedule_appointment", expectGoal: "RESCHEDULE_APPOINTMENT", expectTool: "reschedule_appointment" },
  { op: "book_appointment", expectGoal: "BOOK_APPOINTMENT", expectTool: "book_appointment" },
  { op: "find_availability", expectGoal: "BOOK_APPOINTMENT", expectTool: "find_availability" },
];

const results: string[] = [];
for (const step of steps) {
  const row = simulateOperationSwitch(runtime, step.op);
  assert.equal(row.goal, step.expectGoal);
  assert.equal(row.primaryTool, step.expectTool);
  results.push(`${step.op} → ${row.goal} missing=[${row.missing.join(",")}] tool=${row.primaryTool}`);
}

simulateOperationSwitch(runtime, "transfer_call");
const afterTransfer = getLastAgentSnapshotForCall("call_multi_intent");
assert.equal(afterTransfer?.activeGoal, "REQUEST_TRANSFER");
simulateOperationSwitch(runtime, "send_booking_link");
const backToBook = getLastAgentSnapshotForCall("call_multi_intent");
assert.equal(backToBook?.activeGoal, "BOOK_APPOINTMENT");
assert.ok(
  (backToBook?.stateVersion ?? 0) > (afterTransfer?.stateVersion ?? 0),
  "state_version should advance on intent switch",
);

console.log("PASS voice-v3 multi-intent switching");
console.log("INTENT_CATALOG:");
for (const line of listVoiceIntentSummaryForReport()) {
  console.log(`  ${line}`);
}
console.log("SWITCH_TRACE:");
for (const line of results) {
  console.log(`  ${line}`);
}
}

void main();
