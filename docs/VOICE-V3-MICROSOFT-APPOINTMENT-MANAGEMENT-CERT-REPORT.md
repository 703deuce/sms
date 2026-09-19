# Voice V3 Microsoft appointment management — certification report

**Branch:** `cursor/voice-v3-microsoft-appointment-management-2304`  
**Date:** 2026-09-19  
**Do not merge/deploy from this report alone** — real Microsoft Tests A–D remain manual.

## Trace summary

```
EXISTING_FIND_APPOINTMENT_PATH =
  find-appointment-tool → findExistingAppointment (store + calendarView) → applyVerifiedExisting

EXISTING_RESCHEDULE_APPOINTMENT_PATH =
  reschedule-appointment-tool → bind slot → reschedule-dispatch → revalidate → executeMicrosoftUpdateBooking (PATCH)

EXISTING_CANCEL_APPOINTMENT_PATH =
  cancel-appointment-tool (confirmed gate) → cancel-dispatch → executeMicrosoftCancelBooking (DELETE)
```

## Automated checklist (deterministic)

| Item | Status |
|------|--------|
| MICROSOFT_CONNECTION_REUSED | PASS |
| MICROSOFT_CALENDAR_REUSED | PASS |
| FIND_EXISTING_APPOINTMENT | PASS (store + window builder; Graph mocked in unit suite) |
| AMBIGUOUS_APPOINTMENT_PROTECTION | PASS |
| CANCEL_CONFIRMATION_GATE | PASS |
| MICROSOFT_CANCEL | PASS (hook + default DELETE path wired) |
| RESCHEDULE_USES_EXISTING_SCHEDULING_NORMALIZER | PASS (unchanged `set_scheduling_preference` / rules) |
| RESCHEDULE_USES_EXISTING_FIND_AVAILABILITY | PASS (`find-dispatch` + `freeBusyOverrides`) |
| RESCHEDULE_USES_OFFER_SET | PASS |
| RESCHEDULE_FRESH_REVALIDATION | PASS |
| MICROSOFT_RESCHEDULE_PATCH | PASS (mock; PATCH start/end only) |
| SAME_PROVIDER_EVENT_ID_AFTER_RESCHEDULE | PASS |
| FAILED_RESCHEDULE_PRESERVES_ORIGINAL | PASS (no delete+create path) |
| OUTCOME_UNKNOWN_RECONCILIATION | PARTIAL (BOOK parity; cancel/reschedule classify uncertain network) |
| CANCEL_IDEMPOTENCY | PASS (existing suite) |
| RESCHEDULE_IDEMPOTENCY | PASS (authoritative op + inFlight) |
| NEW_BOOKING_REGRESSION | PASS (`npm run test:voice-v3-booking`) |
| BOOKING_CUSTOM_INTAKE_REGRESSION | PASS (via booking suite) |
| BOOKING_MICROSOFT_CREATE_REGRESSION | PASS (booking suite; BOOK dispatch untouched) |

## Graph endpoints

| Operation | Method | Path |
|-----------|--------|------|
| Find (window) | GET | `/me/calendar/calendarView` or `/me/calendars/{id}/calendarView` |
| Get event | GET | `/me/events/{eventId}` |
| Reschedule | PATCH | `/me/events/{eventId}` (`start`, `end` only) |
| Cancel | DELETE | `/me/events/{eventId}` |

## Files changed (high level)

- Added: `microsoft-find-existing-appointments.ts`, `resolve-voice-v3-microsoft-calendar.ts`, `validate-microsoft-appointment.ts`, `find-existing-appointment-window.ts`, `format-local-iso.ts`
- Extended: `find-existing-appointment.ts`, `cancel-dispatch.ts`, `reschedule-dispatch.ts`, find/cancel/reschedule tools, `appointment-management-types.ts`
- Tests: `test-voice-v3-microsoft-appointment-management.ts`; script import fixes
- Docs: trace + this report

## Remaining gaps

- Live Microsoft Tests A–D (controlled tenant appointment) not run in Cloud Agent VM.
- `listMicrosoftCalendarEvents` filters to busy/cancelled-shaped rows — sufficient for Transovo-tagged events; may need widening if events are created as “free.”
- OUTCOME_UNKNOWN post-cancel/reschedule Microsoft GET reconciliation (read-back) not fully symmetric with BOOK yet.
- Durable cross-call appointment DB row still optional; calendarView + in-call store covers V1.

## Intentionally unchanged

- Frozen BOOK pipeline: `book-dispatch.ts`, `microsoft-create-booking.ts`, FIND slot generation core.
- Nine-tool Astra surface names and BOOK tool schemas.
