# Appointment Reminders — End-to-End Wiring Audit

**Baseline:** `master` (premium New UI 2 — pre–restraint-pass screenshots)  
**Date:** 2026-10-07  
**Method:** Code path tracing (UI → API → lib/runtime → DB). Not a live SMS/PSTN certification run.

## Status legend

| Label | Meaning |
|-------|---------|
| **Full** | UI control → API → persistence/runtime; not mock data on that path. |
| **Partial** | Real wiring with gaps (permissions, scale, UI vs sender mismatch, missing step). |
| **Not hooked** | Placeholder, dead navigation, or no end-to-end path. |

---

## Product shell & navigation

| Area | Status | Notes |
|------|--------|--------|
| Sidebar (Overview, Appointments, Reminders, Calendars, Reminder Settings) | **Full** | `buildAppointmentRemindersNav()` → real routes. |
| Plan & Billing / Business Settings | **Full** | Shared `/settings/*` routes; same auth as rest of app. |
| Product switcher (`appointment_reminders` shell) | **Partial** | Gated by `hasAppointmentReminders` entitlement flags in product shell; not re-checked on every AR API (most AR APIs only use `requireSession()`). |
| Setup (`/appointment-reminders/setup/connect`, `/setup/activate`) | **Partial** | Routes exist and render; **not in sidebar** — manual/deep link only. |
| Legacy `/appointments/reminders` | **Full** | Redirects to AR Reminder Settings. |

---

## 1. Overview (`/appointment-reminders`)

| UI element | Status | Connection |
|------------|--------|------------|
| Page load / Refresh | **Full** | `GET /api/appointment-reminders/overview` → `loadAppointmentRemindersOverview()` (Prisma calendars + appointment/reminder loaders). |
| KPI strip (today, sent today, scheduled, failed 7d) | **Full** | Derived from real appointment/reminder loaders (same engines as list pages). |
| Active / Needs attention / Setup incomplete pill | **Partial** | Based on calendar **connection status**, not “import calendars selected” or “SMS sender ready”. |
| Warning callout (calendar unhealthy) | **Full** | Same calendar health signal. |
| Recent reminder activity | **Full** | Last ~6 rows from operational reminder loader (timeline + future schedule). |
| Connected calendars panel | **Full** | `voiceCalendarConnection` + `importCalendarIds` count + `lastSyncAt`. |
| Quick links | **Full** | In-app routes only. |
| Promotional emphasis strip | **Full** (UI only) | No backend; navigation to Calendars. |

**Gaps:** Overview does not surface SMS sender/A2P readiness (that lives on Reminder Settings stats API). “Healthy” can show **Active** with zero import calendars selected.

---

## 2. Appointments (`/appointment-reminders/appointments`)

| UI element | Status | Connection |
|------------|--------|------------|
| Table + mobile rows | **Full** | `GET /api/appointment-reminders/appointments` → `buildAppointmentsDirectory` + `computeAggregateReminderView` + AR contact display. |
| Default filter **Upcoming** | **Full** | API default `date=upcoming`. |
| Search, date, reminder status, calendar filters | **Full** | Query params → server filter (directory take **500** then filter/paginate in memory). |
| Pagination | **Partial** | Works on filtered set; **not DB-level** pagination — large workspaces can miss rows beyond the 500 cap. |
| KPI strip | **Full** | From same payload `summary`. |
| Sync now | **Full** | `POST /api/appointment-reminders/sync` → `syncWorkspaceCalendarConnection` per connected connection with `importCalendarIds`. |
| Sync status / last sync in header | **Full** | From connections + optional `lastSyncError` in config. |
| Empty states (no calendar, sync error, no rows) | **Full** | Driven by `sync.connected`, errors, and row count. |
| Detail drawer open | **Full** | Row click opens drawer. |
| Drawer: appointment + reminder timeline | **Partial** | `GET /api/appointments/:id` + `GET /api/appointments/:id/reminder-timeline` — requires **`appointments.read`**, not just session. AR-only roles may see the list but **403 in drawer**. |
| Drawer: save reminder phone | **Partial** | `PATCH /api/appointment-reminders/appointments/:id/reminder-contact` → `metadata.reminderOverride.phone` — requires **`appointments.write`**. |
| Drawer: consent line | **Partial** | UI reads `smsCapable` / `emailOnly` from metadata; **no in-drawer consent capture** — points to policy/compliance elsewhere. |
| Open in calendar | **Partial** | Only if `sourceEventUrl` on metadata (often missing for imports). |
| Reminders page link `?open=appointmentId` | **Not hooked** | Reminders drawer links to `?open=` but Appointments page **does not read** that param. |

**Phone display fix (email ≠ phone):** **Full** in list via `resolveArAppointmentContactDisplay`.

---

## 3. Reminders log (`/appointment-reminders/reminders`)

| UI element | Status | Connection |
|------------|--------|------------|
| Table + filters (status, horizon, search) | **Full** | `GET /api/appointment-reminders/reminders` → `loadAppointmentRemindersOperationalPage`. |
| Past SMS events (“Sent”, “Recorded”, failed) | **Full** | `buildDedicatedReminderTimeline` + `mapSmsReminderTimelineOutcome` (internal/cleared → **Recorded**). |
| Future scheduled / blocked rows | **Full** | `buildFutureReminderSchedule` + block reasons (phone, consent flags in metadata). |
| KPI strip | **Full** | From filtered `summary` (computed on same in-memory row set). |
| Row drawer | **Partial** | Read-only summary + link to appointments; **not** full appointment drawer. |
| Edit SMS sequence button | **Full** | Nav to settings. |
| Scale | **Partial** | Loader scans **latest 200** `voiceAppointment` rows per workspace — not full history at scale. |

---

## 4. Calendars (`/appointment-reminders/calendars`)

| UI element | Status | Connection |
|------------|--------|------------|
| Page chrome + banner | **Full** (UI) | Wraps shared integration component. |
| Google / Microsoft connect | **Partial** | `POST /api/integrations/calendars` + OAuth redirect `/api/integrations/calendars/oauth/{provider}` — **Full** when env configured. **Google: Not hooked** in prod until `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET`. Microsoft: **Full** when Microsoft OAuth env set. |
| Provider calendar list | **Full** | `GET .../provider-calendars`. |
| Import calendar selection + rules | **Full** | `PATCH /api/integrations/calendars/:id` → `patchWorkspaceCalendarConnectionSettings` (shared with Appointments product). |
| Save connection | **Full** | Persists config; can register Microsoft push; **may enqueue** `enqueueCalendarConnectionSync` when import newly enabled (`connection-settings.ts`). |
| Sync now (per connection) | **Full** | `POST /api/integrations/calendars/:id/sync`. |
| Verify Microsoft | **Full** | `POST .../verify`. |
| Disconnect | **Full** | `DELETE .../calendars/:id`. |
| AR variant hides availability blocking | **Full** | `variant="appointment_reminders"`. |
| First import without visiting Appointments | **Partial** | Auto-sync on save **only** when backend treats import as newly enabled; UX still tells users to sync from Appointments in places. No dedicated onboarding gate. |

**Import → appointments:** **Full** via `syncWorkspaceCalendarConnection` / `processCalendarProviderEvent` → `voiceAppointment` + contact resolution + `smsCapable` / `emailOnly` on metadata.

---

## 5. Reminder Settings (`/appointment-reminders/settings`)

| UI element | Status | Connection |
|------------|--------|------------|
| Load sequence | **Partial** | `GET /api/appointments/settings` — requires **`appointments.read`** (not AR-specific auth). |
| Save sequence | **Partial** | `PATCH /api/appointments/settings` — requires **`appointments.settings.manage`**. |
| Timeline (toggle, timing, add step, edit) | **Full** | Client state → same PATCH `reminders` blob in platform config (shared with full Appointments). |
| Customer preview tab | **Full** | `GET /api/appointments/reminders/test?step=` → `previewReminderMessage` (sample merge data; may inject **preview** manage/reschedule URLs even for calendar-only product). |
| Send test SMS | **Partial** | `POST /api/appointments/reminders/test` → `sendTestReminderSms` — real SMS path if sender works; same permission stack as appointments APIs. |
| Workspace stats strip | **Full** | `GET /api/appointments/reminders/workspace` (steps, scheduled/sent/failed, SMS readiness via merchant status). |
| Compliance callout → `/compliance` | **Full** | Link only; compliance product separate. |
| Platform-sender template lock | **Not hooked** | Editor allows free-form templates + all merge tags (`{{manage_link}}`, etc.); no AR-specific lock in this UI. |
| “Drip” copy | **UI only** | Terminology only; engine is platform reminder config. |

---

## 6. Setup Connect / Activate

| UI element | Status | Connection |
|------------|--------|------------|
| Connect calendar (same as Calendars) | **Partial** | Same as §4; **Continue** on setup does **not** validate calendar/import before `/setup/activate`. |
| Activate checklist | **Not hooked** | Static copy + links; **no** “activated” flag, no gating of sends, no wizard state API. |

---

## Shared components

| Component | Status |
|-----------|--------|
| `ReminderStatusPill` | **Full** — display only from aggregate status. |
| `OpusDataSurface` / search / skeletons | **Full** — presentation only. |
| `ReminderSequenceTimeline` | **Full** — drives local config until Save. |

---

## Backend / runtime (what actually sends SMS)

| Capability | Status | Notes |
|------------|--------|--------|
| Calendar import | **Full** | Microsoft/Google → `voiceAppointment` + metadata. |
| Scheduled 24h / 2h / extra steps | **Partial** | `appointments_platform_reminder_scan` job → `scanPlatformAppointmentReminders()` (~4‑minute fire window). Depends on **job scheduler running** in prod. |
| **Booking confirmation** step (immediate) | **Not hooked** for calendar import | Scan **excludes** `immediate` confirmation; import path does **not** send confirmation SMS. UI shows step; calendar-import customers likely **never** get that SMS unless another path sends it (e.g. voice booking). |
| Phone used at send time | **Partial** | Scan uses `meta.inviteePhone` + contact phone — **`reminderOverride.phone` from AR drawer is not applied** in `scanPlatformAppointmentReminders` (UI aggregate view **does** use override). |
| Consent (`smsCapable` / `emailOnly`) | **Partial** | AR **UI** blocks as “Consent required”; scan checks `smsConsent === false` but **not** `smsCapable`/`emailOnly` the same way. |
| SMS sender / A2P | **Partial** | `sendInternationalAppointmentSms` / `sendAppointmentSms`; readiness surfaced in settings workspace API; failures show in timeline. |
| Manage/reschedule links in templates | **Partial** | Rendered if tokens/metadata exist; calendar-import appointments often **no** real manage URL — messages can still contain `{{manage_link}}` placeholders. |
| Automation “starting soon” scan | **Separate** | `appointment_starting_soon_scan` → integration automations — **not** the same as platform reminder sequence in AR settings. |

---

## Auth & permissions (cross-cutting)

| Pattern | Status |
|---------|--------|
| AR list/overview/sync APIs | **Session only** (`requireSession`) |
| Appointments detail, timeline, settings, test SMS | **Appointments permissions** (`appointments.read`, `appointments.write`, `appointments.settings.manage`) |
| Phone PATCH | **`appointments.write`** |

**Risk:** A workspace user with AR shell access but **without** appointments permissions can use Overview/Appointments/Reminders lists but **cannot** open drawer details, edit templates, or send tests.

---

## Key file references

| Layer | Paths |
|-------|--------|
| Routes | `src/lib/appointment-reminders/routes.ts` |
| Pages | `src/newui-transplant/connected/appointment-reminders/*.tsx` |
| AR APIs | `src/app/api/appointment-reminders/**` |
| Loaders | `src/lib/appointment-reminders/load-*.ts` |
| Calendar UI | `src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx` |
| Import | `src/lib/calendar/import-sync.ts` |
| Send scan | `src/lib/appointments/reminder-delivery.ts` (`scanPlatformAppointmentReminders`) |
| Job | `appointments_platform_reminder_scan` in `src/lib/jobs/job-handlers.ts` |
| Settings / test | `src/app/api/appointments/settings`, `.../reminders/test`, `.../reminders/workspace` |

---

## Summary: closest to “sellable” vs not

### Mostly end-to-end today (with env + jobs + permissions)

Connect **Microsoft** → select import calendars → sync → see appointments with phone/consent states → configure sequence → **timed** SMS via scan job → see log/overview activity → fix phone in drawer (if permitted).

### Not 100% or missing

1. **Google OAuth** in environment (UI shows “not configured”).
2. **Confirmation SMS** after import (sequence step exists; send path missing for imports).
3. **Drawer phone override** not used by sender (display/scheduling yes; delivery gap).
4. **Consent** UI vs delivery alignment (`smsCapable` / `emailOnly`).
5. **Setup/activate** and **onboarding** (no real wizard state; setup not in nav).
6. **Reminders → Appointments** deep link (`?open=`).
7. **Scale** (500 appointment cap in loader; 200 appointments in reminder log).
8. **Platform-sender template restrictions** not enforced in AR settings UI.
9. **Permission split** between AR session APIs and appointments APIs.

---

## Suggested certification order (no UI redesign)

1. Microsoft connect + import calendar selection + sync  
2. Appointment with valid E.164 phone on imported event  
3. Consent/smsCapable state matches what sender enforces  
4. `appointments_platform_reminder_scan` running in prod  
5. Test SMS from Reminder Settings  
6. Wait for or force a 24h/2h window → verify timeline + Reminders log + real delivery  
7. Repeat with drawer phone override after fixing delivery to honor `reminderOverride.phone`

---

## Update — 2026-10-07 (branch `cursor/appointment-reminders-e2e-complete-f350`)

**Baseline commit:** `5ce061c0` (premium New UI 2 on master). This pass wires runtime/auth gaps without UI redesign.

| Area | Prior | After this pass | Evidence |
|------|-------|-----------------|----------|
| AR API auth | Session only | Entitlement + `appointment_reminders.*` permissions (`api-auth.ts`, all `/api/appointment-reminders/*`) | Code + unit tests pending for 403 matrix |
| Drawer detail/timeline | `appointments.read` | `GET /api/appointment-reminders/appointments/:id` (+ timeline) | Drawer fetches AR routes |
| Phone PATCH | `appointments.write` | `appointment_reminders.write` | `reminder-contact/route.ts` |
| SMS eligibility | UI vs scan mismatch | Shared `evaluateSmsReminderEligibility()` in UI loaders + `scanPlatformAppointmentReminders` | `sms-eligibility.test.ts` |
| Effective phone at send | Override ignored | `resolveEffectiveReminderPhone()` in delivery scan | `reminder-delivery.ts` |
| Confirmation on import | Not hooked | `maybeSendImmediateConfirmationForAppointment()` after future imports only | `import-sync.ts` |
| Overview status pill | OAuth only | `readiness.operationalStatus` (import calendars + sync + SMS sender) | `load-ar-overview.ts`, overview page |
| `?open=appointmentId` | Not hooked | Appointments page opens drawer via query | `appointments-page.tsx` |
| Scale | 500 / 200 caps | 5000 appointment directory window; 1500 reminders scan (still in-memory) | **Partial** — not full DB pagination |
| Setup activate | Static | **Unchanged** | Still needs persisted activation API |
| Platform template lock | Not hooked | **Unchanged** | API enforcement still required |
| Billing / usage limits | Not audited | **Unchanged** | Trace `MASS_TEXTING` / AR SKU separately |
| Google OAuth | Env-dependent | **Unchanged** | Requires `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET` |
| Launch certified SMS | N/A | **Not claimed** | Needs live scheduler + authorized send |

**Remaining for code-complete:** AR settings/test APIs with AR permissions; platform-sender template enforcement; setup activation persistence; DB-level pagination; billing metering; broader automated test suite; regression on shared Appointments/Voice paths.

**Remaining for launch-certified:** Production job scheduler, real Google/Microsoft sync, approved sender + live SMS evidence, usage limit enforcement.
