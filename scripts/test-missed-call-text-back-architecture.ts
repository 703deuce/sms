/**
 * Missed Call Text Back connected-architecture checks (no DB required).
 * Run: npx tsx scripts/test-missed-call-text-back-architecture.ts
 */

import assert from "assert";
import { findTriggerNode, parseAutomationDefinition } from "../src/lib/automations/types";
import { triggerFromBlockType } from "../src/lib/automations/catalog";
import { normalizeCallResultBranch } from "../src/lib/automations/actions";
import { buildMissedCallTextBackDefinition } from "../src/lib/solutions/missed-call-text-back/graph";
import {
  applyWizardConfigToDefinition,
  configFromDefinition,
  detectAdvancedCustomization,
} from "../src/lib/solutions/missed-call-text-back/sync";
import {
  DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  MCTB_NODES,
} from "../src/lib/solutions/missed-call-text-back/types";
import { PLATFORM_EVENT_TYPES } from "../src/lib/platform/events";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";

// 1. Generated graph shape
const def = buildMissedCallTextBackDefinition(DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG);
const trigger = findTriggerNode(def);
assert.ok(trigger, "graph has a trigger");
assert.equal(trigger!.data.blockType, "call_missed");
assert.equal(trigger!.id, MCTB_NODES.TRIGGER);
assert.ok(
  def.nodes.some((n) => n.id === MCTB_NODES.SEND_INITIAL_SMS),
  "initial SMS node present",
);
assert.ok(
  def.nodes.some((n) => n.id === MCTB_NODES.SEND_FOLLOW_UP_SMS),
  "follow-up SMS node present when enabled",
);
assert.equal(triggerFromBlockType("call_missed"), "Missed call");

// 2. Wizard field sync updates expected nodes without rebuild wipe
const patched = applyWizardConfigToDefinition(def, {
  ...DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  firstMessage: "Hello from sync test",
  initialDelayMinutes: 5,
  followUpMessage: "Follow-up sync",
});
assert.equal(patched.advancedCustomized, false);
const sendNode = patched.definition.nodes.find(
  (n) => n.id === MCTB_NODES.SEND_INITIAL_SMS,
);
assert.equal(sendNode?.data.config.body, "Hello from sync test");
const waitNode = patched.definition.nodes.find(
  (n) => n.id === MCTB_NODES.WAIT_INITIAL,
);
assert.equal(Number(waitNode?.data.config.minutes), 5);
// Original graph must not be mutated (shared-reference safety).
assert.notEqual(
  def.nodes.find((n) => n.id === MCTB_NODES.SEND_INITIAL_SMS)?.data.config.body,
  "Hello from sync test",
);

// 3. Config round-trip
const roundTrip = configFromDefinition(
  patched.definition,
  DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
);
assert.equal(roundTrip.firstMessage, "Hello from sync test");
assert.equal(roundTrip.initialDelayMinutes, 5);

// 4. Advanced customization detection + preservation
const customized = parseAutomationDefinition(
  structuredClone(patched.definition),
);
customized.nodes.push({
  id: "CUSTOM_NODE",
  type: "action",
  position: { x: 0, y: 0 },
  data: { blockType: "add_tag", label: "Custom tag", config: { tag: "vip" } },
});
assert.equal(detectAdvancedCustomization(customized), true);

const safePatch = applyWizardConfigToDefinition(customized, {
  ...DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  firstMessage: "Still safe",
  followUpEnabled: false,
});
assert.equal(safePatch.advancedCustomized, true);
assert.ok(
  safePatch.definition.nodes.some((n) => n.id === "CUSTOM_NODE"),
  "custom builder nodes are preserved",
);
assert.equal(
  safePatch.definition.nodes.find((n) => n.id === MCTB_NODES.SEND_INITIAL_SMS)
    ?.data.config.body,
  "Still safe",
);
// Advanced mode must not strip follow-up when wizard disables it.
assert.ok(
  safePatch.definition.nodes.some((n) => n.id === MCTB_NODES.SEND_FOLLOW_UP_SMS),
  "advanced customized graphs keep follow-up nodes when wizard would remove them",
);

// 5. Follow-up disabled removes follow-up only when not advanced
const cleanForDisable = buildMissedCallTextBackDefinition(
  DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
);
const noFollow = applyWizardConfigToDefinition(cleanForDisable, {
  ...DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  followUpEnabled: false,
});
assert.equal(noFollow.advancedCustomized, false);
assert.ok(
  !noFollow.definition.nodes.some((n) => n.id === MCTB_NODES.SEND_FOLLOW_UP_SMS),
  "follow-up node removed when disabled on clean graph",
);
assert.ok(
  noFollow.definition.edges.some(
    (e) =>
      e.source === MCTB_NODES.CONDITION_REPLY &&
      e.target === MCTB_NODES.END_DONE &&
      e.sourceHandle === "no",
  ),
  "no-reply branch goes to END when follow-up disabled",
);

// 6. Catalog includes new node types
const types = new Set(AUTOMATION_BLOCKS.map((b) => b.blockType));
for (const required of [
  "call_missed",
  "start_ai_call",
  "run_voice_agent",
  "wait_for_call_result",
  "start_automation",
  "use_ai_agent",
]) {
  assert.ok(types.has(required), `catalog includes ${required}`);
}

const useAgent = AUTOMATION_BLOCKS.find((b) => b.blockType === "use_ai_agent");
assert.equal(useAgent?.label, "Use Agent");
assert.equal(useAgent?.defaultConfig?.mode, "run_primary_workflow");

const runVoice = AUTOMATION_BLOCKS.find((b) => b.blockType === "run_voice_agent");
assert.equal(runVoice?.label, "Run Voice Agent");

// Guard rails for Use Agent composition
import {
  checkAgentInvokeGuards,
  normalizeUseAgentMode,
} from "../src/lib/automations/agent-invoke";
assert.equal(normalizeUseAgentMode("auto"), "run_primary_workflow");
assert.equal(normalizeUseAgentMode("voice_call"), "hand_off_conversation");
const self = checkAgentInvokeGuards({
  targetKey: "agent:a1",
  currentFlowId: "flow1",
  currentOwnerKey: "agent:a1",
});
assert.equal(self.ok, false);
if (!self.ok) assert.equal(self.error, "use_agent_self_invoke");
const cycle = checkAgentInvokeGuards({
  targetKey: "agent:b",
  currentFlowId: "flow1",
  agentChain: ["agent:a", "agent:b"],
});
assert.equal(cycle.ok, false);
if (!cycle.ok) assert.equal(cycle.error, "use_agent_cycle");

import { buildVoiceAgentPrimaryDefinition } from "../src/lib/agents/compile-workflow";
const voicePrimary = buildVoiceAgentPrimaryDefinition({
  agentId: "maya",
  agentName: "Maya",
  phoneNumberId: "num1",
  routingMode: "every_call",
});
assert.deepEqual(
  voicePrimary.nodes.map((n) => n.data.blockType),
  ["inbound_call", "run_voice_agent", "end_automation"],
);

assert.ok(types.has("inbound_call"), "catalog includes inbound_call");

import { extractTriggersFromDefinition } from "../src/lib/automations/trigger-deployments";
const extracted = extractTriggersFromDefinition(voicePrimary);
assert.equal(extracted[0]?.blockType, "inbound_call");
assert.equal(extracted[0]?.eventType, "every_call");
assert.equal(extracted[0]?.phoneNumberId, "num1");

// 7. Shared event types present
for (const t of [
  "CALL_MISSED",
  "AI_CALL_COMPLETED",
  "AUTOMATION_STARTED",
  "CONTACT_CREATED",
  "MESSAGE_RECEIVED",
  "APPOINTMENT_BOOKED",
]) {
  assert.ok(PLATFORM_EVENT_TYPES.includes(t as never), `platform event ${t}`);
}

// 8. Call-result branching helpers
assert.equal(
  normalizeCallResultBranch({ type: "CALL_MISSED", status: "NO_ANSWER" }),
  "no_answer",
);
assert.equal(
  normalizeCallResultBranch({ type: "AI_CALL_COMPLETED", outcome: "estimate_requested" }),
  "completed",
);
assert.equal(
  normalizeCallResultBranch({ outcome: "appointment_booked", appointmentBooked: true }),
  "booked",
);
assert.equal(normalizeCallResultBranch({ type: "TIMEOUT" }), "failed");
assert.equal(
  normalizeCallResultBranch({ outcome: "transferred_to_staff" }),
  "transferred",
);

// 9. Zero-minute delays round-trip (must not collapse to defaults via ||)
const zeroDelay = buildMissedCallTextBackDefinition({
  ...DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  initialDelayMinutes: 0,
  followUpDelayMinutes: 0,
});
const zeroCfg = configFromDefinition(
  zeroDelay,
  DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
);
assert.equal(zeroCfg.initialDelayMinutes, 0);
assert.equal(zeroCfg.followUpDelayMinutes, 0);

// 10. Rewiring owned edges marks advanced customization
const rewired = parseAutomationDefinition(
  buildMissedCallTextBackDefinition(DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG),
);
const yesEdge = rewired.edges.find((e) => e.id === "e_cond_yes");
assert.ok(yesEdge);
yesEdge!.target = MCTB_NODES.END_DONE;
assert.equal(detectAdvancedCustomization(rewired), true);
assert.equal(
  detectAdvancedCustomization(
    buildMissedCallTextBackDefinition(DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG),
  ),
  false,
);

console.log("missed-call-text-back architecture checks passed");
