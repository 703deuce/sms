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

console.log("message-sanitize.test.ts: ok");
