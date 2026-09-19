# Voice V3 — Microsoft appointment management trace

## Tool → runtime path (nine-tool surface)

| Tool | Entry | Dispatch | Microsoft |
|------|--------|----------|-----------|
| `find_appointment` | `find-appointment-tool.ts` | `findExistingAppointment()` | `microsoft-find-existing-appointments.ts` → `listMicrosoftCalendarEvents` (calendarView) |
| `find_availability` | `find-availability-tool.ts` | `find-dispatch.ts` | `microsoft-find-availability.ts` (unchanged BOOK path) |
| `book_appointment` | `book-appointment-tool.ts` | `book-dispatch.ts` | `microsoft-create-booking.ts` (frozen; unchanged) |
| `cancel_appointment` | `cancel-appointment-tool.ts` | `cancel-dispatch.ts` | `microsoft-cancel-booking.ts` → `DELETE /me/events/{id}` |
| `reschedule_appointment` | `reschedule-appointment-tool.ts` | `reschedule-dispatch.ts` | `microsoft-update-booking.ts` → `PATCH /me/events/{id}` (start/end only) |

Shared resolver: `resolve-voice-v3-microsoft-calendar.ts` (same `config.calendar.connectionId` + Prisma `voiceCalendarConnection` as BOOK).

## Cancellation semantics

Transovo BOOK creates a **single-organizer calendar event** via `POST /me/events` (or `/me/calendars/{id}/events`) with subject + HTML body — **no attendees**, not an online meeting.

**Decision:** use Graph **`DELETE /me/events/{eventId}`** (`deleteMicrosoftEvent`), not `POST .../cancel`. The explicit cancel action is for organizer meetings with attendees/cancellation comments; our events match plain DELETE + 204.

## Reschedule semantics

**PATCH** existing event start/end only (no body/subject) to avoid stripping online-meeting metadata per Graph guidance. Same `providerEventId` after move.

## Find semantics

1. Durable in-call store (`durable-booking-store`) from prior BOOK in same process.
2. Microsoft **calendarView** on configured calendar(s), caller matched via body `Phone:` / `Email:` lines (same shape as create) or attendee email.
3. `appointment_selection_id` = `internalBookingId` — raw Graph IDs rejected at tools.

## Reschedule availability

Uses existing `find-dispatch` + `generateAvailabilitySlots` with `freeBusyOverrides` for the verified appointment interval (`find-dispatch.ts`). Revalidation uses same `fetchMicrosoftBusyIntervals` as BOOK when hooks omitted.
