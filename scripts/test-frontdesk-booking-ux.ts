/**
 * Regression tests for post-email filler ordering and one-and-done booking close.
 * Run: npx tsx scripts/test-frontdesk-booking-ux.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  BOOKING_FAILED_TOOL_RESULT,
  POST_EMAIL_BOOKING_FILLER,
  buildBookingFailureLine,
  buildBookingSuccessLine,
} from "../voice-runtime/src/booking-completion-messages";
import { bookingFailureReason, isCalendlyRateLimitError } from "../voice-runtime/src/booking-error";

const frontdeskSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/frontdesk-booking-agent.ts"),
  "utf8",
);
const bookingToolsSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/booking-tools.ts"),
  "utf8",
);
const amySource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/amy-receptionist-agent.ts"),
  "utf8",
);

// --- 1. Post-email filler is spoken before protected write (inline email flow) ---

assert.ok(
  bookingToolsSource.includes("POST_EMAIL_BOOKING_FILLER"),
  "frontdesk uses shared post-email filler constant",
);

assert.ok(
  !bookingToolsSource.includes("GetEmailTask"),
  "frontdesk must not use GetEmailTask (Realtime agent_handoff)",
);

const fillerBeforeProtect = bookingToolsSource.match(
  /await speakBookingLine\(session,\s*POST_EMAIL_BOOKING_FILLER\)/,
);
assert.ok(
  fillerBeforeProtect,
  "filler uses speakBookingLine (Realtime-safe) before protected Calendly write",
);

assert.doesNotMatch(
  bookingToolsSource,
  /runCtx\.update\(POST_EMAIL_BOOKING_FILLER\)/,
  "must not use runCtx.update for filler — breaks OpenAI Realtime",
);

// --- 2. Provider booking still occurs once inside telemetry wrapper ---

const scheduleTelemetryBlocks = bookingToolsSource.match(
  /withLiveKitToolTelemetry\([\s\S]*?scheduleAppointmentResilient/g,
);
assert.ok(scheduleTelemetryBlocks, "schedule_appointment still calls scheduleAppointmentResilient");

assert.ok(
  bookingToolsSource.includes("markBookingConfirmed"),
  "booking receipt is still persisted after provider write",
);

assert.ok(
  bookingToolsSource.includes("lookupAppointmentIdForCallWithRetry"),
  "CRM sync waits for product persist with retry",
);

// --- 3. Final confirmation spoken once via deterministic update ---

const successLine = buildBookingSuccessLine("Monday at 3 PM");
assert.match(successLine, /confirmed for Monday at 3 PM/);
assert.match(successLine, /confirmation text/i);

assert.ok(
  bookingToolsSource.includes("await speakBookingLine(session, buildBookingSuccessLine(local))"),
  "final confirmation is spoken via Realtime-safe speakBookingLine",
);

assert.ok(
  bookingToolsSource.includes("return BOOKING_COMPLETE_TOOL_RESULT"),
  "tool result tells model not to repeat confirmation",
);

assert.match(BOOKING_COMPLETE_TOOL_RESULT, /BOOKING_COMPLETE_ALREADY_SPOKEN/);
assert.match(BOOKING_COMPLETE_TOOL_RESULT, /end_call/);

assert.match(BOOKING_FAILED_TOOL_RESULT, /BOOKING_FAILED_ALREADY_SPOKEN/);
assert.match(BOOKING_FAILED_TOOL_RESULT, /Do NOT say they are booked/i);
assert.match(buildBookingFailureLine(), /didn't go through/i);
assert.ok(
  isCalendlyRateLimitError(new Error("Integration HTTP 429")),
  "429 errors are classified for retry",
);
assert.match(
  bookingFailureReason(new Error("Integration HTTP 429")),
  /busy right now/i,
);

assert.ok(
  bookingToolsSource.includes("BOOKING_FAILED_TOOL_RESULT"),
  "failed booking returns deterministic tool result instead of hallucination",
);
assert.ok(
  bookingToolsSource.includes("buildBookingFailureLine"),
  "failed booking speaks caller-facing failure via speakBookingLine",
);

// --- 4. No duplicate goodbye sequence — end_call on frontdesk ---

assert.ok(bookingToolsSource.includes('name: "end_call"'), "frontdesk exposes end_call");
assert.ok(bookingToolsSource.includes("buildFrontDeskBusinessAnswerTool"), "frontdesk wires business answer tool");
assert.ok(bookingToolsSource.includes("buildFrontDeskCancelAppointmentTool"), "frontdesk wires cancel tool");
assert.ok(
  bookingToolsSource.includes("buildFrontDeskRescheduleAppointmentTool"),
  "frontdesk wires reschedule tool",
);
assert.ok(
  frontdeskSource.includes("do not repeat it or give") &&
    frontdeskSource.includes("multiple goodbyes"),
  "instructions forbid multiple wrap-ups",
);

assert.ok(
  amySource.includes("return BOOKING_COMPLETE_TOOL_RESULT"),
  "amy schedule path uses same one-and-done completion result",
);

console.log("frontdesk booking UX tests: PASS");
