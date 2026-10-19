#!/usr/bin/env node
/**
 * Unit checks for recording control-id collection (no Telnyx).
 */
import assert from "node:assert/strict";

function collectIds(input) {
  const meta = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const ids = new Set();
  const push = (v) => {
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  };
  push(input.telnyxCallControlId);
  push(input.telnyxCallLegId);
  push(meta.callerCallControlId);
  push(meta.browserCallControlId);
  push(meta.parentCallControlId);
  push(meta.agentCallControlId);
  return [...ids];
}

const ids = collectIds({
  telnyxCallControlId: "pstn-1",
  telnyxCallLegId: "leg-1",
  metadata: { callerCallControlId: "caller-1", browserCallControlId: "browser-1" },
});
assert.ok(ids.includes("pstn-1"));
assert.ok(ids.includes("caller-1"));

console.log("test-phone-recording-resolve: PASS");
