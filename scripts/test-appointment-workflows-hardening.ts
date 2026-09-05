/**
 * Hermetic appointment workflow hardening tests (source-only; do not run in CI by default).
 * Run manually: npx tsx scripts/test-appointment-workflows-hardening.ts
 */
import assert from "node:assert/strict";
import { PREBUILT_WORKFLOW_TEMPLATES } from "../src/lib/appointment-workflows/templates";
import { PREBUILT_WORKFLOW_TEMPLATE_IDS } from "../src/lib/appointment-workflows/types";
import { evaluateConditionGroup, shouldAllowStatusForWorkflow, workflowMatchesAppointmentType } from "../src/lib/appointment-workflows/conditions";
import { webhookHostForLog } from "../src/lib/appointment-workflows/webhook-delivery";
import { isPaymentOutstanding } from "../src/lib/appointment-workflows/payment-link";
import { resolveStepScheduledTime, stepIdempotencyKey } from "../src/lib/appointment-workflows/scheduler";
import { parseWorkflowSteps } from "../src/lib/appointment-workflows/types";

const baseCtx = {
  appointmentId: "appt-1",
  workspaceId: "ws-1",
  serviceName: "Consultation",
  serviceId: "type-1",
  status: "scheduled",
  startsAt: new Date("2026-09-10T14:00:00.000Z"),
  endsAt: new Date("2026-09-10T15:00:00.000Z"),
  metadata: { smsConsent: true, inviteePhone: "+15555550100" },
  contactPhone: "+15555550100",
  contactEmail: "alex@example.com",
};

function testAllTemplatesExist() {
  assert.equal(PREBUILT_WORKFLOW_TEMPLATES.length, 10);
  for (const id of PREBUILT_WORKFLOW_TEMPLATE_IDS) {
    const template = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === id);
    assert.ok(template, `missing template ${id}`);
    assert.ok(template!.defaultSteps.length > 0, `${id} has no steps`);
    assert.ok(template!.trigger, `${id} missing trigger`);
  }
  console.log("templates: all 10 executable definitions present");
}

function testTemplateStepShapes() {
  const standard = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "standard_reminders")!;
  assert.equal(standard.trigger, "appointment_booked");
  assert.equal(standard.defaultSteps.length, 3);

  const confirm = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "confirmation_required")!;
  assert.ok(confirm.defaultSteps.some((s) => s.stopIfConfirmed));

  const highValue = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "high_value_appointment")!;
  assert.ok(highValue.defaultSteps.some((s) => s.action === "send_sms_staff"));

  const post = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "post_appointment_follow_up")!;
  assert.equal(post.trigger, "appointment_completed");

  const review = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "review_request")!;
  assert.equal(review.defaultSteps[0].action, "send_review_link");

  const reschedule = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "reschedule_follow_up")!;
  assert.equal(reschedule.trigger, "appointment_rescheduled");

  const noShow = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "no_show_recovery")!;
  assert.equal(noShow.trigger, "appointment_no_show");
  assert.ok(noShow.defaultSteps.some((s) => s.stopIfRebooked));

  const reEngage = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "re_engagement")!;
  assert.equal(reEngage.trigger, "appointment_completed");
  assert.ok(reEngage.defaultConditions?.conditions.some((c) => c.operator === "customer_no_future_appointment"));

  const payment = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "payment_follow_up")!;
  assert.equal(payment.trigger, "payment_required");
  assert.ok(payment.defaultSteps.some((s) => s.stopIfPaid));
  console.log("template-shapes: ok");
}

function testCustomWorkflowParse() {
  const steps = parseWorkflowSteps([
    {
      id: "s1",
      name: "Immediate",
      timing: { kind: "immediate" },
      action: "send_sms_customer",
      channel: "sms",
    },
  ]);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, "send_sms_customer");
  console.log("custom-workflow-parse: ok");
}

function testTriggerConditions() {
  const match = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "status", operator: "not_canceled", value: true }] },
    baseCtx,
  );
  assert.equal(match, true);

  const noMatch = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "status", operator: "is_canceled", value: true }] },
    baseCtx,
  );
  assert.equal(noMatch, false);
  console.log("trigger-conditions: ok");
}

function testAndOrConditions() {
  const andPass = evaluateConditionGroup(
    {
      logic: "and",
      conditions: [
        { id: "1", field: "status", operator: "has_phone", value: true },
        { id: "2", field: "status", operator: "has_sms_consent", value: true },
      ],
    },
    baseCtx,
  );
  assert.equal(andPass, true);

  const orPass = evaluateConditionGroup(
    {
      logic: "or",
      conditions: [
        { id: "1", field: "status", operator: "is_canceled", value: true },
        { id: "2", field: "status", operator: "has_phone", value: true },
      ],
    },
    baseCtx,
  );
  assert.equal(orPass, true);
  console.log("and-or-conditions: ok");
}

function testTimingKinds() {
  const startsAt = new Date("2026-09-10T14:00:00.000Z");
  const endsAt = new Date("2026-09-10T15:00:00.000Z");
  const now = new Date("2026-09-01T10:00:00.000Z");

  const immediate = resolveStepScheduledTime({
    timing: { kind: "immediate" },
    appointmentStartsAt: startsAt,
    appointmentEndsAt: endsAt,
    bookingCreatedAt: now,
    now,
  });
  assert.equal(immediate!.toISOString(), now.toISOString());

  const before = resolveStepScheduledTime({
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 24,
      unit: "hours",
      direction: "before",
    },
    appointmentStartsAt: startsAt,
    bookingCreatedAt: now,
    now,
  });
  assert.equal(before!.toISOString(), "2026-09-09T14:00:00.000Z");

  const after = resolveStepScheduledTime({
    timing: {
      kind: "relative",
      anchor: "appointment_end",
      amount: 2,
      unit: "hours",
      direction: "after",
    },
    appointmentStartsAt: startsAt,
    appointmentEndsAt: endsAt,
    bookingCreatedAt: now,
    now,
  });
  assert.equal(after!.toISOString(), "2026-09-10T17:00:00.000Z");
  console.log("timing-immediate-before-after: ok");
}

function testRescheduleIdempotencyKey() {
  const t1 = new Date("2026-09-09T14:00:00.000Z");
  const t2 = new Date("2026-09-08T14:00:00.000Z");
  const gen1 = stepIdempotencyKey("exec", "step", t1, 1);
  const gen2 = stepIdempotencyKey("exec", "step", t2, 2);
  assert.notEqual(gen1, gen2);
  const retry = stepIdempotencyKey("exec", "step", t1, 1);
  assert.equal(gen1, retry);
  console.log("reschedule-idempotency-key: ok");
}

function testSmsConsentCondition() {
  const blocked = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "sms", operator: "has_sms_consent", value: true }] },
    { ...baseCtx, metadata: { smsConsent: false } },
  );
  assert.equal(blocked, false);
  console.log("sms-consent: ok");
}

function testPaymentCondition() {
  const deposit = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "pay", operator: "deposit_paid", value: true }] },
    { ...baseCtx, metadata: { depositPaidCents: 5000, balanceDueCents: 2500 } },
  );
  assert.equal(deposit, true);

  const failed = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "pay", operator: "payment_failed", value: true }] },
    { ...baseCtx, paymentStatus: "failed" },
  );
  assert.equal(failed, true);
  console.log("payment-conditions: ok");
}

function testAppointmentTypeScope() {
  const map = new Map([["Consultation", "type-1"]]);
  assert.equal(
    workflowMatchesAppointmentType({ mode: "selected", typeIds: ["type-1"] }, "type-1", "Consultation", map),
    true,
  );
  assert.equal(
    workflowMatchesAppointmentType({ mode: "selected", typeIds: ["type-2"] }, "type-1", "Consultation", map),
    false,
  );
  console.log("appointment-type-scope: ok");
}

function testCompletedVsCanceled() {
  const completed = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "status", operator: "is_completed", value: true }] },
    { ...baseCtx, status: "completed" },
  );
  assert.equal(completed, true);

  const canceled = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "status", operator: "not_canceled", value: true }] },
    { ...baseCtx, status: "canceled" },
  );
  assert.equal(canceled, false);
  console.log("completed-vs-canceled: ok");
}

function testNoShowCondition() {
  const noShow = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "status", operator: "is_no_show", value: true }] },
    { ...baseCtx, status: "no_show" },
  );
  assert.equal(noShow, true);
  console.log("no-show-condition: ok");
}

function testStaleBeforeAppointmentSkipped() {
  const startsAt = new Date("2026-06-01T14:00:00.000Z");
  const now = new Date("2026-06-02T10:00:00.000Z");
  const scheduled = resolveStepScheduledTime({
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 24,
      unit: "hours",
      direction: "before",
    },
    appointmentStartsAt: startsAt,
    bookingCreatedAt: new Date("2026-05-20T10:00:00.000Z"),
    now,
  });
  assert.equal(scheduled, null);
  console.log("stale-before-appointment: ok");
}

function testFutureAppointmentCondition() {
  const hasFuture = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "customer", operator: "customer_has_future_appointment", value: true }] },
    { ...baseCtx, hasFutureAppointment: true },
  );
  assert.equal(hasFuture, true);

  const noFuture = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "customer", operator: "customer_no_future_appointment", value: true }] },
    { ...baseCtx, hasFutureAppointment: false },
  );
  assert.equal(noFuture, true);
  console.log("future-appointment-conditions: ok");
}

function testChangeInitiatedBy() {
  const customer = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "actor", operator: "change_initiated_by_equals", value: "customer" }] },
    { ...baseCtx, metadata: { ...baseCtx.metadata, lastChangeInitiatedBy: "customer" } },
  );
  assert.equal(customer, true);

  const staff = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "actor", operator: "change_initiated_by_equals", value: "staff" }] },
    { ...baseCtx, metadata: { ...baseCtx.metadata, lastChangeInitiatedBy: "staff" } },
  );
  assert.equal(staff, true);
  console.log("change-initiated-by: ok");
}

function testRecurringConditions() {
  const recurring = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "series", operator: "is_recurring", value: true }] },
    { ...baseCtx, metadata: { ...baseCtx.metadata, recurringSeriesId: "series-1", recurringOccurrenceIndex: 1 } },
  );
  assert.equal(recurring, true);

  const first = evaluateConditionGroup(
    { logic: "and", conditions: [{ id: "1", field: "series", operator: "is_first_recurring_occurrence", value: true }] },
    { ...baseCtx, metadata: { ...baseCtx.metadata, recurringSeriesId: "series-1", recurringOccurrenceIndex: 1 } },
  );
  assert.equal(first, true);
  console.log("recurring-conditions: ok");
}

function testWorkflowStatusAllowance() {
  assert.equal(shouldAllowStatusForWorkflow("appointment_completed", "completed"), true);
  assert.equal(shouldAllowStatusForWorkflow("appointment_booked", "completed"), false);
  assert.equal(shouldAllowStatusForWorkflow("appointment_no_show", "no_show"), true);
  assert.equal(shouldAllowStatusForWorkflow("payment_required", "pending_payment"), true);
  console.log("workflow-status-allowance: ok");
}

function testPaymentOutstanding() {
  assert.equal(isPaymentOutstanding({ paymentStatus: "pending" }), true);
  assert.equal(isPaymentOutstanding({ paymentStatus: "succeeded" }), false);
  console.log("payment-outstanding: ok");
}

function testWebhookHostLog() {
  assert.equal(webhookHostForLog("https://hooks.example.com/path?secret=abc"), "hooks.example.com");
  console.log("webhook-host-log: ok");
}

function testFollowUpSuppressionConditions() {
  const review = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "review_request")!;
  assert.ok(review.defaultConditions?.conditions.some((c) => c.operator === "not_no_show"));
  const post = PREBUILT_WORKFLOW_TEMPLATES.find((t) => t.id === "post_appointment_follow_up")!;
  assert.ok(post.defaultConditions?.conditions.some((c) => c.operator === "is_completed"));
  console.log("follow-up-suppression: ok");
}

testAllTemplatesExist();
testTemplateStepShapes();
testCustomWorkflowParse();
testTriggerConditions();
testAndOrConditions();
testTimingKinds();
testRescheduleIdempotencyKey();
testSmsConsentCondition();
testPaymentCondition();
testAppointmentTypeScope();
testCompletedVsCanceled();
testNoShowCondition();
testStaleBeforeAppointmentSkipped();
testFutureAppointmentCondition();
testChangeInitiatedBy();
testRecurringConditions();
testWorkflowStatusAllowance();
testPaymentOutstanding();
testWebhookHostLog();
testFollowUpSuppressionConditions();
console.log("All appointment workflow hardening tests passed.");
