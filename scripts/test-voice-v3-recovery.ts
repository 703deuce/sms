import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { evaluateVoiceV3Recovery } from "../src/lib/voice-v3/recovery/evaluate-recovery";
import { syncVoiceV3RecoveryOnContext } from "../src/lib/voice-v3/recovery/sync-recovery";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;
const NOW = new Date("2026-09-17T15:00:00.000Z");

function baseCtx() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "call_rec",
    liveSessionId: "live_rec",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function main() {
  let ctx = baseCtx();
  ctx = {
    ...ctx,
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    intake: {
      values: {
        email: { value: "a@example.com", source: "caller", updatedAt: NOW.toISOString() },
      },
    },
    selection: {
      selected: {
        slotId: "slot_1",
        offerSetId: "offer_test",
        schedulingGeneration: 1,
        localStart: "2026-09-19T14:00:00",
        localEnd: "2026-09-19T15:00:00",
        utcStart: "2026-09-19T18:00:00.000Z",
        utcEnd: "2026-09-19T19:00:00.000Z",
        selectedAt: NOW.toISOString(),
      },
      lastResolutionStatus: "RESOLVED",
    },
    availability: {
      ...ctx.availability,
      status: "ready",
      activeOfferSet: {
        offerSetId: "offer_test",
        schedulingGeneration: 1,
        timezone: CONFIG.timezone,
        createdAt: NOW.toISOString(),
        slots: [],
      },
    },
    scheduling: { generation: 1, normalized: { precision: "DAYPART", timezone: CONFIG.timezone, localDate: "2026-09-19", localStartDateTime: null, localEndDateTime: null, utcStart: null, utcEnd: null, sourceDateExpression: null, sourceTimeExpression: null } },
  };

  const rules = evaluateVoiceV3Rules(ctx, CONFIG);
  assert.equal(rules.bookingReady, false);
  assert.ok(rules.missingRequiredFields.includes("name"));

  const recovery = evaluateVoiceV3Recovery({ ctx, rules, config: CONFIG, now: NOW });
  assert.equal(recovery?.code, "REQUIRED_FIELD_MISSING");
  assert.equal(recovery?.missingFieldKey, "name");
  assert.equal(recovery?.userRecoverable, true);

  const synced = syncVoiceV3RecoveryOnContext({ ctx, rules, config: CONFIG, now: NOW });
  assert.equal(synced.outcome, "created");
  assert.equal(synced.ctx.recovery.active?.code, "REQUIRED_FIELD_MISSING");

  const resolvedCtx = {
    ...synced.ctx,
    intake: {
      values: {
        ...synced.ctx.intake.values,
        name: { value: "Anthony", source: "caller", updatedAt: NOW.toISOString() },
        phone: { value: "+15551234567", source: "caller", updatedAt: NOW.toISOString() },
      },
    },
  };
  const rules2 = evaluateVoiceV3Rules(resolvedCtx, CONFIG);
  const synced2 = syncVoiceV3RecoveryOnContext({
    ctx: resolvedCtx,
    rules: rules2,
    config: CONFIG,
    now: NOW,
  });
  assert.equal(synced2.outcome, "resolved");
  assert.equal(synced2.ctx.recovery.active, null);

  const timedOut = {
    ...baseCtx(),
    availability: {
      ...baseCtx().availability,
      status: "pending",
      findStartedAt: new Date(NOW.getTime() - 60_000).toISOString(),
    },
  };
  const timeoutRecovery = evaluateVoiceV3Recovery({
    ctx: timedOut,
    rules: evaluateVoiceV3Rules(timedOut, CONFIG),
    config: CONFIG,
    now: NOW,
  });
  assert.equal(timeoutRecovery?.code, "ASYNC_ACTION_TIMED_OUT");

  console.log("PASS voice-v3 recovery");
}

main();
