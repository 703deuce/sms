import assert from "node:assert/strict";
import { amdResultSupportsAutoDrop } from "../lib/server/phone/power-dialer/beep-auto-drop";
import { inferTimezoneFromAreaCode } from "../lib/server/phone/power-dialer/timezone-infer";
import { mapTelnyxAmdResult } from "../lib/server/phone/power-dialer/answer-detection";
import { computeAcwDeadline } from "../lib/server/phone/power-dialer/acw-enforcement";
import { evaluateContactEligibility } from "../lib/server/phone/power-dialer/eligibility";
import type { PowerDialerCampaignRules } from "../lib/server/phone/power-dialer/types";

function rules(): PowerDialerCampaignRules {
  return {
    status: "active",
    dialingMode: "power",
    timezone: "America/Chicago",
    dailyAttemptCap: 3,
    totalAttemptCap: 5,
    retryIntervalMinutes: 60,
    ringTimeoutSeconds: 30,
    postCallIntervalSeconds: 5,
    requireDispositionBeforeNext: true,
    phoneFieldPriority: ["phone"],
    allowedDays: [0, 1, 2, 3, 4, 5, 6],
    callingHoursStart: "00:00",
    callingHoursEnd: "23:59",
  };
}

assert.equal(amdResultSupportsAutoDrop("machine_end_beep"), true);
assert.equal(amdResultSupportsAutoDrop("human"), false);
assert.equal(mapTelnyxAmdResult("machine_end_beep"), "voicemail");
assert.equal(inferTimezoneFromAreaCode("+13125550100"), "America/Chicago");
const deadline = computeAcwDeadline(30);
assert.ok(deadline && deadline.getTime() > Date.now());

const ownerBlock = evaluateContactEligibility({
  contact: {
    id: "c1",
    phone: "+15551234567",
    status: "SUBSCRIBED",
    timezone: "America/Chicago",
    customFields: {},
    ownerUserId: "rep-a",
  },
  rules: rules(),
  campaignAttemptsForContact: [],
  sessionAttemptsForContact: [],
  now: new Date(),
  sessionActive: true,
  sessionPaused: false,
  hasOpenDispositionBlock: false,
  anyLiveAttemptInSession: false,
  repAuthorized: true,
  sessionRepUserId: "rep-b",
  leadOwnerRouting: "assigned_only",
});
assert.equal(ownerBlock.eligible, false);
assert.equal(ownerBlock.reason, "lead_owner_mismatch");

console.log("test-power-dialer-b1-carryovers: PASS");
