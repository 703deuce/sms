/**
 * Gateway failure injection — simulates provider error translation.
 * Run: npx tsx scripts/test-gateway-failure-injection.ts
 */
import { translateError, AgentToolError, failResult } from "../src/lib/voice/agent-tool-gateway/errors";

const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (!cond) failures.push(name);
  else console.log("✓", name);
}

const scenarios: Array<{ name: string; input: unknown; expectCode: string }> = [
  { name: "slot unavailable", input: new Error("Slot no longer available"), expectCode: "SLOT_UNAVAILABLE" },
  { name: "auth expired", input: new Error("OAuth token expired"), expectCode: "AUTH_REQUIRED" },
  { name: "rate limit", input: new Error("429 rate limit"), expectCode: "TEMPORARY_PROVIDER_ERROR" },
  { name: "policy block", input: new Error("POLICY: Approval required"), expectCode: "POLICY_BLOCKED" },
  { name: "already booked", input: new Error("already confirmed"), expectCode: "ALREADY_COMPLETED" },
  { name: "invalid slot", input: new Error("must be copied exactly from slots[]"), expectCode: "SLOT_NOT_IN_AVAILABILITY" },
  { name: "missing field", input: new Error("Missing required booking field: email"), expectCode: "MISSING_REQUIRED_FIELD" },
  { name: "timeout", input: new Error("503 timeout"), expectCode: "TEMPORARY_PROVIDER_ERROR" },
];

for (const s of scenarios) {
  const err = translateError(s.input);
  check(`inject ${s.name}`, err.code === s.expectCode);
}

const fail = failResult(new AgentToolError("SLOT_UNAVAILABLE", "gone", true, "Try again"), "op_test");
check("fail envelope has error_code", fail.error_code === "SLOT_UNAVAILABLE");
check("fail envelope retryable", fail.retryable === true);
check("fail envelope operation_id", fail.operation_id === "op_test");

if (failures.length) {
  console.error(failures);
  process.exit(1);
}
console.log("\nFailure injection checks passed.");
