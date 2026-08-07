/**
 * Workflow Architect enterprise runtime tests — TOOL CONTRACT + AGENT DECISION.
 * Run: npx tsx scripts/test-workflow-architect-runtime.ts
 */
import { isRegisteredNodeType, WORKFLOW_NODE_CATALOG } from "../src/lib/platform/workflow-dsl/node-catalog";
import {
  assertValidWorkflowOrFail,
  validateCanonicalWorkflow,
} from "../src/lib/platform/workflow-dsl/validator";
import { assertArchitectToolAllowed, isArchitectToolAllowed } from "../src/lib/platform/architect-runtime/guard";
import { createCandidateVersion } from "../src/lib/platform/architect-runtime/versioning";
import type { CanonicalWorkflowSpec } from "../src/lib/platform/workflow-dsl/types";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  console.log(cond ? "✓" : "✗", name, detail || "");
}

const validSpec: CanonicalWorkflowSpec = {
  workflow_id: "wf_test",
  version: 1,
  entry_node: "n1",
  nodes: [
    { id: "n1", type: "incoming_call", version: 1, config: {}, next: "n2" },
    { id: "n2", type: "collect_field", version: 1, config: { field_id: "fld_problem" }, next: "n3" },
    {
      id: "n3",
      type: "confirm_booking",
      version: 1,
      config: { start_time: "2026-08-08T14:00:00Z", service_id: "svc_plumbing" },
      on_failure: [{ error_code: "SLOT_UNAVAILABLE", next_node_id: "n4" }],
      next: "n5",
    },
    { id: "n4", type: "check_availability", version: 1, config: { service_id: "svc_plumbing" }, next: "n5", on_failure: [{ error_code: "PROVIDER_DOWN", next_node_id: "n5" }] },
    { id: "n5", type: "end", version: 1, config: {} },
  ],
};

// TOOL CONTRACT
check("catalog has collect_field", isRegisteredNodeType("collect_field"));
check("catalog rejects super_magic_booking_node", !isRegisteredNodeType("super_magic_booking_node"));
check("catalog size >= 25", WORKFLOW_NODE_CATALOG.length >= 25);
check("valid workflow passes", validateCanonicalWorkflow(validSpec, { known_field_ids: new Set(["fld_problem"]) }).valid);
check("unknown node fails", (() => {
  const bad = { ...validSpec, nodes: [...validSpec.nodes, { id: "x", type: "super_magic_booking_node" as never, version: 1, config: {} }] };
  return !validateCanonicalWorkflow(bad).valid;
})());
check("missing failure path on confirm_booking", (() => {
  const bad: CanonicalWorkflowSpec = {
    ...validSpec,
    nodes: validSpec.nodes.map((n) =>
      n.id === "n3" ? { ...n, on_failure: undefined } : n,
    ),
  };
  const r = validateCanonicalWorkflow(bad);
  return !r.valid && r.errors.some((e) => e.code === "MISSING_FAILURE_PATH");
})());
check("unknown field fails", (() => {
  const r = validateCanonicalWorkflow(validSpec, { known_field_ids: new Set(["fld_other"]) });
  return !r.valid && r.errors.some((e) => e.code === "FIELD_NOT_FOUND");
})());
check("CAPABILITY_NOT_SUPPORTED for unknown node", (() => {
  const bad: CanonicalWorkflowSpec = {
    workflow_id: "wf_bad",
    version: 1,
    entry_node: "n1",
    nodes: [{ id: "n1", type: "super_magic_booking_node" as never, version: 1, config: {} }],
  };
  const r = assertValidWorkflowOrFail(bad);
  return r.status === "capability_not_supported";
})());

// AGENT DECISION
check("architect cannot publish", !isArchitectToolAllowed("request_publish"));
check("architect can build candidate", isArchitectToolAllowed("build_workflow_candidate"));
check("architect blocked tool throws", (() => {
  try {
    assertArchitectToolAllowed("publish_version");
    return false;
  } catch {
    return true;
  }
})());
check("candidate version immutable", (() => {
  const c = createCandidateVersion({
    workflow_id: "wf_1",
    next_version: 3,
    spec: validSpec,
    change_request_id: "chg_1",
    validation_passed: true,
  });
  return c.version === 3 && c.status === "validated" && c.spec.metadata?.candidate === true;
})());

// Randomized mutation — unknown field in collect
for (let i = 0; i < 20; i++) {
  const fieldId = `fld_${Math.floor(Math.random() * 10000)}`;
  const spec: CanonicalWorkflowSpec = {
    workflow_id: `wf_mut_${i}`,
    version: 1,
    entry_node: "n1",
    nodes: [
      { id: "n1", type: "missed_call", version: 1, config: {}, next: "n2" },
      { id: "n2", type: "wait", version: 1, config: { delay_seconds: 30 }, next: "n3" },
      { id: "n3", type: "collect_field", version: 1, config: { field_id: fieldId }, next: "n4" },
      { id: "n4", type: "send_sms", version: 1, config: { to: "{{caller_phone}}", body: "Hi" }, on_failure: [{ error_code: "SMS_FAILED", next_node_id: "n5" }], next: "n5" },
      { id: "n5", type: "end", version: 1, config: {} },
    ],
  };
  const r = validateCanonicalWorkflow(spec, { known_field_ids: new Set([fieldId]) });
  check(`mutation ${i} valid with known field`, r.valid);
}

if (failures.length) {
  console.error(`\n${failures.length} architect runtime failure(s)`);
  process.exit(1);
}
console.log("\nWorkflow Architect runtime tests passed.");
