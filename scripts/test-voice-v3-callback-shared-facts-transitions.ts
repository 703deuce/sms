#!/usr/bin/env npx tsx
/**
 * Shared call facts survive operation switches (booking ↔ callback).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { mergeIntakeUpdate } from "../src/lib/voice-v3/intake-objective";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";

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
  ],
  operationRequirements: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.operationRequirements,
    book_appointment: ["name", "email", "phone"],
    request_callback: ["name", "phone", "service_reason"],
  },
};

const clock = buildVoiceV3CallClock(TZ);
let ctx = createInitialVoiceV3CallContext({
  callId: "call_transition",
  liveSessionId: "live_transition",
  timezone: TZ,
  clock,
  inboundCallerE164: "+15715550100",
});

// Simulate Microsoft booking intake while pursuing book_appointment
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
ctx = { ...ctx, intake: { values: merged.values } };

const missingCallback = getMissingFieldsForOperation("request_callback", config, ctx);
assert.deepEqual(
  missingCallback,
  [],
  "callback must reuse facts collected during booking — ANI satisfies callback phone",
);

// Booking still requires explicit phone capture; callback does not re-ask.
let missingBook = getMissingFieldsForOperation("book_appointment", config, ctx);
assert.deepEqual(missingBook, ["phone"]);

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
assert.deepEqual(missingBook, []);
assert.deepEqual(getMissingFieldsForOperation("request_callback", config, ctx), []);

// Inverse: facts first collected on callback path remain for booking
const config2 = { ...config };
let ctx2 = createInitialVoiceV3CallContext({
  callId: "call_transition_2",
  liveSessionId: "live_transition_2",
  timezone: TZ,
  clock,
  inboundCallerE164: "+15715550100",
});
const merged2 = mergeIntakeUpdate({
  current: {},
  update: {
    name: "Brianna",
    email: "brianna@example.com",
    service_reason: "Leak under sink",
  },
  config: config2,
  at: new Date(),
  sourceCallId: ctx2.callId,
  sourceDelegationId: null,
});
ctx2 = { ...ctx2, intake: { values: merged2.values } };

assert.deepEqual(getMissingFieldsForOperation("request_callback", config2, ctx2), []);
assert.deepEqual(getMissingFieldsForOperation("book_appointment", config2, ctx2), ["phone"]);

const withPhone2 = mergeIntakeUpdate({
  current: ctx2.intake.values,
  update: { phone: "+15715550100" },
  config: config2,
  at: new Date(),
  sourceCallId: ctx2.callId,
  sourceDelegationId: null,
});
ctx2 = { ...ctx2, intake: { values: withPhone2.values } };
assert.deepEqual(getMissingFieldsForOperation("book_appointment", config2, ctx2), []);
assert.deepEqual(getMissingFieldsForOperation("request_callback", config2, ctx2), []);

console.log("PASS voice-v3 callback shared-facts transitions");
