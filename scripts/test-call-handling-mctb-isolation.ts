/**
 * MCTB must not start Smart Routing when callHandlingMode is mctb but flow is still published.
 * Run: npx tsx scripts/test-call-handling-mctb-isolation.ts
 */
import assert from "node:assert/strict";
import {
  isSmartRoutingCallHandlingActive,
  readCallHandlingMode,
} from "@/lib/numbers/call-handling-mode-shared";

assert.equal(
  readCallHandlingMode({
    callHandlingMode: "mctb",
    routingOwner: null,
  }),
  "mctb",
);
assert.equal(
  isSmartRoutingCallHandlingActive({
    callHandlingMode: "mctb",
    routingOwner: "smart_routing",
  }),
  false,
  "explicit mctb mode must win over stale routingOwner",
);

// Paused flow: mode preserved, runtime owner cleared
assert.equal(
  readCallHandlingMode({
    callHandlingMode: "smart_routing",
    routingOwner: null,
  }),
  "smart_routing",
);

import { derivePersonalDisplayState } from "@/lib/numbers/personal-call-settings";
import {
  isCustomerSmartRoutingFlow,
  isMctbConsentFlow,
} from "@/lib/smart-routing/flow-kind";

assert.equal(isMctbConsentFlow({ type: "missed_call_recovery", name: "x" }), true);
assert.equal(isCustomerSmartRoutingFlow({ type: "phone_menu", name: "Main menu" }), true);
assert.equal(isCustomerSmartRoutingFlow({ type: "missed_call_recovery", name: "x" }), false);


assert.equal(
  derivePersonalDisplayState({
    settingsJson: { callHandlingMode: "smart_routing", routingOwner: null },
  }),
  "SMART_ROUTING_PAUSED",
);
assert.equal(
  derivePersonalDisplayState({
    settingsJson: { callHandlingMode: "smart_routing", routingOwner: "smart_routing" },
  }),
  "SMART_ROUTING",
);

console.log("test:call-handling-mctb-isolation ok");
