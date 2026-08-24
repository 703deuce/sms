/**
 * Unit tests for call handling mode inference (no DB).
 * Run: npx tsx scripts/test-call-handling-mode.ts
 */
import assert from "node:assert/strict";
import {
  readCallHandlingMode,
  snapshotCallHandlingMode,
} from "../src/lib/numbers/call-handling-mode-shared";

assert.equal(readCallHandlingMode({ callHandlingMode: "smart_routing" }), "smart_routing");
assert.equal(readCallHandlingMode({ callHandlingMode: "mctb" }), "mctb");
assert.equal(readCallHandlingMode({ callHandlingMode: "none" }), "none");

assert.equal(
  readCallHandlingMode({ mctbSipIngress: true, routingOwner: "smart_routing" }),
  "mctb",
  "explicit mctbSipIngress wins when callHandlingMode unset",
);

assert.equal(
  readCallHandlingMode({ routingOwner: "smart_routing" }),
  "smart_routing",
);

assert.equal(readCallHandlingMode({}), "none");

const snap = snapshotCallHandlingMode({
  callHandlingMode: "smart_routing",
  routingOwner: "smart_routing",
  mctbSipIngress: false,
});
assert.equal(snap.mode, "smart_routing");
assert.equal(snap.routingOwner, "smart_routing");
assert.equal(snap.mctbSipIngress, false);

console.log("test-call-handling-mode: ok");
