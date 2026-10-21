#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildConversationalRouteAiDescription,
  tryNormalizePhoneInput,
} from "../lib/receptionist/conversational-route-helpers.ts";

assert.deepEqual(tryNormalizePhoneInput("(571) 555-0134"), {
  ok: true,
  e164: "+15715550134",
});
assert.equal(tryNormalizePhoneInput("").ok, false);

const desc = buildConversationalRouteAiDescription({
  id: "r1",
  name: "Sales",
  description: "New customers and quotes.",
  intentDescription: "When someone asks about pricing.",
  examples: ["I need an estimate"],
  destinationRef: "",
  destinationKind: "forwarding_destination",
  enabled: true,
  confirmBeforeTransfer: false,
});
assert.ok(desc.includes("New customers"));
assert.ok(desc.includes("When to transfer:"));
assert.ok(desc.includes("estimate"));

console.log("test-conversational-route-helpers: PASS");
