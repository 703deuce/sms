import assert from "node:assert/strict";
import { applyRecipientSuppressionMetadata } from "@/lib/appointment-reminders/ar-recipient-suppression-metadata";
import type { AppointmentMetadata } from "@/lib/appointments/types";

const base = { inviteePhone: "+15551234567", smsConsent: true } as AppointmentMetadata;

const suppressed = applyRecipientSuppressionMetadata(base, true);
assert.equal(suppressed.smsOptOut, true);
assert.equal(suppressed.recipientOptedOut, true);
assert.equal(suppressed.smsConsent, false);

const clear = applyRecipientSuppressionMetadata(base, false);
assert.equal(clear.smsConsent, true);
assert.notEqual(clear.smsOptOut, true);

console.log("ar-recipient-suppression.test.ts PASS");
