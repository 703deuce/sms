import assert from "node:assert/strict";
import { resolveStepScheduledTime, stepIdempotencyKey } from "../src/lib/appointment-workflows/scheduler";
import { evaluateConditionGroup } from "../src/lib/appointment-workflows/conditions";
import { parseSchedulingIntentFallback } from "../src/lib/appointments/ai-scheduling/intent-parser-fallback";
import { validateSchedulingIntent } from "../src/lib/appointments/ai-scheduling/intent-schema";
import { evaluateCancellationPolicy, evaluateReschedulePolicy } from "../src/lib/appointments/scheduling-policy";

function testScheduler() {
  const startsAt = new Date("2026-09-10T14:00:00.000Z");
  const scheduled = resolveStepScheduledTime({
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 24,
      unit: "hours",
      direction: "before",
    },
    appointmentStartsAt: startsAt,
    bookingCreatedAt: new Date("2026-09-01T10:00:00.000Z"),
    now: new Date("2026-09-01T10:00:00.000Z"),
  });
  assert.ok(scheduled);
  assert.equal(scheduled!.toISOString(), "2026-09-09T14:00:00.000Z");

  const key = stepIdempotencyKey("exec1", "step1", scheduled!, 1);
  assert.ok(key.includes("exec1"));
  console.log("scheduler: ok");
}

function testConditions() {
  const result = evaluateConditionGroup(
    {
      logic: "and",
      conditions: [
        { id: "1", field: "status", operator: "not_canceled", value: true },
        { id: "2", field: "status", operator: "is_upcoming", value: true },
      ],
    },
    {
      appointmentId: "a1",
      workspaceId: "w1",
      serviceName: "Consultation",
      status: "scheduled",
      startsAt: new Date(Date.now() + 86_400_000),
      metadata: {},
    },
  );
  assert.equal(result, true);
  console.log("conditions: ok");
}

function testAiFallback() {
  const intent = parseSchedulingIntentFallback("I need a consultation Friday afternoon", {
    appointmentTypes: [{ id: "t1", name: "Consultation" }],
    timezone: "America/New_York",
  });
  assert.equal(intent.appointmentTypeName, "Consultation");
  assert.ok(intent.timeOfDay === "afternoon" || intent.requestedDate);
  console.log("ai-fallback: ok");
}

function testIntentValidation() {
  const valid = validateSchedulingIntent({
    intent: "availability_request",
    confidence: 0.9,
    originalText: "test",
  });
  assert.ok(valid);
  assert.equal(valid!.intent, "availability_request");

  const invalid = validateSchedulingIntent({ foo: "bar" });
  assert.equal(invalid, null);
  console.log("intent-validation: ok");
}

function testPolicies() {
  const future = new Date(Date.now() + 7 * 86_400_000);
  const cancel = evaluateCancellationPolicy(
    { allowed: "until_hours_before", cutoffHours: 24 },
    future,
  );
  assert.equal(cancel.allowed, true);

  const soon = new Date(Date.now() + 3_600_000);
  const cancelSoon = evaluateCancellationPolicy(
    { allowed: "until_hours_before", cutoffHours: 24 },
    soon,
  );
  assert.equal(cancelSoon.allowed, false);
  console.log("policies: ok");
}

testScheduler();
testConditions();
testAiFallback();
testIntentValidation();
testPolicies();
console.log("All appointment workflow/scheduling unit tests passed.");
