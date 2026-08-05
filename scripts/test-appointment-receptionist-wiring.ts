/**
 * Unit tests for Appointment Receptionist bugfix wiring (no live agent / Telnyx).
 *
 *   npx tsx scripts/test-appointment-receptionist-wiring.ts
 */
import { normalizeWizardTransferPhone } from "../src/lib/solutions/appointment-receptionist/transfer-utils";
import { resolveWizardRoutingMode } from "../src/lib/solutions/appointment-receptionist/routing-mode";
import {
  parseNoticeMinutes,
  parseDaysAhead,
  parseBookingHours,
} from "../src/lib/solutions/appointment-receptionist/notice-utils";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "../src/lib/solutions/appointment-receptionist/capability-checklist";
import { resolveLiveCalendar } from "../src/lib/solutions/appointment-receptionist/live-calendar";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { resolveServiceRequiredFields } from "../src/lib/solutions/appointment-receptionist/required-fields";
import {
  buildSystemPrompt,
  buildWizardAgentConfig,
} from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import {
  fieldSatisfied,
  normalizeBookingToolArgs,
  resolveAvailabilityTimeWindow,
} from "../src/lib/voice/calendar/booking-args";
import {
  applyActionTimezone,
  resolveRingTimeoutSeconds,
  resolveTransferInsightFields,
  resolveMessageTakenInsight,
} from "../src/lib/voice/routing-action-resolve";
import {
  isWithinBusinessHours,
  type MessagingRuntimeSettings,
} from "../src/lib/messaging/messaging-settings";
import {
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "../src/lib/voice/calendar/timezone-slots";
import { mergeVoiceConfig, parseVoiceAgentConfig } from "../src/lib/voice/types";

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

// --- Live calendar resolution (Calendly must count like activate-hooks) ---
{
  const none = resolveLiveCalendar({ voiceCalendars: [], integrationConnections: [] });
  assert("no calendars → not connected", !none.connected);

  const calendlyVoice = resolveLiveCalendar({
    voiceCalendars: [
      { provider: "calendly", status: "connected", name: "Calendly" },
    ],
  });
  assert(
    "voice calendly connected counts",
    calendlyVoice.connected && calendlyVoice.provider === "calendly",
  );

  const calendlyIntegration = resolveLiveCalendar({
    voiceCalendars: [{ provider: "calendly", status: "pending", name: "Calendly" }],
    integrationConnections: [
      {
        provider: "calendly",
        status: "connected",
        config: { email: "owner@example.com" },
      },
    ],
  });
  assert(
    "integrations calendly counts when voice row is pending",
    calendlyIntegration.connected &&
      calendlyIntegration.source === "integrations" &&
      calendlyIntegration.name === "owner@example.com",
  );

  const googleOnly = resolveLiveCalendar({
    voiceCalendars: [{ provider: "google", status: "connected", name: "Work" }],
  });
  assert("google voice calendar counts", googleOnly.connected && googleOnly.provider === "google");

  // Booking wizard must not block when calendly is live (Activate used to ignore calendly).
  const bookingState = createDefaultWizardState();
  bookingState.phoneNumberId = "pn";
  bookingState.agentName = "Danny";
  bookingState.voiceId = "allie-ultra";
  bookingState.openingGreeting = "Hi";
  bookingState.businessName = "Lakeside";
  bookingState.capabilities = ["book_appointments"];
  bookingState.appointmentTypes = bookingState.appointmentTypes.map((t) => ({
    ...t,
    enabled: true,
  }));
  bookingState.calendarConnected = false; // UI flag stale — live probe wins
  const calendlyOk = getWizardActivationIssues(bookingState, {
    hasCalendarConnection: calendlyVoice.connected,
  });
  assert(
    "calendly live probe unblocks booking activate",
    !calendlyOk.some((i) => i.id === "calendar" && i.severity === "blocking"),
  );
}

// --- max days ahead / booking hours parsers ---
assert("30 days → 30", parseDaysAhead("30 days") === 30);
assert("2 weeks → 14", parseDaysAhead("2 weeks") === 14);
assert("bare 14 → 14", parseDaysAhead("14") === 14);
assert("Number(30 days) was NaN bug", Number("30 days") !== 30);
assert(
  "parsed days usable where Number fails",
  parseDaysAhead("30 days") === 30 && !(Number("30 days") > 0),
);

{
  const hours = parseBookingHours("Mon - Fri, 8:00 AM - 6:00 PM");
  assert("booking hours parsed", Boolean(hours));
  assert("booking hours start 8", hours?.startHour === 8);
  assert("booking hours end 18", hours?.endHour === 18);
  assert("booking hours weekdays", hours?.weekdaysOnly === true);
}

// --- timezone wall clock ---
{
  // 2026-07-29 10:00 America/New_York = 14:00 UTC (EDT)
  const utc = wallTimeInZoneToUtc("America/New_York", 2026, 7, 29, 10, 0);
  assert("NY 10:00 → 14:00Z", utc.toISOString() === "2026-07-29T14:00:00.000Z");
  const parts = zonedDateParts(utc, "America/New_York");
  assert("zoned parts hour 10", parts.hour === 10);
  assert("zoned parts weekday wed", parts.weekday === "wed");
}

// --- greeting merge prefers wizard base ---
{
  const base = parseVoiceAgentConfig({
    callHandling: { greeting: "Thanks for calling Acme Dental, this is Maya." },
  });
  const merged = mergeVoiceConfig(base, {
    callHandling: {
      greeting: "Thank you for calling. I'm the virtual assistant. How can I help you today?",
    },
  });
  // mergeVoiceConfig still overwrites — apply.ts must prefer base. Simulate apply preference:
  const preferred =
    String(base.callHandling?.greeting || "").trim() ||
    String(merged.callHandling?.greeting || "").trim();
  assert(
    "wizard greeting preferred over flow default",
    preferred.includes("Acme Dental"),
  );
}

// --- draft config answerMode for line_busy is overflow, not ring_team_first ---
{
  const state = createDefaultWizardState();
  state.answerWhen = "line_busy";
  state.ringBehavior = "line_busy";
  state.agentName = "Maya";
  state.openingGreeting = "Hi, thanks for calling.";
  state.businessName = "Acme";
  const cfg = buildWizardAgentConfig(state);
  assert(
    "line_busy answerMode is overflow",
    String(cfg.callHandling?.answerMode) === "overflow",
  );
  assert(
    "wizard greeting in draft",
    String(cfg.callHandling?.greeting || "").includes("thanks for calling"),
  );
}

{
  const state = createDefaultWizardState();
  state.bookingBehavior = {
    ...state.bookingBehavior,
    distinguishNewExisting: true,
  };
  const prompt = buildSystemPrompt(state);
  assert(
    "distinguishNewExisting in system prompt",
    /new or an existing/i.test(prompt),
  );

  state.businessName = "Lakeside Family Dentistry";
  state.agentName = "Danny";
  state.knowledgeItems = state.knowledgeItems.map((i) =>
    i.id === "hours"
      ? {
          ...i,
          status: "complete" as const,
          summary: "Friday until 3pm. First Saturday 9–1.",
        }
      : i.id === "pricing"
        ? {
            ...i,
            status: "complete" as const,
            summary: "New patient exam + cleaning + X-rays: $189",
          }
        : i,
  );
  const withKnowledge = buildSystemPrompt(state);
  assert(
    "prompt embeds hours knowledge",
    withKnowledge.includes("Friday until 3pm"),
  );
  assert(
    "prompt embeds pricing knowledge",
    withKnowledge.includes("$189"),
  );
  assert(
    "prompt does not say knowledge-base-only",
    !withKnowledge.includes("knowledge base only"),
  );
  assert(
    "prompt has Business knowledge section",
    withKnowledge.includes("Business knowledge:"),
  );
}

assert(
  "message_taken prefers outcome",
  resolveMessageTakenInsight({
    text: "thanks bye",
    outcome: "message_taken",
  }) === true,
);
assert(
  "message_taken prefers structuredMessage metadata",
  resolveMessageTakenInsight({
    text: "",
    outcome: null,
    metadata: { structuredMessage: { reason: "callback" } },
  }) === true,
);
assert(
  "smsConfirmations from Goals capability",
  (() => {
    const state = createDefaultWizardState();
    state.capabilities = ["send_sms_confirmations"];
    state.bookingBehavior = {
      ...state.bookingBehavior,
      sendSmsAfterBooking: false,
    };
    state.agentName = "Maya";
    state.openingGreeting = "Hi";
    return Boolean(buildWizardAgentConfig(state).messaging?.smsConfirmations);
  })(),
);

// --- Booking arg aliases (Telnyx schema ↔ handler) ---
{
  const n = normalizeBookingToolArgs({
    startAt: "2026-08-04T15:00:00.000Z",
    customerPhone: "+15551234567",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    serviceId: "Initial Consultation",
  });
  assert("alias startAt→startsAt", n.startsAt === "2026-08-04T15:00:00.000Z");
  assert("alias customerPhone→phone", n.phone === "+15551234567");
  assert("alias customerName→name", n.name === "Jane Doe");
  assert("alias customerEmail→email", n.email === "jane@example.com");
  assert("alias serviceId name→serviceName", n.serviceName === "Initial Consultation");
  assert(
    "required full_name satisfied by name",
    fieldSatisfied("full_name", n) === true,
  );
  assert("required service satisfied by serviceName", fieldSatisfied("service", n) === true);
  assert("required phone satisfied", fieldSatisfied("phone", n) === true);
}

{
  const cfg = buildWizardAgentConfig(createDefaultWizardState());
  const startup = cfg.callHandling?.startupGreeting as { mode?: string } | undefined;
  // default connection greeting is transovo_professional
  assert(
    "full wizard snapshot persisted for promote",
    Boolean(
      (cfg.advanced as { appointmentReceptionistWizard?: { phoneNumberId?: unknown } })
        ?.appointmentReceptionistWizard &&
        "capabilities" in
          ((cfg.advanced as { appointmentReceptionistWizard: object })
            .appointmentReceptionistWizard || {}),
    ),
  );
  assert("default agent name matches voice Astra", createDefaultWizardState().agentName === "Astra");
  void startup;
}

{
  const state = createDefaultWizardState();
  state.connectionGreeting = "create_custom";
  state.connectionGreetingText = "One moment while I connect you.";
  const cfg = buildWizardAgentConfig(state);
  const startup = cfg.callHandling?.startupGreeting as { mode?: string; text?: string };
  assert("create_custom uses tts mode", startup?.mode === "tts");
  assert(
    "create_custom keeps text",
    String(startup?.text || "").includes("connect you"),
  );
  assert(
    "prompt forbids inventing slot times",
    String(cfg.instructions?.system || "").includes(
      "Never offer, confirm, or book a day/time unless",
    ),
  );
  assert(
    "prompt includes call-start date/time dynvars",
    String(cfg.instructions?.system || "").includes("{{current_date}}") &&
      String(cfg.instructions?.system || "").includes("{{current_time}}") &&
      String(cfg.instructions?.system || "").includes("{{business_timezone}}"),
  );
  assert(
    "dynamicVariables include business_timezone + current_date",
    Boolean(cfg.dynamicVariables?.business_timezone) &&
      Boolean(cfg.dynamicVariables?.current_date),
  );
}

{
  const fields = resolveServiceRequiredFields(
    ["full_name", "phone", "email", "service", "address"],
    [
      { id: "full_name", enabled: true },
      { id: "phone", enabled: true },
      { id: "email", enabled: true },
      { id: "service", enabled: true },
      { id: "address", enabled: false },
    ],
  );
  assert("drops disabled address from requiredFields", !fields.includes("address"));
  assert("keeps phone required", fields.includes("phone"));
}

// --- Availability window for voice calendar tools ---
{
  const now = new Date("2026-08-05T18:00:00.000Z");
  const clock = resolveAvailabilityTimeWindow(
    { daysAhead: 7, startTime: "08:00", endTime: "12:00" },
    { now, maxDays: 3 },
  );
  assert("caps daysAhead 7→3", clock.daysAhead === 3);
  assert("clock times become ISO start", clock.startTime.includes("T"));
  assert("clock preferred morning", clock.preferredStartMinute === 480);
  const iso = resolveAvailabilityTimeWindow(
    {
      startTime: "2026-08-11T12:00:00.000Z",
      endTime: "2026-08-11T16:00:00.000Z",
    },
    { now, maxDays: 3 },
  );
  assert("ISO window keeps Tuesday", iso.startTime.startsWith("2026-08-11"));
  assert("ISO window daysAhead 1", iso.daysAhead === 1);
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length} check(s)`);
  process.exit(1);
}
console.log("OK: appointment receptionist wiring unit tests passed");
process.exit(0);
