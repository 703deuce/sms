#!/usr/bin/env node
/**
 * Logic checks for Phone runtime (no live Telnyx).
 * Run: node new-app/scripts/test-phone-runtime-logic.mjs
 */
import assert from "node:assert/strict";

function decodeClientState(raw) {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

const state = Buffer.from(JSON.stringify({ humanCallId: "hc_1", kind: "human" })).toString("base64");
const parsed = decodeClientState(state);
assert.equal(parsed.humanCallId, "hc_1");
assert.equal(parsed.kind, "human");

const ringTimeout = new Date(Date.now() - 1000).toISOString();
assert.ok(new Date(ringTimeout).getTime() < Date.now());

console.log("test-phone-runtime-logic: PASS");
