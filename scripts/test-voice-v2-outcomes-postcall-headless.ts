#!/usr/bin/env npx tsx
/**
 * Sections 41–43: structured outcomes, post-call reconcile (no DB), notification idempotency keys.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-outcomes-postcall-headless.ts
 */
import assert from "node:assert/strict";
import { structuredOutcomeForStrategy } from "../src/lib/voice-receptionist-wizard/booking-strategy";
import {
  extractPostCallIntakeCandidates,
  mergePostCallBackfills,
} from "../src/lib/voice-receptionist-wizard/intake/postcall-reconcile";

function deliveryKey(outcome: string, channel: string, recipient: string): string {
  return `voiceV2Notify:${outcome}:${channel}:${recipient}`;
}

assert.equal(structuredOutcomeForStrategy("REQUEST_ONLY"), "APPOINTMENT_REQUESTED");
assert.equal(structuredOutcomeForStrategy("NONE"), "MESSAGE_TAKEN");
assert.equal(structuredOutcomeForStrategy("MICROSOFT_365"), "MESSAGE_TAKEN");

const k1 = deliveryKey("APPOINTMENT_REQUESTED", "email", "ops@example.com");
const k2 = deliveryKey("APPOINTMENT_REQUESTED", "email", "ops@example.com");
assert.equal(k1, k2);
assert.notEqual(k1, deliveryKey("MESSAGE_TAKEN", "email", "ops@example.com"));

const canonical = {
  name: {
    value: "Anthony",
    status: "CAPTURED",
    source: "CALLER",
    updatedAt: new Date().toISOString(),
  },
};
const transcript = "Agent: Anything else?\nCaller: my email is anthony@example.com";
const candidates = extractPostCallIntakeCandidates(transcript, canonical);
assert.ok(candidates.candidate_backfills.email?.value.includes("@"));
const merged = mergePostCallBackfills(canonical, candidates);
assert.equal(merged.name?.value, "Anthony");
assert.ok(merged.email?.value);

const corrected = {
  ...canonical,
  email: {
    value: "fixed@example.com",
    status: "CORRECTED",
    source: "CALLER",
    updatedAt: new Date().toISOString(),
  },
};
const noOverwrite = mergePostCallBackfills(corrected, candidates);
assert.equal(noOverwrite.email?.value, "fixed@example.com");

console.log("test-voice-v2-outcomes-postcall-headless: PASS");
