/**
 * Smart Routing standalone V1 contracts (no telephony).
 * Run: npx tsx scripts/test-smart-routing-standalone-v1.ts
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { SMART_ROUTING_TEMPLATES } from "../src/lib/smart-routing/templates";
import {
  decodeEmployeeAccessState,
  encodeEmployeeAccessState,
} from "../src/lib/smart-routing/employee-access-state";
import { isMissedRoutedOutcomeForEmployee } from "../src/lib/smart-routing/last-caller-heuristics";
import { isWorkspaceInternalSmartRoutingNumberSync } from "../src/lib/smart-routing/internal-numbers";

function isDomesticCallbackDestination(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return true;
  if (digits.length === 10) return true;
  return false;
}

assert.equal(isDomesticCallbackDestination("+17035551234"), true);
assert.equal(isDomesticCallbackDestination("+442071234567"), false);

assert.equal(
  isWorkspaceInternalSmartRoutingNumberSync(
    { routingNumberE164: "+17035559000", callbackNumberE164: "+17035559001" },
    "+17035559001",
  ),
  true,
);

const gate = SMART_ROUTING_TEMPLATES.find((t) => t.type === "call_gate");
assert.ok(gate);

const state = encodeEmployeeAccessState({
  kind: "smart_routing_employee",
  accessSessionId: "sess1",
  workspaceId: "ws1",
  awaiting: "pin",
});
assert.equal(decodeEmployeeAccessState(state)?.accessSessionId, "sess1");

assert.equal(isMissedRoutedOutcomeForEmployee("connected"), false);
assert.equal(isMissedRoutedOutcomeForEmployee("no_answer"), true);
assert.equal(isMissedRoutedOutcomeForEmployee(null), true);

async function main() {
  const hash = await bcrypt.hash("1234", 4);
  assert.ok(await bcrypt.compare("1234", hash));
  console.log("test-smart-routing-standalone-v1: ok");
}

main();
