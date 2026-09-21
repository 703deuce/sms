#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { invalidateBookingStateForGoalAbandon } from "../src/lib/voice-v3/agent/goal-invalidation.ts";
import type { VoiceV3CallContext } from "../src/lib/voice-v3/state/call-context.ts";

const ctx = {
  scheduling: { generation: 3, preference: null },
  availability: {
    status: "ready",
    activeOfferSet: { offerSetId: "x", schedulingGeneration: 3, timezone: "UTC", slots: [], createdAt: "" },
    lastFailure: null,
    inFlightGeneration: 2,
    lastDispatchedRequestKey: "k",
    findStartedAt: null,
  },
  booking: { phase: "SLOT_SELECTED", activeAttempt: { bookingAttemptId: "a" } as never, confirmed: null, lastFailure: null, postBookChangeRequested: false, verbalConfirmation: "NOT_REQUIRED" },
  presentation: { current: null },
  selection: { selected: null, lastResolutionStatus: null },
  intake: { values: {}, objective: "book" },
  runtime: { version: 1 },
} as VoiceV3CallContext;

const next = invalidateBookingStateForGoalAbandon(ctx);
assert.equal(next.scheduling.generation, 4);
assert.equal(next.availability.status, "idle");
assert.equal(next.availability.activeOfferSet, null);

console.log("test-voice-v3-objective-pivot-safety: PASS");
