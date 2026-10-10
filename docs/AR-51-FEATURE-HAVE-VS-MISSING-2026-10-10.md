# Transovo Appointment Reminders — What we really have vs. what we don’t

**Purpose:** Map the original **51-item** checklist (Priorities 1–3 + two-way write-back) to **evidence**, not wishful thinking.

**Legend**

| Symbol | Meaning |
|--------|---------|
| **Have** | Supported by **production verification** and/or **clear runtime code** (API + lib + UI routes). |
| **Partial** | **Code or infrastructure exists**, but behavior is **incomplete**, **not wired end-to-end**, or **not verified in production** for AR. |
| **Not confirmed** | **No targeted audit** this pass; may still exist in repo — **do not treat as missing** until inventory confirms. |
| **Missing / planned** | **No meaningful implementation** found in AR/appointments reminder paths, or **explicitly deferred** (e.g. Google for M365 launch). |

**Important:** This document combines (1) the **Microsoft 365 production verification** (`docs/AR-MICROSOFT-PRODUCTION-VERIFICATION-2026-10-09.md`) and (2) a **lightweight code scan** (not a full 51-item file-by-file audit). For authoritative “implemented and wired” vs “dead code,” run the **read-only inventory** your team described next.

---

## Scorecard (evidence-based, not a source audit)

| Bucket | Count | Notes |
|--------|------:|-------|
| **Have** | **6** | Strong sync + dispatch foundations + inbound SMS stack |
| **Partial** | **28** | Most “product” lives here — code exists, prod proof thin |
| **Not confirmed** | **10** | Need dedicated inventory pass |
| **Missing / planned** | **7** | Mostly P3 marketing/expansion + CSV |

*Totals = 51.*

---

## Priority 1 — Core product (16 items)

| # | Feature | Status | What we really have | What’s still missing / unproven |
|---|---------|--------|---------------------|----------------------------------|
| 1 | Microsoft 365 / Outlook calendar sync | **Have** | Import/sync (`src/lib/calendar/import-sync.ts`, `microsoft-delta-sync.ts`), webhooks → jobs, reconcile scheduler. **Prod:** migration applied; **lifecycle E2E PASS** (create, rename, reschedule, delete, sync backstop) on ws_1 test connection. | Ongoing webhook volume not soak-tested; not a 10k-calendar proof. |
| 2 | Automated SMS reminders | **Partial** | Discovery + `ar_reminder_dispatches` + `ar_dispatch_reminder` (`reminder-discovery.ts`, `reminder-dispatch-executor.ts`); Telnyx reconcile hook. Mock/idempotency tests pass. | **One live SMS** through dispatch + delivery webhook **not completed** in verification pass. |
| 3 | Automated email reminders | **Partial** | Email channel in `src/lib/appointments/reminder-delivery.ts` (and related send paths). | **AR production email send** not demonstrated; deliverability/auth not checked. |
| 4 | Multiple reminders per appointment | **Partial** | `confirmation`, `reminder24h`, `reminder2h`, `additionalSteps` in `src/lib/appointments/types.ts` + `configuredReminderSteps()` in `reminder-delivery.ts`. | Exact **production sequence** (which steps fire for imported M365 events) not certified in verification. |
| 5 | Per-step delivery channel | **Have** (code) | `ReminderStepConfig.channel`: `sms` \| `email` \| `voice` (`types.ts`); honored in `reminder-delivery.ts`. | Per-step UI editing and prod sends per channel not verified. |
| 6 | Customizable reminder timing | **Partial** | `minutesBefore`, `timeOfDay` / `daysBefore`, extra steps (`types.ts`, `reminder-delivery.ts`). | Customer-facing **controls** and saved config behavior not verified in prod. |
| 7 | SMS message templates | **Partial** | Template policy / platform templates (`platform-template-policy`, settings + AR settings UI shell). | Full **variable set**, editor UX, and prod template content not audited. |
| 8 | Email message templates | **Partial** | Same reminder engine supports email body/subject paths in `reminder-delivery.ts`. | **No verified** AR email template UI or live sends. |
| 9 | Appointment personalization | **Partial** | Appointment + metadata on `voice_appointments`; merge/render in reminder delivery. | **Merge-field matrix** (what works in SMS vs email) not documented or prod-tested. |
| 10 | Reschedule/cancellation sync (calendar → Transovo) | **Have** | **Prod lifecycle PASS**; delta/import updates rows; cancel/delete reflected. | Edge cases (recurring instances, conflicts) not in scope of that E2E. |
| 11 | Recipient phone/email mapping | **Partial** | Calendar import + `resolveContactForImportedEvent` / attendee metadata (`calendar/attendee-contact`, import metadata). | **Missing phone/email** handling and display rules not verified. |
| 12 | Timezone handling and quiet hours | **Partial** | `shouldSkipStepNow`, `weeklyHours`, timezone on appointments (`reminder-delivery.ts`, `availability-engine-policy`). | **Prod behavior** for skip weekends/off-hours not verified. |
| 13 | SMS consent, opt-out, sender readiness | **Partial** | `sms-eligibility.ts`, shared Telnyx/compliance stack; AR platform sender pool. | **AR-specific** consent gates vs generic SMS not certified in this pass. |
| 14 | Email sender authentication/deliverability | **Not confirmed** | Likely shared email infra elsewhere in Transovo. | SPF/DKIM/bounce handling for **AR reminder email** not inspected. |
| 15 | Reminder delivery tracking | **Partial** | `ar_reminder_dispatches` statuses; Telnyx reconcile (`ar-dispatch-telnyx-reconcile.ts`); ops metrics route. | **Live** provider ID persistence + webhook → `delivered` **not proven**; `unknown` timeout gap remains. |
| 16 | Simple three-step onboarding | **Partial** | Routes: `/appointment-reminders/setup/connect`, `/setup/activate`, calendars, settings (`setup-pages.tsx`, `activation.ts`). | Not proven as a polished **3-step wizard**; readiness = calendar + activate, not full product tour. |

**P1 summary:** **3 Have**, **11 Partial**, **1 Not confirmed**, **0 Missing** (by this evidence pass).

---

## Priority 2 — High-value functionality (17 items)

| # | Feature | Status | What we really have | What’s still missing / unproven |
|---|---------|--------|---------------------|----------------------------------|
| 17 | Two-way SMS confirmation | **Partial** | `ar_process_inbound_sms`, reply letters **C/R/X**, AI rescheduler v3 (`src/lib/appointment-reminders/messaging/`, `ai-rescheduler/`). **Prior ws_1 live SMS docs** (Oct 2026) show real traffic. | Not re-run in **this** verification pass; not same as “reminder dispatch only.” |
| 18 | Email confirmation buttons | **Not confirmed** | — | Secure link flow for email confirm not located in quick scan. |
| 19 | Confirmation status tracking | **Partial** | `wasReminderSent`, `reminderGeneration`, aggregate status (`reminder-state`, `aggregate-reminder-status.server.ts`). | Customer-visible **confirmed** state vs reminder sent not prod-certified here. |
| 20 | Cancellation requests by SMS/email | **Partial** | Inbound + Luna cancel/reschedule tooling in AI rescheduler. | End-to-end **cancel request** product workflow not verified in this pass. |
| 21 | Reschedule requests and links | **Partial** | Heavy **AI rescheduler** + Microsoft booking primitives; calendar reschedule sync **into** Transovo is proven. | **Customer-initiated** reschedule UX (links, self-serve) not verified here. |
| 22 | Confirmation/reschedule dashboard | **Partial** | AR UI: overview, appointments, calendar, reminders log, customer response pills (`overview-page`, `appointments-page`, `reminders-page`). | Depth of “dashboard” vs checklist expectation not audited. |
| 23 | Branded HTML emails | **Not confirmed** | — | HTML/branding for AR emails not verified. |
| 24 | ICS calendar attachments | **Partial** | `src/lib/appointments/ics-builder.ts`; attached in `reminder-engine.ts`; UI mention in `calendar-integrations-opus.tsx`. | **Live email with ICS** not demonstrated for AR. |
| 25 | Industry-based starter templates | **Missing / planned** | No AR-specific industry preset module found. | Build or import content packs. |
| 26 | Recommended timing presets | **Partial** | Defaults in platform/reminder config (`DEFAULT_PLATFORM_CONFIG`, core 24h/2h). | “Recommended” UX presets not verified as a dedicated feature. |
| 27 | Appointment lead-time logic | **Partial** | Discovery fire window + max late suppression (`FIRE_TOLERANCE_MS`, `REMINDER_MAX_LATE_MS` in `reminder-discovery.ts`). | Short-notice **business rules** (e.g. don’t text 5 min before) not fully documented. |
| 28 | Rendered message previews | **Not confirmed** | Settings/marketing copy references sequences. | Dedicated **preview** UI for SMS/email not verified. |
| 29 | Preparation instructions | **Not confirmed** | — | Configurable prep copy not verified. |
| 30 | Business contact/directions merge fields | **Not confirmed** | — | Merge field catalog not audited. |
| 31 | Basic reminder analytics | **Partial** | `GET /api/appointment-reminders/ops/metrics` (internal); job completion counts in verification probe. | **Customer-facing** AR analytics page not found under `/appointment-reminders/*`. |
| 32 | Duplicate prevention / send safeguards | **Have** (implementation) | Unique dispatch key; idempotency tests; no blind retry on Telnyx timeout. | **600-reminder** simulation **not completed**; scale not proven. |
| 33 | Appointment-level reminder history | **Partial** | `ar_reminder_dispatches` + `/appointment-reminders/reminders` log UI. | History completeness vs all channels not verified. |

**P2 summary:** **1 Have**, **11 Partial**, **4 Not confirmed**, **1 Missing**.

---

## Priority 3 — Expansion opportunities (17 items)

| # | Feature | Status | What we really have | What’s still missing / unproven |
|---|---------|--------|---------------------|----------------------------------|
| 34 | Manual appointment entry | **Partial** | AR calendar native actions, booking routes (`ar-calendar-native-actions.ts`, `/appointment-reminders/booking/*`). | Whether this satisfies “manual entry for AR” vs full appointments product — **not confirmed**. |
| 35 | CSV/file appointment import | **Missing / planned** | No AR CSV import found in quick scan. | Build if required. |
| 36 | Google Calendar integration | **Partial (deferred)** | Google sync still in `lib/calendar` for legacy; **new AR connects Microsoft-only** (`calendar-provider-policy.ts`, `AR_MICROSOFT_ONLY_CALENDAR`). | **Not** part of M365 pilot positioning. |
| 37 | Custom reminder fields | **Not confirmed** | Metadata on appointments exists. | Custom fields → templates not audited. |
| 38 | Communication tone presets | **Missing / planned** | — | — |
| 39 | Cancellation policy templates | **Missing / planned** | — | — |
| 40 | Configurable confirmation behavior | **Partial** | `wasReminderSent`, confirmation immediate step, generation bumps on calendar changes. | “Don’t re-confirm” product rules not verified. |
| 41 | Multilingual reminder templates | **Not confirmed** | Transovo i18n standards exist globally. | AR template locale strategy not audited. |
| 42 | Advanced reminder analytics | **Not confirmed** | Ops metrics only. | Per-step/channel reporting not found for AR. |
| 43 | No-show tracking | **Partial** | `no_show` status used in queries (`reminder-discovery`, appointments page loaders). | **Recording** no-show outcomes (workflow) not verified. |
| 44 | No-show cost calculator | **Missing / planned** | — | — |
| 45 | Simple booking confirmation emails | **Partial** | `maybeSendImmediateConfirmationForAppointment` in `reminder-delivery.ts`. | Trigger on **M365 import** vs manual book not prod-verified. |
| 46 | Calendar-based send-time controls | **Partial** | `skipOffHours`, `skipWeekends`, `skipClosedDays` on steps. | “Previous evening / morning-of” **named** controls not verified as product copy. |
| 47 | Reminder rules by appointment type | **Not confirmed** | Service name / voiceService linkage in guards. | Per-type rule UI not verified. |
| 48 | iCal/ICS feed integration | **Missing / planned** | ICS **attachments** exist; not a subscribe **feed**. | — |
| 49 | Apple iCloud Calendar integration | **Missing / planned** | — | — |
| 50 | Customer notification preferences | **Not confirmed** | — | Channel prefs per contact not verified. |

**P3 summary:** **0 Have**, **7 Partial**, **3 Not confirmed**, **7 Missing/deferred**.

---

## Priority 4 — Exception

| # | Feature | Status | What we really have | What’s still missing / unproven |
|---|---------|--------|---------------------|----------------------------------|
| 51 | Two-way calendar write-back (Transovo → provider) | **Partial** (code **Have**, prod **unverified** this pass) | **`syncExternalCalendarOnReschedule`** and **`syncExternalCalendarOnCancel`** in `src/lib/calendar/external-sync.ts` (Microsoft + Google update/delete). User-confirmed: treat as **implemented**, not missing. | **Verification pass only proved calendar → Transovo** (import/sync). **No prod test** in that pass that edited an appointment **in Transovo** and asserted Graph was updated. |

---

## What production verification actually proved (short)

| Proved | Not proved |
|--------|------------|
| Migration `20261009120000_ar_microsoft_production_hardening` on prod | One live AR SMS + delivery webhook |
| M365 lifecycle on test connection (import, update, delete, sync backstop) | 600-reminder throughput run to completion |
| Workers/queues **likely** healthy (web `worker-all`, BullMQ, AR job activity) | Ops metrics UI with authenticated session |
| Dispatch/idempotency **in test** | Email reminder path in prod |
| | Dedicated SMS worker image at same commit as web |
| | Write-back **Transovo → Microsoft** in prod |

---

## What we should **not** do yet

- **Do not** send Cursor to “build 40 features” from the checklist alone — **email**, **templates UI**, and **inbound SMS** likely already have substantial code.
- **Do** run one **read-only inventory** of the 51 items with columns: **Implemented & wired** | **Partial** | **Missing** | **Unverified**, plus **file paths** and **routes**.

Suggested inventory seeds (already known):

- **Sync:** `src/lib/calendar/import-sync.ts`, `microsoft-reconcile-discovery.ts`, `src/lib/calendar/external-sync.ts`
- **Reminders:** `src/lib/appointment-reminders/reminder-discovery.ts`, `reminder-dispatch-executor.ts`, `src/lib/appointments/reminder-delivery.ts`
- **SMS inbound:** `src/lib/appointment-reminders/messaging/process-inbound-sms-job.ts`, `ai-rescheduler/`
- **UI:** `src/app/(app)/appointment-reminders/**`, `src/newui-transplant/connected/appointment-reminders/**`
- **Config:** `src/lib/appointments/settings.ts`, `types.ts`, `solutionSetup` activation

---

## Recommended next steps (product, not architecture)

1. **One live SMS** — `scripts/ar-production-dispatch-reminder-smoke.ts` **inside prod web container** (authorized test phone).
2. **Finish 600 mock throughput** — `scripts/test-ar-reminder-throughput.ts` on prod or stable DB host.
3. **Optional:** prod test **write-back** — reschedule in Transovo UI/API → assert Microsoft event time changes (`external-sync.ts`).
4. **Read-only 51-item inventory** — then decide pilot scope vs backlog.

---

## Related docs

- `docs/AR-MICROSOFT-PRODUCTION-VERIFICATION-2026-10-09.md` — verification snapshot  
- `docs/AR-MICROSOFT-PRODUCTION-HARDENING-RESULTS.md` — hardening implementation + tests  
- `docs/AR-SMS-LIVE-RESCHEDULE-VERIFICATION-2026-10-08.md` — prior live SMS / C-R-X evidence (ws_1)
