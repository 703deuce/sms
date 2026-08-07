/**
 * Owner Amy enterprise runtime tests — TOOL CONTRACT + AGENT DECISION levels.
 * Run: npx tsx scripts/test-owner-amy-runtime.ts
 */
import { assertOwnerToolAllowed } from "../src/lib/platform/owner-runtime/guard";
import { inferOwnerTaskFromIntent, isOwnerToolAllowedForState } from "../src/lib/platform/owner-runtime/states";
import {
  buildFieldRequirementChangeRequest,
  toArchitectBuildRequest,
} from "../src/lib/platform/owner-runtime/change-requests";
import { isPlatformBlockedTool } from "../src/lib/platform/agent-runtime/gateway";
import { defaultOwnerPermissions } from "../src/lib/platform/owner-runtime/session";
import { OWNER_AMY_CONSTITUTION } from "../src/lib/platform/owner-runtime/constitution";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  console.log(cond ? "✓" : "✗", name, detail || "");
}

// TOOL CONTRACT
check("blocked execute_sql", isPlatformBlockedTool("execute_sql"));
check("blocked edit_prompt_text", isPlatformBlockedTool("edit_prompt_text"));
check("structured change request has id", (() => {
  const cr = buildFieldRequirementChangeRequest({
    tenant_id: "ws_1",
    user_id: "user_1",
    agent_id: "amy_1",
    field_id: "fld_email",
    required: false,
    reason: "Owner does not want email required for plumbing",
  });
  return cr.change_request_id.startsWith("chg_") && cr.intent === "update_field_requirement";
})());
check("architect contract from change request", (() => {
  const cr = buildFieldRequirementChangeRequest({
    tenant_id: "ws_1",
    user_id: "user_1",
    agent_id: "amy_1",
    field_id: "fld_email",
    required: false,
    reason: "test",
  });
  const req = toArchitectBuildRequest(cr);
  return req.request_type === "workflow_change" && req.change_request_id === cr.change_request_id;
})());
check("constitution forbids false success claims", /Never say "I updated it"/.test(OWNER_AMY_CONSTITUTION));

// AGENT DECISION
check("DIAGNOSE exposes get_call_trace", isOwnerToolAllowedForState("DIAGNOSE", "get_call_trace"));
check("DIAGNOSE blocks publish", !isOwnerToolAllowedForState("DIAGNOSE", "request_publish"));
check("intent: why did fail → DIAGNOSE", inferOwnerTaskFromIntent("Why did the last booking fail?") === "DIAGNOSE");
check("intent: make optional → CHANGE_REQUEST", inferOwnerTaskFromIntent("Stop asking for email on plumbing bookings") === "CHANGE_REQUEST");
check("publish blocked without tests", (() => {
  const r = assertOwnerToolAllowed({
    tool: "request_publish",
    state: "PUBLISH",
    permissions: defaultOwnerPermissions(),
    tests_passed: false,
  });
  return !r.allowed && r.error_code === "TESTS_NOT_PASSED";
})());
check("publish blocked without permission", (() => {
  const r = assertOwnerToolAllowed({
    tool: "request_publish",
    state: "PUBLISH",
    permissions: ["agent.read", "workflow.read"],
    tests_passed: true,
  });
  return !r.allowed && r.error_code === "PERMISSION_DENIED";
})());
check("publish allowed with permission + tests", (() => {
  const r = assertOwnerToolAllowed({
    tool: "request_publish",
    state: "PUBLISH",
    permissions: defaultOwnerPermissions(),
    tests_passed: true,
  });
  return r.allowed;
})());
check("blocked tool rejected", (() => {
  const r = assertOwnerToolAllowed({
    tool: "execute_sql",
    state: "GENERAL",
    permissions: defaultOwnerPermissions(),
  });
  return !r.allowed;
})());

if (failures.length) {
  console.error(`\n${failures.length} owner runtime failure(s)`);
  process.exit(1);
}
console.log("\nOwner Amy runtime tests passed.");
