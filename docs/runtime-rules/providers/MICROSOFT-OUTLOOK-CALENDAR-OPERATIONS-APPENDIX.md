# Microsoft Graph — Full operations appendix (canonical connector)

**Authority:** `src/lib/calendar/providers.ts`, `src/lib/microsoft/*`, MCTB `microsoftAiBookingAdapter`.

Each operation below is **implemented** in the canonical connector. MCTB AI Booking must not call Graph except through these paths.

---

## OP-001 — List calendars

| Field | Value |
|-------|--------|
| Endpoint | `GET /v1.0/me/calendars` |
| Method | GET |
| Permission | `Calendars.ReadWrite` |
| Account types | organizational, personal |
| Headers | `Authorization: Bearer {access_token}` |
| Parameters | OData optional (`$select`, `$top`) |
| Normalized result | `ProviderCalendar[]` (`id`, `name`, `canEdit`, …) |
| Errors | `401` → reconnect; `403` → missing scopes |
| Retry | Standard Graph 429 via `graph-errors.ts` |
| Idempotency | Read — safe to repeat |
| Timezone | N/A |
| Limitations | Large tenants may paginate (`@odata.nextLink`) |
| Prohibited | LLM calendar selection |
| Docs | [List calendars](https://learn.microsoft.com/en-us/graph/api/user-list-calendars) |

**Code:** `getMicrosoftCalendars`, `listMicrosoftCalendarsForConnection`

---

## OP-002 — Free/busy via getSchedule

| Field | Value |
|-------|--------|
| Endpoint | `POST /v1.0/me/calendar/getSchedule` |
| Method | POST |
| Permission | `Calendars.ReadWrite` (delegated) |
| Account types | **organizational only** (not personal MSA) |
| Headers | `Content-Type: application/json`, `Prefer: outlook.timezone="UTC"` |
| Body | `schedules[]`, `startTime`, `endTime`, `availabilityViewInterval` (5–1440, default 30) |
| Response | `value[].scheduleItems[]` with `status`, `start`, `end` |
| Normalized result | `BusyInterval[]` (busy/tentative/oof) |
| Errors | Personal account → **do not treat as broken**; fall back to OP-003 |
| Retry | 429 + narrow window on “too many entries” |
| Idempotency | Read |
| Timezone | Request/response via `dateTimeTimeZone`; parsed to UTC `Date` |
| Prohibited | Using getSchedule for personal accounts as failure |
| Docs | [getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule) |

**Code:** `getMicrosoftBusyViaGetSchedule` ← `getMicrosoftBusy` when `canUseMicrosoftGetSchedule`

---

## OP-003 — Busy via calendarView

| Field | Value |
|-------|--------|
| Endpoint | `GET /v1.0/me/calendars/{calendarId}/calendarView` or `/me/calendarView` |
| Method | GET |
| Permission | `Calendars.ReadWrite` |
| Account types | **all** (required for personal) |
| Query | `startDateTime`, `endDateTime`, `$select=start,end,showAs`, `$top=250` |
| Headers | `Prefer: outlook.timezone="UTC"` |
| Normalized result | `BusyInterval[]` from events where `showAs` busy/tentative/oof |
| Errors | 404 calendar → configuration error |
| Retry | 429 standard |
| Idempotency | Read |
| Timezone | `parseMicrosoftGraphDateTime` |
| Limitations | Pagination for dense calendars |
| Docs | [calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview) |

**Code:** `getMicrosoftBusyViaCalendarView`

---

## OP-004 — Get single event

| Field | Value |
|-------|--------|
| Endpoint | `GET /v1.0/me/events/{eventId}` |
| Method | GET |
| Permission | `Calendars.ReadWrite` |
| Account types | all |
| Normalized result | `ProviderCalendarEvent` |
| Errors | 404 → not found |
| Docs | [Get event](https://learn.microsoft.com/en-us/graph/api/event-get) |

**Code:** `getMicrosoftCalendarEvent`

---

## OP-005 — List events (import/sync)

| Field | Value |
|-------|--------|
| Endpoint | `GET /v1.0/me/calendars/{id}/events` or calendarView variant |
| Method | GET |
| Permission | `Calendars.ReadWrite` |
| Normalized result | `ProviderCalendarEvent[]` |
| Docs | [List events](https://learn.microsoft.com/en-us/graph/api/user-list-events) |

**Code:** `listMicrosoftCalendarEvents`

---

## OP-006 — Create event (booking)

| Field | Value |
|-------|--------|
| Endpoint | `POST /v1.0/me/calendars/{calendarId}/events` or `/me/events` |
| Method | POST |
| Permission | `Calendars.ReadWrite` |
| Body | `subject`, `body`, `start`/`end` `dateTimeTimeZone`, optional `location`, `attendees`, **`transactionId`** |
| transactionId | Stable per logical booking — **idempotent create protection** (MS-IDEM-001) |
| Attendees | Only when verified email — otherwise event on business calendar only |
| Normalized result | Provider event `id` |
| Errors | 403 read-only calendar; 409 duplicate transactionId |
| Retry | Do not blind retry create without same `transactionId` |
| Timezone | `toMicrosoftDateTimeTimeZone` |
| Prohibited | Claiming “Outlook sent invite” without attendees |
| Docs | [Create event](https://learn.microsoft.com/en-us/graph/api/user-post-events) |

**Code:** `insertMicrosoftEvent` ← `bookAppointment` / MCTB orchestrator

---

## OP-007 — Update event (reschedule)

| Field | Value |
|-------|--------|
| Endpoint | `PATCH /v1.0/me/events/{eventId}` |
| Method | PATCH |
| Permission | `Calendars.ReadWrite` |
| Body | Partial `subject`, `body`, `start`, `end` |
| Normalized result | void on success |
| Errors | 404, 403 |
| Retry | Safe for PATCH with same payload |
| Prohibited | Reschedule without re-validating availability in orchestrator |
| Docs | [Update event](https://learn.microsoft.com/en-us/graph/api/event-update) |

**Code:** `updateMicrosoftEvent` — **native Graph PATCH** (not Calendly-style recreate)

---

## OP-008 — Delete event

| Field | Value |
|-------|--------|
| Endpoint | `DELETE /v1.0/me/events/{eventId}` |
| Method | DELETE |
| Permission | `Calendars.ReadWrite` |
| Normalized result | void (404 tolerated) |
| Docs | [Delete event](https://learn.microsoft.com/en-us/graph/api/event-delete) |

**Code:** `deleteMicrosoftEvent`

---

## OP-009 — Cancel event (organizer)

| Field | Value |
|-------|--------|
| Endpoint | `POST /v1.0/me/events/{eventId}/cancel` |
| Method | POST |
| Body | `{ comment }` |
| Permission | `Calendars.ReadWrite` |
| Account types | Organizer connections only |
| Normalized result | void |
| Docs | [Cancel event](https://learn.microsoft.com/en-us/graph/api/event-cancel) |

**Code:** `cancelMicrosoftEvent`, `cancelOrDeleteMicrosoftEvent`

---

## OP-010 — Mailbox timezone

| Field | Value |
|-------|--------|
| Endpoint | `GET /v1.0/me/mailboxSettings?$select=timeZone` |
| Method | GET |
| Permission | `Calendars.ReadWrite` / mailbox read |
| Normalized result | Windows timezone string |
| Docs | [mailboxSettings](https://learn.microsoft.com/en-us/graph/api/user-get-mailboxsettings) |

**Code:** `refreshMicrosoftMailboxTimezone`

---

## OP-011 — Token-backed Graph fetch (all mutations)

| Field | Value |
|-------|--------|
| Entry | `microsoftGraphFetch(connectionId, config, url, init)` |
| Behavior | Refresh lock (`withMicrosoftTokenRefreshLock`), bearer injection |
| Errors | Normalized `MicrosoftConnectorError` (`graph-errors.ts`) |
| Prohibited | Raw fetch from MCTB runtime / LLM |

---

## Capabilities & preflight (non-HTTP)

| API | Role |
|-----|------|
| `getMicrosoftCalendarCapabilities()` | Account type, getSchedule eligibility, online meeting support |
| `prepareMicrosoftBooking()` | Validates write calendar, attendee email policy, online meeting flags |

---

## Booking policy (Transovo-owned, not Graph)

Duration, buffers, notice, horizon, business hours: `VoiceService` / `getAvailability` / MCTB config — **MS-POL-001**. Graph returns busy; Transovo computes offerable slots.

---

## Definition of done

`MICROSOFT_RULEBOOK_FULL_OPERATION_APPENDIX: YES` when this appendix matches `providers.ts` and conformance audit reports `MICROSOFT_UNRESOLVED_NON_COMPLIANCE: 0`.
