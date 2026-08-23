/**
 * Hermetic tests for Transovo product features (availability, menu behaviors).
 * Run: npx tsx scripts/test-transovo-product-features.ts
 */
import assert from "node:assert/strict";
import {
  destinationAvailabilityLabel,
  isDestinationAvailable,
  pauseDurationUntil,
} from "../src/lib/smart-routing/destination-availability";
import { applyMenuBehaviorsToDraft } from "../src/lib/smart-routing/menu-behaviors";
import { formatRoutingOutcome } from "../src/lib/smart-routing/outcome-labels";
import { compileDraftConfig } from "../src/lib/smart-routing/flow-compiler";

assert.equal(isDestinationAvailable({ active: true, availabilityStatus: "available" }), true);
assert.equal(
  isDestinationAvailable({ active: true, availabilityStatus: "unavailable" }),
  false,
);
assert.equal(
  isDestinationAvailable({
    active: true,
    availabilityStatus: "unavailable",
    unavailableUntil: new Date(Date.now() + 60_000),
  }),
  false,
);
assert.equal(destinationAvailabilityLabel({ active: false, phoneNumber: "+15551234567" }), "Disabled");

const until1h = pauseDurationUntil("1h");
assert.ok(until1h && until1h > new Date());

assert.equal(formatRoutingOutcome("connected"), "Answered");
assert.equal(formatRoutingOutcome("callback_requested"), "Callback requested");

const draft = applyMenuBehaviorsToDraft({
  nodes: [
    { id: "menu", type: "MENU", config: {} },
    { id: "team", type: "RING_GROUP", config: { label: "Main" } },
    { id: "vm", type: "VOICEMAIL", config: {} },
  ],
  edges: [],
  metadata: {
    menuBehaviors: {
      noInput: { action: "ring_main_team" },
      invalidInput: { action: "replay" },
    },
  },
});
const timeoutEdge = draft.edges.find((e) => e.fromNodeId === "menu" && e.conditionType === "timeout");
assert.equal(timeoutEdge?.toNodeId, "team");

const compiled = compileDraftConfig(draft);
assert.ok(compiled.nodes.menu);

console.log("test-transovo-product-features: OK");
