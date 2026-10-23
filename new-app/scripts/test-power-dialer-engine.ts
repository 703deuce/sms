/**
 * Power Dialer Phase 2 — VM-safe engine tests (no DB, no live Telnyx).
 */
import assert from "node:assert/strict";
import { evaluateContactEligibility, dispositionIsTerminal } from "../lib/server/phone/power-dialer/eligibility";
import { isHumanConversation } from "../lib/server/phone/power-dialer/disposition-effects";
import { isCallingWindowOpen } from "../lib/server/phone/power-dialer/timezone-window";
import { parseCampaignConfigPatch } from "../lib/server/phone/power-dialer/campaign-config";
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

function testEligibility() {
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

  const dispositionGate = evaluateContactEligibility({
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
  assert.equal(dispositionGate.reason, "disposition_required");

  const live = evaluateContactEligibility({
    contact,
    rules: baseRules,
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: true,
    repAuthorized: true,
  });
  assert.equal(live.reason, "live_attempt_in_progress");
}

function testTimezoneWindow() {
  const fridayChicago = new Date("2026-10-23T15:00:00.000Z");
  const open = isCallingWindowOpen(
    fridayChicago,
    "America/Chicago",
    [1, 2, 3, 4, 5],
    "09:00",
    "17:00",
  );
  assert.equal(open.open, true);

  const late = new Date("2026-10-24T03:00:00.000Z");
  const closed = isCallingWindowOpen(late, "America/Chicago", [1, 2, 3, 4, 5], "09:00", "17:00");
  assert.equal(closed.open, false);

  const eligibleAfterWindow = evaluateContactEligibility({
    contact,
    rules: baseRules,
    campaignAttemptsForContact: [],
    sessionAttemptsForContact: [],
    now: late,
    sessionActive: true,
    sessionPaused: false,
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  assert.equal(eligibleAfterWindow.reason, "calling_window_closed");
}

function testHumanConversationMetrics() {
  assert.equal(isHumanConversation("Booked", "uncertain"), true);
  assert.equal(isHumanConversation("Voicemail", "voicemail"), false);
  assert.equal(isHumanConversation(null, "human"), true);
  assert.equal(isHumanConversation("No answer", "no_answer"), false);
}

function testCampaignConfigPatch() {
  const parsed = parseCampaignConfigPatch({
    ringTimeoutSeconds: 45,
    retryDelayMinutes: 90,
    dialingMode: "preview",
    phoneFieldPriority: ["mobile", "phone"],
  });
  assert.equal(parsed.ringTimeoutSeconds, 45);
  assert.equal(parsed.retryIntervalMinutes, 90);
  assert.equal(parsed.dialingMode, "preview");
  assert.deepEqual(parsed.phoneFieldPriority, ["mobile", "phone"]);
}

function testTerminalDisposition() {
  assert.equal(dispositionIsTerminal("Do not call"), true);
  assert.equal(dispositionIsTerminal("Callback"), false);
}

function run() {
  testEligibility();
  testTimezoneWindow();
  testHumanConversationMetrics();
  testCampaignConfigPatch();
  testTerminalDisposition();
  console.log("test-power-dialer-engine: PASS");
}

run();
