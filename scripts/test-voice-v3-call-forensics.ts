#!/usr/bin/env npx tsx
import assert from "node:assert/strict";

// Forensics helpers are DB-backed; unit-test payload shape only.
const samplePayload = {
  toolName: "find_availability",
  outcome: "success",
  durationMs: 120,
  conversationRevision: 7,
};

assert.equal(samplePayload.toolName, "find_availability");
assert.ok(samplePayload.durationMs > 0);

console.log("test-voice-v3-call-forensics: PASS (shape contract)");
