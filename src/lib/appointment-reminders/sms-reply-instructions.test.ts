import assert from "node:assert/strict";
import { stripEmbeddedSmsReplyInstructions } from "@/lib/appointment-reminders/sms-reply-instructions";

const withYes =
  "Reminder: Consultation tomorrow at 9:00 AM. Manage:  Reply YES to confirm.";
assert.equal(
  stripEmbeddedSmsReplyInstructions(withYes),
  "Reminder: Consultation tomorrow at 9:00 AM. Manage:",
);

const withCrx =
  "Hi Alex, see you Tuesday. Reply C to confirm, R to reschedule, or X to cancel.";
assert.equal(stripEmbeddedSmsReplyInstructions(withCrx), "Hi Alex, see you Tuesday.");

const libraryDayBefore =
  "Hi Alex, Studio here. Your appointment is tomorrow at 9:00 AM. Please arrive early. Reply C to confirm or R to request a new time. STOP to opt out.";
assert.equal(
  stripEmbeddedSmsReplyInstructions(libraryDayBefore),
  "Hi Alex, Studio here. Your appointment is tomorrow at 9:00 AM. Please arrive early. STOP to opt out.",
);

console.log("sms-reply-instructions.test.ts: PASS");
