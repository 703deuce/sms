import assert from "node:assert/strict";
import { sortCampaignQueueMembers } from "../lib/server/phone/power-dialer/queue-order";
import { retryDelayMinutesForAttempt } from "../lib/server/phone/power-dialer/campaign-advanced";
import { areaCodeAllowed } from "../lib/server/phone/power-dialer/dial-policy";
import { isCallingWindowOpen, resolveLegalHours } from "../lib/server/phone/power-dialer/timezone-window";
import { evaluateContactEligibility } from "../lib/server/phone/power-dialer/eligibility";

function baseRules() {
  return {
    ringTimeoutSeconds: 30,
    retryIntervalMinutes: 60,
    dailyAttemptCap: 5,
    totalAttemptCap: 3,
    postCallIntervalSeconds: 5,
    requireDispositionBeforeNext: true,
    allowedDays: [1, 2, 3, 4, 5],
    callingHoursStart: "09:00",
    callingHoursEnd: "17:00",
    phoneFieldPriority: ["mobile", "phone"],
    dialingMode: "power" as const,
    timezone: "America/Chicago",
    status: "active",
  };
}

async function main() {
  const fifo = sortCampaignQueueMembers(
    [
      { contactId: "a", createdAt: new Date("2020-01-01"), dialPriority: 0 },
      { contactId: "b", createdAt: new Date("2021-01-01"), dialPriority: 0 },
    ],
    { dialOrder: "fifo" },
  );
  assert.equal(fifo[0].contactId, "a");

  const priority = sortCampaignQueueMembers(
    [
      { contactId: "a", createdAt: new Date("2020-01-01"), dialPriority: 1 },
      { contactId: "b", createdAt: new Date("2021-01-01"), dialPriority: 9 },
    ],
    { dialOrder: "priority" },
  );
  assert.equal(priority[0].contactId, "b");

  assert.equal(retryDelayMinutesForAttempt({ retryScheduleMinutes: [10, 20, 30] }, 60, 1), 20);

  const ac = areaCodeAllowed(
    "+13125551212",
    [],
    ["312"],
    { minMinutesBetweenCallsToPhone: 0, maxCallsToPhonePerDay: 0, allowedAreaCodes: [], blockedAreaCodes: [] },
  );
  assert.equal(ac.ok, false);

  const legal = resolveLegalHours("us_ftc_consumer", "09:00", "17:00");
  assert.equal(legal.startHm, "08:00");

  const sunday = new Date("2026-10-25T15:00:00.000Z");
  const window = isCallingWindowOpen(sunday, "America/Chicago", [1, 2, 3, 4, 5], "09:00", "17:00", []);
  assert.equal(window.open, false);

  const retry = evaluateContactEligibility({
    contact: {
      id: "c1",
      phone: "+13125559999",
      status: "SUBSCRIBED",
      timezone: "America/Chicago",
      customFields: {},
    },
    rules: baseRules(),
    campaignAttemptsForContact: [
      {
        contactId: "c1",
        status: "completed",
        disposition: null,
        attemptNumber: 1,
        createdAt: new Date(Date.now() - 3600_000),
        endedAt: new Date(Date.now() - 1800_000),
      },
    ],
    sessionAttemptsForContact: [],
    now: new Date(),
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
    advanced: { retryScheduleMinutes: [120] },
  });
  assert.equal(retry.eligible, false);
  assert.equal(retry.reason, "retry_delay_active");

  console.log("test-power-dialer-batch3: PASS");
}

void main();
