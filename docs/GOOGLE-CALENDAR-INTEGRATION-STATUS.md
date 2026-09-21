# Google Calendar integration — completion status (Transovo)

**Last updated:** 2026-09-20  
**Implementation branch:** `cursor/google-calendar-voice-v3-implementation-2304` (draft PR #459)  
**Scope:** Google Calendar for **Voice V3 Appointment Receptionist** live scheduling (find / book / find existing / reschedule / cancel). Not MCTB TeXML/SMS, not mass texting, not legacy Appointments UI booking engine unless noted.

**Legend**

- **DONE** — Implemented in repo; wired to the canonical path described.
- **NOT DONE** — Missing, partial, or only documented; needs work or your production validation.
- **INTENTIONAL / UNCHANGED** — By design (frozen scope, legacy preserved, or ops outside repo).

---

## 1. Product intent (locked architecture)

| Item | Status | Notes |
|------|--------|--------|
| Google is a **provider behind existing** Voice V3 tools (`find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment`) | **DONE** | No `google_*` Astra tools. |
| Published wizard config selects Microsoft vs Google; Astra does not choose provider | **DONE** | `bookingStrategy` + `calendar.provider` on compiled `VoiceV3AgentConfig`. |
| Microsoft 365 scheduling path frozen (no refactor) | **INTENTIONAL / UNCHANGED** | Google added in parallel extension points only. |
| Caller natural language normalized **before** any provider | **DONE** (upstream) | `set_scheduling_preference` + `scheduling-normalizer.ts` — shared with Microsoft. |
| Google-specific **date/time serializer + normalizer** at provider boundary | **DONE** | `google-datetime-adapter.ts`, `google-event-interval-normalizer.ts`. |
| Do not pass Microsoft Graph wire shapes or raw UTC `Z` as Google `dateTime` + IANA `timeZone` | **DONE** | Book/reschedule use wall `dateTime` + IANA zone. |

---

## 2. Documentation & agent rules

| Artifact | Status | Path |
|----------|--------|------|
| Engineering guide (API, OAuth, events.list, GET+PUT) | **DONE** | `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md` |
| Voice V3 implementation directive | **DONE** | `docs/GOOGLE-CALENDAR-VOICE-V3-IMPLEMENTATION-DIRECTIVE.md` |
| Date/time provider boundary addendum | **DONE** | `docs/GOOGLE-CALENDAR-DATETIME-PROVIDER-BOUNDARY.md` |
| OAuth scope verification template (Google Cloud console) | **DONE** | `docs/GOOGLE-CALENDAR-OAUTH-VERIFICATION.md` |
| Cursor rule (activates on calendar / Voice V3 paths) | **DONE** | `.cursor/rules/google-calendar-integration.mdc` |
| This status sheet | **DONE** | `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md` |

---

## 3. OAuth & Integrations UI (workspace calendar connect)

| Item | Status | Notes |
|------|--------|--------|
| OAuth scope `calendar.events.owned` (V1) | **DONE** | `src/lib/calendar/google-calendar-scope.ts`, `src/lib/calendar/oauth.ts` |
| `include_granted_scopes` on authorize | **DONE** | `getGoogleOAuthStartUrl` |
| Offline refresh; preserve refresh token on reconnect | **DONE** | `completeGoogleOAuth` merges prior `refreshToken` |
| Post-connect validation (`primary` `events.list` smoke) | **DONE** | `validateGooglePrimaryCalendarList` in `oauth.ts` |
| Integrations → Google Calendar connect (API routes) | **DONE** | `src/app/api/integrations/calendars/oauth/google/*` |
| Legacy voice calendar OAuth callback (same `lib/calendar/oauth`) | **DONE** | `src/app/api/voice/calendars/oauth/google/*` |
| Integrations cards (Google Calendar tile, connect, manage) | **DONE** | `platform-integration-cards.tsx`, `calendar-integrations-card.tsx`, Kimi calendars card |
| Env: `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` | **DONE** (config) | Must be set in each deployment |
| Google Cloud OAuth app verification / production consent screen | **NOT DONE** | Ops: submit scopes per `GOOGLE-CALENDAR-OAUTH-VERIFICATION.md` |
| Duplicate legacy module `src/lib/voice/calendar/oauth.ts` (broad `calendar` scope) | **NOT DONE** (cleanup) | **Not used** by current integration routes; dead/legacy copy — safe to align or delete in a later pass |
| Disconnect calendar connection | **DONE** (shared) | `disconnectWorkspaceCalendarConnection` — provider-agnostic |

---

## 4. Appointment Receptionist wizard & publish

| Item | Status | Notes |
|------|--------|--------|
| Booking strategy `GOOGLE_CALENDAR` in types | **DONE** | `appointment-receptionist/types.ts` |
| Wizard UI: “Book with Google Calendar” (replaces visible Calendly slot in main list) | **DONE** | `appointments-step.tsx` |
| Legacy `CALENDLY` wizard path preserved in code | **INTENTIONAL / UNCHANGED** | Still works if `bookingStrategy === "CALENDLY"` |
| Derive `GOOGLE_CALENDAR` when `calendarProvider === "google"` + book directly | **DONE** | `booking-strategy.ts` |
| Publish: OpenAI-realtime Telnyx transport for Google agents | **DONE** | `build-agent-config.ts` |
| Wizard snapshot includes `bookingStrategy`, `calendarProvider`, `calendarConnected` | **DONE** | `build-agent-config.ts` / advanced bridge |

---

## 5. Voice V3 compile & runtime config

| Item | Status | Notes |
|------|--------|--------|
| `compileVoiceV3AgentConfig`: `GOOGLE_CALENDAR` → `calendar.provider: "google"` | **DONE** | |
| Resolve Google `voiceCalendarConnection` on agent load | **DONE** | `from-published-agent.ts` → `resolveProviderConnectionsForWizard` |
| Default calendar id `primary` only | **DONE** | No multi-calendar picker in wizard |
| `bookingStrategyDetail.executionStatus` ACTIVE for Google | **DONE** | |
| Tool authorization & catalog (find/book/manage) for direct calendar strategies | **DONE** | Includes Google via `isDirectCalendarBookingConfig` |
| Runtime capability flags (`canBook`, reschedule, cancel) for Google | **DONE** | `capability-state.ts` |
| Env fallback `VOICE_V3_GOOGLE_CONNECTION_ID` | **DONE** (optional) | Only when no DB connection row |

---

## 6. Voice V3 scheduling runtime (dispatch → Google API)

| Operation | Status | Implementation |
|-----------|--------|----------------|
| Find availability (busy from `events.list`) | **DONE** | `google-find-availability.ts` + `calendar-provider-runtime.ts` |
| Book appointment (`events.insert`) | **DONE** | `google-create-booking.ts` |
| Reschedule (`events.get` + `events.update` PUT) | **DONE** | `google-update-booking.ts` |
| Cancel (`events.delete`) | **DONE** | `google-cancel-booking.ts` |
| Find existing appointments (discovery) | **DONE** | `google-find-existing-appointments.ts` + `find-existing-appointment.ts` |
| Pre-mutation validation | **DONE** | `validate-google-appointment.ts` |
| Outcome reconcile (uncertain network) | **DONE** | `google-reconcile-mutation-outcome.ts` |
| Connection resolution | **DONE** | `resolve-voice-v3-google-calendar.ts` |
| Low-level API client (list/get/insert/put/delete) | **DONE** | `google-events-api.ts` |
| Central dispatch routing (Microsoft untouched) | **DONE** | `find-dispatch`, `book-dispatch`, `reschedule-dispatch`, `cancel-dispatch`, `calendar-provider-runtime.ts` |
| Confirmed booking `provider: "google"` | **DONE** | `booking-types.ts`, book success path |
| Existing appointment `provider: "google"` | **DONE** | `appointment-management-types.ts` |
| Provider failure → recovery code mapping (incl. `google_*`) | **DONE** | `provider-failure-map.ts` |

---

## 7. Date & time (provider boundary)

| Item | Status | Notes |
|------|--------|--------|
| Canonical → Google timed event (`dateTime` wall + IANA `timeZone`) | **DONE** | `google-datetime-adapter.ts` |
| `events.list` window: UTC `timeMin`/`timeMax` + `timeZone` query param | **DONE** | `google-events-api.ts` |
| Normalize Google responses → `CalendarBusyInterval` (UTC) | **DONE** | Timed + all-day (exclusive `end.date`) |
| DST via IANA only (no fixed UTC offsets) | **DONE** | Uses `src/lib/voice-v3/time/timezone.ts` |
| Microsoft normalization path | **INTENTIONAL / UNCHANGED** | Frozen reference |

---

## 8. Explicitly out of scope / not built

| Item | Status | Notes |
|------|--------|--------|
| New Google-specific Astra / FunctionTools | **INTENTIONAL / UNCHANGED** | Not built (by design). |
| Google FreeBusy API for V1 availability | **INTENTIONAL / UNCHANGED** | Uses `events.list` only. |
| Multi-calendar selection in wizard (beyond `primary`) | **NOT DONE** | Same as current Microsoft V3 default (`primary` / env calendar id). |
| Per-agent Google credentials (duplicate of workspace integration) | **NOT DONE** | Uses workspace `voiceCalendarConnection`. |
| MCTB / TeXML / SMS recovery pipeline changes | **INTENTIONAL / UNCHANGED** | Frozen; unrelated product. |
| Mass texting / campaigns Google usage | **INTENTIONAL / UNCHANGED** | Separate product boundary. |
| Legacy `src/lib/calendar/providers.ts` Google helpers (PATCH, FreeBusy, broad scope) | **INTENTIONAL / UNCHANGED** | Old Appointments/shared paths; **not** Voice V3 adapter. Replacing them is a separate consolidation task. |
| Calendly platform code removal | **INTENTIONAL / UNCHANGED** | Wizard de-emphasized only. |
| ACL / CalendarList UI / Meet / service accounts | **NOT DONE** | Out of scope per directive. |

---

## 9. Production readiness (your validation — not listed as “tests”)

These are **product gates** only you can close in a real workspace; code paths exist but **completion is NOT DONE** until you confirm:

| Gate | Code ready? | You confirmed in prod? |
|------|-------------|-------------------------|
| Google OAuth connect → CONNECTED in Integrations | Yes | **NOT DONE** (your sign-off) |
| Wizard → Google Calendar → publish agent | Yes | **NOT DONE** (your sign-off) |
| Live call: find availability → book on `primary` | Yes | **NOT DONE** (your sign-off) |
| Reschedule + cancel on real event | Yes | **NOT DONE** (your sign-off) |
| Microsoft agent unchanged (regression) | Yes (frozen path) | **NOT DONE** (your sign-off) |
| Google OAuth app verified for production users (if required) | N/A (ops) | **NOT DONE** |

---

## 10. Summary verdict

| Area | Verdict |
|------|---------|
| **Voice V3 Google provider (code)** | **DONE** — find, book, find-existing, reschedule, cancel, datetime boundary, dispatch, compile, tools, wizard option. |
| **Integrations OAuth (code)** | **DONE** — `calendar.events.owned`, connect flows, token handling, post-connect validation. |
| **Documentation & Cursor rules** | **DONE** |
| **Legacy / parallel Google code cleanup** | **NOT DONE** — `voice/calendar/oauth.ts` duplicate; old `calendar/providers.ts` Google functions still present for non–Voice-V3. |
| **Multi-calendar & advanced Google features** | **NOT DONE** — primary-only; no ACL/CalendarList/Meet. |
| **Shippable without your live validation** | **NOT DONE** — implementation is complete in repo; **production “complete”** requires your connect + publish + call sign-off (Section 9). |

---

## 11. Key file index (copy reference)

**Docs:** `docs/GOOGLE-CALENDAR-*.md`, `.cursor/rules/google-calendar-integration.mdc`  

**OAuth:** `src/lib/calendar/oauth.ts`, `src/lib/calendar/google-calendar-scope.ts`  

**Wizard:** `src/components/solutions/appointment-receptionist/steps/appointments-step.tsx`, `src/lib/voice-receptionist-wizard/booking-strategy.ts`  

**Compile / runtime:** `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts`, `from-published-agent.ts`  

**Dispatch:** `src/lib/voice-v3/calendar/calendar-provider-runtime.ts`, `*-dispatch.ts`  

**Google provider:** `src/lib/voice-v3/calendar/google/*`  

**Shared strategy:** `src/lib/voice-v3/calendar/direct-booking-strategy.ts`  

**PR:** https://github.com/703deuce/sms/pull/459  
