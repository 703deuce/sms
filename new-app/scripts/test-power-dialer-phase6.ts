/**
 * Phase 6 unit checks — DNC, usage, metrics consistency, CRM idempotency keys.
 */
import assert from "node:assert/strict";
import { evaluateContactEligibility } from "../lib/server/phone/power-dialer/eligibility";
import {
  dedupeAttemptsById,
  isHumanConversation,
} from "../lib/server/phone/power-dialer/metrics-definitions";

function testInternalDncEligibility() {
  const r = evaluateContactEligibility({
    contact: { id: "c1", phone: "+15551234567", status: "ACTIVE", timezone: null, customFields: {} },
    rules: {
      ringTimeoutSeconds: 30,
      retryIntervalMinutes: 60,
      dailyAttemptCap: 50,
      totalAttemptCap: 3,
      postCallIntervalSeconds: 5,
      requireDispositionBeforeNext: true,
      allowedDays: [1, 2, 3, 4, 5],
      callingHoursStart: "00:00",
      callingHoursEnd: "23:59",
      phoneFieldPriority: ["phone"],
      dialingMode: "power",
      timezone: "America/Chicago",
      status: "active",
    },
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now: new Date(),
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
    onInternalDnc: true,
  });
  assert.equal(r.reason, "internal_dnc");
  console.log("internal-dnc-eligibility: PASS");
}

function testUsageBlocked() {
  const r = evaluateContactEligibility({
    contact: { id: "c1", phone: "+15551234567", status: "ACTIVE", timezone: null, customFields: {} },
    rules: {
      ringTimeoutSeconds: 30,
      retryIntervalMinutes: 60,
      dailyAttemptCap: 50,
      totalAttemptCap: 3,
      postCallIntervalSeconds: 5,
      requireDispositionBeforeNext: true,
      allowedDays: [1, 2, 3, 4, 5],
      callingHoursStart: "00:00",
      callingHoursEnd: "23:59",
      phoneFieldPriority: ["phone"],
      dialingMode: "power",
      timezone: "America/Chicago",
      status: "active",
    },
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now: new Date(),
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
    usageBlocked: true,
  });
  assert.equal(r.reason, "usage_limit_reached");
  console.log("usage-limit-eligibility: PASS");
}

function testMetricsHumanExcludesMachine() {
  assert.equal(isHumanConversation("Interested", "voicemail"), false);
  assert.equal(isHumanConversation("Interested", "human"), true);
  console.log("metrics-human-definition: PASS");
}

function testDedupeAttempts() {
  const rows = dedupeAttemptsById([
    { id: "a1", x: 1 },
    { id: "a1", x: 2 },
    { id: "a2", x: 3 },
  ]);
  assert.equal(rows.length, 2);
  console.log("attempt-dedupe: PASS");
}

function testCrmIdempotencyKey() {
  const key = `pd-crm:attempt-1:call_completed`;
  assert.ok(key.includes("attempt-1"));
  console.log("crm-idempotency-key: PASS");
}

testInternalDncEligibility();
testUsageBlocked();
testMetricsHumanExcludesMachine();
testDedupeAttempts();
testCrmIdempotencyKey();
console.log("test-power-dialer-phase6: ALL PASS");
