# CALENDLY BOOKING PROVIDER RULESET — TRANSOVO MCTB AI BOOKING

**Authority:** Deterministic booking orchestrator + canonical Calendly OAuth connector.  
**LLM agents (Intent Router, Scheduling Specialist) never call Calendly.**

Official references (maintain links in implementation PRs):

- [API introduction](https://developer.calendly.com/docs/api-docs/calendly-api/overview)
- [OAuth & scopes](https://developer.calendly.com/docs/authentication/scopes)
- [Refresh token rotation](https://developer.calendly.com/docs/authentication/refresh-token-rotation-guide)
- [Schedule events with AI agents](https://developer.calendly.com/docs/api-guides/schedule-events-with-ai-agents)
- [Event type available times](https://developer.calendly.com/api-docs/calendly-api/event-types/event-type-available-times)
- [Create event invitee](https://developer.calendly.com/api-docs/calendly-api/scheduled-events/create-event-invitee)
- [Cancel event](https://developer.calendly.com/api-docs/calendly-api/scheduled-events/cancel-event)
- [Reschedule webhook semantics](https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events)
- [Rate limits](https://developer.calendly.com/api-docs/overview/rate-limits)

---

## Architecture boundary — CAL-ARCH-001

| Layer | May call Calendly API? |
|--------|-------------------------|
| Intent Router | **No** |
| Scheduling Specialist | **No** |
| MCTB AI Booking orchestrator | **No** (calls adapter only) |
| `calendlyAiBookingAdapter` | **No** (calls `calendly-actions` / connector) |
| `calendly-actions` + `calendly-client` | **Yes** (canonical path) |

Runtime flow:

`SMS → Router → Specialist → orchestrator → MCTB Calendly adapter → calendly-actions → calendly-client → Calendly API`

---

## API version — CAL-API-001

- Base URL: `https://api.calendly.com` (REST v2 only).
- Reuse existing Transovo Calendly OAuth app — no second client, no PAT for customer workspaces.

---

## Authentication — CAL-AUTH-001 … CAL-AUTH-004

### CAL-AUTH-001 OAuth

| Field | Value |
|--------|--------|
| Authorize | `https://auth.calendly.com/oauth/authorize` |
| Token | `https://auth.calendly.com/oauth/token` |
| Client | `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET` (existing env) |
| Storage | `integrationConnection` (encrypted tokens) |

### CAL-AUTH-002 Minimum scopes (AI Booking)

| Scope | Purpose |
|--------|---------|
| `users:read` | `GET /users/me` |
| `event_types:read` | List/detail event types |
| `availability:read` | Availability schedules / bookable slots |
| `scheduled_events:read` | Events + invitees |
| `scheduled_events:write` | `POST /invitees`, cancel |

Optional: `scheduling_links:write`, `shares:write`, `webhooks:read`, `webhooks:write`.

**Not required for AI Booking:** `event_types:write`, `availability:write`, `contacts:write`.

### CAL-AUTH-003 Refresh token rotation

After successful `POST /oauth/token` with `grant_type=refresh_token`:

1. Store **new** access token **and** new refresh token atomically.
2. Never reuse a refresh token that already succeeded.
3. Use per-connection refresh lock (`token-refresh-lock.ts`).
4. On `invalid_grant`, re-read connection (another worker may have rotated); else `needs_reauth`.

### CAL-AUTH-004 Connection health states

`CONNECTED` | `CONNECTED_MISSING_SCOPES` | `NEEDS_RECONNECT` | `PLAN_BLOCKED` | `RATE_LIMITED` | `PROVIDER_UNAVAILABLE`

Implemented: `getCalendlyCapabilities()` in `calendly-capabilities.ts`.

---

## Operation catalog (template)

Each operation below is the contract for connector + MCTB runtime. Code must not guess beyond this.

---

### CAL-USER-001 — Get current user

| | |
|--|--|
| **Purpose** | Stable user/org/timezone discovery |
| **Endpoint** | `GET /users/me` |
| **Scope** | `users:read` |
| **Plan** | Any connected account |
| **Success fields** | `resource.uri`, `current_organization`, `timezone`, `scheduling_url`, `email`, `name` |
| **Normalized** | Persist on integration metadata; do not call every SMS turn |
| **Prohibited** | Exposing tokens to UI/LLM |
| **Code** | `calendly-actions.getMe`, `calendlyAdapter.validateConnection` |

**Example (normalized):**

```json
{ "userUri": "https://api.calendly.com/users/…", "organizationUri": "https://api.calendly.com/organizations/…", "timezone": "America/New_York" }
```

---

### CAL-EVT-001 — List event types

| | |
|--|--|
| **Endpoint** | `GET /event_types?user={userUri}&active=true` |
| **Scope** | `event_types:read` |
| **Pagination** | `page_token` cursor — no offset assumptions |
| **Normalized** | `listCalendlyEventTypes()` → `NormalizedCalendlyEventType[]` |
| **MCTB** | Setup picker only; LLM does not browse types |

### CAL-EVT-002 — Get event type

| | |
|--|--|
| **Endpoint** | `GET /event_types/{uuid}` |
| **Use** | Duration, locations, custom questions, active flag |
| **Code** | `getEventTypeDetail()`, `isEventTypeAiBookable()` |

### CAL-EVT-003 — Event type selection (product)

One configured `eventTypeUri` per MCTB AI Booking config (`customFieldsConfig.mctb.aiBooking`). Runtime resolves config — not LLM.

---

### CAL-AVL-001 — Bookable slots (authoritative)

| | |
|--|--|
| **Endpoint** | `GET /event_type_available_times` |
| **Query** | `event_type` (full URI), `start_time`, `end_time` (ISO-8601 UTC, future) |
| **Scope** | `availability:read` + `event_types:read` |
| **Plan** | Per Calendly account |
| **Prohibited** | Inferring slots from working hours, busy times, or cache alone |
| **Normalized** | `MctbBookingSlot` via adapter; only returned starts may be offered |
| **Code** | `listEventTypeAvailableTimes()`, `buildCalendlyAvailabilityRequest()` |

**Retry:** 429 → backoff using `X-RateLimit-Reset` (GET only).

### CAL-AVL-002 — Maximum window 31 days

If customer window > 31 days: split queries in `buildCalendlyAvailabilityRequest` or ask to narrow.

### CAL-AVL-003 — User availability schedules (non-authoritative)

`GET /user_availability_schedules` — diagnostics/setup only, not customer slot truth.

### CAL-AVL-004 — User busy times (diagnostics)

`GET /user_busy_times` — max 7-day range; conflict diagnostics only.

---

### CAL-BKG-001 — Direct booking (Create invitee)

| | |
|--|--|
| **Endpoint** | `POST /invitees` |
| **Scope** | `scheduled_events:write` |
| **Plan** | Standard+ (403 on free — `CALENDLY_PLAN_REQUIRED`) |
| **Required body** | `event_type`, `start_time` (UTC), `invitee` (`email`, `name`, `timezone`) |
| **Conditional** | `location`, `questions_and_answers` per event type |
| **Idempotency** | Transovo operation identity — **no blind retry** on timeout (CAL-BKG-004) |
| **Rate limits** | Stricter than global API (see CAL-RATE-002) |
| **Code** | `prepareCalendlyBooking()` then `bookEventInvitee()` |

**AI agent sequence (Calendly docs):** event type → available times → customer choice → `POST /invitees` → confirmation URLs.

### CAL-BKG-002 — Booking confirmation

Emit `BOOKING_CONFIRMED` only after Calendly success. Persist `inviteeUri`, `eventUri`, `cancel_url`, `reschedule_url`.

### CAL-BKG-003 — Required invitee data

Do not fabricate email. Missing email → conversational collect + session persist.

### CAL-BKG-004 — Idempotency / ambiguous POST

On network timeout after `POST /invitees`: reconcile via scheduled events / invitee lookup before retry.

---

### CAL-RSC-001 — Reschedule (limitation)

**There is no native Calendly API to change event time in one call.**

| Policy | Behavior |
|--------|----------|
| **A (default)** | Return `reschedule_url` from invitee — customer uses Calendly UI |
| **B (optional)** | Transovo replacement: book new slot → on success cancel old (not native reschedule) |

Connector: `getAppointment().rescheduleUrl` — **no** `rescheduleBooking()` pretending to be native.

### CAL-CAN-001 — Cancel

`POST /scheduled_events/{uuid}/cancellation` — `cancelAppointment()` in `calendly-actions.ts`.

---

### CAL-LNK-001 — Standard booking link

Use `scheduling_url` on event type or configured MCTB booking link.

### CAL-LNK-002 — Single-use scheduling link

`POST /scheduling_links` — scope `scheduling_links:write` — `createSingleUseSchedulingLink()`.

### CAL-LNK-003 — Customized share

`POST /shares` — scope `shares:write` — not used for normal AI direct booking.

---

### CAL-WHK-001 — Webhooks

Subscribe: `invitee.created`, `invitee.canceled` (+ optional no-show).

### CAL-WHK-002 — Reschedule semantics

Native reschedule → `invitee.canceled` with `rescheduled=true` **and** `invitee.created` for new invitee. Link via `old_invitee` / `new_invitee`. Do not double-count as unrelated cancel + new lead.

**Code:** `calendlyAdapter.normalizeWebhook` treats canceled+rescheduled as `appointment.rescheduled`.

### CAL-WHK-003 — Idempotency

Dedupe by stable invitee/event URI — no duplicate activities or SMS.

---

### CAL-RATE-001 — General API limits

User-based limits (see official docs). Honor `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### CAL-RATE-002 — Create invitee limits (documented)

Paid non-Enterprise (indicative): 10/min, 50/hour, 100/day per user. Enterprise higher. Connector must map 429 → `CALENDLY_RATE_LIMITED`.

### CAL-RATE-003 — Retry matrix

| Status | Action |
|--------|--------|
| 401 | One refresh, then reconnect |
| 403 scope | No retry — reconnect |
| 403 plan | No retry — booking link fallback |
| 429 | Backoff |
| 5xx GET | Bounded retry |
| 5xx/timeout POST /invitees | Reconcile first |

---

## Normalized connector methods — CAL-CONN-002

| Method | Implementation |
|--------|----------------|
| `getIdentity()` | `/users/me` |
| `listBookableTargets()` | `listCalendlyEventTypes` |
| `getBookableTarget()` | `getEventTypeDetail` |
| `findAvailability()` | `listEventTypeAvailableTimes` |
| `prepareCalendlyBooking()` | preflight |
| `createBooking()` | `bookEventInvitee` |
| `getBooking()` | `getAppointment` |
| `cancelBooking()` | `cancelAppointment` |
| `getRescheduleLink()` | invitee `reschedule_url` |
| `createSingleUseLink()` | `createSingleUseSchedulingLink` |
| `healthCheck()` | `getCalendlyCapabilities` |

**No** native `rescheduleBooking()` API.

---

## Error normalization — CAL-ERR-001

Codes in `CalendlyConnectorError` (`calendly-client.ts`). Customer SMS never receives raw Calendly JSON.

---

## Absolute runtime rule — CAL-RULE-065

| Source of truth | Owns |
|-----------------|------|
| **Calendly** | Availability, booking creation, event/cancel state, native reschedule linkage |
| **Transovo** | Conversation, AI Booking session, config, fallback, activities |
| **LLM** | Intent + phrasing only — **nothing consequential** |

---

## Definition of done — CAL-DONE-066

See `CALENDLY-CONNECTOR-CONFORMANCE-AUDIT.md` final report flags.
