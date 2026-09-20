# Transovo Voice V3 — Google Calendar

## Complete end-to-end implementation directive

**Status:** Permanent build directive for adding Google Calendar to Voice V3 Appointment Receptionist.  
**Pair with:** `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md` (API/OAuth reference) · `docs/GOOGLE-CALENDAR-OAUTH-VERIFICATION.md` (scope review).  
**Cursor rule:** `.cursor/rules/google-calendar-integration.mdc` (activates on calendar / Voice V3 scheduling paths).

### Key corrections (read before any implementation)

1. **No Google-specific Astra tool** if Microsoft does not work that way. Google is **another provider behind the existing scheduling tools** (`find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment`). The **published agent** is configured for Google; the deterministic runtime resolves those tools to Google. That prevents Google from becoming a **parallel booking system** and keeps provider choice out of Astra.
2. **Microsoft 365 is frozen.** Trace the Microsoft path as a **read-only behavioral reference** — copy contracts and patterns, implement Google at the narrowest extension points. **Do not refactor Microsoft** while adding Google. Microsoft tests must stay green.

---

## Goal

Add **Google Calendar** as a first-class scheduling **provider** for Transovo Voice V3.

When complete, a business owner must be able to:

1. **Integrations** → Calendar integrations → **Google Calendar** → Connect → Google OAuth → authorize Calendar permission → return to Transovo → **CONNECTED**
2. **Appointment Receptionist wizard** → Appointments / scheduling provider → choose **Google Calendar** → configure scheduling **as Microsoft supports** → save → publish
3. On a **real call:**

```
Caller → Amy → Astra → existing scheduling tool
  → existing Transovo scheduling engine
  → Google Calendar provider
  → real Google Calendar operation
  → normalized Transovo result → Astra → Amy → caller
```

Google Calendar must support the same core lifecycle as Microsoft 365:

- FIND AVAILABILITY  
- BOOK APPOINTMENT  
- FIND EXISTING APPOINTMENT  
- RESCHEDULE APPOINTMENT  
- CANCEL APPOINTMENT  

---

## 1. Non-negotiable architecture rule

### ADD GOOGLE. DO NOT REBUILD SCHEDULING.

Existing production architecture remains:

```
Caller
   ↓
Amy / GPT-Live
   ↓
Astra / Responses delegation
   ↓
Existing LiveKit FunctionTools
   ↓
TransovoV3ToolClient
   ↓
/api/internal/voice-runtime
   ↓
executeVoiceTool / existing scheduling executors
   ↓
existing deterministic scheduling system
   ↓
configured scheduling provider
```

Google becomes:

```
                           ┌→ Microsoft 365 [FROZEN]
Existing scheduling layer ├→ Google Calendar [NEW]
                           └→ other existing paths where applicable
```

**Do NOT build:** Amy → special Google agent → special Google tools → separate Google scheduling engine.

---

## 2. Microsoft 365 is frozen

Microsoft currently works. Treat its implementation as a **behavioral reference**, not a refactoring target.

Before changing anything, **trace** the Microsoft scheduling path completely and document:

Integrations UI · OAuth/connect · credential persistence · provider selection · wizard state · draft · manifest · publish · compiler · runtime config · Node scheduling executor · provider adapter · availability · booking · appointment lookup · reschedule · cancel · result normalization · provider IDs · idempotency · OfferSets · generations · reconciliation · notifications.

Identify exact files/functions/types. Implement Google through the **narrowest** existing extension points.

### DO NOT

- rename Microsoft contracts unnecessarily  
- rewrite Microsoft executors  
- move Microsoft files merely to make Google look cleaner  
- alter proven Microsoft API behavior or OAuth  
- change Microsoft scheduling semantics  
- replace existing booking idempotency, OfferSets, generations, or appointment matching  
- change Amy’s basic scheduling behavior or LiveKit plumbing  

If an abstraction must accept Google, make the **smallest backward-compatible** extension. **Microsoft tests must remain green.**

---

## 3. Remove Calendly from the active wizard choice

For **Appointment Receptionist**, Calendly Direct is **not** an active wizard provider choice.

Replace the **visible** Calendly scheduling-provider choice with **Google Calendar**.

**Do NOT** recklessly delete Calendly backend code, historical data, MCTB AI Booking, Lead Recovery, or legacy integrations.

Desired wizard choices (use existing UI composition):

- Microsoft 365  
- Google Calendar  
- Send booking link  

Persisted historical Calendly configs must **parse safely**. Do **not** silently convert Calendly customers to Google.

---

## 4. Permanent Google engineering guide

**Already in repo:** `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md`

Must cover API v3, OAuth, scope, events CRUD, time zones, recurring/pagination, extended properties, ETags, errors, normalization, security, operation mapping, official links.

**Do not duplicate API detail in this directive** — read the guide for Google API facts.

---

## 5. Google scope

Initial permission:

`https://www.googleapis.com/auth/calendar.events.owned`

Do **not** request broad `https://www.googleapis.com/auth/calendar`. Do **not** add ACLs, CalendarList, settings, or FreeBusy for V1.

Operate on authenticated user’s owned **primary** calendar: `calendarId = "primary"` unless repo inspection documents a genuine blocker before broadening scope.

---

## 6. Existing Google login OAuth vs Google Calendar connection

Google sign-in for Transovo identity **≠** Google Calendar integration authorized.

Reuse existing Google OAuth infrastructure (client, callback, encryption) but obtain **Calendar permission explicitly** via the Calendar connect flow.

---

## 7. Integrations page

Find existing Integrations (Microsoft / Calendly / scheduling). **Do not redesign.**

Add **Google Calendar** under Calendar/scheduling using production cards, badges, buttons, loading, responsive patterns.

Connected state: Primary calendar · Reconnect · Disconnect.

Use existing Google branding if present; no unofficial artwork.

---

## 8. Connect flow

Connect → server OAuth request → Google consent (Calendar scope) → callback → token exchange → secure persistence → **validate Calendar access** → redirect → CONNECTED.

Offline access required. Preserve refresh token when Google omits a new one. Incremental authorization where compatible.

---

## 9. OAuth state / CSRF

Use existing OAuth state mechanism (workspace, user, intent, return path). No unverified workspace IDs from browser. No open redirect. No credentials in URL after completion.

---

## 10. Connection storage

Audit existing integration models before new tables. Prefer workspace-level credential storage: provider `GOOGLE_CALENDAR`, encrypted tokens, scopes, state, timestamps. No per-agent credential duplication if integration is workspace-level.

---

## 11. Connection validation

After token exchange, perform minimal API check (e.g. bounded `events.list` on `primary`). CONNECTED only if usable; otherwise ERROR / RECONNECT REQUIRED.

---

## 12. Disconnect

Same UX as Microsoft: confirm if required; disable provider; revoke/remove credentials; block runtime calls; preserve Transovo history; **do not** delete Google events. Published agents depending on Google must surface unhealthy provider deterministically.

---

## 13. Wizard provider selection

Replace active Calendly choice with Google Calendar. Show connection state; block publish without usable Google when Google is selected. Link to Connect from wizard when disconnected.

---

## 14. Save → publish → compile pipeline

Wire end-to-end: Wizard UI → draft → save → reload → published config → manifest → `compile-voice-v3-agent-config.ts` → runtime → provider resolution.

Extend provider enum/types minimally (e.g. `microsoft` | `google_calendar` | `send_link` | legacy values). Historical values must parse safely.

---

## 15. No new Google-specific voice tool

**Do NOT create:** `google_find_availability`, `google_book_appointment`, etc.

Existing tools remain:

- `set_scheduling_preference`  
- `find_availability`  
- `book_appointment`  
- `find_appointment`  
- `reschedule_appointment`  
- `cancel_appointment`  
- `send_booking_link`  

Provider selection is **below** the tool contract:

```
Astra → book_appointment → executor → published provider = GOOGLE → Google provider
```

**Wrong:** `Astra → google_book_appointment`

**Critical:** Do **not** add a separate Google-specific Astra/LiveKit FunctionTool if Microsoft does not work that way. Astra learns that **existing** scheduling tools operate against Google when the **published agent** is configured for Google — not a parallel booking system or provider choice at runtime.

---

## 16. Tool registration / Astra

Audit existing FunctionTool registration and descriptions. **Do not duplicate** the tool catalog.

Update descriptions only where Microsoft-specific wording should become **provider-neutral**, e.g.:

- *find_availability* — use the business’s **configured scheduling provider**; return authoritative Transovo slots; never invent availability.  
- *book_appointment* — book an offered slot via configured provider after workflow rules.  
- *find_appointment* — before reschedule/cancel when appointment not yet identified; clarify if multiple matches.  
- *reschedule_appointment* / *cancel_appointment* — after policy + identification; success only on tool success.

**Do NOT** teach Astra `events.insert` or Google REST terms. **Astra does not choose Microsoft vs Google** — configuration already did.

---

## 17. Amy

No Google-specific instructions. Natural scheduling language only. Provider details are internal.

---

## 18. Google Calendar provider module

Centralize under existing scheduling/provider structure (no REST in React, Astra, or API routes ad hoc):

- client · auth/credentials · events · normalize · errors · provider  

Capabilities: `findAvailability`, `bookAppointment`, `findAppointment`, `rescheduleAppointment`, `cancelAppointment`.

---

## 19. Authenticated Google client

Reuse existing OAuth utilities / `googleapis`. Server-side only.

---

## 20. Find availability

`events.list` on `primary`, bounded window, `singleEvents=true`, `orderBy=startTime`, `showDeleted=false`, business `timeZone`, pagination → normalize busy → **existing** Transovo slot engine.

---

## 21. Busy normalization

Handle cancelled, transparent, timed, all-day, recurring instances. Do not treat every event as busy.

---

## 22. Book appointment

`events.insert` after Transovo revalidation + idempotency. `sendUpdates` per policy. `extendedProperties.private` for correlation.

---

## 23. Google event ID

Persist `response.data.id` as provider truth for find/reschedule/cancel/reconciliation.

---

## 24. Private extended properties

Minimal: `transovoAppointmentId`, `transovoWorkspaceId`. No tokens, prompts, or transcripts in Calendar.

---

## 25. Find existing appointment

Same behavior as Microsoft: `events.get` when ID known; else bounded `events.list` → **existing** deterministic matching — no new Google-specific matcher.

---

## 26. Reschedule

`events.get` → preserve fields → change start/end → `events.update` (GET + UPDATE, not default PATCH). Revalidate slot first. Preserve attendees, metadata, location.

---

## 27. Cancel

`events.delete` with stored event ID. Existing Voice V3 confirmation policy unchanged.

---

## 28. Idempotency

Reuse existing OfferSets, generations, provider truth, reconciliation. No second Google idempotency system. Reconcile ambiguous creates before retry.

---

## 29. Reschedule concurrency

ETag / 412 → re-fetch, reconcile. Do not blindly overwrite newer Calendar edits.

---

## 30. Time zones

Business IANA zone authoritative in API payloads. No server-local or fixed-offset business time.

---

## 31. Error normalization

Map Google HTTP/errors to Transovo codes (`AUTH_RECONNECT_REQUIRED`, `APPOINTMENT_NOT_FOUND`, `SLOT_NO_LONGER_AVAILABLE`, etc.). No raw Google errors to Amy.

---

## 32. Token failure

Refresh access token; revoked refresh → reconnect required; graceful scheduling-unavailable with existing fallback (message, callback, booking link).

---

## 33. Notifications

Transovo notifications remain authoritative; Google `sendUpdates` is separate from business notification architecture.

---

## 34. Appointment system facts

Google successes feed the **same** system-facts path as Microsoft for post-call and outcomes.

---

## 35. Analytics

Provider-independent appointment outcomes; no separate “Google dashboard” unless existing analytics already break down by provider.

---

## 36. Call detail

Same appointment outcome UI as Microsoft; provider identity only if existing UI already shows it.

---

## 37. MCTB boundary

Primary target: **Voice V3 Appointment Receptionist**. Do **not** alter MCTB TeXML, consent, SMS frozen pipeline. Shared abstraction may gain Google only without destabilizing MCTB.

---

## 38. Calendly boundary

Wizard UI replacement only — preserve Calendly integrations, MCTB consumers, APIs, historical configs.

---

## 39. Activation validation

When provider is Google: integration exists, credentials usable, scope granted, primary calendar reachable — mirror Microsoft preflight patterns.

---

## 40. Live wizard test

Compiled config with Google should exercise **real** provider through existing scheduling tools when credentials present — no fake Google simulation unless existing architecture requires mocks.

---

## 41. Integration health

Connected · Reconnect required · Not connected · Error — existing conventions; no technical errors to end users.

---

## 42. Security

Never expose tokens, codes, or secrets to browser, Amy, Astra, LiveKit prompts, transcripts, or normal logs.

---

## 43. Google data minimization

Slots and normalized candidates only — never full calendar to LLMs.

---

## 44. Astra tool descriptions

Audit current descriptions first. Do not rewrite good existing descriptions unnecessarily. Where wording is Microsoft-specific, make it **provider-neutral**.

**find_availability** (conceptual):

> Find appointment availability using the business's configured scheduling provider and published scheduling rules. Use this after the caller's service and scheduling preferences are sufficiently known. The tool returns authoritative available slots generated by Transovo; never invent availability.

**book_appointment** (conceptual):

> Book the caller into an authoritative slot previously offered through the scheduling workflow, using the business's configured scheduling provider. Do not invent a slot or treat a requested time as booked until this tool returns success.

**find_appointment** (conceptual):

> Find an existing appointment that may be managed by the caller. Use this before rescheduling or cancelling when the exact appointment has not already been authoritatively identified. If multiple appointments match, obtain caller clarification rather than guessing.

**reschedule_appointment** (conceptual):

> Move an authoritatively identified appointment to a valid new slot using the configured scheduling provider. The new slot must satisfy the existing scheduling and confirmation policy. Do not report the appointment moved until the tool returns success.

**cancel_appointment** (conceptual):

> Cancel an authoritatively identified appointment using the configured scheduling provider after the existing cancellation confirmation requirements have been satisfied. Never report cancellation until the tool returns success.

Adapt to actual current descriptions rather than replacing stronger existing rules.

---

## 45. Do not change tool ownership

Amy = conversation · Astra = tools · LiveKit = execution · Transovo = logic · Google = persistence. No Google logic in Amy; no REST in Astra; no LLM provider selection.

---

## 46. Do not add another LLM

Deterministic normalization only.

---

## 47. Google verification preparation

Real Connect flow to consent screen with requested scope — no fake reviewer UI.

---

## 48. Privacy policy

Update for Google API Services User Data / Limited Use before scope submission; must match implementation.

---

## 49. Document actual AI data flow

Maintain `docs/GOOGLE-CALENDAR-OAUTH-VERIFICATION.md` (scope, APIs, read/write, Voice V3 exposure, retention, disconnect, video steps).

---

## 50. Verification video plan

Integrations → Connect → consent with visible scope → Connected in Transovo.

---

## 51. Automated tests

Provider contract tests: OAuth, `events.list` cases, book/find/reschedule/cancel, errors (400–5xx), idempotency, concurrency.

---

## 52. Existing test regression

Microsoft appointment management, Voice V3 intake/booking/reschedule/cancel/agent/delegation/post-call must stay **PASS**. Fix Google adapter, not Microsoft behavior.

---

## 53. Browser certification

Integrations connect/disconnect/reload; wizard select Google; save/reload/publish; activation; responsive UI.

---

## 54. Provider certification without voice

Real test calendar: FIND (busy exclusion), BOOK, RESCHEDULE (same event ID), CANCEL.

---

## 55. Real voice certification

Three PSTN calls: book · reschedule · cancel through existing tools → Google provider.

---

## 56. Post-call certification

System facts, summary, notifications, analytics, webhooks — no Google-specific duplication.

---

## 57. Observability

`provider=google_calendar`, operation, duration, normalized result — no tokens or full calendar in logs.

---

## 58. Do not add unneeded Google features

ACLs, CalendarList UI, Meet, sync DB, service accounts, etc. — out of scope.

---

## 59. Definition of done

Full chain: Integrations CONNECT → wizard publish → real call → existing tools → Google → outcomes, for all five operations, while **Microsoft unchanged and passing**, MCTB intact, post-call/notifications/analytics/LiveKit unchanged.

---

## 60. Implementation report

When implementation completes, deliver report covering: repo audit (Microsoft trace file list), all file changes, OAuth behavior, Google provider methods, tool→provider→Google traces, UI evidence, test commands PASS/FAIL, provider cert evidence (event IDs), regression checklist, Google review readiness.

---

## Final rule

**COPY THE PROVEN CONTRACT. ADD GOOGLE BEHIND IT.**

Not: **REDESIGN SCHEDULING.**

Microsoft 365 is proven and **frozen**. Voice V3 is frozen except minimal provider-neutral extensions. LiveKit / Amy / Astra architecture intact. MCTB intact.

Google enters at the **same deterministic provider boundary** where Microsoft reaches its external calendar.

**Add Google. Preserve everything else.**

### Clarification: “it gets a new tool”

Do **not** add a new `google_*` LiveKit FunctionTool. That would expose provider choice to Astra unnecessarily. The business already chose Google in the wizard; Astra continues calling `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, and `cancel_appointment`; the runtime resolves them to Google. That is how the Microsoft path stays **frozen** instead of forking agent architecture.

### Calendly in the wizard only

Replace Calendly as the **active** Appointment Receptionist wizard choice with Google Calendar — **not** delete Calendly from the repository (MCTB AI Booking, Lead Recovery, and legacy integrations may still depend on Calendly).

---

## Cursor agent checklist (start of any Google Calendar implementation task)

1. Read `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md`  
2. Read **this directive**  
3. Trace Microsoft path — **read-only**; document files; do not refactor Microsoft  
4. Trace existing Google OAuth / `src/lib/calendar/providers.ts` — migrate toward guide scope intentionally  
5. Implement provider module + wiring only at scheduling boundary  
6. **No** `google_*` FunctionTools; **no** Astra provider choice  
7. Wizard: Google replaces **visible** Calendly choice only  
8. Run Microsoft + Voice V3 regression suites before declaring done  

---

*End of directive.*
