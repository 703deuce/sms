/**
 * Pure logic for LiveKit per-DID dispatch rule upsert (no API calls).
 */
import assert from "node:assert/strict";
import {
  dispatchRuleNameForDid,
  findPerDidDispatchRule,
  isDuplicateDispatchRuleError,
  numbersWithoutE164,
  ruleDispatchCoversDid,
} from "../lib/server/receptionist/livekit/dispatch-sync-helpers.ts";

assert.equal(dispatchRuleNameForDid("+15717491060"), "transovo-did-dispatch-15717491060");

const rules = [
  {
    sipDispatchRuleId: "SDR_shared",
    name: "transovo-inbound-dispatch",
    trunkIds: ["ST_trunk"],
    numbers: ["+15717491060", "+15719999999"],
  },
  {
    sipDispatchRuleId: "SDR_did",
    name: "transovo-did-dispatch-15717491060",
    trunkIds: ["ST_trunk"],
    numbers: ["+15717491060"],
  },
];

assert.equal(findPerDidDispatchRule(rules, "+15717491060")?.sipDispatchRuleId, "SDR_did");
assert.equal(findPerDidDispatchRule(rules, "+15711111111"), null);

assert.ok(ruleDispatchCoversDid(rules[0], "+15717491060", "ST_trunk"));
assert.deepEqual(numbersWithoutE164(rules[0].numbers, "+15717491060"), ["+15719999999"]);

assert.ok(
  isDuplicateDispatchRuleError(
    "Dispatch rule for the same trunk, inbound number already exists in dispatch rule 'SDR_x' 'transovo-inbound-dispatch'",
  ),
);

console.log("test-dispatch-sync-logic: PASS");
