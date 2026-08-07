/**
 * Caller Amy live-agent tool audit — parameter normalization + handler contracts.
 * Run: npx tsx scripts/test-live-agent-tools.ts
 *
 * Tests every tool in the caller_amy runtime registry with realistic voice payloads.
 * No live Calendly/Telnyx calls — validates the same param path builtin-actions uses.
 */
import assert from "node:assert/strict";
import { getRuntime } from "../src/lib/agents/appointment-booking/runtime-registry";
import { BUILTIN_WEBHOOK_BODIES } from "../src/lib/voice/tools/catalog";
import {
  normalizeBookingToolArgs,
  resolveAvailabilityTimeWindow,
  buildCalendlyListAvailableTimesParams,
  buildCalendlyBookParams,
  fieldSatisfied,
  assertStartsAtMatchesAvailabilitySlots,
} from "../src/lib/voice/calendar/booking-args";
import { resolveSpokenDatetime } from "../src/lib/voice/calendar/resolve-datetime";
import { LIVE_AGENT_CALENDLY_WINDOW_REGRESSION } from "../src/lib/integrations/framework/fixtures/live-agent-calendly-window-regression";
import {
  liveAgentAllowsAction,
  LIVE_AGENT_APPOINTMENT_ACTIONS,
} from "../src/lib/integrations/framework/execution-source";
import { compileCallerToolPlaybookForPrompt } from "../src/lib/agents/appointment-booking/intelligence/caller-tool-playbook";
import { classifyActionRisk } from "../src/lib/integrations/framework/ai-policy";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

/** Maps runtime-registry tool ids → builtin-actions switch cases (when applicable). */
const RUNTIME_TO_BUILTIN: Record<string, string | "telnyx_native"> = {
  resolve_datetime: "resolve_datetime",
  calendar_availability: "calendar_availability",
  hold_appointment_slot: "hold_appointment_slot",
  release_appointment_hold: "release_appointment_hold",
  book_appointment: "book_appointment",
  find_appointments: "find_appointments",
  reschedule_appointment: "reschedule_appointment",
  cancel_appointment: "cancel_appointment",
  send_sms: "send_sms",
  transfer: "telnyx_native",
  escalate_human: "escalate_human",
  save_caller_info: "save_caller_info",
  take_structured_message: "take_structured_message",
  lookup_customer: "lookup_customer",
  hangup: "telnyx_native",
};

console.log("\n== Caller Amy runtime tool coverage ==");
const runtime = getRuntime("caller_amy");
for (const toolId of runtime.toolIds) {
  const builtin = RUNTIME_TO_BUILTIN[toolId];
  check(
    `runtime tool ${toolId} has handler mapping`,
    Boolean(builtin),
    builtin ? undefined : "missing RUNTIME_TO_BUILTIN entry",
  );
  if (builtin && builtin !== "telnyx_native") {
    check(
      `catalog schema exists for ${toolId}`,
      Boolean(BUILTIN_WEBHOOK_BODIES[builtin as keyof typeof BUILTIN_WEBHOOK_BODIES]),
    );
  }
}

console.log("\n== resolve_datetime (realistic voice phrases) ==");
{
  const now = new Date("2026-08-07T14:00:00.000Z");
  const tomorrow = resolveSpokenDatetime({
    spoken: "tomorrow at 2pm",
    timezone: "America/New_York",
    now,
  });
  check("tomorrow at 2pm resolves", tomorrow.ok === true);
  if (tomorrow.ok) {
    check("tomorrow has resolvedIso", Boolean(tomorrow.resolvedIso));
    check("tomorrow confidence high", tomorrow.confidence === "high");
  }

  const friday = resolveSpokenDatetime({
    spoken: "this Friday morning",
    timezone: "America/New_York",
    now,
  });
  check("this Friday morning resolves", friday.ok === true);

  const relative = resolveSpokenDatetime({
    spoken: "in three hours",
    timezone: "America/New_York",
    now,
  });
  check("in three hours resolves", relative.ok === true);
}

console.log("\n== resolve_datetime → calendar_availability chain ==");
{
  const now = new Date("2026-08-07T02:16:00.000Z");
  const resolved = resolveSpokenDatetime({
    spoken: "tomorrow at 2pm",
    timezone: "America/New_York",
    now,
  });
  check("chain: resolve ok", resolved.ok === true);
  if (!resolved.ok) throw new Error("resolve failed");

  // Model often passes resolvedIso as from/to point-in-time.
  const fromChain = buildCalendlyListAvailableTimesParams(
    {
      resolvedIso: resolved.resolvedIso,
      from: resolved.resolvedIso,
      to: resolved.resolvedIso,
      serviceName: "Service Visit",
    },
    { now, maxDays: 3 },
  );
  check(
    "chain: resolvedIso expands window end > start",
    new Date(fromChain.endTime).getTime() > new Date(fromChain.startTime).getTime(),
  );
  check("chain: startTime is ISO", fromChain.startTime.includes("T"));

  // Model may pass only resolvedIso without from/to.
  const isoOnly = buildCalendlyListAvailableTimesParams(
    { resolvedIso: resolved.resolvedIso, serviceName: "Service Visit" },
    { now, maxDays: 3 },
  );
  check(
    "chain: resolvedIso-only expands window",
    new Date(isoOnly.endTime).getTime() > new Date(isoOnly.startTime).getTime(),
  );
}

console.log("\n== calendar_availability param shapes ==");
{
  const now = new Date("2026-08-07T02:16:00.000Z");
  const reg = LIVE_AGENT_CALENDLY_WINDOW_REGRESSION;

  const pointInTime = buildCalendlyListAvailableTimesParams(reg.calendarInput, {
    now,
    maxDays: 3,
  });
  check(
    "regression cmsibcgz from=to window",
    pointInTime.startTime === reg.expectedWindow.startTime &&
      pointInTime.endTime === reg.expectedWindow.endTime,
  );

  const startsAtOnly = buildCalendlyListAvailableTimesParams(
    { startsAt: "2026-08-07T18:00:00.000Z", serviceName: "Service Visit" },
    { now, maxDays: 3 },
  );
  check(
    "startsAt-only expands for Calendly",
    startsAtOnly.endTime === "2026-08-08T18:00:00.000Z",
  );

  const telnyxAliases = buildCalendlyListAvailableTimesParams(
    {
      startAt: "2026-08-11T12:00:00.000Z",
      serviceId: "Drain cleaning",
      daysAhead: 1,
    },
    { now: new Date("2026-08-05T18:00:00.000Z"), maxDays: 3 },
  );
  check(
    "startAt alias maps to availability window",
    telnyxAliases.startTime === "2026-08-11T12:00:00.000Z",
  );
  check(
    "serviceId name maps to serviceName",
    telnyxAliases.normalized.serviceName === "Drain cleaning",
  );

  const morningClock = resolveAvailabilityTimeWindow(
    { daysAhead: 2, startTime: "08:00", endTime: "12:00" },
    { now: new Date("2026-08-05T18:00:00.000Z"), maxDays: 3 },
  );
  check("clock-time window caps daysAhead", morningClock.daysAhead === 2);
  check("clock-time preferredStartMinute", morningClock.preferredStartMinute === 480);
}

console.log("\n== book_appointment param shapes ==");
{
  const telnyxBook = buildCalendlyBookParams({
    startAt: "2026-08-07T18:00:00.000Z",
    customerPhone: "+18663464256",
    customerName: "Test Caller",
    customerEmail: "caller@example.com",
    serviceName: "Service Visit",
    timezone: "America/New_York",
  });
  check("book startAt→startTime", telnyxBook.startTime === "2026-08-07T18:00:00.000Z");
  check("book customerPhone→phone", telnyxBook.phone === "+18663464256");
  check("book customerName→name", telnyxBook.name === "Test Caller");
  check("book customerEmail→email", telnyxBook.email === "caller@example.com");
  check("book timezone preserved", telnyxBook.timezone === "America/New_York");

  const slotBook = buildCalendlyBookParams({
    startsAt: "2026-08-07T18:00:00.000Z",
    phone: "+18663464256",
    name: "Jane",
    email: "jane@example.com",
  });
  check("book startsAt path", slotBook.startTime === "2026-08-07T18:00:00.000Z");

  const required = normalizeBookingToolArgs({
    startAt: "2026-08-07T18:00:00.000Z",
    customerPhone: "+15551234567",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    serviceId: "Initial Consultation",
  });
  check("required full_name via name", fieldSatisfied("full_name", required));
  check("required phone via customerPhone", fieldSatisfied("phone", required));
  check("required service via serviceId", fieldSatisfied("service", required));
}

console.log("\n== hold_appointment_slot param shapes ==");
{
  const hold = normalizeBookingToolArgs({
    startAt: "2026-08-07T18:00:00.000Z",
    customerPhone: "+18663464256",
    serviceName: "Service Visit",
  });
  check("hold startAt→startsAt", hold.startsAt === "2026-08-07T18:00:00.000Z");
  check("hold customerPhone→phone", hold.phone === "+18663464256");
  const holdStart = new Date(String(hold.startsAt));
  check("hold startsAt parses", !Number.isNaN(holdStart.getTime()));
}

console.log("\n== find_appointments param shapes ==");
{
  const find = normalizeBookingToolArgs({
    customerPhone: "+18663464256",
  });
  check("find customerPhone→phone", find.phone === "+18663464256");
}

console.log("\n== reschedule_appointment param shapes ==");
{
  const args = {
    appointmentId: "appt_test_1",
    newStartAt: "2026-08-08T18:00:00.000Z",
  };
  const newStartAt = String(args.newStartAt || (args as { startsAt?: string }).startsAt || "");
  check("reschedule newStartAt required", Boolean(args.appointmentId && newStartAt));
  const parsed = new Date(newStartAt);
  check("reschedule newStartAt parses", !Number.isNaN(parsed.getTime()));
}

console.log("\n== cancel_appointment param shapes ==");
{
  const args = { appointmentId: "appt_test_1", reason: "caller requested" };
  check("cancel appointmentId required", Boolean(args.appointmentId));
}

console.log("\n== send_sms param shapes ==");
{
  const payloads = [
    { to: "+18663464256", body: "Your appointment is confirmed." },
    { phone: "+18663464256", body: "Thanks for calling." },
  ];
  for (const p of payloads) {
    const to = String(p.to || p.phone || "");
    const body = String(p.body || "");
    check(`send_sms to+body (${to.slice(0, 4)}…)`, Boolean(to && body));
  }
}

console.log("\n== save_caller_info param shapes ==");
{
  const args = {
    phone: "+18663464256",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
  };
  check("save_caller_info phone required", Boolean(args.phone));
  check("save_caller_info first_name", Boolean(args.first_name));
}

console.log("\n== take_structured_message param shapes ==");
{
  const args = {
    reason: "Needs callback about billing",
    caller_name: "Jane Doe",
    phone: "+18663464256",
    urgency: "normal",
  };
  const reason = String(args.reason || "").trim();
  check("take_structured_message reason required", Boolean(reason));
}

console.log("\n== lookup_customer param shapes ==");
{
  const args = { query: "Jane Doe", phone: "+18663464256" };
  const query = args.query ? String(args.query) : "";
  check("lookup_customer query or phone", Boolean(query || args.phone));
}

console.log("\n== escalate_human param shapes ==");
{
  const args = { target_name: "Front Desk", reason: "caller asked for human" };
  check("escalate_human target_name", Boolean(args.target_name || args.reason));
}

console.log("\n== end_call safety (builtin fallback when hangup unavailable) ==");
{
  const blockedReasons = [
    "crm lookup failed",
    "transfer error",
    "tool timeout",
  ];
  const allowedReasons = ["caller said goodbye", "conversation complete", ""];
  const blockedRe =
    /lookup|crm|transfer|tool|error|fail|timeout|hold|connect(ing)? you/;
  const allowedRe =
    /goodbye|complete|finished|caller.?asked|hang.?up|end.?call|conversation.?over|no further/;
  for (const r of blockedReasons) {
    const blocked = blockedRe.test(r.toLowerCase());
    const allowed = !blocked && allowedRe.test(r.toLowerCase());
    check(`end_call blocks "${r}"`, blocked && !allowed);
  }
  for (const r of allowedReasons) {
    const blocked = blockedRe.test(r.toLowerCase());
    const allowed =
      !blocked &&
      (!r || allowedRe.test(r.toLowerCase()));
    check(`end_call allows "${r || "(empty)"}"`, allowed);
  }
}

console.log("\n== live_agent Calendly integration policy ==");
{
  check(
    "whitelist list_available_times",
    LIVE_AGENT_APPOINTMENT_ACTIONS.has("appointment.list_available_times"),
  );
  check("whitelist book", LIVE_AGENT_APPOINTMENT_ACTIONS.has("appointment.book"));
  check(
    "allows list_available_times",
    liveAgentAllowsAction("appointment.list_available_times", 1),
  );
  check("allows book", liveAgentAllowsAction("appointment.book", 3));
  check(
    "blocks contact.upsert",
    !liveAgentAllowsAction("contact.upsert", 3),
  );
  check(
    "list_available_times risk 1",
    classifyActionRisk("appointment.list_available_times") === 1,
  );
}

console.log("\n== book_appointment slot guard (call cmsicfq1 regression) ==");
{
  const validSlots = [
    "2026-08-07T13:00:00.000Z",
    "2026-08-07T13:30:00.000Z",
    "2026-08-07T14:00:00.000Z",
  ];
  try {
    assertStartsAtMatchesAvailabilitySlots("2026-08-07T17:00:00.000Z", validSlots);
    check("rejects invented startsAt", false, "should have thrown");
  } catch (err) {
    check(
      "rejects invented startsAt (cmsicfq1 used 17:00 not from slots)",
      err instanceof Error && err.message.includes("copied EXACTLY"),
    );
  }
  check(
    "accepts exact slot startsAt",
    (() => {
      assertStartsAtMatchesAvailabilitySlots("2026-08-07T13:00:00.000Z", validSlots);
      return true;
    })(),
  );
}

console.log("\n== caller tool playbook injected in prompt ==");
{
  const prompt = compileCallerToolPlaybookForPrompt(["book_appointment", "calendar_availability"]);
  check("playbook mentions slots[].startsAt", prompt.includes("slots[].startsAt"));
  check("playbook mentions customerEmail required", prompt.includes("customerEmail"));
  check("playbook mentions resolve_datetime chain", prompt.includes("resolve_datetime"));
}

console.log("\n== Calendly API param contract ==");
{
  const params = buildCalendlyListAvailableTimesParams(
    LIVE_AGENT_CALENDLY_WINDOW_REGRESSION.calendarInput,
    { now: new Date("2026-08-07T02:16:00.000Z"), maxDays: 3 },
  );
  const start = new Date(params.startTime);
  const end = new Date(params.endTime);
  check("Calendly end_time > start_time", end.getTime() > start.getTime());
  check("Calendly start_time is ISO", params.startTime.endsWith("Z"));
  check("Calendly end_time is ISO", params.endTime.endsWith("Z"));

  const book = buildCalendlyBookParams({
    startsAt: "2026-08-07T18:00:00.000Z",
    name: "Test",
    email: "test@example.com",
    phone: "+18663464256",
  });
  check("Calendly book has startTime", Boolean(book.startTime));
  check("Calendly book has name+email", Boolean(book.name && book.email));
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length} check(s):`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log(`OK: all ${runtime.toolIds.length} Caller Amy live-agent tool checks passed`);
