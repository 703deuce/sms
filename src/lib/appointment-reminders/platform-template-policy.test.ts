import assert from "node:assert/strict";
import {
  PLATFORM_AR_ALLOWED_MERGE_TAGS,
  resolvePlatformLockedReminderTemplate,
} from "@/lib/appointment-reminders/platform-template-policy";
import type { ReminderStepConfig } from "@/lib/appointments/types";

const step: ReminderStepConfig = {
  enabled: true,
  channel: "sms",
  label: "24h",
  template: "Hi {{first_name}} manage {{manage_link}} cancel {{cancel_link}}",
  minutesBefore: 1440,
};

const locked = resolvePlatformLockedReminderTemplate("reminder24h", step);
assert.ok(!locked.template.includes("manage_link"));
assert.ok(!locked.template.includes("cancel_link"));
assert.ok(locked.template.includes("{{first_name}}") || locked.template.length > 10);

assert.ok(PLATFORM_AR_ALLOWED_MERGE_TAGS.includes("{{business_name}}"));

console.log("platform-template-policy.test.ts: PASS");
