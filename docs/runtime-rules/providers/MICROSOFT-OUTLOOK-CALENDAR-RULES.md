# MICROSOFT 365 / OUTLOOK CALENDAR PROVIDER RULESET — TRANSOVO MCTB AI BOOKING

**Authority:** Deterministic orchestrator + canonical Microsoft OAuth/Graph connector (`src/lib/calendar/providers.ts`, `microsoftGraphFetch`).  
**LLM agents never call Microsoft Graph.**

Official references:

- [Graph v1.0 overview](https://learn.microsoft.com/en-us/graph/overview)
- [OAuth 2.0 auth code flow](https://learn.microsoft.com/en-us/graph/auth-v2-user)
- [Calendars.ReadWrite](https://learn.microsoft.com/en-us/graph/permissions-reference#calendars-permissions)
- [getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule)
- [findMeetingTimes](https://learn.microsoft.com/en-us/graph/api/user-findmeetingtimes)
- [calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview)
- [Create event](https://learn.microsoft.com/en-us/graph/api/user-post-events)
- [Update event](https://learn.microsoft.com/en-us/graph/api/event-update)
- [Cancel event](https://learn.microsoft.com/en-us/graph/api/event-cancel)
- [transactionId](https://learn.microsoft.com/en-us/graph/api/resources/event)
- [Throttling](https://learn.microsoft.com/en-us/graph/throttling)

---

## Architecture — MS-ARCH-001

```
SMS → Intent Router → Scheduling Specialist → orchestrator
  → microsoftAiBookingAdapter → voice/calendar/booking.ts
  → calendar/providers.ts (microsoftGraphFetch) → Graph v1.0
```

| Layer | Graph access? |
|--------|----------------|
| LLM agents | **No** |
| MCTB orchestrator | **No** (adapter only) |
| `microsoftGraphFetch` | **Yes** (canonical) |

---

## API version — MS-API-001

Production AI Booking uses **Microsoft Graph v1.0** (`MICROSOFT_GRAPH_V1`). No beta for booking mutations unless explicitly approved.

---

## OAuth — MS-AUTH-001 … MS-AUTH-004

| Item | Rule |
|------|------|
| App | Reuse `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, existing callback |
| Scopes | `openid profile email offline_access User.Read Calendars.ReadWrite` (`oauth-config.ts`) |
| `offline_access` | Required for refresh token — without it: `CONNECTED_NO_REFRESH` |
| Refresh | `refreshMicrosoftAccessToken` — store new refresh when returned |
| Token lock | `withMicrosoftTokenRefreshLock` per connection (`providers.ts`) |

Shared calendars (if product enables): `Calendars.ReadWrite.Shared` — not default.

---

## Account types — MS-ACCT-001

| Type | Detection | Implications |
|------|-----------|--------------|
| `organizational` | tenant ≠ personal MSA tenant | `getSchedule`, `findMeetingTimes` (delegated) |
| `personal` | tenant `9188040d-6c67-4c5b-b112-36a304b66dad` | **No** delegated `getSchedule` |
| `unknown` | missing metadata | Do not assume work features |

Code: `inferMicrosoftAccountType`, `canUseMicrosoftGetSchedule`, `getMicrosoftCalendarCapabilities`.

---

## Connection health — MS-CONN-001

States: `CONNECTED`, `CONNECTED_MISSING_SCOPES`, `CONNECTED_NO_REFRESH`, `NEEDS_RECONNECT`, `CALENDAR_NOT_SELECTED`, `CALENDAR_READ_ONLY`, `AI_BOOKING_READY`, `AI_BOOKING_PARTIAL`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`.

**Do not** show “AI Booking Ready” for OAuth alone.

---

## Calendars — MS-CAL-001

| Operation | Endpoint | Scope |
|-----------|----------|--------|
| List | `GET /me/calendars` | Calendars.ReadWrite |
| Write target | `POST /me/calendars/{id}/events` or `/me/events` | Calendars.ReadWrite |

MCTB config selects **connection** + **write calendar** (`writeCalendarId` / `resolveWriteCalendarId`). LLM does not pick calendars.

`canEdit` must be true for direct booking.

---

## Availability — MS-AVL-001 … MS-AVL-004

**Microsoft is a calendar, not a booking product.** Transovo owns **booking policy** (duration, buffers, notice, horizon, business hours via `VoiceService` / `getAvailability`).

| Source | When |
|--------|------|
| `POST /me/calendar/getSchedule` | Work/school + SMTP known (`getMicrosoftBusyViaGetSchedule`) |
| `GET .../calendarView` | Personal accounts, specific calendar id, or getSchedule unavailable |

**Prohibited:** LLM arithmetic on slots; offering times without deterministic slot generator (`computeFreeSlots` + policy).

`getSchedule` interval: 5–1440 minutes (default 30). Narrow window on “too many entries” errors.

`findMeetingTimes`: optional enhancement for multi-attendee — **not** required for one-calendar MCTB launch (`canFindMeetingTimes` = organizational only).

---

## Booking policy — MS-POL-001

Configured via existing voice/MCTB fields:

- `durationMinutes`, `minimumBookingNoticeMinutes`, `bookingHours`, `maxDaysAhead`, `timezone`, `serviceName`
- Stored in workspace / `VoiceService` — **not** invented by LLM

---

## Create event — MS-EVT-001

| Field | Rule |
|-------|------|
| Endpoint | `POST /me/calendars/{calendarId}/events` when configured |
| Permission | `Calendars.ReadWrite` |
| `transactionId` | Stable per logical booking (`insertMicrosoftEvent`) — **MS-IDEM-001** |
| Attendees | Only with verified email — MS-ATT-001 |
| Without attendee | Event on business calendar only — do not claim “Microsoft sent invite” |

Preflight: `prepareMicrosoftBooking()` (`microsoft/booking-preflight.ts`).

---

## Reschedule — MS-UPD-001

Native Graph **`PATCH /me/events/{id}`** after availability revalidation. Emit `BOOKING_RESCHEDULED` only after Graph success.

(Calendly contrast: no native reschedule API.)

---

## Cancel — MS-CAN-001

Organizer: `POST /me/events/{id}/cancel` (`cancelMicrosoftEvent`). Attendee-only connections must not use organizer cancel.

---

## Online meetings — MS-OLM-001

Before `isOnlineMeeting: true`, verify calendar `allowedOnlineMeetingProviders`. Read `onlineMeeting.joinUrl` after create — never invent Teams links. Online meeting state is not freely reversible after creation.

---

## Timezone — MS-TZ-001

Graph uses `dateTimeTimeZone` (`toMicrosoftDateTimeTimeZone`). Centralize Windows ↔ IANA mapping; server-side only.

---

## Subscriptions / delta — MS-SYNC-001

Outlook event subscriptions max ~7 days — renew (`outlookEventSubscriptionExpiration`). Delta via `calendarView/delta` for sync; **not** final truth for booking mutation.

---

## Throttling — MS-RATE-001

Outlook limits (~10k req / 10 min / app / mailbox, concurrency ~4). Map `429` → `MICROSOFT_RATE_LIMITED` (`graph-errors.ts`). Honor `Retry-After`. No LLM retry storms.

---

## Error normalization — MS-ERR-001

Codes in `MicrosoftConnectorError`. Never expose raw Graph JSON in SMS.

---

## Normalized adapter methods — MS-ADP-001

| Method | Implementation |
|--------|----------------|
| `getCapabilities()` | `getMicrosoftCalendarCapabilities` |
| `findAvailability()` | `getAvailability` / `getMicrosoftBusy` |
| `createBooking()` | `bookAppointment` → `insertMicrosoftEvent` |
| `getBooking()` | `getMicrosoftEvent` / local appointment row |
| `updateBooking()` | `updateMicrosoftEvent` |
| `cancelBooking()` | `cancelMicrosoftEvent` |
| `prepareMicrosoftBooking()` | preflight |

**Blocked from AI runtime:** create/delete calendar, mailbox settings writes, calendar groups.

---

## Source of truth — MS-RULE-097

| Microsoft Graph | Transovo |
|-----------------|----------|
| Busy/free, events, writes, invites | Booking policy, session, config, fallback, activities |
| LLM | Phrasing only — **nothing consequential** |

---

## Definition of done — MS-DONE-098

See `MICROSOFT-CALENDAR-CONNECTOR-CONFORMANCE-AUDIT.md`.
