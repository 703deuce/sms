import assert from "node:assert/strict";
import {
  isAppointmentCustomerConfirmed,
  shouldSkipReminderStepForConfirmation,
} from "./reminder-confirmation-guard";

assert.equal(
  isAppointmentCustomerConfirmed("confirmed", {}),
  true,
);

assert.equal(
  shouldSkipReminderStepForConfirmation({
    stepKey: "confirmation",
    step: { enabled: true, channel: "sms", label: "Confirm", template: "x" },
    appointmentStatus: "confirmed",
    metadata: {},
    platform: { reminderPreferences: { skipConfirmationStepsWhenConfirmed: true } },
  }),
  true,
);

assert.equal(
  shouldSkipReminderStepForConfirmation({
    stepKey: "reminder24h",
    step: {
      enabled: true,
      channel: "sms",
      label: "24h",
      template: "x",
      skipIfAppointmentConfirmed: false,
    },
    appointmentStatus: "confirmed",
    metadata: {},
    platform: { reminderPreferences: {} },
  }),
  false,
);

console.log("reminder-confirmation-guard.test.ts OK");
