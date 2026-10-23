import assert from "node:assert/strict";
import { mergePowerDialerRecordingPolicy } from "../lib/server/phone/power-dialer/recording-policy";

const ws = {
  recordingEnabled: true,
  recordingConsentAnnounce: true,
  recordingRetentionDays: 90,
} as const;

const campaignOff = mergePowerDialerRecordingPolicy({
  campaignRecordingEnabled: false,
  workspace: ws,
  isPowerDialerCall: true,
  phoneGlobalRecordCalls: true,
});
assert.equal(campaignOff.record, false);
assert.equal(campaignOff.policySource, "campaign");

const wsOnly = mergePowerDialerRecordingPolicy({
  campaignRecordingEnabled: undefined,
  workspace: { ...ws, recordingEnabled: false },
  isPowerDialerCall: true,
  phoneGlobalRecordCalls: true,
});
assert.equal(wsOnly.record, false);
assert.equal(wsOnly.policySource, "workspace");
assert.equal(wsOnly.consentAnnounce, true);

const nonPd = mergePowerDialerRecordingPolicy({
  campaignRecordingEnabled: true,
  workspace: ws,
  isPowerDialerCall: false,
  phoneGlobalRecordCalls: false,
});
assert.equal(nonPd.record, false);
assert.equal(nonPd.policySource, "phone_global_fallback");

console.log("test-power-dialer-recording-policy: PASS");
