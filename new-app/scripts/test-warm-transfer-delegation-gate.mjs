#!/usr/bin/env node
/**
 * Warm transfer must stay on the voice worker (WarmTransferTask), not Node SIP REFER.
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

const warm = {
  route_id: "cr_billing",
  targets: [{ mode: "WARM", executor: "livekit_sip", dial_target: "+17038166017" }],
};
const cold = {
  route_id: "cr_billing",
  targets: [{ mode: "DIRECT", executor: "livekit_sip", dial_target: "+17038166017" }],
};
const phoneCc = {
  route_id: "cr_billing",
  targets: [
    {
      mode: "DIRECT",
      executor: "phone_call_control",
      dial_target: "+17038166017",
    },
  ],
};

assert.equal(planRequiresNodePhoneHandoff(warm), false);
assert.equal(planRequiresNodePhoneHandoff(cold), false);
assert.equal(planRequiresNodePhoneHandoff(phoneCc), true);
console.log("test-warm-transfer-delegation-gate: PASS");
