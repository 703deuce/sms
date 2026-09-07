#!/usr/bin/env tsx
/**
 * Local certification for rapid_flow_test minute-based workflow scheduling.
 * Does NOT send SMS or require TEST_PHONE — only timing construction.
 *
 * Live SMS delivery for minute workflows remains APT-WF-03-live (PSTN-blocked).
 */
import assert from "node:assert/strict";
import { getPrebuiltTemplate } from "../src/lib/appointment-workflows/templates";
import { resolveStepScheduledTime } from "../src/lib/appointment-workflows/scheduler";

const template = getPrebuiltTemplate("rapid_flow_test");
assert.ok(template, "rapid_flow_test template must exist");

const bookingCreatedAt = new Date("2026-09-10T14:00:00.000Z");
const appointmentStartsAt = new Date("2026-09-12T16:00:00.000Z");
const now = bookingCreatedAt;

const steps = template.defaultSteps;
assert.equal(steps.length, 4);

const immediate = resolveStepScheduledTime({
  timing: steps[0]!.timing,
  appointmentStartsAt,
  bookingCreatedAt,
  now,
});
assert.ok(immediate);
assert.equal(immediate!.toISOString(), bookingCreatedAt.toISOString());

const oneMin = resolveStepScheduledTime({
  timing: steps[1]!.timing,
  appointmentStartsAt,
  bookingCreatedAt,
  now,
});
assert.ok(oneMin);
assert.equal(oneMin!.toISOString(), "2026-09-10T14:01:00.000Z");

const threeMin = resolveStepScheduledTime({
  timing: steps[2]!.timing,
  appointmentStartsAt,
  bookingCreatedAt,
  now,
});
assert.ok(threeMin);
assert.equal(threeMin!.toISOString(), "2026-09-10T14:03:00.000Z");

const fiveMin = resolveStepScheduledTime({
  timing: steps[3]!.timing,
  appointmentStartsAt,
  bookingCreatedAt,
  now,
});
assert.ok(fiveMin);
assert.equal(fiveMin!.toISOString(), "2026-09-10T14:05:00.000Z");

console.log("test-appointment-workflow-minutes-scheduling: ok", {
  steps: steps.map((s) => s.id),
  scheduled: [immediate, oneMin, threeMin, fiveMin].map((d) => d!.toISOString()),
});
