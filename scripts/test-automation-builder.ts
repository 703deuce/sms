/**
 * Automation builder and execution tests.
 * Run: npx tsx scripts/test-automation-builder.ts
 */
import {
  createEdgeId,
  createNodeId,
  getNextNodeId,
  hasCycle,
  nodeSummary,
  parseAutomationDefinition,
  waitDurationMs,
  waitUntilMs,
  type AutomationDefinition,
} from "../src/lib/automations/types";
import {
  defaultMvpDefinition,
  hasBlockingErrors,
  validateAutomationForPublish,
} from "../src/lib/automations/validation";
import { evaluateConditionNode } from "../src/lib/automations/actions";
import { factsFromMetadata } from "../src/lib/automations/metadata";
import { getAutomationCapabilities } from "../src/lib/automations/capabilities";

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.log(`✗ ${name}${detail ? `: ${detail}` : ""}`);
  }
}

// Node IDs
const id1 = createNodeId();
const id2 = createNodeId();
assert("createNodeId unique", id1 !== id2);

// MVP definition validates
const mvp = defaultMvpDefinition();
const mvpIssues = validateAutomationForPublish("Review follow-up", mvp);
assert("MVP definition has no blocking errors", !hasBlockingErrors(mvpIssues));

// Missing trigger fails
const noTrigger = { version: 1, nodes: [], edges: [] };
assert(
  "Empty flow fails validation",
  hasBlockingErrors(validateAutomationForPublish("Test", noTrigger)),
);

// Wait duration
assert("waitDurationMs minimum 1 min", waitDurationMs({ minutes: 0 }) >= 60_000);
assert("waitDurationMs 3 days", waitDurationMs({ days: 3 }) === 3 * 24 * 60 * 60_000);
assert("waitDurationMs weeks", waitDurationMs({ weeks: 1 }) === 7 * 24 * 60 * 60_000);

// Graph navigation
const def = parseAutomationDefinition(mvp);
const trigger = def.nodes.find((n) => n.type === "trigger");
assert("MVP has trigger", Boolean(trigger));
if (trigger) {
  const next = getNextNodeId(def, trigger.id);
  assert("Trigger connects to next node", Boolean(next));
}

// Condition branches
const cond = def.nodes.find((n) => n.data.blockType === "condition");
if (cond) {
  assert("Condition has yes branch", Boolean(getNextNodeId(def, cond.id, "yes")));
  assert("Condition has no branch", Boolean(getNextNodeId(def, cond.id, "no")));
}

// Parse legacy empty
assert("parse empty", parseAutomationDefinition(null).nodes.length === 0);

// Edge id
assert("createEdgeId", createEdgeId().startsWith("edge_"));

// Cycle detection
const loopDef: AutomationDefinition = {
  version: 1,
  nodes: [
    { id: "a", type: "action", position: { x: 0, y: 0 }, data: { blockType: "send_sms", label: "A", config: {} } },
    { id: "b", type: "action", position: { x: 0, y: 100 }, data: { blockType: "send_sms", label: "B", config: {} } },
  ],
  edges: [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "a" },
  ],
};
assert("hasCycle detects loop", hasCycle(loopDef));
assert("hasCycle no loop in MVP", !hasCycle(def));

// Self-connection validation
const selfDef: AutomationDefinition = {
  version: 1,
  nodes: [
    {
      id: "t",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { blockType: "customer_added", label: "Trigger", config: {} },
    },
  ],
  edges: [{ id: "e1", source: "t", target: "t" }],
};
assert(
  "Self-connection fails validation",
  validateAutomationForPublish("Self", selfDef).some((i) => i.message.includes("itself")),
);

// Cycle fails publish validation
assert(
  "Cycle fails publish validation",
  hasBlockingErrors(validateAutomationForPublish("Loop", loopDef)),
);

// Condition without branches fails
const badCond: AutomationDefinition = {
  version: 1,
  nodes: [
    {
      id: "c",
      type: "logic",
      position: { x: 0, y: 0 },
      data: {
        blockType: "condition",
        label: "Condition",
        config: { field: "review_received", operator: "equals", value: "true" },
      },
    },
  ],
  edges: [],
};
assert(
  "Condition missing branches fails",
  validateAutomationForPublish("Cond", badCond).some((i) => i.message.includes("Yes and No")),
);

// evaluateConditionNode branching
const condNode = badCond.nodes[0];
const factsYes = { review_received: true };
const factsNo = { review_received: false };
assert(
  "Condition review yes",
  evaluateConditionNode(condNode, factsYes, { phone: "+15551234567" }, []),
);
assert(
  "Condition review no",
  !evaluateConditionNode(condNode, factsNo, { phone: "+15551234567" }, []),
);

// Tag condition
const tagNode = {
  id: "tagc",
  type: "logic" as const,
  position: { x: 0, y: 0 },
  data: {
    blockType: "condition_tag",
    label: "Tag",
    config: { tag: "vip" },
  },
};
assert(
  "Tag condition true when tag present",
  evaluateConditionNode(tagNode, {}, { phone: "+1" }, ["vip", "lead"]),
);
assert(
  "Tag condition false when tag missing",
  !evaluateConditionNode(tagNode, {}, { phone: "+1" }, ["lead"]),
);

// factsFromMetadata
const mergedFacts = factsFromMetadata(
  { review_received: true, link_clicked: true },
  { phone: "+1", customFields: { review_received: true } },
  ["vip"],
);
assert("factsFromMetadata review", mergedFacts.review_received === true);
assert("factsFromMetadata link", mergedFacts.link_clicked === true);

// nodeSummary
const waitNode = def.nodes.find((n) => n.data.blockType === "wait");
if (waitNode) {
  assert("nodeSummary wait", nodeSummary(waitNode).includes("3 day"));
}

// waitUntilMs future
const untilMs = waitUntilMs({ runAt: new Date(Date.now() + 3600_000).toISOString() });
assert("waitUntilMs future date", untilMs >= 60_000);

// SMS body required
const smsDef: AutomationDefinition = {
  version: 1,
  nodes: [
    {
      id: "sms",
      type: "action",
      position: { x: 0, y: 0 },
      data: { blockType: "send_sms", label: "SMS", config: { body: "" } },
    },
  ],
  edges: [],
};
assert(
  "SMS body required for publish",
  validateAutomationForPublish("SMS", smsDef).some((i) => i.message.includes("body")),
);

// Missing name
assert(
  "Name required",
  validateAutomationForPublish("", mvp).some((i) => i.message.includes("name")),
);

// Email publish blocked without Brevo
const emailDef = {
  version: 1,
  nodes: [
    {
      id: "em",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        blockType: "send_email",
        label: "Email",
        config: { subject: "Hi", body: "Test" },
      },
    },
  ],
  edges: [],
};
const savedBrevo = process.env.BREVO_API_KEY;
delete process.env.BREVO_API_KEY;
assert(
  "Email publish blocked without Brevo",
  hasBlockingErrors(validateAutomationForPublish("Email flow", emailDef as import("../src/lib/automations/types").AutomationDefinition)),
);
if (savedBrevo) process.env.BREVO_API_KEY = savedBrevo;

assert("capabilities email flag", typeof getAutomationCapabilities().email === "boolean");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
