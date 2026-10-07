import assert from "node:assert/strict";
import {
  isAiAutomaticCalendarMutation,
  DEFAULT_AI_RESCHEDULER_CONFIG,
} from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { parseImportedExternalId } from "../src/lib/calendar/external-id";

assert.equal(DEFAULT_AI_RESCHEDULER_CONFIG.mode, "notify");
assert.equal(isAiAutomaticCalendarMutation({ ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "ai" }), true);
assert.equal(
  isAiAutomaticCalendarMutation({ ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "notify" }),
  false,
);

const parsed = parseImportedExternalId("microsoft:conn1:event123");
assert.ok(parsed);
assert.equal(parsed?.eventId, "event123");

console.log("PASS test-ar-ai-rescheduler");
