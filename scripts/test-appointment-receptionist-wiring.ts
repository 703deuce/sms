/**
 * Unit tests for Appointment Receptionist bugfix wiring (no live agent / Telnyx).
 *
 *   npx tsx scripts/test-appointment-receptionist-wiring.ts
 */
import { normalizeWizardTransferPhone } from "../src/lib/solutions/appointment-receptionist/transfer-utils";
import { resolveWizardRoutingMode } from "../src/lib/solutions/appointment-receptionist/sync-routing";
import { parseNoticeMinutes } from "../src/lib/solutions/appointment-receptionist/notice-utils";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "../src/lib/solutions/appointment-receptionist/capability-checklist";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  applyActionTimezone,
  resolveRingTimeoutSeconds,
  resolveTransferInsightFields,
} from "../src/lib/voice/routing-action-resolve";
import {
  isWithinBusinessHours,
  type MessagingRuntimeSettings,
} from "../src/lib/messaging/messaging-settings";

const failures: string[] = [];
const ok = (label: string) => console.log(`✓ ${label}`);
const fail = (label: string, detail?: string) => {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.error(`✗ ${label}${detail ? `: ${detail}` : ""}`);
};

function assert(label: string, cond: boolean, detail?: string) {
  if (cond) ok(label);
  else fail(label, detail);
}

// --- Transfer phone normalize ---
assert("E.164 already valid", normalizeWizardTransferPhone("+15551234567") === "+15551234567");
assert("10-digit US", normalizeWizardTransferPhone("(555) 123-4567") === "+15551234567");
assert("11-digit leading 1", normalizeWizardTransferPhone("15551234567") === "+15551234567");
assert("rejects short", normalizeWizardTransferPhone("555-1234") === null);
assert("rejects empty", normalizeWizardTransferPhone("  ") === null);

// --- Routing mode: answerWhen wins over ringBehavior ---
assert(
  "after_hours not overridden by ring_team_first",
  resolveWizardRoutingMode({
    answerWhen: "after_hours",
    ringBehavior: "ring_team_first",
  }) === "ai_after_hours",
);
assert(
  "every_call not overridden by ring_team_first",
  resolveWizardRoutingMode({
    answerWhen: "every_call",
    ringBehavior: "ring_team_first",
  }) === "ai_answer",
);
assert(
  "nobody_answers → human_first",
  resolveWizardRoutingMode({
    answerWhen: "nobody_answers",
    ringBehavior: "ai_immediate",
  }) === "human_first",
);
assert(
  "line_busy → overflow",
  resolveWizardRoutingMode({
    answerWhen: "line_busy",
    ringBehavior: "ai_immediate",
  }) === "overflow",
);
assert(
  "custom_schedule",
  resolveWizardRoutingMode({
    answerWhen: "custom_schedule",
    ringBehavior: "ai_immediate",
  }) === "custom_schedule",
);
assert(
  "answerWhen every_call beats ringBehavior line_busy",
  resolveWizardRoutingMode({
    answerWhen: "every_call",
    ringBehavior: "line_busy",
  }) === "ai_answer",
);
assert(
  "line_busy answerWhen → overflow",
  resolveWizardRoutingMode({
    answerWhen: "line_busy",
    ringBehavior: "ai_immediate",
  }) === "overflow",
);

// --- Ring timeout reads wizard ringSeconds ---
assert(
  "timeoutSeconds preferred",
  resolveRingTimeoutSeconds({ timeoutSeconds: 15, ringSeconds: 45 }) === 15,
);
assert(
  "ringSeconds fallback (wizard write path)",
  resolveRingTimeoutSeconds({ ringSeconds: 20 }) === 20,
);
assert("default 30", resolveRingTimeoutSeconds({}) === 30);
assert("clamps high", resolveRingTimeoutSeconds({ ringSeconds: 999 }) === 300);

// --- Timezone on after-hours resolution ---
const baseSettings: MessagingRuntimeSettings = {
  workspaceId: "ws_test",
  timezone: "America/Los_Angeles",
  businessHoursJson: {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "09:00", end: "17:00" },
    sun: { enabled: false, start: "09:00", end: "17:00" },
  },
  quietHoursStart: null,
  quietHoursEnd: null,
  awayEnabled: false,
  awayAlways: false,
  awayMessage: null,
  reviewLinkUrl: null,
  optOutKeywords: null,
  optInKeywords: null,
  helpKeywords: null,
};

const withNy = applyActionTimezone(baseSettings, { timezone: "America/New_York" });
assert("applyActionTimezone overrides LA→NY", withNy.timezone === "America/New_York");
assert(
  "no override keeps LA",
  applyActionTimezone(baseSettings, {}).timezone === "America/Los_Angeles",
);

// Wednesday 14:00 UTC = 10:00 ET / 07:00 PT — in NY hours, outside LA hours
const wed14utc = new Date("2026-07-29T14:00:00.000Z");
assert(
  "NY timezone: within hours at 10am ET",
  isWithinBusinessHours(withNy, wed14utc) === true,
);
assert(
  "LA timezone: outside hours at 7am PT",
  isWithinBusinessHours(baseSettings, wed14utc) === false,
);

// --- min notice parse ---
assert("2 hours → 120", parseNoticeMinutes("2 hours") === 120);
assert("1 day → 1440", parseNoticeMinutes("1 day") === 1440);
assert("30 min → 30", parseNoticeMinutes("30 min") === 30);
assert("bare 45 → 45", parseNoticeMinutes("45") === 45);
assert("empty → 0", parseNoticeMinutes("") === 0);

// --- Transfer insight split ---
{
  const dialOnly = resolveTransferInsightFields({
    text: "Connecting you now",
    transferred: true,
    outcome: "in_progress",
  });
  assert("dial start is attempt not success", dialOnly.transfer_attempted === true);
  assert("dial start is not success", dialOnly.transfer_successful === false);

  const bridged = resolveTransferInsightFields({
    text: "Transfer completed successfully",
    transferred: true,
    outcome: "completed",
  });
  assert("bridged text counts success", bridged.transfer_successful === true);

  const outcomeOk = resolveTransferInsightFields({
    text: "",
    transferred: true,
    outcome: "transferred",
  });
  assert("outcome=transferred is success", outcomeOk.transfer_successful === true);
}

// --- Activation checklist ---
{
  const blank = createDefaultWizardState();
  const blocking = getWizardActivationIssues(blank);
  assert(
    "blank wizard has blocking issues",
    hasBlockingActivationIssues(blocking),
    blocking.map((i) => i.id).join(","),
  );

  const ready = createDefaultWizardState();
  ready.phoneNumberId = "pn_test";
  ready.agentName = "Alex";
  ready.voiceId = "voice_1";
  ready.openingGreeting = "Thanks for calling.";
  ready.businessName = "Acme Dental";
  ready.capabilities = ["answer_questions", "book_appointments", "transfer_calls"];
  ready.transferDestinationPhone = "+15551234567";
  ready.appointmentTypes = ready.appointmentTypes.map((t) => ({ ...t, enabled: true }));
  ready.calendarConnected = true;
  ready.lastTestPassed = true;
  const readyIssues = getWizardActivationIssues(ready, {
    hasCalendarConnection: true,
    hasKnowledgeText: true,
  });
  assert(
    "complete wizard has no blockers",
    !hasBlockingActivationIssues(readyIssues),
    readyIssues.map((i) => `${i.severity}:${i.id}`).join(","),
  );

  const badTransfer = { ...ready, transferDestinationPhone: "123" };
  const xferIssues = getWizardActivationIssues(badTransfer);
  assert(
    "invalid transfer blocks when capability on",
    xferIssues.some((i) => i.id === "transfer" && i.severity === "blocking"),
  );
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length} check(s)`);
  process.exit(1);
}
console.log("OK: appointment receptionist wiring unit tests passed");
process.exit(0);
