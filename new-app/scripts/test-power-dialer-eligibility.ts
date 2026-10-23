import assert from "node:assert/strict";
import { evaluateContactEligibility } from "../lib/server/phone/power-dialer/eligibility";
import type { PowerDialerCampaignRules } from "../lib/server/phone/power-dialer/types";

const baseRules: PowerDialerCampaignRules = {
  ringTimeoutSeconds: 30,
  retryIntervalMinutes: 60,
  dailyAttemptCap: 3,
  totalAttemptCap: 3,
  postCallIntervalSeconds: 5,
  requireDispositionBeforeNext: true,
  allowedDays: [1, 2, 3, 4, 5],
  callingHoursStart: "09:00",
  callingHoursEnd: "17:00",
  phoneFieldPriority: ["phone"],
  dialingMode: "power",
  timezone: "America/Chicago",
  status: "active",
};

const contact = {
  id: "c1",
  phone: "+15551234567",
  status: "SUBSCRIBED",
  timezone: "America/Chicago",
  customFields: null,
};

function run() {
  const now = new Date("2026-10-23T14:30:00.000Z");
  const ok = evaluateContactEligibility({
    contact,
    rules: baseRules,
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  assert.equal(ok.eligible, true);
  assert.equal(ok.reason, "eligible");

  const blocked = evaluateContactEligibility({
    contact: { ...contact, status: "BLOCKED" },
    rules: baseRules,
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  assert.equal(blocked.reason, "contact_blocked");

  const retryAt = new Date("2026-10-23T16:00:00.000Z");
  const deferred = evaluateContactEligibility({
    contact,
    rules: baseRules,
    campaignAttemptsForContact: [
      {
        contactId: "c1",
        status: "completed",
        disposition: "No answer",
        attemptNumber: 1,
        createdAt: new Date("2026-10-23T14:00:00.000Z"),
        endedAt: new Date("2026-10-23T14:05:00.000Z"),
      },
    ],
    sessionAttemptsForContact: [],
    now,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  assert.equal(deferred.reason, "retry_delay_active");
  assert.ok(deferred.retryEligibleAt);

  const dispBlock = evaluateContactEligibility({
    contact,
    rules: baseRules,
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: true,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  assert.equal(dispBlock.reason, "disposition_required");

  console.log("test-power-dialer-eligibility: PASS");
}

run();
