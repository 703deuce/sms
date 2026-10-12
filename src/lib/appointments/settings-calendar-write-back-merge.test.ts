/**
 * Shallow merge check for appointmentReminders.calendarWriteBack without loading Prisma.
 */
import assert from "node:assert/strict";
import type { AppointmentPlatformConfig } from "./types";

function mergeAppointmentReminders(
  current: AppointmentPlatformConfig,
  patch: Partial<AppointmentPlatformConfig>,
): AppointmentPlatformConfig["appointmentReminders"] {
  return patch.appointmentReminders
    ? {
        ...(current.appointmentReminders || {}),
        ...patch.appointmentReminders,
        calendarWriteBack: patch.appointmentReminders.calendarWriteBack
          ? {
              ...(current.appointmentReminders?.calendarWriteBack || {}),
              ...patch.appointmentReminders.calendarWriteBack,
            }
          : current.appointmentReminders?.calendarWriteBack,
      }
    : current.appointmentReminders;
}

const current = {
  appointmentReminders: {
    existingCustomerSmsConsent: { attestedAt: "2020-01-01", version: "ar_existing_sms_v1" },
    calendarWriteBack: { enabled: true, colorCodingEnabled: true },
  },
} as AppointmentPlatformConfig;

const next = mergeAppointmentReminders(current, {
  appointmentReminders: { calendarWriteBack: { enabled: false } },
});

assert.equal(next?.existingCustomerSmsConsent?.attestedAt, "2020-01-01");
assert.equal(next?.calendarWriteBack?.enabled, false);
assert.equal(next?.calendarWriteBack?.colorCodingEnabled, true);

console.log("settings-calendar-write-back-merge.test.ts: PASS");
