#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  isVoiceV3CallBillable,
  voiceV3BillableCallUsageIdentity,
} from "../src/lib/voice-v3/billing/is-voice-v3-call-billable.ts";

assert.equal(
  isVoiceV3CallBillable({
    isTest: true,
    status: "COMPLETED",
    answeredAt: new Date(),
    metadata: { voiceV3Product: "voice_v3" },
  }),
  false,
);

assert.equal(
  isVoiceV3CallBillable({
    isTest: false,
    status: "COMPLETED",
    answeredAt: new Date(),
    metadata: { voiceV3Product: "voice_v3" },
  }),
  true,
);

assert.equal(
  isVoiceV3CallBillable({
    isTest: false,
    status: "COMPLETED",
    answeredAt: new Date(),
    metadata: { voiceV3PreCallReject: "blocklist" },
  }),
  false,
);

assert.equal(voiceV3BillableCallUsageIdentity("vc_abc"), "voice_v3_call:vc_abc");
assert.equal(
  voiceV3BillableCallUsageIdentity("vc_abc"),
  voiceV3BillableCallUsageIdentity("vc_abc"),
);

console.log("test-voice-v3-call-billing: PASS");
