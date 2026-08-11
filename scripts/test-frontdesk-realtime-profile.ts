/**
 * Unit tests for frontdesk realtime profile helpers.
 * Run: npx tsx scripts/test-frontdesk-realtime-profile.ts
 */
import assert from "node:assert/strict";
import {
  FRONTDESK_PROFILE,
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
  isFrontDeskRealtimeProfile,
  isFrontDeskStackProfile,
  usesFrontDeskRealtimeVoicePipeline,
} from "../src/lib/voice/frontdesk/agent-config";
import { isFrontDeskRealtimeTestEnabled } from "../src/lib/voice/frontdesk/frontdesk-boot";
import { isInboundRealtimeEnabled } from "../src/lib/voice/inbound-realtime";

const stackConfig = { advanced: { livekitProfile: FRONTDESK_PROFILE } } as const;
const realtimeConfig = {
  advanced: {
    livekitProfile: FRONTDESK_REALTIME_PROFILE,
    realtimeModel: "gpt-realtime-2.1",
    realtimeVoice: "marin",
  },
} as const;

assert.ok(isFrontDeskStackProfile(stackConfig));
assert.ok(!isFrontDeskStackProfile(realtimeConfig));
assert.ok(isFrontDeskRealtimeProfile(realtimeConfig));
assert.ok(!isFrontDeskRealtimeProfile(stackConfig));
assert.ok(isFrontDeskProfile(stackConfig.advanced));
assert.ok(isFrontDeskProfile(realtimeConfig.advanced));
assert.ok(usesFrontDeskRealtimeVoicePipeline(realtimeConfig));
assert.ok(!usesFrontDeskRealtimeVoicePipeline(stackConfig));

const prev = process.env.FRONTDESK_REALTIME_TEST;
process.env.FRONTDESK_REALTIME_TEST = "1";
assert.equal(isFrontDeskRealtimeTestEnabled(), true);
process.env.FRONTDESK_REALTIME_TEST = "0";
assert.equal(isFrontDeskRealtimeTestEnabled(), false);
assert.equal(isInboundRealtimeEnabled(), false);
process.env.FRONTDESK_REALTIME_TEST = prev;
if (prev == null) delete process.env.FRONTDESK_REALTIME_TEST;

process.env.INBOUND_REALTIME_TEST = "1";
assert.equal(isInboundRealtimeEnabled(), false);
delete process.env.INBOUND_REALTIME_TEST;
assert.equal(isInboundRealtimeEnabled(), false);

// FRONTDESK_REALTIME_TEST must NOT enable Amy realtime (inbound is frontdesk-only)
process.env.FRONTDESK_REALTIME_TEST = "1";
assert.equal(isInboundRealtimeEnabled(), false);
process.env.FRONTDESK_REALTIME_TEST = prev;
if (prev == null) delete process.env.FRONTDESK_REALTIME_TEST;

console.log("frontdesk realtime profile tests: PASS");
