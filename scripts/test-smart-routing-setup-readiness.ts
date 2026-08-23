/**
 * Run: npx tsx scripts/test-smart-routing-setup-readiness.ts
 */
import assert from "node:assert/strict";
import { computeSetupReadiness } from "../src/lib/smart-routing/setup-readiness";

const base = computeSetupReadiness({
  settings: {
    id: "1",
    workspaceId: "w",
    publicBusinessE164: "+17035551000",
    routingNumberE164: "+17035559000",
    assignedPhoneNumberId: "pn1",
    routingMode: "front_door",
    callerIdStatus: "verified",
    callerIdProvider: "telnyx",
    callerIdProviderRef: null,
    callerIdMethod: "sms",
    callerIdVerifiedAt: new Date(),
    callerIdFailedReason: null,
    callerIdRequestedAt: null,
    outboundEnabled: true,
    scheduleOverrideJson: null,
    setupCompletedAt: null,
  },
  callerIdStatus: "verified",
  flows: [{ id: "f1", status: "active", scheduleJson: { windows: [] } }],
  destinations: [{ active: true }],
  authorizedCallers: [{ active: true, outboundEnabled: true }],
  forwardingDetected: true,
  inboundTestDetected: true,
  outboundTestDetected: false,
  scheduleBranch: "open",
});

assert.equal(base.ready, true);
assert.equal(base.routingStatus, "live");
assert.equal(base.steps.find((s) => s.key === "caller_id_verified")?.complete, true);

const closed = computeSetupReadiness({
  settings: null,
  callerIdStatus: "not_verified",
  flows: [],
  destinations: [],
  authorizedCallers: [],
  forwardingDetected: false,
  inboundTestDetected: false,
  outboundTestDetected: false,
  scheduleBranch: "temporary_closure",
});

assert.equal(closed.routingStatus, "temporary_closure");
assert.equal(closed.ready, false);

console.log("test-smart-routing-setup-readiness: ok");
