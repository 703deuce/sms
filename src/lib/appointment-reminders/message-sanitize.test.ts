import assert from "node:assert/strict";
import { finalizeReminderSmsBody } from "./message-sanitize";

assert.equal(
  finalizeReminderSmsBody("Hi Alex. Manage: {{manage_link}}"),
  "Hi Alex.",
  "strips unreplaced manage link",
);

assert.equal(
  finalizeReminderSmsBody("Hello {{first_name}} tomorrow"),
  "Hello tomorrow",
  "strips leftover tokens",
);

assert.equal(
  finalizeReminderSmsBody(
    "Hi Alex, your appointment is booked. Details: {{appointment_link}}. Reply STOP to opt out.",
  ),
  "Hi Alex, your appointment is booked. Reply STOP to opt out.",
  "removes empty Details clause when link token is blank",
);

console.log("message-sanitize.test.ts: ok");
