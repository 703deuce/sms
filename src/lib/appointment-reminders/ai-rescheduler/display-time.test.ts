import assert from "node:assert/strict";
import {
  buildArRescheduleConfirmedSms,
  formatArCustomerFacingAppointmentDateTime,
  resolveArAppointmentDisplayTimezone,
} from "./display-time";

const instant = "2026-10-13T13:00:00.000Z";
const eastern = "America/New_York";

assert.equal(
  formatArCustomerFacingAppointmentDateTime(instant, eastern),
  "Tuesday, October 13 at 9:00 AM",
  "13:00 UTC must display as 9 AM Eastern in October (EDT)",
);

assert.equal(
  buildArRescheduleConfirmedSms(instant, eastern),
  "Your appointment has been rescheduled to Tuesday, October 13 at 9:00 AM.",
);

assert.equal(
  resolveArAppointmentDisplayTimezone({
    appointmentTimezone: "America/Chicago",
    platformTimezone: "America/New_York",
  }),
  "America/Chicago",
);

console.log("display-time.test.ts: PASS");
