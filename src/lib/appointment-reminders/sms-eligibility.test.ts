import assert from "node:assert/strict";
import { evaluateSmsReminderEligibility } from "./sms-eligibility";

const baseMeta = {
  inviteePhone: "+15551234567",
} as import("@/lib/appointments/types").AppointmentMetadata;

assert.equal(
  evaluateSmsReminderEligibility({ metadata: baseMeta, appointmentStatus: "confirmed" }).eligible,
  false,
  "missing consent should block",
);

assert.equal(
  evaluateSmsReminderEligibility({
    metadata: { ...baseMeta, smsConsent: true },
    appointmentStatus: "confirmed",
  }).eligible,
  true,
  "explicit consent allows send",
);

assert.equal(
  evaluateSmsReminderEligibility({
    metadata: { ...baseMeta, existingConsentCertified: true },
    appointmentStatus: "confirmed",
  }).eligible,
  true,
  "certified existing consent allows send",
);

assert.equal(
  evaluateSmsReminderEligibility({
    metadata: { ...baseMeta, smsConsent: true, reminderOverride: { phone: "+15559876543" } },
    appointmentStatus: "confirmed",
  }).phone,
  "+15559876543",
  "override phone wins",
);

console.log("sms-eligibility.test.ts: ok");
