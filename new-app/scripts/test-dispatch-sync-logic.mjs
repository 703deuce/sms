/**
 * Pure logic for LiveKit dispatch rule upsert (no API calls).
 */
import assert from "node:assert/strict";
import {
  dispatchRuleNameForDid,
  findDispatchRuleForDid,
  isDuplicateDispatchRuleError,
} from "../lib/server/receptionist/livekit/dispatch-sync-helpers.ts";

assert.equal(dispatchRuleNameForDid("+15717491060"), "transovo-did-dispatch-15717491060");

const rules = [
  {
    sipDispatchRuleId: "SDR_shared",
    name: "transovo-inbound-dispatch",
    trunkIds: ["ST_trunk"],
    numbers: ["+15717491060"],
  },
];

const found = findDispatchRuleForDid(rules, "+15717491060", "ST_trunk");
assert.equal(found?.sipDispatchRuleId, "SDR_shared");

assert.ok(
  isDuplicateDispatchRuleError(
    "Dispatch rule for the same trunk, inbound number already exists in dispatch rule 'SDR_x' 'transovo-inbound-dispatch'",
  ),
);

console.log("test-dispatch-sync-logic: PASS");
