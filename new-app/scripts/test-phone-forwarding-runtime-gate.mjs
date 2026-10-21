#!/usr/bin/env node
/** Run from repo root: node new-app/scripts/test-phone-forwarding-runtime-gate.mjs */
import assert from "node:assert/strict";

function readTelephony(settingsJson) {
  const settings =
    settingsJson && typeof settingsJson === "object" ? settingsJson : {};
  const telephony = settings.telephony || settings.provisioning || {};
  return {
    routingMode: telephony.routingMode,
    state: telephony.state,
  };
}

function phoneCallForwardingRuntimeAllowed(settingsJson) {
  const telephony = readTelephony(settingsJson);
  const mode = telephony.routingMode;
  if ((mode === "livekit_sip" || mode === "mctb_texml") && telephony.state === "active") {
    return false;
  }
  if (telephony.state === "error" || telephony.state === "removed") {
    return false;
  }
  return true;
}

assert.equal(phoneCallForwardingRuntimeAllowed({}), true);
assert.equal(
  phoneCallForwardingRuntimeAllowed({ telephony: { routingMode: "telnyx_call_control", state: "active" } }),
  true,
);
assert.equal(
  phoneCallForwardingRuntimeAllowed({ telephony: { routingMode: "mctb_texml", state: "active" } }),
  false,
);

console.log("test-phone-forwarding-runtime-gate: PASS");
