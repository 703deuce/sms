# Voice V3 — Google Calendar reuse audit (no implementation)

**Date:** 2026-09-21  
**Purpose:** Find existing Google Calendar code, compare to the **current** Voice V3 Microsoft provider contract, and define the **minimal** adapter work to connect Google to production Voice V3 — without resurrecting legacy voice orchestration.

**Production architecture (unchanged):** Telnyx PSTN → LiveKit → GPT-Live-1 + delegated Sol → FunctionTools → Node `src/lib/voice-v3/**` → calendar provider → structured tool result → continuation.

**Conclusion up front:** Transovo already has **substantial Google OAuth + Calendar API** implementation in shared `src/lib/calendar/**` (and legacy consumers). Voice V3 has **zero** Google imports under `src/lib/voice-v3/**`. The gap is **not** “build Google from scratch”; it is **strategy/compiler/dispatch wiring + thin V3 executor modules** mirroring the existing Microsoft V3 pattern, plus wizard/booking-strategy enum alignment.

---

## 1. EXISTING GOOGLE IMPLEMENTATION FOUND

### 1.1 Canonical shared calendar layer (production — reuse target)

| Path | Symbols / capability | Status |
|------|----------------------|--------|
| `src/lib/calendar/providers.ts` | `getValidAccessToken` (google refresh via `refreshGoogle`), `getGoogleBusy` (freeBusy), `getGoogleCalendars`, `listGoogleCalendarEvents`, `getGoogleCalendarEvent`, `insertGoogleEvent`, `updateGoogleEvent`, `deleteGoogleEvent`, `computeFreeSlots`, `CalendarConfig`, `resolveWriteCalendarId`, `resolveBlockingCalendarIds` | **Production** — provider-neutral calendar API |
| `src/lib/calendar/oauth.ts` | `getGoogleOAuthStartUrl`, `completeGoogleOAuth`, `parseOAuthState`, redirects; stores tokens on `voiceCalendarConnection` | **Production** |
| `src/lib/calendar/constants.ts` | `GOOGLE_OAUTH_CALLBACK_PATH` = `/api/integrations/calendars/oauth/google/callback`; legacy `/api/voice/calendars/oauth/google/callback` | **Production** |
| `src/lib/calendar/connections.ts` | `createWorkspaceCalendarConnection`, list/get/update/delete on `voiceCalendarConnection` (google \| microsoft) | **Production** |
| `src/lib/calendar/connection-settings.ts` | `listConnectionProviderCalendars` (calls `getGoogleCalendars`), calendar selection, blocking/write/import ids, `disconnectWorkspaceCalendarConnection` | **Production** |
| `src/lib/calendar/external-sync.ts` | On Transovo appointment mutations: `updateGoogleEvent` / `deleteGoogleEvent` when connection is google | **Production** (Appointments stack) |
| `src/lib/calendar/import-sync.ts` | Google event import paths | **Production** (sync jobs) |
| `src/lib/calendar/webhooks.ts` | Google Calendar watch channel register | **Production** (sync) |
| `src/lib/calendar/index.ts` | Re-exports Google functions | **Production** |
| `src/lib/voice/calendar/providers.ts` | Re-export barrel → `@/lib/calendar/providers` | **Production** (Voice V3 Microsoft modules import from here today) |

### 1.2 OAuth HTTP routes (production)

| Route | File | Notes |
|-------|------|--------|
| Start | `src/app/api/integrations/calendars/oauth/google/route.ts` | Redirect to Google consent |
| Callback | `src/app/api/integrations/calendars/oauth/google/callback/route.ts` | `completeGoogleOAuth` |
| Legacy start/callback | `src/app/api/voice/calendars/oauth/google/*` | Same lib; **legacy redirect URI** for existing Google Cloud OAuth clients |

### 1.3 UI / wizard connection (production — not V3 runtime)

| Path | Role |
|------|------|
| `src/components/integrations/platform-integration-cards.tsx` | `startCalendarOAuth("google")` |
| `src/components/integrations/calendar-integrations-card.tsx` | Connect copy + env hint |
| `src/components/settings/kimi-ui/calendar/*` | Settings calendar connections |
| `src/components/solutions/appointment-receptionist/steps/appointments-step.tsx` | Wizard: pick Google → POST connection → redirect OAuth integrations URL |
| `src/lib/integrations/platform-integrations.ts` | `google_calendar` platform id |

### 1.4 Legacy / parallel voice booking (production code — **do not route V3 through**)

| Path | Role | Reuse |
|------|------|--------|
| `src/lib/voice/calendar/booking.ts` (~1200 lines) | Telnyx/legacy voice scheduling: `getGoogleBusy`, `insertGoogleEvent`, slot generation, staff routing | **Extract nothing except patterns**; V3 must not call this orchestrator |
| `src/lib/voice/calendar/oauth.ts` | Duplicate OAuth helpers with **legacy** callback only | Prefer `src/lib/calendar/oauth.ts` (canonical + returnTo + calendarId default) |
| `src/app/api/voice/calendars/availability/route.ts` | Legacy voice calendar API | **Do not wire V3 here** |
| `voice-runtime/src/frontdesk/*` | Calendly Front Desk; `receptionist-booking-calendar.ts` interface only | **Not Google** |

### 1.5 Appointments scheduling (production — shared busy/slots)

| Path | Google usage |
|------|----------------|
| `src/lib/appointments/scheduling-domain.ts` | `getGoogleBusy` for conflict checking |
| `src/lib/appointments/staff-availability.ts` | `getGoogleBusy` per blocking calendar |

### 1.6 Voice V3 (current PSTN path)

| Path | Google |
|------|--------|
| `src/lib/voice-v3/**` | **No matches** — all FIND/BOOK/RESCHEDULE/CANCEL dispatch hard-coded to `provider: "microsoft"` and `microsoft/*` executors |

### 1.7 Tests

| Finding |
|---------|
| No dedicated unit/integration tests found that assert `insertGoogleEvent` / `getGoogleBusy` / OAuth round-trip (grep `*test*` + google calendar). Microsoft V3 has scripts under `scripts/test-voice-v3-microsoft-*`. **Gap:** Google provider contract tests after adapter lands. |

---

## 2. GOOGLE AUTH / OAUTH STATUS

| # | Capability | Status | Where |
|---|------------|--------|--------|
| 1 | OAuth connection start | **Complete** | `getGoogleOAuthStartUrl` |
| 2 | OAuth callback | **Complete** | `completeGoogleOAuth` + route handlers |
| 3 | Requested scopes | **Single scope:** `https://www.googleapis.com/auth/calendar` (full Calendar scope, not `calendar.events` split) | `src/lib/calendar/oauth.ts`, `src/lib/voice/calendar/oauth.ts` |
| 4 | Token storage | **Complete** | `voiceCalendarConnection.config`: `accessToken`, `refreshToken`, `expiresAt`, `provider: "google"`, default `calendarId: "primary"` (integrations path) |
| 5 | Refresh token handling | **Complete** | `refreshGoogle()` in `providers.ts`; `getValidAccessToken(connectionId, "google", config)` |
| 6 | Access token refresh | **Complete** | Same; persists new tokens unless read-only mutation policy blocks |
| 7 | Disconnect / revoke | **Partial** | `disconnectWorkspaceCalendarConnection` **deletes** DB row; **no** Google `revoke` HTTP call; Microsoft subscription teardown is special-cased, Google watch channels not explicitly stopped on disconnect in that function |
| 8 | Google account identity | **Partial** | Unlike Microsoft, OAuth completion does **not** fetch profile/email into connection name/config (Microsoft sets `email`, `displayName`, mailbox timezone) |
| 9 | Calendar discovery | **Complete** | `getGoogleCalendars` + UI `listConnectionProviderCalendars` |
| 10 | Selected calendar storage | **Complete** | `CalendarConfig.calendarId`, `writeCalendarId`, `blockingCalendarIds`, `importCalendarIds` via connection-settings |

**Missing for V3 only:** resolving **which** `voiceCalendarConnection` row to bind when wizard `calendarProvider === "google"` (Microsoft has `resolveMicrosoftConnectionForWizard` + `resolveMicrosoftProviderConnections`; Google returns `{}` today).

---

## 3. EXISTING GOOGLE CALENDAR OPERATIONS (by product path)

| Operation | Shared `calendar/providers.ts` | Appointments / sync | Legacy `voice/calendar/booking.ts` | Voice V3 PSTN |
|-----------|-------------------------------|---------------------|-----------------------------------|---------------|
| **FIND** (free/busy) | `getGoogleBusy` | scheduling-domain, staff-availability | Yes (slot pipeline) | **Not wired** — V3 uses `fetchMicrosoftBusyIntervals` only |
| **BOOK** (create event) | `insertGoogleEvent` | external-sync on appointment create | Yes | **Not wired** — `executeMicrosoftCreateBooking` only |
| **RESCHEDULE** | `updateGoogleEvent` | external-sync | Yes (partial) | **Not wired** — `executeMicrosoftUpdateBooking` only |
| **CANCEL** | `deleteGoogleEvent` | external-sync | Yes | **Not wired** — `executeMicrosoftCancelBooking` only |
| **Find existing** (management) | `listGoogleCalendarEvents`, `getGoogleCalendarEvent` | import-sync | N/A | **Not wired** — `loadMicrosoftCandidates` only in `find-existing-appointment.ts` |

---

## 4. CURRENT VOICE V3 MICROSOFT PROVIDER CONTRACT

### 4.1 Config boundary

- `VoiceV3CalendarConfig` (`src/lib/voice-v3/calendar/types.ts`): **`provider: "microsoft"` only**; `connectionId`, `calendarIds`, optional `smtp`.
- Compiled in `compile-voice-v3-agent-config.ts`: `calendar` block set **only** when `bookingStrategy === "MICROSOFT_365"`.
- `from-published-agent.ts`: `resolveMicrosoftProviderConnections` — if wizard `calendarProvider !== "microsoft"`, returns **empty** `{}` (no Google connection id).

### 4.2 Tool authorization

- `authorize-tool-for-config.ts`: FIND/BOOK/FIND_APPOINTMENT/RESCHEDULE/CANCEL require `scheduling.bookingStrategy === "MICROSOFT_365"`.

### 4.3 Booking strategy (wizard)

- `VoiceWizardBookingStrategy`: `NONE | REQUEST_ONLY | SEND_LINK | MICROSOFT_365 | CALENDLY` — **no `GOOGLE_CALENDAR`**.
- `deriveBookingStrategyFromWizard`: `book_directly` + connected **google** does **not** map to live book → falls through to **`REQUEST_ONLY`**.

### 4.4 FIND pipeline (shared above provider)

1. Tool: `find_availability` → `find-dispatch.ts` → `buildFindAvailabilityRequest`
2. Provider hook: `fetchBusy` **or** default `fetchMicrosoftBusyIntervals` + Prisma `voiceCalendarConnection` where `provider: "microsoft"`
3. Output: `CalendarBusyInterval[]` → `generateAvailabilitySlots` → offer set → Live context append

**Microsoft adapter:** `microsoft/microsoft-find-availability.ts` → `getMicrosoftBusy` + token via `getValidAccessToken`.

### 4.5 BOOK pipeline

1. Rules → `dispatchBookingIfRequired` (`book-dispatch.ts`)
2. Revalidate busy (same Microsoft-only default path)
3. `buildCreateBookingRequest` → `executeMicrosoftCreateBooking` (`microsoft-create-booking.ts`)
4. Success: `providerEventId`, `providerCalendarId` → `BOOKING_CONFIRMED` in context (DB `appointmentBooked` / `voice_appointments` still separate gap)

**Contract types:** `CreateBookingRequest`, `ConfirmedBooking`, `BookingFailure` in `booking-types.ts`; Microsoft result reasons are Microsoft-prefixed strings.

### 4.6 RESCHEDULE / CANCEL

- `reschedule-dispatch.ts` → `executeMicrosoftUpdateBooking`
- `cancel-dispatch.ts` → `executeMicrosoftCancelBooking`
- Management discovery: `microsoft-find-existing-appointments.ts` + `resolveVoiceV3MicrosoftCalendar`

### 4.7 Normalized shapes Google must satisfy

| Stage | Neutral shape |
|-------|----------------|
| Busy | `CalendarBusyInterval[]` (`calendarId`, `startUtc`, `endUtc`) |
| FIND failure | `FindAvailabilityFailure` (today reasons are Microsoft-named) |
| BOOK success | `{ providerEventId, providerCalendarId, durationMs }` |
| BOOK failure | `BookingFailure` with stable `reason` codes consumed by `mapProviderFailureToRecoveryCode` |
| Management | `ExistingAppointment` + discovery records; Graph-specific helpers must have Google parallel for parity |

**Important:** Slot generation, offer sets, revalidation, intake, and Live context are **provider-agnostic** today — only the busy fetch and commit executors are Microsoft-locked.

---

## 5. REUSABLE WITHOUT MODIFICATION

Use as-is (call from new V3 thin wrappers):

- `getValidAccessToken(connectionId, "google", config)`
- `getGoogleBusy(accessToken, calendarId, timeMin, timeMax)`
- `insertGoogleEvent`, `updateGoogleEvent`, `deleteGoogleEvent`
- `getGoogleCalendars`, `listGoogleCalendarEvents`, `getGoogleCalendarEvent`
- `resolveWriteCalendarId`, `resolveBlockingCalendarIds`
- `computeFreeSlots` (if needed for parity; V3 FIND uses busy intervals + `generateAvailabilitySlots`, not this directly)
- `completeGoogleOAuth`, `getGoogleOAuthStartUrl`, integration OAuth routes
- `createWorkspaceCalendarConnection`, connection-settings calendar pickers
- Prisma model `voiceCalendarConnection` (already used for Google tokens)

---

## 6. REQUIRES THIN V3 ADAPTER (new files, mirror Microsoft)

Pattern: copy **structure** of `src/lib/voice-v3/calendar/microsoft/*`, implement with Google exports from `@/lib/voice/calendar/providers`.

| New module (proposed) | Mirrors | Calls |
|----------------------|---------|--------|
| `google/google-find-availability.ts` | `microsoft-find-availability.ts` | `getValidAccessToken`, `getGoogleBusy` per `calendarIds` |
| `google/google-create-booking.ts` | `microsoft-create-booking.ts` | `insertGoogleEvent` |
| `google/google-update-booking.ts` | `microsoft-update-booking.ts` | `updateGoogleEvent` |
| `google/google-cancel-booking.ts` | `microsoft-cancel-booking.ts` | `deleteGoogleEvent` |
| `google/google-find-existing-appointments.ts` | `microsoft-find-existing-appointments.ts` | `listGoogleCalendarEvents` + identity matching |
| `resolve-voice-v3-google-calendar.ts` | `resolve-voice-v3-microsoft-calendar.ts` | Prisma `provider: "google"` |

**Dispatch edits (provider branch, minimal):**

- `find-dispatch.ts` — else branch: google connection + `fetchGoogleBusyIntervals`
- `book-dispatch.ts` — revalidate + `executeGoogleCreateBooking`
- `reschedule-dispatch.ts`, `cancel-dispatch.ts` — google executors
- `find-existing-appointment.ts` — `loadGoogleCandidates` when calendar provider is google

**Config / compiler (no legacy voice):**

- Add `GOOGLE_CALENDAR` to `VoiceWizardBookingStrategy` (or map `calendarProvider===google` + `book_directly` → strategy without breaking Microsoft enum — product choice)
- `deriveBookingStrategyFromWizard` — google + book_directly → live strategy
- `compile-voice-v3-agent-config.ts` — populate `calendar: { provider: "google", connectionId, calendarIds }`
- `from-published-agent.ts` — `resolveGoogleProviderConnections` (mirror Microsoft)
- `VoiceV3CalendarConfig.provider` — `"microsoft" | "google"`
- `authorize-tool-for-config.ts` — `isDirectCalendarStrategy` = Microsoft **or** Google
- `voice-tool-catalog.ts` / `astra-backend-instructions.ts` — strategy string only; **no provider jargon in tool descriptions**

**Failure mapping:** extend `provider-failure-map.ts` with Google codes **or** introduce provider-neutral `CALENDAR_AUTH_FAILED` at the boundary (prefer parallel Google-specific reasons matching Microsoft pattern to avoid Microsoft regression).

---

## 7. DO NOT REUSE (keep isolated)

| Area | Why |
|------|-----|
| `src/lib/voice/calendar/booking.ts` | Full legacy voice booking orchestration (staff round-robin, Telnyx-era flows) |
| `src/lib/voice/calendar/oauth.ts` | Duplicate; legacy callback-only |
| `/api/voice/calendars/*` scheduling | Legacy voice HTTP surface |
| Voice V2 Telnyx workflow / `voice_ai_booking_turn` | Removed from V3 path per isolation doc |
| `commit-booking-for-python.ts` / Front Desk Calendly | Different product path |
| `deriveBookingStrategy` naming “VoiceV2” | Types only — do not re-enable V2 PSTN orchestration |

---

## 8. ACTUAL MISSING WORK (after reuse)

1. **V3 executor modules** (5–6 files) — thin wrappers around existing Google API functions.
2. **Dispatch branching** in find/book/reschedule/cancel (+ existing-appointment discovery) on `config.calendar.provider`.
3. **Wizard compile + published config**: Google connection id + calendar ids on `VoiceV3AgentConfig`.
4. **Booking strategy enum + derivation** so Google-connected receptionist is not compiled as `REQUEST_ONLY`.
5. **Tool authorization** for FIND/BOOK/manage when strategy is Google direct.
6. **Types**: `VoiceV3CalendarConfig`, `FindAvailabilityFailureReason` (google_* or neutral).
7. **Optional parity**: Google profile/email on OAuth complete (review UX, not strictly required for API).
8. **Tests**: provider contract scripts mirroring `scripts/test-voice-v3-microsoft-*` (user asked to defer testing in gaps doc; needed before production claim).
9. **Not Google-specific but blocks “booking confirmed” product truth:** `markVoiceCallBooked` / `voice_appointments` on V3 book success (affects Microsoft and Google equally).

**Not missing:** OAuth app wiring, Calendar API CRUD, token refresh, integrations UI connect flow, workspace connection storage.

---

## 9. GOOGLE REVIEW READINESS

| Item | Current state |
|------|----------------|
| **Scopes requested** | `https://www.googleapis.com/auth/calendar` only (full Calendar scope) |
| **Scopes required by code** | Same — freeBusy, events.list/get/insert/patch/delete, calendarList |
| **Narrower scope option** | Google offers `calendar.events` for event CRUD; freeBusy may still need calendar read — **do not broaden**; narrowing requires Google Cloud console + code change + re-verification (out of scope until product/legal approves) |
| **Stale scopes** | Login OAuth (`src/lib/auth/google-oauth.ts`) uses `openid email profile` — **separate** from Calendar product client (`GOOGLE_CALENDAR_CLIENT_ID`) |
| **Redirect URIs** | Canonical: `{APP_URL}/api/integrations/calendars/oauth/google/callback`; Legacy: `{APP_URL}/api/voice/calendars/oauth/google/callback` |
| **Consent parameters** | `access_type=offline`, `prompt=consent` (forces refresh token on connect) |
| **User-facing flow** | Integrations → Calendars / Platform card → OAuth redirect → return with `oauth=google_ok` query |
| **Scope explanation in UI** | Generic “Two-way sync…” copy; **no per-scope breakdown** in code |
| **Privacy / terms links** | Not embedded in calendar OAuth components (grep integrations — none); likely app-level marketing pages only — **verify before submission** |
| **Disconnect** | Deletes connection record; **no** token revoke call to `oauth2.googleapis.com/revoke` |
| **Blockers visible in repo** | (1) V3 product does not yet use Google on PSTN — verification narrative must match **actual** features enabled after adapter; (2) full `calendar` scope is sensitive — justify with “read/write events for appointment booking”; (3) ensure OAuth client in GCP matches **both** redirect URIs if legacy still registered |

---

## 10. MINIMAL IMPLEMENTATION PLAN

**Phase A — Config & strategy (no provider API)**

| File | Change |
|------|--------|
| `src/lib/solutions/appointment-receptionist/types.ts` | Add `GOOGLE_CALENDAR` to `VoiceWizardBookingStrategy` (or document mapping) |
| `src/lib/voice-receptionist-wizard/booking-strategy.ts` | Derive `GOOGLE_CALENDAR` when `calendarProvider === "google"` && book_directly |
| `src/lib/voice-v3/calendar/types.ts` | `VoiceV3CalendarConfig.provider`: `"google" \| "microsoft"`; extend failure reason union |
| `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` | Set `calendar` for `GOOGLE_CALENDAR` |
| `src/lib/voice-v3/config/from-published-agent.ts` | `resolveGoogleProviderConnections` |
| `src/lib/voice-v3/config/resolve-google-connection.ts` | Mirror `resolve-microsoft-connection.ts` (optional small file) |
| `src/lib/voice-v3/tools/authorize-tool-for-config.ts` | Authorize FIND/BOOK/manage for Google strategy |
| `src/lib/voice-v3/tools/voice-tool-catalog.ts` | Gate parity with Microsoft |
| `src/components/.../appointments-step.tsx` | When user picks Google + book directly, set `bookingStrategy: GOOGLE_CALENDAR` (UX) |

**Phase B — Provider executors (new directory)**

| File | Change |
|------|--------|
| `src/lib/voice-v3/calendar/google/google-find-availability.ts` | New |
| `src/lib/voice-v3/calendar/google/google-create-booking.ts` | New |
| `src/lib/voice-v3/calendar/google/google-update-booking.ts` | New |
| `src/lib/voice-v3/calendar/google/google-cancel-booking.ts` | New |
| `src/lib/voice-v3/calendar/google/google-find-existing-appointments.ts` | New |
| `src/lib/voice-v3/calendar/google/resolve-voice-v3-google-calendar.ts` | New |

**Phase C — Dispatch wiring (surgical branches)**

| File | Change |
|------|--------|
| `find-dispatch.ts` | If `config.calendar?.provider === "google"`, load google connection + `fetchGoogleBusyIntervals` |
| `book-dispatch.ts` | Google revalidate + `executeGoogleCreateBooking` |
| `reschedule-dispatch.ts` | Google update executor |
| `cancel-dispatch.ts` | Google cancel executor |
| `find-existing-appointment.ts` | `loadGoogleCandidates` |
| `operations/provider-failure-map.ts` | Google failure codes |

**Phase D — Docs / gaps register**

| File | Change |
|------|--------|
| `docs/VOICE-V3-CODE-GAPS-REGISTER.md` | Google = “not connected to V3 path” |

**Explicit non-goals for this workstream**

- No changes to LiveKit worker, GPT-Live, or Sol delegation architecture
- No refactor of Microsoft executors
- No resurrection of `voice/calendar/booking.ts` orchestrator
- No scope expansion without separate review

**Estimated complexity:** **Medium-small** — mostly adapter + dispatch switches; largest risk is **wizard/strategy correctness** and **parity** on find-existing/reschedule identity matching, not Google API novelty.

---

## Appendix — Microsoft V3 file index (reference)

| Concern | Path |
|---------|------|
| FIND dispatch | `src/lib/voice-v3/calendar/find-dispatch.ts` |
| BOOK dispatch | `src/lib/voice-v3/calendar/book-dispatch.ts` |
| Microsoft FIND | `src/lib/voice-v3/calendar/microsoft/microsoft-find-availability.ts` |
| Microsoft BOOK | `src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts` |
| Microsoft RESCHEDULE | `src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts` |
| Microsoft CANCEL | `src/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking.ts` |
| Resolve connection | `src/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar.ts` |
| Shared Google API | `src/lib/calendar/providers.ts` |
