/**
 * Unit tests for Microsoft appointment discovery matching (no Graph I/O).
 */
import assert from "node:assert/strict";
import {
  extractIdentityFromEventFields,
  normalizeEmail,
  normalizePhoneDigits,
  phonesEquivalent,
} from "../src/lib/voice-v3/calendar/appointment-discovery-identity";
import {
  computeUsefulDiscriminators,
  narrowAppointmentCandidates,
  type AppointmentDiscoveryRecord,
} from "../src/lib/voice-v3/calendar/appointment-discovery-match";
import { stableMicrosoftDiscoveryBookingId } from "../src/lib/voice-v3/calendar/microsoft-discovery-selection-id";
import { findExistingAppointmentFromStore } from "../src/lib/voice-v3/calendar/find-existing-appointment";
import {
  buildAppointmentWhenFromSchedulingMeaning,
  appointmentWhenHasSignal,
} from "../src/lib/voice-v3/calendar/appointment-lookup-when";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";

function mockRecord(partial: {
  id: string;
  subject: string;
  body?: string;
  location?: string;
  localStart: string;
  phone?: string;
  email?: string;
  name?: string;
}): AppointmentDiscoveryRecord {
  const discovery = extractIdentityFromEventFields({
    subject: partial.subject,
    description: partial.body,
    location: partial.location,
    attendeeNames: partial.name ? [partial.name] : [],
    attendeeEmails: partial.email ? [partial.email] : [],
  });
  const base = {
    internalBookingId: stableMicrosoftDiscoveryBookingId("conn", "primary", partial.id),
    provider: "microsoft" as const,
    providerEventId: partial.id,
    providerCalendarId: "primary",
    providerConnectionId: "conn",
    startUtc: "2026-09-22T14:00:00.000Z",
    endUtc: "2026-09-22T15:00:00.000Z",
    localStart: partial.localStart,
    localEnd: partial.localStart,
    timezone: "America/New_York",
    customerIdentity: {
      name: partial.name,
      phone: partial.phone,
      email: partial.email,
    },
    durationMinutes: 60,
    status: "ACTIVE" as const,
  };
  return { ...base, discovery, safeDisplay: partial.localStart };
}

// Transovo body labels
const transovo = extractIdentityFromEventFields({
  subject: "Consultation — Anthony",
  description: "Email: a@b.co\nPhone: 571-555-1234",
});
assert.ok(transovo.emails.includes("a@b.co"));
assert.ok(transovo.phones.some((p) => phonesEquivalent(p, "5715551234")));

// Manual body phone
const manual = extractIdentityFromEventFields({
  subject: "John Smith - Plumbing Diagnostic",
  description: "Call 571-555-1234 when technician arrives.",
});
assert.ok(manual.phones.some((p) => phonesEquivalent(p, "5715551234")));

// Attendee email
const attendee = extractIdentityFromEventFields({
  subject: "Plumbing Appointment",
  attendeeNames: ["John Smith"],
  attendeeEmails: ["john@gmail.com"],
});
assert.equal(normalizeEmail(attendee.emails[0]!), "john@gmail.com");

assert.ok(phonesEquivalent("(571) 555-1234", "+1 571 555 1234"));
assert.equal(normalizeEmail("  A@B.Co "), "a@b.co");

const johnA = mockRecord({
  id: "e1",
  subject: "John Smith",
  localStart: "2026-09-22T10:00:00-04:00",
  phone: "5715551111",
});
const johnB = mockRecord({
  id: "e2",
  subject: "John Smith",
  localStart: "2026-09-25T14:00:00-04:00",
  phone: "7035552222",
});
const onlyName = narrowAppointmentCandidates([johnA, johnB], { name: "John Smith" });
assert.equal(onlyName.length, 2);
const discs = computeUsefulDiscriminators(onlyName);
assert.ok(discs.includes("phone"));

const narrowedPhone = narrowAppointmentCandidates([johnA, johnB], {
  name: "John Smith",
  phone: "571-555-1111",
});
assert.equal(narrowedPhone.length, 1);

const sameCustomer = narrowAppointmentCandidates(
  [
    mockRecord({
      id: "e3",
      subject: "Diagnostic",
      localStart: "2026-09-22T10:00:00-04:00",
      email: "john@gmail.com",
      phone: "5715551234",
    }),
    mockRecord({
      id: "e4",
      subject: "Installation",
      localStart: "2026-09-25T14:00:00-04:00",
      email: "john@gmail.com",
      phone: "5715551234",
    }),
  ],
  { email: "john@gmail.com", phone: "5715551234" },
);
assert.equal(sameCustomer.length, 2);
assert.ok(computeUsefulDiscriminators(sameCustomer).includes("appointment_date"));

const stable1 = stableMicrosoftDiscoveryBookingId("c", "primary", "evt_x");
const stable2 = stableMicrosoftDiscoveryBookingId("c", "primary", "evt_x");
assert.equal(stable1, stable2);
assert.ok(!stable1.includes("evt_x"));

// Legacy store path still requires phone or email
const legacyFail = findExistingAppointmentFromStore({ callId: "x", customerName: "John" });
assert.equal(legacyFail.status, "VERIFICATION_FAILED");

const clock = buildVoiceV3CallClock("America/New_York", new Date("2026-09-19T15:00:00.000Z"));
const mondayWhen = buildAppointmentWhenFromSchedulingMeaning(
  {
    date_expression: "Monday",
    date_relation: "THIS_WEEKDAY",
    weekday: "MONDAY",
    explicit_date: null,
    time_expression: null,
    time_kind: "UNSPECIFIED",
    exact_time: null,
    start_time: null,
    end_time: null,
    daypart: null,
  },
  clock,
);
assert.ok(mondayWhen && appointmentWhenHasSignal(mondayWhen));

const timeOnlyWhen = buildAppointmentWhenFromSchedulingMeaning(
  {
    date_expression: null,
    date_relation: "UNSPECIFIED",
    weekday: null,
    explicit_date: null,
    time_expression: "10 in the morning",
    time_kind: "EXACT",
    exact_time: "10:00",
    start_time: null,
    end_time: null,
    daypart: null,
  },
  clock,
);
assert.equal(timeOnlyWhen?.localTimeHm, "10:00");
const at10 = mockRecord({
  id: "t1",
  subject: "Visit",
  localStart: "2026-09-22T10:00:00-04:00",
  phone: "5715551234",
});
const at14 = mockRecord({
  id: "t2",
  subject: "Visit",
  localStart: "2026-09-22T14:00:00-04:00",
  phone: "5715551234",
});
assert.equal(
  narrowAppointmentCandidates([at10, at14], {
    ani: "5715551234",
    when: timeOnlyWhen,
  }).length,
  1,
);

const aniOnly = narrowAppointmentCandidates([johnA, johnB], { ani: "5715551111" });
assert.equal(aniOnly.length, 1);

console.log("PASS voice-v3 appointment discovery");
