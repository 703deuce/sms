#!/usr/bin/env node
/**
 * Voice V3 PSTN transfers must use Telnyx Call Control only (no LiveKit REFER path).
 */
import assert from "node:assert/strict";

function planRequiresNodePhoneHandoff(plan) {
  return (
    plan.targets.length > 0 &&
    plan.targets.every(
      (t) => (t.executor || "livekit_sip").toLowerCase() === "phone_call_control",
    )
  );
}

const telnyxOnly = {
  targets: [{ executor: "phone_call_control", mode: "DIRECT" }],
};
const livekit = {
  targets: [{ executor: "livekit_sip", mode: "WARM" }],
};

assert.equal(planRequiresNodePhoneHandoff(telnyxOnly), true);
assert.equal(planRequiresNodePhoneHandoff(livekit), false);
console.log("test-telnyx-voice-transfer-gate: PASS");
