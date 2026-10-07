import assert from "node:assert/strict";
import {
  markReminderSentInMeta,
  reminderTimelineType,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";

const timelineType = reminderTimelineType("confirmation");
let meta = {} as AppointmentMetadata;

assert.equal(wasReminderSent(meta, timelineType), false);

meta = markReminderSentInMeta(
  {
    ...meta,
    timeline: [{ type: timelineType, at: new Date().toISOString(), label: "Confirmation" }],
  },
  timelineType,
);

assert.equal(wasReminderSent(meta, timelineType), true, "import confirmation must not send twice");

const replay = markReminderSentInMeta(meta, timelineType);
assert.equal(wasReminderSent(replay, timelineType), true);

console.log("confirmation-idempotency.test.ts: PASS");
