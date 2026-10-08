import assert from "node:assert/strict";

// Regression: single-letter AR replies must not match substring STOP keywords (e.g. C vs CANCEL).
async function loadBoundary() {
  const mod = await import("./platform-inbound-boundary");
  return mod;
}

const { handlePlatformSenderComplianceInbound } = await loadBoundary();

const platformSender = {
  phoneNumberId: "pn_test",
  e164: "+18665550100",
  workspaceId: "ws_platform",
  provider: "telnyx",
};

const stop = await handlePlatformSenderComplianceInbound({
  platformSender,
  fromE164: "+15714073615",
  body: "C",
});
assert.equal(stop.kind, "none", "C is confirm for AR, not carrier STOP");

const realStop = await handlePlatformSenderComplianceInbound({
  platformSender,
  fromE164: "+15714073615",
  body: "STOP",
});
assert.equal(realStop.kind, "stop", "STOP still opts out when MCTB compliance runs");

const cancelWord = await handlePlatformSenderComplianceInbound({
  platformSender,
  fromE164: "+15714073615",
  body: "CANCEL",
});
assert.equal(cancelWord.kind, "none", "CANCEL alone is not an opt-out keyword");

const takeOff = await handlePlatformSenderComplianceInbound({
  platformSender,
  fromE164: "+15714073615",
  body: "take me off the list",
});
assert.equal(takeOff.kind, "stop", "explicit removal phrase opts out");

console.log("platform-inbound-boundary-keywords.test.ts: ok");
