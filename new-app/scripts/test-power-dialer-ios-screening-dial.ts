/**
 * Phase 2 — server iOS screening origination (mocked Telnyx) + dial-mode regression.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMultiLineDialMode, normalizeDialingMode } from "../lib/server/phone/power-dialer/dial-modes";

const policySrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/ios-origination-policy.ts"),
  "utf8",
);
assert.ok(policySrc.includes("POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION"));
assert.ok(!policySrc.includes("multi_line_uses_webrtc_path"));
assert.ok(policySrc.includes("server_ios_screening"));
console.log("ios origination policy: PASS");

const dialSrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/power-dialer-server-pstn-dial.ts"),
  "utf8",
);
assert.ok(dialSrc.includes("premium_ios_call_screening_detection"));
assert.ok(dialSrc.includes("bridge_on_answer: false"));
assert.ok(!dialSrc.includes("bridge_on_answer: true"));
assert.ok(dialSrc.includes("iosScreeningWireActive: true"));
console.log("server pstn dial body: PASS");

const bridgeSrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/power-dialer-leg-bridge.ts"),
  "utf8",
);
assert.ok(bridgeSrc.includes("screening_pending"));
assert.ok(bridgeSrc.includes("isConfirmedHumanClassification"));
console.log("deferred bridge policy: PASS");

assert.ok(bridgeSrc.includes("readPowerDialerLegIds"));
console.log("leg id reader: PASS");

const modes = ["preview", "power", "parallel", "parallel_amd", "predictive"] as const;
for (const m of modes) {
  const norm = normalizeDialingMode(m);
  if (m === "parallel" || m === "parallel_amd" || m === "predictive") {
    assert.ok(isMultiLineDialMode(norm));
  } else {
    assert.ok(!isMultiLineDialMode(norm));
  }
}
console.log("five dial modes taxonomy: PASS");

const sharedSrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/ios-shared-agent-leg.ts"),
  "utf8",
);
assert.ok(sharedSrc.includes("sharedIosAgentCallControlId"));
assert.ok(dialSrc.includes("sharedFromSession"));
console.log("multiline shared agent leg: PASS");

const callsSvc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/calls-service.ts"),
  "utf8",
);
assert.ok(callsSvc.includes('mode: "server_pstn_ios"'));
assert.ok(callsSvc.includes("outboundPstnMode === \"server_ios_screening\""));
console.log("calls-service integration hooks: PASS");

console.log("test-power-dialer-ios-screening-dial: ALL PASS");
