/**
 * Regression tests for post-email filler ordering and one-and-done booking close.
 * Run: npx tsx scripts/test-frontdesk-booking-ux.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
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
const scheduleRuntimeSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/runtime-schedule-appointment.ts"),
  "utf8",
);
const providerWriteSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/booking-provider-write.ts"),
  "utf8",
);
const emailTaskSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/email-collection-task.ts"),
  "utf8",
);
const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/task-async-work-bridge.ts"),
  "utf8",
);
const amySource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/amy-receptionist-agent.ts"),
  "utf8",
);

// --- 1. Provider write decoupled from AgentSession; optional speech after success ---

assert.ok(
  bridgeSource.includes("runAsyncWorkWithBridge"),
  "generic async-work bridge utility exists",
);
assert.ok(
  bridgeSource.includes("speakBeforeTaskHandoff"),
  "AgentTask handoff bridge exists",
);
assert.ok(
  scheduleRuntimeSource.includes("writeBookingToProvider"),
  "schedule commit uses direct provider write (no session bridge)",
);
assert.ok(
  !scheduleRuntimeSource.includes("runAsyncWorkWithBridge"),
  "schedule commit must not wrap Calendly write in async-work bridge",
);
assert.ok(
  providerWriteSource.includes("booking_provider_write_started"),
  "provider write logs booking_provider_write_started",
);
assert.ok(
  providerWriteSource.includes("booking_provider_write_succeeded"),
  "provider write logs booking_provider_write_succeeded",
);
assert.ok(
  scheduleRuntimeSource.includes("trySpeakAfterProviderWrite"),
  "spoken confirmation runs after provider write via trySpeakAfterProviderWrite",
);
assert.ok(
  bookingToolsSource.includes("formatToolFeedbackForModel"),
  "schedule_appointment returns structured TOOL_FEEDBACK",
);
assert.ok(
  bookingToolsSource.includes("toolFeedbackMissingEmail"),
  "schedule_appointment fast-returns when email is missing",
);
assert.ok(
  !bookingToolsSource.includes("collectEmailInlineForBooking"),
  "schedule_appointment must not block on inline email waiter",
);
assert.ok(
  emailTaskSource.includes("speakBeforeTaskHandoff"),
  "email task speaks bridge before handoff to parent (legacy AgentTask path)",
);
assert.ok(
  emailTaskSource.includes("deliverScriptedSpeech"),
  "email onEnter uses scripted speech instead of generateReply",
);

assert.ok(
  !bookingToolsSource.includes("GetEmailTask"),
  "frontdesk must not use GetEmailTask (Realtime agent_handoff)",
);

assert.ok(
  scheduleRuntimeSource.includes("sendBookingSmsAsync"),
  "confirmation SMS is queued async after speak (LiveKit say-before-slow-IO)",
);
assert.ok(
  !scheduleRuntimeSource.includes("await sendBookingConfirmationSms"),
  "must not await SMS before speaking confirmation",
);
const postWriteBlock = scheduleRuntimeSource.match(
  /markBookingOperationConfirmed\(userData\)[\s\S]*?toolFeedbackBookingCompleteSpeakNow/,
);
assert.ok(postWriteBlock, "post-write success block exists");
assert.ok(
  postWriteBlock![0].indexOf("trySpeakAfterProviderWrite") <
    postWriteBlock![0].indexOf("sendBookingSmsAsync"),
  "speak confirmation before async SMS",
);
assert.ok(
  postWriteBlock![0].indexOf("trySpeakAfterProviderWrite") <
    postWriteBlock![0].indexOf("lookupAppointmentIdForCallWithRetry"),
  "speak confirmation before deferred CRM lookup",
);
assert.ok(
  postWriteBlock![0].indexOf("writeBookingToProvider") <
    postWriteBlock![0].indexOf("trySpeakAfterProviderWrite"),
  "provider write completes before spoken confirmation",
);

assert.ok(
  fs.readFileSync(
    path.join(process.cwd(), "voice-runtime/src/frontdesk/booking-speech.ts"),
    "utf8",
  ).includes("allowInterruptions: false"),
  "booking confirmation uses non-interruptible scripted speech",
);

assert.doesNotMatch(
  bookingToolsSource,
  /runCtx\.update\(POST_EMAIL_BOOKING_FILLER\)/,
  "must not use runCtx.update for filler — breaks OpenAI Realtime",
);

// --- 2. Provider booking still occurs once inside telemetry wrapper ---

const scheduleTelemetryBlocks = scheduleRuntimeSource.match(
  /withLiveKitToolTelemetry\([\s\S]*?writeBookingToProvider/g,
);
assert.ok(scheduleTelemetryBlocks, "schedule_appointment still calls writeBookingToProvider inside telemetry");

assert.ok(
  scheduleRuntimeSource.includes("markBookingConfirmed"),
  "booking receipt is still persisted after provider write",
);

assert.ok(
  scheduleRuntimeSource.includes("lookupAppointmentIdForCallWithRetry"),
  "CRM sync waits for product persist with retry",
);

// --- 3. Final confirmation spoken once via deterministic update ---

const successLine = buildBookingSuccessLine("Monday at 3 PM");
assert.match(successLine, /confirmed for Monday at 3 PM/);
assert.match(successLine, /confirmation text/i);

assert.ok(
  scheduleRuntimeSource.includes("trySpeakAfterProviderWrite"),
  "final confirmation is spoken after provider write via trySpeakAfterProviderWrite",
);

assert.ok(
  scheduleRuntimeSource.includes("toolFeedbackBookingCompleteSpoken") ||
    scheduleRuntimeSource.includes("toolFeedbackBookingCompleteSpeakNow"),
  "tool result tells model confirmation state after booking",
);

assert.ok(
  scheduleRuntimeSource.includes("formatToolFeedbackForModel"),
  "schedule commit returns TOOL_FEEDBACK envelopes",
);
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
  scheduleRuntimeSource.includes("toolFeedbackFromBookingWriteError"),
  "failed booking returns structured recoverable/terminal feedback",
);
assert.ok(
  scheduleRuntimeSource.includes("buildBookingFailureLine"),
  "failed booking attempts caller-facing failure speech after provider failure",
);

// --- 4. No duplicate goodbye sequence — end_call on frontdesk ---

assert.ok(bookingToolsSource.includes("buildFrontDeskEndCallToolset"), "frontdesk uses playout-aware end call");
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
