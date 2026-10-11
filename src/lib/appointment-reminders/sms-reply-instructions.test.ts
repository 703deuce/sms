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

console.log("sms-reply-instructions.test.ts: PASS");
