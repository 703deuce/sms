# Appointments Core Scheduling Parity — Gap Audit

Audit date: 2026-09-04 (implementation pass)

| Capability | Status | Notes |
|------------|--------|-------|
| Custom booking questions | PARTIAL → EXTENDED | `BookingQuestion` type extended with full field types; stored in `AppointmentTypeConfig.bookingQuestions` |
| Multi-staff scheduling | PARTIAL → IMPLEMENTED | `BookableStaffMember` in platform config; `staffName` on appointments |
| Staff-specific availability | PARTIAL → IMPLEMENTED | Staff weekly hours/overrides in `BookableStaffMember`; engine extension point in `scheduling-domain.ts` |
| Round robin | MISSING → IMPLEMENTED | `assignStaffRoundRobin` in `scheduling-domain.ts` |
| Collective appointments | PARTIAL → IMPLEMENTED | `collectiveStaffIds` + `StaffAssignmentMode.collective` |
| Multiple locations | PARTIAL → IMPLEMENTED | `AppointmentLocation` in platform config; `locationId` on types/appointments |
| Routing | MISSING → IMPLEMENTED | `RoutingRule` + `resolveRoutingDestination` |
| Booking limits | PARTIAL → IMPLEMENTED | Extended existing min notice/horizon; added per-day/week limits in `checkBookingLimits` |
| Recurring appointments | MISSING → IMPLEMENTED | `appointment_recurring_series` table + `recurring.ts` |
| Group bookings / capacity | MISSING → IMPLEMENTED | `groupBooking` config + `checkGroupCapacity` in slot validation |
| Payments / deposits | PARTIAL → EXTENDED | `PaymentRequirement` type; Stripe wiring deferred to existing `PaymentLink` infrastructure |
| Cancellation/reschedule policies | PARTIAL → IMPLEMENTED | `evaluateCancellationPolicy` / `evaluateReschedulePolicy` |
| Staff notifications | PARTIAL → IMPLEMENTED | Via appointment workflows (`send_sms_staff` / `send_email_staff` actions) |
| Waitlist | MISSING → IMPLEMENTED | `appointment_waitlist_entries` + `waitlist.ts` |
| Google Calendar conflict sync | PARTIAL → IMPLEMENTED | `getExternalBusyIntervals` via existing `voice/calendar/providers.ts` |
| Outlook readiness | PARTIAL → PRESERVED | Provider abstraction in `CalendarProvider` type; Microsoft token refresh exists |
| Appointment notes | PARTIAL → EXTENDED | `internalNotes` array in appointment metadata |
| Timezone/DST | EXISTING — PRESERVE | Existing `timezone-slots` infrastructure unchanged |
| AI integration | IMPLEMENTED | `ai-scheduling/` service extended for staff/location/recurring intent |
| Workflows integration | IMPLEMENTED | Payment/waitlist triggers added to trigger enum |
| Shared availability engine | EXISTING — EXTENDED | `generateNativeSlots` remains source of truth; external busy times via scheduling-domain |
| Shared booking validation | EXISTING — EXTENDED | `assertSlotAvailableForBooking` now checks limits + group capacity |

## Explicitly Preserved

- SMS Playbooks, Drips, Flow Builder, Mass SMS, MCTB
- Conversations, Contacts (no rebuild)
- Existing appointment calendar, types, availability engine core
- Existing reminder worker (`appointments_platform_reminder_scan`)
- Existing booking APIs and double-booking locks
- Existing consent/compliance logic

## Requires Runtime/Browser Certification

- Full UI for staff management, locations, routing rules, payment checkout
- Google Calendar OAuth flow with live credentials
- Recurring booking UI on public booking page
- Waitlist join UI on public booking page
- Payment/deposit Stripe checkout for appointments

## Requires External Configuration

- `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` for calendar sync
- `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET` for Outlook
- `OPENAI_API_KEY` for AI natural-language booking (fallback parser works without it)
- `BREVO_API_KEY` for workflow email actions
