/**
 * Call-handling mode helpers — unit checks for SR/MCTB isolation.
 * Run: npx tsx scripts/test-call-handling-mode.ts
 */
import assert from "node:assert/strict";
import {
  isSmartRoutingCallHandlingActive,
  readCallHandlingMode,
} from "@/lib/numbers/call-handling-mode-shared";

assert.equal(readCallHandlingMode({ callHandlingMode: "smart_routing" }), "smart_routing");
assert.equal(readCallHandlingMode({ routingOwner: "smart_routing" }), "smart_routing");
assert.equal(readCallHandlingMode({ callHandlingMode: "mctb" }), "mctb");
assert.equal(readCallHandlingMode({ mctbSipIngress: true }), "mctb");
assert.equal(readCallHandlingMode({}), "unconfigured");

assert.equal(isSmartRoutingCallHandlingActive({ callHandlingMode: "smart_routing" }), true);
assert.equal(
  isSmartRoutingCallHandlingActive({ callHandlingMode: "mctb", routingOwner: "smart_routing" }),
  false,
);
assert.equal(isSmartRoutingCallHandlingActive({ routingOwner: "smart_routing" }), true);

console.log("test:call-handling-mode ok");
