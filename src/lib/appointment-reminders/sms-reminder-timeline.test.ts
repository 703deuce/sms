import assert from "node:assert/strict";
import { mapSmsReminderTimelineOutcome } from "./sms-reminder-timeline";

assert.deepEqual(mapSmsReminderTimelineOutcome("reminders_cleared"), {
  status: "logged",
  statusLabel: "Recorded",
});
assert.deepEqual(mapSmsReminderTimelineOutcome("reminder_sms_sent"), {
  status: "sent",
  statusLabel: "Sent",
});
assert.deepEqual(mapSmsReminderTimelineOutcome("confirmation_sent"), {
  status: "sent",
  statusLabel: "Sent",
});

console.log("sms-reminder-timeline.test.ts: ok");
