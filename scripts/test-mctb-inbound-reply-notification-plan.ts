#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { planInboundReplyNotificationEvent } from "../src/lib/mctb/handoff/inbound-reply-notification-plan";

assert.deepEqual(
  planInboundReplyNotificationEvent({ callbackRequested: false, urgent: false }),
  { eventType: "caller_replied", urgent: false },
);
assert.deepEqual(
  planInboundReplyNotificationEvent({ callbackRequested: false, urgent: true }),
  { eventType: "urgent_detected", urgent: true },
);
assert.deepEqual(
  planInboundReplyNotificationEvent({ callbackRequested: true, urgent: true }),
  { eventType: "callback_requested", urgent: true },
);

import { readFileSync } from "node:fs";
const sideEffects = readFileSync("src/lib/mctb/handoff/lead-recovery-inbound-side-effects.ts", "utf8");
assert.ok(sideEffects.includes("processMctbInboundReplyHandoff"));

console.log("test-mctb-inbound-reply-notification-plan: ok");
