#!/usr/bin/env npx tsx
/**
 * Shared call facts survive operation switches (booking ↔ callback ↔ SEND_LINK).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { mergeIntakeUpdate, deriveIntakeObjective } from "../src/lib/voice-v3/intake-objective";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { getMissingCallbackRequirementKeys } from "../src/lib/voice-v3/callback/callback-requirements";

const TZ = "America/New_York";

const config = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
  },
  intakeFields: [
    ...VOICE_V3_BOOKING_TEST_CONFIG.intakeFields,
    {
      key: "service_reason",
      label: "Reason",
      type: "text" as const,
      required: false,
      description: "Service reason.",
    },
    {
      key: "mother_s_name",
      label: "Mother's name",
      type: "text" as const,
      required: true,
      description: "Booking-only field.",
    },
  ],
  operationRequirements: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.operationRequirements,
    book_appointment: ["name", "email", "phone", "mother_s_name"],
    request_callback: ["name", "phone", "service_reason"],
  },
};

const clock = buildVoiceV3CallClock(TZ);

function ctxWithIntake(
  callId: string,
  update: Record<string, string>,
  dialogGoal: "BOOK_APPOINTMENT" | "REQUEST_CALLBACK" = "BOOK_APPOINTMENT",
) {
  let ctx = createInitialVoiceV3CallContext({
    callId,
    liveSessionId: `live_${callId}`,
    timezone: TZ,
    clock,
    inboundCallerE164: "+15715550100",
  });
  const merged = mergeIntakeUpdate({
    current: ctx.intake.values,
    update,
    config,
    at: new Date(),
    sourceCallId: callId,
    sourceDelegationId: null,
  });
  ctx = {
    ...ctx,
    intake: { values: merged.values },
    dialog: { activeGoal: dialogGoal },
  };
  return ctx;
}

// A. booking → callback, all callback facts already known
{
  const ctx = ctxWithIntake(
    "transition_a",
    {
      name: "Anthony",
      email: "anthony@example.com",
      service_reason: "Water heater is broken",
      mother_s_name: "Mary",
    },
    "REQUEST_CALLBACK",
  );
  assert.deepEqual(getMissingFieldsForOperation("request_callback", config, ctx), []);
  const objective = deriveIntakeObjective(config, ctx);
  assert.deepEqual(objective.missingRequiredFields, []);
  assert.equal(objective.status, "COMPLETE");
  assert.ok(!objective.requiredFields.includes("email"));
  assert.ok(!objective.requiredFields.includes("mother_s_name"));
}

// B. booking → callback, name + ANI known but reason missing
{
  const ctx = ctxWithIntake(
    "transition_b",
    { name: "Anthony", email: "a@example.com", mother_s_name: "Mary" },
    "REQUEST_CALLBACK",
  );
  assert.deepEqual(getMissingFieldsForOperation("request_callback", config, ctx), ["service_reason"]);
}

// C. SEND_LINK → callback with callback facts already known
{
  const sendLinkConfig = {
    ...config,
    scheduling: { ...config.scheduling, bookingStrategy: "SEND_LINK" as const },
    bookingStrategyDetail: {
      ...config.bookingStrategyDetail,
      bookingLinkUrl: "https://book.example.com/x",
    },
  };
  let ctx = createInitialVoiceV3CallContext({
    callId: "transition_c",
    liveSessionId: "live_transition_c",
    timezone: TZ,
    clock,
    inboundCallerE164: "+15715550100",
  });
  const merged = mergeIntakeUpdate({
    current: {},
    update: {
      name: "Sam",
      service_reason: "Leak",
      email: "sam@example.com",
      mother_s_name: "Jo",
    },
    config: sendLinkConfig,
    at: new Date(),
    sourceCallId: ctx.callId,
    sourceDelegationId: null,
  });
  ctx = {
    ...ctx,
    intake: { values: merged.values },
    dialog: { activeGoal: "REQUEST_CALLBACK" },
  };
  assert.deepEqual(getMissingFieldsForOperation("request_callback", sendLinkConfig, ctx), []);
}

// D. callback → booking preserves facts, adds booking requirements
{
  const ctx = ctxWithIntake(
    "transition_d",
    { name: "Brianna", service_reason: "Leak under sink", email: "brianna@example.com" },
    "BOOK_APPOINTMENT",
  );
  assert.deepEqual(getMissingFieldsForOperation("request_callback", config, ctx), []);
  assert.deepEqual(getMissingFieldsForOperation("book_appointment", config, ctx).sort(), [
    "mother_s_name",
    "phone",
  ]);
}

// E. custom collect field shared by both operations — collect once
{
  const sharedConfig = {
    ...config,
    operationRequirements: {
      ...config.operationRequirements,
      book_appointment: ["name", "email", "phone", "service_reason"],
      request_callback: ["name", "phone", "service_reason"],
    },
  };
  const ctx = ctxWithIntake(
    "transition_e",
    { name: "Chris", service_reason: "AC repair", email: "c@example.com" },
    "REQUEST_CALLBACK",
  );
  assert.deepEqual(getMissingFieldsForOperation("request_callback", sharedConfig, ctx), []);
  const bookCtx = { ...ctx, dialog: { activeGoal: "BOOK_APPOINTMENT" as const } };
  assert.deepEqual(
    getMissingFieldsForOperation("book_appointment", sharedConfig, bookCtx).sort(),
    ["mother_s_name", "phone"].sort(),
  );
}

// F. field required only by original operation — not required after switch
{
  const ctx = ctxWithIntake(
    "transition_f",
    {
      name: "Dana",
      email: "dana@example.com",
      mother_s_name: "Pat",
      service_reason: "No heat",
    },
    "REQUEST_CALLBACK",
  );
  const objective = deriveIntakeObjective(config, ctx);
  assert.ok(!objective.missingRequiredFields.includes("email"));
  assert.ok(!objective.missingRequiredFields.includes("mother_s_name"));
}

// Legacy PSTN scenario: abandon Microsoft booking → callback
let ctx = createInitialVoiceV3CallContext({
  callId: "call_transition",
  liveSessionId: "live_transition",
  timezone: TZ,
  clock,
  inboundCallerE164: "+15715550100",
});
const merged = mergeIntakeUpdate({
  current: ctx.intake.values,
  update: {
    name: "Anthony",
    email: "anthony@example.com",
    service_reason: "Water heater is broken",
  },
  config,
  at: new Date(),
  sourceCallId: ctx.callId,
  sourceDelegationId: null,
});
ctx = { ...ctx, intake: { values: merged.values }, dialog: { activeGoal: "REQUEST_CALLBACK" } };

const missingCallback = getMissingFieldsForOperation("request_callback", config, ctx);
assert.deepEqual(
  missingCallback,
  [],
  "abandon Microsoft booking → callback: name, service_reason, phone(ANI) — no re-collection",
);

let missingBook = getMissingFieldsForOperation("book_appointment", config, ctx);
assert.deepEqual(missingBook.sort(), ["mother_s_name", "phone"].sort());

const withPhone = mergeIntakeUpdate({
  current: ctx.intake.values,
  update: { phone: "+15715550100" },
  config,
  at: new Date(),
  sourceCallId: ctx.callId,
  sourceDelegationId: null,
});
ctx = { ...ctx, intake: { values: withPhone.values } };
missingBook = getMissingFieldsForOperation("book_appointment", config, ctx);
assert.deepEqual(missingBook, ["mother_s_name"]);
assert.deepEqual(getMissingFieldsForOperation("request_callback", config, ctx), []);

// G. legacy alias key full_name satisfies callback name requirement
{
  let ctx = createInitialVoiceV3CallContext({
    callId: "transition_g",
    liveSessionId: "live_transition_g",
    timezone: TZ,
    clock,
    inboundCallerE164: "+15715550100",
  });
  const at = new Date().toISOString();
  ctx = {
    ...ctx,
    intake: {
      values: {
        full_name: {
          value: "Legacy Name",
          source: "caller",
          confidence: 1,
          updatedAt: at,
        },
        service_reason: {
          value: "Callback please",
          source: "caller",
          confidence: 1,
          updatedAt: at,
        },
      },
    },
    dialog: { activeGoal: "REQUEST_CALLBACK" },
  };
  assert.deepEqual(getMissingCallbackRequirementKeys(config, ctx), []);
}

console.log("PASS voice-v3 callback shared-facts transitions");
