import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { assertVoiceV3RuntimeInvariants, VoiceV3InvariantViolation } from "../src/lib/voice-v3/agent/runtime-invariants";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");

function base() {
  const clock = buildVoiceV3CallClock(VOICE_V3_BOOKING_TEST_CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "inv_call",
    liveSessionId: "inv_live",
    timezone: VOICE_V3_BOOKING_TEST_CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function expectViolation(mutate: (ctx: ReturnType<typeof base>) => ReturnType<typeof base>, code: string) {
  try {
    assertVoiceV3RuntimeInvariants(mutate(base()), { throwOnViolation: true });
    assert.fail(`expected ${code}`);
  } catch (e) {
    assert.ok(e instanceof VoiceV3InvariantViolation);
    assert.ok((e as VoiceV3InvariantViolation).code.includes(code) || e.message.includes(code));
  }
}

function main() {
  expectViolation(
    (ctx) => ({
      ...ctx,
      booking: { ...ctx.booking, phase: "BOOKING_CONFIRMED", confirmed: null },
    }),
    "BOOKING_CONFIRMED_WITHOUT_CONFIRMED_RECORD",
  );

  expectViolation(
    (ctx) => ({
      ...ctx,
      selection: {
        selected: {
          slotId: "s1",
          offerSetId: "wrong",
          localStart: "2026-09-25T17:00:00",
          timezone: "America/New_York",
          schedulingGeneration: 1,
        },
        lastResolutionStatus: null,
      },
      availability: {
        ...ctx.availability,
        status: "ready",
        activeOfferSet: {
          offerSetId: "right",
          schedulingGeneration: 1,
          timezone: "America/New_York",
          slots: [],
        },
      },
    }),
    "SELECTED_SLOT_OFFER_SET_MISMATCH",
  );

  console.log("VOICE_V3_AGENT_INVARIANTS_PASS");
}

main();
