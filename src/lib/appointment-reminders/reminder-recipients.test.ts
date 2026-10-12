import assert from "node:assert/strict";
import { resolveReminderRecipientPhones } from "./reminder-recipients";

const phones = resolveReminderRecipientPhones(
  {
    inviteePhone: "+15551234567",
    reminderRecipientPhones: ["+15559876543", "+15551234567"],
  },
  null,
);
assert.deepEqual(phones, ["+15551234567", "+15559876543"]);

const single = resolveReminderRecipientPhones({ inviteePhone: "+15551234567" }, null);
assert.deepEqual(single, ["+15551234567"]);

console.log("reminder-recipients.test.ts: PASS");
