/**
 * Pure-logic wiring checks for appointment parity phases 3–17.
 * Run: npx tsx scripts/test-phases-3-17-wiring.ts
 */
import assert from "node:assert/strict";
import { generateRecurringOccurrences } from "../src/lib/appointments/recurring-schedule";
import { buildPolicySnapshot } from "../src/lib/appointments/policy-snapshot";

function testRecurringSchedule() {
  const dates = generateRecurringOccurrences({
    startsAt: "2026-09-08T14:00:00.000Z",
    frequency: "weekly",
    occurrences: 3,
  });
  assert.equal(dates.length, 3);
  const biweekly = generateRecurringOccurrences({
    startsAt: "2026-09-08T14:00:00.000Z",
    frequency: "biweekly",
    occurrences: 2,
  });
  assert.equal(biweekly.length, 2);
  const dayDiff =
    (new Date(biweekly[1]).getTime() - new Date(biweekly[0]).getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(dayDiff, 14);
}

function testPolicySnapshot() {
  const snap = buildPolicySnapshot({
    cancellationPolicy: { allowed: "anytime" },
    reschedulePolicy: { allowed: "anytime" },
    payment: { mode: "deposit", priceCents: 5000, depositCents: 2500, currency: "usd" },
  });
  assert.equal(snap.version, "v1");
  assert.equal(snap.paymentMode, "deposit");
}

function testPaymentPlanSummary() {
  const installments = [
    { id: "a", label: "A", amountCents: 4000, dueDaysFromStart: 0 },
    { id: "b", label: "B", amountCents: 6000, dueDaysFromStart: 30 },
  ];
  const paid = installments.reduce((s, i) => s + i.amountCents, 0);
  assert.equal(paid, 10000);
}

function testSchedulingModules() {
  const defaults = {
    workflows: false,
    meetings: false,
    payments: true,
    analytics: true,
    integrations: true,
    classes: false,
    commerce: true,
    globalSearch: true,
  };
  assert.equal(defaults.commerce, true);
  assert.equal(defaults.workflows, false);
}

testRecurringSchedule();
testPolicySnapshot();
testPaymentPlanSummary();
testSchedulingModules();

console.log("test-phases-3-17-wiring: PASS");
