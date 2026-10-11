import assert from "node:assert/strict";
import {
  isAppointmentReminderImportEligible,
  shouldRecoverFromImportOnlySuppression,
} from "./import-eligibility";
import type { AppointmentMetadata } from "@/lib/appointments/types";

assert.equal(
  isAppointmentReminderImportEligible({ reminderImportEligible: true }),
  true,
);
assert.equal(
  isAppointmentReminderImportEligible({ reminderImportEligible: false }),
  false,
);

assert.equal(
  isAppointmentReminderImportEligible({
    reminderSmsEligible: false,
    reminderSmsIneligibleReason: "organizer_not_connection",
  }),
  false,
);

assert.equal(
  isAppointmentReminderImportEligible({
    reminderSmsEligible: false,
    reminderSmsIneligibleReason: "consent_required",
  }),
  true,
);

const recoverMeta: AppointmentMetadata = {
  remindersSuppressed: true,
  reminderSmsIneligibleReason: "no_external_attendees",
};
assert.equal(shouldRecoverFromImportOnlySuppression(recoverMeta), true);

assert.equal(
  shouldRecoverFromImportOnlySuppression({
    ...recoverMeta,
    reminderOverride: { suppressed: true },
  }),
  false,
);

console.log("import-eligibility.test.ts: ok");
