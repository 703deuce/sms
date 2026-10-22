#!/usr/bin/env node
/**
 * Warm transfer must stay on the voice worker (WarmTransferTask), not Node SIP REFER.
 */
import assert from "node:assert/strict";

function planRequiresWorkerWarmTransfer(plan) {
  return plan.targets.some((t) => {
    const executor = (t.executor || "livekit_sip").toLowerCase();
    if (executor === "phone_call_control") return false;
    return (t.mode || "DIRECT").toUpperCase() === "WARM";
  });
}

const warm = {
  route_id: "cr_billing",
  targets: [{ mode: "WARM", dial_target: "+17038166017" }],
};
const cold = {
  route_id: "cr_billing",
  targets: [{ mode: "DIRECT", dial_target: "+17038166017" }],
};

assert.equal(planRequiresWorkerWarmTransfer(warm), true);
assert.equal(planRequiresWorkerWarmTransfer(cold), false);
const phoneWarm = {
  route_id: "cr_billing",
  targets: [
    {
      mode: "WARM",
      executor: "phone_call_control",
      dial_target: "+17038166017",
    },
  ],
};
assert.equal(planRequiresWorkerWarmTransfer(phoneWarm), false);
console.log("test-warm-transfer-delegation-gate: PASS");
