# Transovo Google Calendar Integration

## API, OAuth, Scope & Engineering Reference

**Status:** Permanent engineering reference — read before implementing, maintaining, debugging, or extending the Transovo Google Calendar integration.

**API:** Google Calendar API v3  
**Product use case:** Voice V3 Appointment Receptionist (after-hours receptionist product)  
**Primary objective:** Reproduce existing Microsoft 365 scheduling capabilities using the narrowest practical Google Calendar authorization.

**Official references:** See [§62 Official Google references](#62-official-google-references).

**Related (implementation):** End-to-end build steps, frozen Microsoft rule, wizard/UI, and definition of done — `docs/GOOGLE-CALENDAR-VOICE-V3-IMPLEMENTATION-DIRECTIVE.md`. OAuth verification checklist — `docs/GOOGLE-CALENDAR-OAUTH-VERIFICATION.md`.

**Division of labor:** This file = **what Google’s API/OAuth expects**. The implementation directive = **how to wire Google into Transovo without new Astra tools or Microsoft refactors**.

---

## 1. Product requirement

Google Calendar is a **scheduling provider** underneath Transovo’s existing scheduling system.

It is **not** a new scheduling architecture.

Existing Voice V3 operations remain authoritative:

- `find_availability`
- `book_appointment`
- `find_appointment`
- `reschedule_appointment`
- `cancel_appointment`

The provider architecture should conceptually remain:

```
Caller
  ↓
Amy / GPT-Live
  ↓
Astra
  ↓
Existing Voice V3 scheduling tools
  ↓
Existing Transovo scheduling engine
  ↓
Provider abstraction
  ├── Microsoft 365
  ├── Calendly / existing providers where applicable
  └── Google Calendar  ← NEW
```

**DO NOT** create Google-specific Astra tools.

**DO NOT** expose Google API semantics to Amy.

**DO NOT** move scheduling reasoning into Google-specific code.

Google Calendar should satisfy the same normalized Transovo contracts already satisfied by Microsoft 365.

---

## 2. Google API

Use **Google Calendar API v3**.

REST base: `https://www.googleapis.com/calendar/v3`

For the initial implementation, operate against:

`calendarId = "primary"`

Google explicitly supports the special `primary` identifier for the authenticated user’s primary calendar. This lets Transovo avoid requiring CalendarList permissions simply to discover a calendar.

Initial product behavior:

```
Connect Google Calendar
        ↓
Transovo receives Calendar authorization
        ↓
Use authenticated user's primary calendar
        ↓
Amy manages appointments on that calendar
```

Do not add calendar selection unless the product actually needs it.

---

## 3. Required Calendar scope

### Recommended V1 Calendar scope

Request:

`https://www.googleapis.com/auth/calendar.events.owned`

Google defines this permission as access to see, create, change, and delete events on calendars **owned** by the user.

This scope is accepted by all core Event operations required by Transovo:

- `events.list`
- `events.get`
- `events.insert`
- `events.update`
- `events.patch`
- `events.delete`

Therefore this single scope can support the initial Transovo use case.

### Why this scope

Transovo needs to:

- READ events
- CREATE appointments
- CHANGE appointments
- DELETE appointments

It does **NOT** initially need to:

- manage calendars
- create calendars
- manage calendar subscriptions
- change sharing permissions
- manage ACLs
- access every shared calendar

Therefore do **NOT** request the broad `https://www.googleapis.com/auth/calendar` unless a future requirement actually requires it.

Also do **NOT** request these for V1 unless a documented product requirement is introduced:

- `calendar.acls` / `calendar.acls.readonly`
- `calendar.calendars` / `calendar.calendars.readonly`
- `calendar.calendarlist` / `calendar.calendarlist.readonly`
- `calendar.settings.readonly`

---

## 4. Important `events.owned` limitation

`calendar.events.owned` is intentionally narrower than `calendar.events`.

The design assumption for V1 is:

```
Connected Google account
        ↓
Authenticated user's OWNED / primary calendar
```

Do not silently expand this to arbitrary shared calendars.

If Transovo later needs:

```
Office Manager owns calendar
        ↓
Employee Google account has shared write access
        ↓
Transovo must manage that shared calendar
```

re-evaluate whether `calendar.events` is required. Do not broaden the scope preemptively.

---

## 5. OAuth requirements

Transovo already has Google OAuth infrastructure. The Calendar integration should **extend** the existing Google authorization implementation rather than create a second unrelated Google OAuth system.

Calendar access must support **unattended** calls. Amy may need Calendar access at 11:30 PM when the Google user is not logged into Transovo. Therefore authorization must support offline access.

For Google’s web-server OAuth flow, `access_type=offline` should be used when authorization must return a refresh token.

Google also recommends incremental authorization: `include_granted_scopes=true`.

Conceptual authorization request:

```typescript
const authorizationUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  include_granted_scopes: true,
  scope: [
    // Existing approved Transovo scopes
    ...existingScopes,
    // New Calendar permission
    "https://www.googleapis.com/auth/calendar.events.owned",
  ],
});
```

**IMPORTANT:** Do not overwrite an existing stored refresh token with `null` or `undefined`. Google does not necessarily return a new refresh token on every authorization/token exchange.

Token persistence should preserve the existing refresh token unless Google actually returns a replacement.

```typescript
oauth2Client.on("tokens", async (tokens) => {
  await persistGoogleTokens({
    accessToken: tokens.access_token,
    ...(tokens.refresh_token
      ? { refreshToken: tokens.refresh_token }
      : {}),
  });
});
```

Use the repository’s existing credential encryption/storage mechanism. Never store Google refresh tokens in plaintext if the existing integration encrypts provider credentials.

---

## 6. Access token refresh

Google access tokens expire. The application must not require the business owner to reconnect Google every time this happens.

```
refresh token
      ↓
Google OAuth token endpoint
      ↓
new access token
      ↓
Calendar API
```

When using Google’s supported Node client with stored credentials, token refresh can be handled by the OAuth client.

```typescript
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri,
);
oauth2Client.setCredentials({
  refresh_token: storedRefreshToken,
});
const calendar = google.calendar({
  version: "v3",
  auth: oauth2Client,
});
```

Do not implement a second independent token system if the repository already has this behavior.

---

## 7. Provider contract

Google should normalize into the existing Transovo provider model.

```typescript
interface SchedulingProvider {
  findAvailability(...): Promise<AvailabilityResult>;
  bookAppointment(...): Promise<BookingResult>;
  findAppointment(...): Promise<AppointmentLookupResult>;
  rescheduleAppointment(...): Promise<RescheduleResult>;
  cancelAppointment(...): Promise<CancelResult>;
}
```

Google-specific data must be translated at the provider boundary. The rest of Voice V3 should not care whether the provider is Microsoft, Google, Calendly, etc.

---

## 8. Find availability

### Google method

Use **Events.list**

`GET /calendar/v3/calendars/{calendarId}/events`

For V1: `calendarId = primary`

Recommended parameters:

- `timeMin`
- `timeMax`
- `singleEvents=true`
- `orderBy=startTime`
- `showDeleted=false`
- `timeZone=<business IANA timezone>`

```typescript
const response = await calendar.events.list({
  calendarId: "primary",
  timeMin: searchStart.toISOString(),
  timeMax: searchEnd.toISOString(),
  singleEvents: true,
  orderBy: "startTime",
  showDeleted: false,
  timeZone: businessTimeZone,
});
```

Google requires RFC3339 timestamps with time-zone information for `timeMin` and `timeMax`.

Examples:

- `2026-09-21T09:00:00-04:00`
- `2026-09-21T17:00:00-04:00`
- UTC: `2026-09-21T13:00:00Z`

### Important semantics

Google defines:

- **`timeMin`** = lower bound for event **end** time
- **`timeMax`** = upper bound for event **start** time

That behavior is useful because it returns events overlapping the requested window. Do not incorrectly interpret both as event-start filters.

---

## 9. Availability calculation

Google should provide **occupied** calendar events. Transovo should continue deciding which appointment slots are valid.

**Do NOT** make Google Calendar the business-hours engine.

```
Google events
      ↓
Normalize busy intervals
      ↓
Transovo scheduling rules
      ↓
Business hours, service duration, buffers, lead time,
allowed days, existing appointments, other restrictions
      ↓
Available slots
```

Example:

- Business hours: 9 AM – 5 PM
- Google: 10:00–11:00 busy, 1:00–2:00 busy
- Service: 60 minutes
- Transovo determines: 9:00, 11:00, 12:00, 2:00, 3:00, 4:00

Reuse the existing deterministic scheduling implementation.

---

## 10. Why V1 does not require FreeBusy

Google provides `POST /calendar/v3/freeBusy`, but that method requires scopes such as `calendar.freebusy` or `calendar.events.freebusy`.

**`calendar.events.owned` is NOT listed as authorization for `freeBusy.query`.**

Therefore using FreeBusy would require another Calendar permission. For V1, that is unnecessary because `events.list` already works with `calendar.events.owned` and provides the event intervals required by Transovo’s scheduling engine.

**V1 preferred:** `events.list` + `calendar.events.owned`

Do **NOT** add `calendar.freebusy` unless there is a measured product/privacy/technical reason to do so.

---

## 11. Recurring events

For availability queries use `singleEvents=true` (expands recurring events into instances). Then `orderBy=startTime` can be used.

Without `singleEvents=true`, recurring event handling will not behave the way a scheduling availability search expects.

---

## 12. Pagination

`events.list` is paginated. Google defaults to 250 events per page (max 2500). Never assume the first response contains every event.

```typescript
let pageToken: string | undefined;
const events = [];
do {
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    showDeleted: false,
    timeZone,
    pageToken,
  });
  events.push(...(response.data.items ?? []));
  pageToken = response.data.nextPageToken ?? undefined;
} while (pageToken);
```

---

## 13. Event types and busy intervals

Google Calendar can contain multiple event types (`default`, `birthday`, `focusTime`, `fromGmail`, `outOfOffice`, `workingLocation`, etc.).

Do not blindly assume every returned object should become a bookable appointment. For availability, determine whether the event blocks time based on Event resource semantics and Transovo’s scheduling policy (`status`, `transparency`, `start`, `end`, `eventType`).

Transparent events should not automatically block availability. Cancelled events should not block availability. All-day/out-of-office events must be handled intentionally.

---

## 14. Time zones

Google Calendar uses IANA time-zone identifiers (`America/New_York`, etc.). Continue using the **business scheduling time zone** as authoritative.

- Do not rely on server local time.
- Do not assume UTC equals business time.
- Do not use fixed UTC offsets instead of IANA zones (DST).

```
Caller: "tomorrow at 2"
       ↓
Transovo date/time normalization
       ↓
2026-09-21, 14:00, America/New_York
       ↓
Google API
```

---

## 15. Book appointment

### Google method

**Events.insert** — `POST /calendar/v3/calendars/{calendarId}/events`

For V1: `calendarId = primary`

Minimum required Event fields: `start`, `end`. Normally also provide `summary`, `description`, `location`, `attendees`, `extendedProperties` where appropriate.

```typescript
const response = await calendar.events.insert({
  calendarId: "primary",
  sendUpdates: "all",
  requestBody: {
    summary: serviceName,
    description: buildAppointmentDescription({
      callerName,
      callerPhone,
      serviceName,
      intake,
    }),
    start: {
      dateTime: startIso,
      timeZone: businessTimeZone,
    },
    end: {
      dateTime: endIso,
      timeZone: businessTimeZone,
    },
    attendees: callerEmail ? [{ email: callerEmail }] : undefined,
    extendedProperties: {
      private: {
        transovoAppointmentId,
        transovoWorkspaceId,
      },
    },
  },
});
```

Store Google’s returned event identifier: `const googleEventId = response.data.id` — provider truth for GET, RESCHEDULE, CANCEL, RECONCILIATION. Do not reconstruct an event ID from the title.

---

## 16. `sendUpdates`

Google supports `all` | `externalOnly` | `none` for attendee notifications. Do not use deprecated `sendNotifications`.

For normal customer appointments with an attendee email, align with existing Transovo/Microsoft scheduling policy (likely `sendUpdates: "all"` when Google should send invitation/update). Do not blindly use `none` — Google warns it can have undesirable synchronization effects. Keep behavior centralized in the provider.

---

## 17. Event metadata / extended properties

Use `extendedProperties.private` for durable Transovo correlation:

```json
{
  "extendedProperties": {
    "private": {
      "transovoAppointmentId": "appt_123",
      "transovoWorkspaceId": "ws_456",
      "transovoProvider": "google"
    }
  }
}
```

`Events.list` supports filtering: `privateExtendedProperty: ["transovoAppointmentId=${appointmentId}"]`.

Keep metadata minimal. Do not put secrets, OAuth tokens, prompts, or unnecessary caller PII in extended properties.

---

## 18. Find appointment — preferred path

If Transovo already knows the Google event ID, use **Events.get**:

```typescript
const response = await calendar.events.get({
  calendarId: "primary",
  eventId: providerEventId,
  timeZone: businessTimeZone,
});
```

This is superior to fuzzy search.

---

## 19. Find appointment — discovery path

If Transovo does not have a Google event ID, use **Events.list** with a bounded time range. Potential filters: `timeMin`, `timeMax`, `q`, `iCalUID`, `privateExtendedProperty`.

**Do NOT** allow Google free-text search to become the appointment-selection authority.

```
Google returns candidate events
       ↓
Transovo normalizes candidates
       ↓
existing deterministic appointment matching
       ↓
0 / 1 / multiple matches
       ↓
existing Voice V3 confirmation behavior
```

Preserve Microsoft appointment-management semantics.

---

## 20. Reschedule appointment

Do **NOT** delete and recreate by default. Prefer:

```
Events.get
      ↓
modify Event resource
      ↓
Events.update
```

Google recommends retrieving the event first for partial logical changes. Consider **ETags** for atomicity.

```typescript
const existing = await calendar.events.get({
  calendarId: "primary",
  eventId,
});
const updatedEvent = {
  ...existing.data,
  start: {
    dateTime: newStartIso,
    timeZone: businessTimeZone,
  },
  end: {
    dateTime: newEndIso,
    timeZone: businessTimeZone,
  },
};
const result = await calendar.events.update({
  calendarId: "primary",
  eventId,
  sendUpdates: "all",
  requestBody: updatedEvent,
});
```

In implementation, **sanitize read-only fields** as required by the Google client/API rather than blindly echoing every returned field.

---

## 21. Why not default to PATCH?

Google provides **Events.patch** (partial update). However, Google’s current API documentation states that **each patch request consumes three quota units** and recommends **get + update** instead.

**Transovo preferred reschedule:** GET event → modify start/end → UPDATE event.

Patch remains documented but is **not** the preferred Transovo implementation.

---

## 22. ETags / concurrent changes

Consider conditional updates so Transovo does not overwrite a change made in Google Calendar between GET and UPDATE.

If Google returns **412 Precondition Failed**, re-fetch, reconcile, re-apply if still valid. Do not blindly overwrite newer provider state.

---

## 23. Cancel appointment

**Events.delete** — `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}`

```typescript
await calendar.events.delete({
  calendarId: "primary",
  eventId,
  sendUpdates: "all",
});
```

Successful deletion returns an empty body. Provider call occurs only after Transovo has determined correct appointment, caller confirmation if required, and operation authorized.

---

## 24. Cancel idempotency

Cancellation should be logically idempotent (retry after success + lost response → do not surface false failure if provider truth is already cancelled). Normalize into existing cancellation/reconciliation semantics.

---

## 25. Create idempotency

Never automatically retry an ambiguous create without checking whether the first create succeeded (duplicate appointment risk). Reuse existing booking generations, OfferSets, idempotency, reconciliation, provider truth. Private extended properties can assist reconciliation.

---

## 26. Event response fields to preserve

Important fields: `id`, `etag`, `status`, `htmlLink`, `created`, `updated`, `summary`, `description`, `location`, `start`, `end`, `creator`, `organizer`, `attendees`, `recurringEventId`, `originalStartTime`, `transparency`, `visibility`, `iCalUID`, `extendedProperties`.

Retain enough for lookup, reschedule, cancel, reconciliation, debugging — not necessarily the entire response forever.

---

## 27. All-day events

Timed events use `start.dateTime` / `end.dateTime`. All-day events use `start.date` / `end.date`. Availability normalization must support both. Do not assume `event.start.dateTime` always exists.

---

## 28. Transparency

Inspect `event.transparency`. Transparent events generally should not block availability.

---

## 29. Cancelled events

For availability: `showDeleted=false`. When reconciling a known event, provider status may show cancellation already completed.

---

## 30. Recurring appointment edge cases

V1 does not need full recurring-series management. If the caller manipulates a complex recurring series Transovo did not create, fail safely or require clarification. Prefer the exact instance identified by the appointment-management contract.

---

## 31. Event creation data policy

Only business-relevant scheduling information in Google Calendar. Do **not** put Amy prompts, Astra reasoning, OAuth tokens, full transcripts, internal spam scores, or model traces into events.

---

## 32. Attendees

If caller email is available and policy expects a Google invitation: `attendees: [{ email: callerEmail }]`. Preserve Transovo required-field rules — do not force email collection for Google if Microsoft does not for the same workflow unless Google technically requires it.

---

## 33. Location

Supply `location` when the appointment/service has one. Do not invent locations for phone/virtual appointments.

---

## 34. Description

Generate descriptions **deterministically** from approved appointment information — not via LLM.

```typescript
function buildGoogleEventDescription(input) {
  return [
    "Booked by Transovo",
    input.customerName && `Customer: ${input.customerName}`,
    input.customerPhone && `Phone: ${input.customerPhone}`,
    input.serviceName && `Service: ${input.serviceName}`,
  ]
    .filter(Boolean)
    .join("\n");
}
```

---

## 35. Google Meet

`conferenceData` / `conferenceDataVersion=1` is **NOT** required for initial after-hours scheduling. Do not add Meet generation unless product requires it.

---

## 36. Calendar selection

V1: `calendarId = primary`. Do **NOT** add CalendarList scope for a selector unless product requirements change.

---

## 37. Disconnect

Disconnect must: disable Google as active scheduling provider; invalidate credentials per existing semantics; prevent future Calendar operations; preserve historical Transovo records; **never** delete the customer’s Google events because they disconnected Transovo. Reuse existing token revocation if present.

---

## 38. Connection state

UI should distinguish: NOT CONNECTED | CONNECTED | AUTHORIZATION EXPIRED / RECONNECT REQUIRED | ERROR. Do not show “Connected” merely because a credential row exists.

---

## 39. Integrations UI

Google Calendar belongs with Microsoft 365, Calendly, and other scheduling providers — same integration surface, existing production integration-card components. Do not invent a new design system.

---

## 40. Wizard integration

Where Appointment Receptionist wizard selects scheduling providers, Google appears as another provider (alongside Microsoft 365, Calendly, send booking link). Trace the Microsoft path first; Google should behave as similarly as practical.

---

## 41. Microsoft is the implementation blueprint

Before coding Google, **trace** the complete Microsoft provider path:

Integrations UI → OAuth/connect → credential persistence → provider selection → wizard save → publish → manifest/compiler → Voice V3 runtime → find → book → find existing → reschedule → cancel → normalization → reconciliation/idempotency → UI state.

Document actual repository files. Add Google at the **same provider boundary**.

**DO NOT** rewrite Microsoft. **DO NOT** introduce a new scheduling framework. **DO NOT** change proven Voice V3 tool contracts for Google.

---

## 42. Google → Transovo operation map

| Transovo | Google |
|----------|--------|
| `find_availability` | `Events.list` → normalize busy → existing slot engine |
| `book_appointment` | `Events.insert` |
| `find_appointment` | Known ID → `Events.get`; else `Events.list` → existing matching |
| `reschedule_appointment` | `Events.get` → revalidate → `Events.update` |
| `cancel_appointment` | `Events.delete` |

---

## 43. API error handling

| Code | Guidance |
|------|----------|
| **400** | Permanent request problem — do not blindly retry; normalize to configuration/request error |
| **401** | Refresh access token; if refresh fails → reconnect-required |
| **403 / 429** | Rate limits — exponential backoff within Voice V3 timeout budget |
| **403** | May be insufficient auth, calendar access, non-organizer — inspect reason |
| **404** | Reconcile provider truth for known appointments |
| **409** | Booking/idempotency — reconcile, do not duplicate |
| **410** | Deleted/expired resource — cancellation may already be satisfied |
| **412** | ETag mismatch — re-fetch, reconcile |
| **5xx** | Bounded exponential backoff |

---

## 44. Voice-call failure behavior

Normalize Google errors into existing Transovo scheduling results (availability unavailable, appointment not found, reconnect required, etc.). Amy must **not** receive raw HTTP codes, `invalid_grant`, scope names, or ETag internals.

---

## 45. Latency

During live calls: bounded time windows; no calendar enumeration; no huge historical fetches; no repeated identical GETs; no LLM interpretation of Google payloads. Preserve Microsoft timeout/cancellation policy.

---

## 46. Security

Credentials: server-side only; encrypted at rest; never browser, logs, telemetry, Amy, Astra, or prompts.

---

## 47. Logging

Safe: `provider=google`, operation, `workspaceId`, `callId`, duration, success/failure, normalized error category, `eventId` where permitted.

Never log: access/refresh tokens, auth codes, client secret, full responses with unnecessary PII.

---

## 48. API client

Reuse existing `googleapis` usage if present.

```typescript
import { google } from "googleapis";

export function createGoogleCalendarClient(credentials) {
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials({
    refresh_token: credentials.refreshToken,
    access_token: credentials.accessToken ?? undefined,
    expiry_date: credentials.expiresAt ?? undefined,
  });
  return google.calendar({ version: "v3", auth });
}
```

Adapt to existing Transovo Google OAuth — do not duplicate factories.

---

## 49. Normalized Google event

```typescript
type NormalizedGoogleEvent = {
  provider: "google";
  providerEventId: string;
  title?: string;
  start: Date;
  end: Date;
  status: "confirmed" | "tentative" | "cancelled";
  blocksAvailability: boolean;
  organizerEmail?: string;
  attendeeEmails: string[];
  etag?: string;
  htmlLink?: string;
  recurringEventId?: string;
  transovoAppointmentId?: string;
};
```

---

## 50. Availability normalization example

```typescript
function googleEventBlocksAvailability(event): boolean {
  if (event.status === "cancelled") return false;
  if (event.transparency === "transparent") return false;
  return true;
}
```

Also handle all-day events, recurring instances, missing times, and special event types per scheduling policy.

---

## 51. Book example — complete conceptual flow

```typescript
async function bookGoogleAppointment(input) {
  // 1. Existing Transovo logic has already:
  //    - resolved service, caller, slot
  //    - revalidated availability
  //    - established idempotency
  const calendar = await getGoogleCalendarForWorkspace(input.workspaceId);
  const response = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: input.sendGuestUpdates ? "all" : "none",
    requestBody: {
      summary: input.serviceName,
      description: buildGoogleAppointmentDescription(input),
      start: {
        dateTime: input.startIso,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.endIso,
        timeZone: input.timeZone,
      },
      attendees: input.customerEmail
        ? [{ email: input.customerEmail }]
        : undefined,
      extendedProperties: {
        private: {
          transovoAppointmentId: input.appointmentId,
          transovoWorkspaceId: input.workspaceId,
        },
      },
    },
  });
  if (!response.data.id) {
    throw new Error("GOOGLE_EVENT_ID_MISSING");
  }
  return {
    provider: "google",
    providerEventId: response.data.id,
    status: "confirmed",
    start: response.data.start,
    end: response.data.end,
  };
}
```

Architectural example only — adapt to actual Transovo types and provider abstractions.

---

## 52. Reschedule example

```typescript
async function rescheduleGoogleAppointment(input) {
  const calendar = await getGoogleCalendarForWorkspace(input.workspaceId);
  const current = await calendar.events.get({
    calendarId: "primary",
    eventId: input.providerEventId,
  });
  const updated = sanitizeGoogleEventForUpdate(current.data);
  updated.start = {
    dateTime: input.newStartIso,
    timeZone: input.timeZone,
  };
  updated.end = {
    dateTime: input.newEndIso,
    timeZone: input.timeZone,
  };
  const response = await calendar.events.update({
    calendarId: "primary",
    eventId: input.providerEventId,
    sendUpdates: "all",
    requestBody: updated,
  });
  return normalizeGoogleEvent(response.data);
}
```

Do not remove existing attendees/metadata accidentally. Do not update before Transovo’s existing slot revalidation succeeds.

---

## 53. Cancel example

```typescript
async function cancelGoogleAppointment(input) {
  const calendar = await getGoogleCalendarForWorkspace(input.workspaceId);
  await calendar.events.delete({
    calendarId: "primary",
    eventId: input.providerEventId,
    sendUpdates: "all",
  });
  return {
    provider: "google",
    providerEventId: input.providerEventId,
    status: "cancelled",
  };
}
```

Normalize already-deleted/provider-truth cases through existing reconciliation logic.

---

## 54. Find availability example

```typescript
async function listGoogleCalendarEvents(input) {
  const calendar = await getGoogleCalendarForWorkspace(input.workspaceId);
  const events = [];
  let pageToken: string | undefined;
  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: input.windowStartIso,
      timeMax: input.windowEndIso,
      timeZone: input.timeZone,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      pageToken,
    });
    events.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return events
    .map(normalizeGoogleEvent)
    .filter((event) => event.blocksAvailability);
}
```

Then pass normalized occupied intervals into the existing Transovo availability engine.

---

## 55. Do not build (V1)

ACL management, calendar create/delete/share, subscriptions, Google Meet, push channels, full/incremental sync DB, CalendarList selector UI, Tasks, Gmail, Contacts, Drive, domain-wide delegation, recurring-series management UI — unless product explicitly requires.

---

## 56. Google OAuth verification scope explanation

Suggested reviewer text for `calendar.events.owned`:

> Transovo is an AI receptionist platform for businesses. A business can connect its Google Calendar so its AI receptionist can check existing calendar events for scheduling conflicts and create, reschedule, or cancel customer appointments while handling calls. Transovo requests `calendar.events.owned` because the application needs to view and manage events on Google calendars owned by the connected business user. The permission is used only for appointment scheduling functionality. Transovo does not require permission to manage calendar sharing, ACLs, or the user's Google Calendar account configuration.

Keep submission consistent with implementation.

---

## 57. Google review video requirement

Video should show: Transovo → Connect Google Calendar → OAuth consent with **exact** Calendar permission visible → return to Transovo. Provide additional demonstration only if Google requests it.

---

## 58. Limited use / AI data handling

Privacy policy must match Google API Services User Data / Limited Use requirements. Send only data necessary for scheduling through Voice V3 — not full calendars or unnecessary history to models. Do not use Google Calendar data to train generalized models.

---

## 59. Implementation order

1. Audit existing Google OAuth  
2. Audit Integrations UI  
3. Trace Microsoft scheduling end-to-end  
4. Document provider boundary  
5. Add `calendar.events.owned` to Calendar connect  
6. Integration card/state  
7. Persist credentials (existing system)  
8. Authenticated Calendar client  
9. `events.list` normalization → `find_availability`  
10. `events.insert` → `book_appointment`  
11. `events.get`/`list` → `find_appointment`  
12. GET + UPDATE → `reschedule_appointment`  
13. `events.delete` → `cancel_appointment`  
14. Disconnect/reconnect  
15. Wizard provider selection  
16. Preserve Microsoft behavior  
17. Provider contract tests  
18. Browser OAuth QA  
19. Real Google CRUD  
20. Voice V3 against Google  
21. OAuth scope-review submission  

---

## 60. Required provider test matrix

**CONNECT:** auth completes, refresh retained, connected UI, refresh without user present  

**AVAILABILITY:** empty, one/many busy, recurring, all-day, transparent, TZ/DST, pagination  

**BOOK:** created, start/end/TZ, provider ID + metadata, attendee behavior, duplicate prevention  

**FIND:** by provider ID, extended property, bounded lookup, 0/1/many candidates  

**RESCHEDULE:** same event ID, slots, attendees/metadata retained, concurrency (412)  

**CANCEL:** deleted, reconciled, repeated cancel safe, notifications  

**AUTH:** expired access, refresh success, revoked refresh, reconnect state  

**ERRORS:** 400, 401, 403, 404, 409, 410, 412, 429, 5xx  

---

## 61. Source-of-truth principle

When uncertain:

1. Current official Google Calendar API documentation  
2. Installed Google client-library types/version  
3. Existing Transovo provider architecture  
4. **This guide**  

If Google changes the API, update this guide with the implementation. Do not rely on stale blog posts over current Google docs.

---

## 62. Official Google references

- Authorization/scopes: https://developers.google.com/workspace/calendar/api/auth  
- Events.list: https://developers.google.com/workspace/calendar/api/v3/reference/events/list  
- Events.get: https://developers.google.com/workspace/calendar/api/v3/reference/events/get  
- Events.insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert  
- Events.update: https://developers.google.com/workspace/calendar/api/v3/reference/events/update  
- Events.patch: https://developers.google.com/workspace/calendar/api/v3/reference/events/patch  
- Events.delete: https://developers.google.com/workspace/calendar/api/v3/reference/events/delete  
- FreeBusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query  
- Create events guide: https://developers.google.com/workspace/calendar/api/guides/create-events  
- Extended properties: https://developers.google.com/workspace/calendar/api/guides/extended-properties  
- Concepts/time zones: https://developers.google.com/workspace/calendar/api/concepts/events-calendars  
- Errors: https://developers.google.com/workspace/calendar/api/guides/errors  
- OAuth web server: https://developers.google.com/identity/protocols/oauth2/web-server  

---

## 63. Final V1 design

| Dimension | Choice |
|-----------|--------|
| Scope | **One:** `calendar.events.owned` |
| Calendar | **One default:** `primary` |
| Google operations | `events.list`, `events.insert`, `events.get` + `events.update`, `events.delete` |
| Transovo operations | `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment` |

**Google owns:** calendar event persistence.  
**Transovo owns:** business rules, availability, durations, buffers, date interpretation, intake, matching, confirmation, OfferSets, generations, idempotency, reconciliation, provider truth, voice behavior, notifications, analytics.

The Google Calendar integration must remain a **provider adapter** underneath the proven Transovo scheduling system. Do not redesign the scheduling architecture.

---

## Repository touchpoints (audit starting points)

When tracing Microsoft-as-blueprint or existing Google code, start here (evidence only — this guide is authority for **target** V1 design):

| Area | Path |
|------|------|
| Calendar providers (REST) | `src/lib/calendar/providers.ts` |
| Calendar OAuth | `src/lib/calendar/oauth.ts`, `src/lib/voice/calendar/oauth.ts` |
| Voice calendar booking | `src/lib/voice/calendar/booking.ts` |
| Integrations UI | `src/features/integrations/kimi/calendars/` |
| Wizard provider option | `src/components/solutions/appointment-receptionist/steps/appointments-step.tsx` |

**Note:** Legacy code may still use broad `calendar` scope or `freeBusy` — migrating to this guide is intentional V1 work, not a reason to ignore this document.

---

*End of guide.*
