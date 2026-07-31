/**
 * Automation builder and execution tests.
 * Run: npx tsx scripts/test-automation-builder.ts
 */
import {
  createEdgeId,
  createNodeId,
  getNextNodeId,
  parseAutomationDefinition,
  waitDurationMs,
} from "../src/lib/automations/types";
import {
  defaultMvpDefinition,
  hasBlockingErrors,
  validateAutomationForPublish,
} from "../src/lib/automations/validation";

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
