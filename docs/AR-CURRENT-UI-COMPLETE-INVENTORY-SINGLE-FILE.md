# Appointment Reminders — Complete UI Inventory (Single File)

**READ-ONLY inventory · 2026-10-11 · As-built from codebase**

## Table of contents

1. [Executive summary](#executive-summary)
2. [Part A — Route & navigation map](#part-a--route--navigation-map)
3. [Part B — Page-by-page feature inventory](#part-b--page-by-page-feature-inventory)
4. [Part C — Settings deep inventory](#part-c--settings-deep-inventory)
5. [Part D — Discoverability matrix](#part-d--discoverability-matrix)
6. [Part E — Full UI hierarchy](#part-e--full-ui-hierarchy)

---

## Executive summary

| Metric | Count |
|--------|------:|
| App routes (page.tsx under appointment-reminders) | 25 |
| Primary sidebar destinations (booking hidden) | 10 (+2 account links) |
| Major tab bars | 5 |
| Distinct drawer/sheet/modal flows | ~10 |
| Significant controls (estimate) | ~220–280 |
| Settings tabs (visible) | 5 (scheduling, business, notifications, integrations, billing) |

**Settings tabs:** Scheduling & rules · Business profile · Notifications & responses · Integrations · Plan & billing

**Visual verification:** CODE-INFERRED (not screenshot-certified on this pass).

---

## Part A — Route & navigation map

**Pass type:** READ-ONLY inventory (no product changes)  
**As-built source:** Next.js App Router under `src/app/(app)/appointment-reminders/**`, `src/lib/products/appointment-reminders-nav.ts`, connected shells in `src/newui-transplant/connected/appointment-reminders/**`  
**Inventory date:** 2026-10-11  
**Visual verification:** CODE-INFERRED (responsive behavior taken from component classes and nav config; live browser pass on Cloud VM was unstable — not used as authority)

---

### 1. Product shell & navigation sources

| Mechanism | File / behavior |
|-----------|-----------------|
| Desktop sidebar | `buildAppointmentRemindersNav()` → `resolveProductSidebarNav()` when product shell is `appointment_reminders` |
| Mobile bottom nav (4 slots + **More**) | `buildAppointmentRemindersMobileNav()` — **More** opens full sidebar (`app-shell.tsx` → `Sidebar`) |
| Route constants | `src/lib/appointment-reminders/routes.ts` (`AR_ROUTES`) |
| Page titles | `getAppointmentRemindersPageTitle()` |
| Booking submodule nav | Hidden when `appointmentRemindersHideBookingNav()` is true (default: `isAppointmentRemindersV1Primary()`) — routes still exist |
| Shared workspace pages (keep AR shell) | `/settings/billing`, `/settings/business` (`isAppointmentRemindersSharedWorkspacePath`) |
| External shared links from AR UI | `/compliance`, `/contacts` (linked from notifications panel) |

### 1.1 Desktop sidebar (current)

When booking nav **hidden** (typical V1 AR launch):

| Label | Route | Notes |
|-------|-------|--------|
| Overview | `/appointment-reminders` | `matchExact` |
| Appointments | `/appointment-reminders/appointments` | |
| Calendar | `/appointment-reminders/calendar` | Read-only grid |
| Reminders | `/appointment-reminders/reminders` | **Children:** Activity & delivery, Sequences, Templates |
| Responses | `/appointment-reminders/responses` | |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` | |
| Analytics | `/appointment-reminders/analytics` | |
| Settings | `/appointment-reminders/settings` | Query tabs |
| Plan & Billing | `/appointment-reminders/settings?tab=billing` | Account section |
| Business Settings | `/settings/business` | **Shared** org settings |

When booking nav **visible** (env `AR_HIDE_BOOKING_NAV=0`): adds **Booking page**, **Meetings** under Booking section.

### 1.2 Mobile bottom nav (current)

When booking hidden:

| Slot | Label | Route |
|------|-------|-------|
| 1 | Home | `/appointment-reminders` |
| 2 | Appointments | `/appointment-reminders/appointments` |
| 3 | Reminders | `/appointment-reminders/reminders` |
| 4 | Settings | `/appointment-reminders/settings` |
| 5 | **More** | Opens sidebar (Calendar, Responses, AI Rescheduler, Analytics, Reminders children, Plan & Billing, Business Settings, product switcher) |

**Not in bottom nav:** Sequences, Templates, Responses, Analytics, Calendar — reachable via Reminders hub tabs, More → sidebar, or in-page links.

---

### 2. Route tree (customer-facing pages)

Legend: **R** = route URL · **T** = tab/query state · **D** = drawer/sheet (no URL) · **↪** = redirect

```
/appointment-reminders                          [R] Overview
/appointment-reminders/appointments             [R] Appointments list (+ query filters)
/appointment-reminders/calendar                 [R] Calendar (read-only)
/appointment-reminders/reminders                [R] Reminders hub — Activity & delivery
/appointment-reminders/reminders/sequences      [R] Reminders hub — Sequences
/appointment-reminders/reminders/templates      [R] Reminders hub — Templates
/appointment-reminders/reminders/sequences/[stepKey]/edit  [R] Full-page sequence step editor
/appointment-reminders/responses                [R] Responses (+ ?view=)
/appointment-reminders/held-inbound             [↪] → /responses?view=held
/appointment-reminders/analytics                [R] Analytics
/appointment-reminders/settings                 [R] Settings (+ ?tab=)
/appointment-reminders/settings?tab=sequence    [↪] → /reminders/sequences
/appointment-reminders/settings?tab=templates   [↪] → /reminders/templates
/appointment-reminders/calendars                [R] Calendars (duplicate integration surface; not in sidebar)
/appointment-reminders/calendars                [R] (same as above)
/appointment-reminders/ai-rescheduler           [R] AI Rescheduler
/appointment-reminders/pricing                  [R] Pricing / plan marketing
/appointment-reminders/setup/connect            [R] Onboarding step 1
/appointment-reminders/setup/configure          [R] Onboarding step 2
/appointment-reminders/setup/activate           [R] Onboarding step 3
/appointment-reminders/booking                  [R] Booking page (nav optional)
/appointment-reminders/booking/meetings         [R] Meetings list
/appointment-reminders/booking/meetings/new     [R] New meeting
/appointment-reminders/booking/meetings/[id]    [R] Meeting detail
/appointment-reminders/booking/services         [R] Services list
/appointment-reminders/booking/services/new       [R] New service
/appointment-reminders/booking/services/[id]      [R] Service detail
/signup/appointment-reminders                   [R] AR signup entry (auth layout)
/settings/business                              [R] Shared — Business Settings (AR shell)
/settings/billing                               [R] Shared — may duplicate billing entry
```

**Page file count:** 25 `page.tsx` files under `src/app/**/appointment-reminders/**` (includes API-adjacent app routes only in `(app)` group).

---

### 3. In-page navigation (not separate routes)

| Parent | Mechanism | States / IDs |
|--------|-----------|----------------|
| Settings | Horizontal tab bar | `scheduling`, `business`, `notifications`, `integrations`, `billing` (+ legacy `sequence`/`templates` redirect) |
| Reminders hub | Horizontal tab bar | `activity`, `sequences`, `templates` |
| Responses | Horizontal tab bar | `view=needs_attention` (default), `all`, `held` |
| Appointments | Engagement filter tabs | `all`, `upcoming`, `awaiting_confirmation`, `confirmed`, `reschedule_requested`, `cancellation_requested`, `needs_attention`, `completed` |
| Appointments | URL query filters | `q`, `date`, `reminderStatus`, `calendarId`, `page`, `pageSize`, `highlight`, `open` |
| Reminders activity | URL query filters | `q`, `status`, `horizon`, `page`, `pageSize` |
| Appointment detail | Sheet tabs | `details`, `reminders`, `activity`, `preferences` |
| Analytics | Date range | Query-driven (see analytics page) |

---

### 4. Click depth from Overview (typical)

Assumes user lands on `/appointment-reminders` (Overview). Counts **clicks/taps**; opening a drawer counts as +1 interaction.

| Destination | Path | Depth (clicks) | Desktop sidebar | Mobile bottom |
|-------------|------|----------------|-----------------|---------------|
| Appointments list | Sidebar / bottom | 1 | Yes | Yes |
| Appointment detail drawer | Appointments → row | 2 (+ drawer) | — | — |
| Calendar | Sidebar / More | 1–2 | Yes | More only |
| Reminders activity | Sidebar / bottom / link | 1 | Yes (child) | Yes (hub default) |
| Sequences | Reminders tab or sidebar child | 2 | Child link | 2 (Reminders → tab) |
| Step editor (full page) | Sequences → Edit | 3 | — | 3 |
| Templates | Reminders tab | 2 | Child | 2 |
| Responses | Sidebar / More / Overview link | 1–2 | Yes | More |
| AI Rescheduler | Sidebar / More | 1–2 | Yes | More |
| Analytics | Sidebar / More | 1–2 | Yes | More |
| Settings (scheduling default) | Sidebar / bottom | 1 | Yes | Yes |
| Settings → Integrations | Settings tab | 2 | — | 2 |
| Plan & billing | Sidebar account / Settings tab | 1–2 | Yes | More |
| Setup connect | Product onboarding / links | 2+ | No permanent nav | No |
| `/calendars` | No sidebar link | Orphan unless linked | No | No |

---

### 5. OAuth & off-app flows (customer-visible)

| Flow | Entry | Return |
|------|-------|--------|
| Microsoft calendar OAuth | Integrations tab, Setup connect, `/calendars` | `returnTo` query on `CalendarIntegrationsOpus` |
| Stripe checkout / portal | Plan & billing | External Stripe URLs |
| Export CSV | Reminders / Responses headers | `GET /api/appointment-reminders/export/*` download |

---

### 6. API routes (not pages — reference for save targets)

Settings UI persists primarily to:

- `PATCH /api/appointment-reminders/settings`
- `POST /api/appointment-reminders/settings/presets`
- `POST /api/appointment-reminders/settings/apply-template`
- `PATCH /api/integrations/calendars/:id` (integrations UI)
- `PATCH /api/appointment-reminders/operational-pause`
- Billing: `/api/appointment-reminders/billing/*`

Listed for Settings deep inventory cross-reference; not customer navigation.

---

### 7. Orphan / duplicate entry points (discoverability notes)

| Surface | Issue |
|---------|--------|
| `/appointment-reminders/calendars` | Full page exists; **not** in primary sidebar — overlaps Settings → Integrations |
| Settings `?tab=sequence` / `?tab=templates` | Redirect to Reminders hub (backward compatible) |
| `/appointment-reminders/held-inbound` | Legacy redirect to Responses held tab |
| Booking routes | Present in codebase; nav hidden by default |
| Test send / template preview | Settings notifications tab + step editor; API `GET/POST .../reminders/test` |

---

### 8. Completeness checklist (route map)

- [x] All `(app)/appointment-reminders/**/page.tsx` routes listed  
- [x] Signup AR route listed  
- [x] Shared `/settings/*` paths noted  
- [x] Tabs vs routes distinguished  
- [x] Mobile vs desktop nav documented separately  
- [ ] Live mobile overflow menu labels — CODE-INFERRED from sidebar parity  

**Next doc:** `AR-CURRENT-UI-COMPLETE-FEATURE-INVENTORY.md` (per-page controls).

---

## Part B — Page-by-page feature inventory

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Method:** Static analysis of `src/newui-transplant/**/appointment-reminders/**`, `src/app/(app)/appointment-reminders/**`, shared integration components.  
**Visual:** CODE-INFERRED unless noted.

This document lists **customer-facing** surfaces and controls. Backend-only behavior is marked **BACKEND-ONLY**.

---

### Overview (`/appointment-reminders`)

**Component:** `overview-page.tsx`

### Header

| Control | Action |
|---------|--------|
| Status pill | Active / Paused / Needs attention / Setup incomplete |
| Add appointment | → Appointments |
| Settings | → Settings |
| Refresh | reload overview API |

### Banners / operational

| Surface | Controls |
|---------|----------|
| Load error callout | Try again |
| Paused callout | Resume reminders |
| Pause all reminders | button (when activated) |

### Upcoming appointments panel

`ArUpcomingAppointmentsPanel` — list with customer, appointment, time, response pills, needs-attention styling; links to appointments.

### KPI stat grid (4)

| Stat | Link query |
|------|------------|
| Upcoming appointments | `appointments?engagement=upcoming` |
| Awaiting reply | `engagement=awaiting_confirmation` |
| Confirmed | `engagement=confirmed` |
| Needs attention | `responses?view=needs_attention` |

### Customer replies panel

`ArOverviewConversationsPanel`:

| Control | |
|---------|---|
| List rows (max 8) | customer, appointment, preview, unread, pills |
| View all conversations | → Responses |
| Open thread | opens **Sheet** thread drawer |
| Thread drawer | message list inbound/outbound/system; link open appointment |
| Plan gate | empty state when Starter+ SMS responses required |

### Product status cards (dynamic)

Links from API `productStatus[]` — e.g. calendar, sender, activation (href per card).

### Needs attention table

Columns: Customer, Appointment, Issue, Last activity, Open → appointments `?highlight=`

### Calendar warning callout

When unhealthy → Integrations link.

### Feature emphasis strip

"Automatic SMS from your calendar" → Manage calendars.

### Recent reminder activity table

Columns: Recipient, Channel, Message, Status, Time · View all → Reminders.

### Connected calendars panel

Per connection: provider, label, email, import count, last sync · Manage → Integrations.

### Quick links panel

Appointments, Responses, Reminder log, SMS sequence.

---

### Appointments (`/appointment-reminders/appointments`)

**Component:** `appointments-page.tsx`

### Header

| Control | |
|---------|---|
| Sync status meta | relative time |
| Add appointment | opens **Sheet** manual create |
| Sync now | POST sync |
| Connect calendar | → Integrations (if not connected) |

### Stat grid

Upcoming, Scheduled reminders, Sent (30d), Needs attention.

### Engagement tabs (8)

All, Upcoming, Awaiting reply, Confirmed, Reschedule requested, Cancellation requested, Needs attention, Completed.

### Toolbar filters

| Control | |
|---------|---|
| Search | debounced `q` |
| Date range | upcoming / today / next7 / next30 / past / all |
| Reminder status | all / scheduled / sent / delivered / needs_attention / not_scheduled / cancelled |
| Calendar | all + per-connection |
| Rows per page | 25/50/100 |
| Pagination | prev/next |

### Table columns

Customer (avatar), Appointment, When, Phone, Reminder status pill, Customer response pill, Source, Row menu.

### Row interactions

| Action | |
|--------|---|
| Row click | **AppointmentDetailDrawer** |
| Row menu | Open, Copy phone, etc. (DropdownMenu) |
| `?highlight=` / `?open=` | auto-open drawer |

### Manual add appointment sheet

Fields: name, email, phone, service, starts at · Save → import API · Cancel.

### Appointment detail drawer

**Component:** `appointment-detail-drawer.tsx` — **Sheet**, tabs:

#### Tab: Details

Service, time, timezone, provider, consent/eligibility text, customer response summary, reschedule request approve/reject (when pending), evidence summary, SMS thread snippets, links.

#### Tab: Reminders

Timeline future/past steps, engagement per step, suppression state.

#### Tab: Activity

Customer action history list; dispatch records.

#### Tab: Preferences

Phone, email edits; recipient channel select (sms/email/both); Save contact; Suppress reminders toggle; reminder suppress errors.

---

### Calendar (`/appointment-reminders/calendar`)

**Component:** `ar-calendar-opus.tsx` + `ar-calendar-opus-view.tsx`

| Surface | |
|---------|---|
| Read-only event grid | |
| Event click | **Sheet** `ar-calendar-event-sheet` — event metadata, link to appointment if mapped |
| Refresh / connection state | |

---

### Reminders — Activity (`/appointment-reminders/reminders`)

**Hub tab:** Activity · **Component:** `reminders-page.tsx` + `ArRemindersHubShell`

### Hub tabs (all Reminders routes)

Activity & delivery | Sequences | Templates

### Header actions

Edit sequence → Sequences · Refresh · Export CSV (30d).

### Stat grid

Scheduled, Sent (30d), Failed (7d), Blocked.

### Filters

Search, Status (9 values), Horizon (all/upcoming), pagination.

### Table columns

Appointment (customer), Reminder, When, Channel, Status pill.

### Row click

**Sheet** detail: customer, appointment, status, detail, action hint, Open appointment, Close.

---

### Reminders — Sequences (`/reminders/sequences`)

**Component:** `ar-reminders-sequences-page.tsx` → settings opus `sequence-hub`

| Control | |
|---------|---|
| Save changes | |
| Drip sequence timeline | per-step: timing (non-confirmation), enable switch, channel pill, preview snippet, Edit message → **full-page editor route** |
| Add step / upgrade CTA | plan limit |
| Compliance callout | → /compliance |

---

### Reminders — Templates (`/reminders/templates`)

| Control | |
|---------|---|
| Save changes | |
| Starter packs panel | industry, timing preset, Apply preset |
| Template library | see browser section |
| Customer preview | per enabled step rendered text |

### Template library browser (`ArTemplateLibraryBrowser`)

| Control | |
|---------|---|
| Industry filter | |
| Channel filter | |
| Message type filter | |
| Search | |
| Browse all toggle | paginated table |
| Row open | **Sheet** preview + optional read-only editor |
| Apply to step | opens apply sheet on parent (step picker) |

---

### Reminders — Step editor (`/reminders/sequences/[stepKey]/edit`)

Full-page `SequenceStepEditor` — see Settings deep inventory for full control list; adds sticky Save/Back and desktop preview panel.

---

### Responses (`/appointment-reminders/responses`)

**Component:** `ar-responses-opus.tsx`

### Tabs

Needs attention (default) | All responses | Held

### Header

Export CSV (30d).

### Table columns

Customer, Appointment, Response pill, Channel, When, Action (Open appointment / held resolve).

### Held tab actions

Dismiss, Route to AR (when applicable) — per-row buttons.

**Note:** Full SMS thread on Overview panel and appointment drawer — not a dedicated full-page inbox route.

---

### AI Rescheduler (`/appointment-reminders/ai-rescheduler`)

**Component:** `ar-ai-rescheduler-opus.tsx` (large form)

| Area | Controls (representative) |
|------|---------------------------|
| Mode selection | reminders_only / notify / ai (plan-gated) |
| SMS action policies | cancel, reschedule, confirm — cutoff minutes, after-cutoff mode, penalty types |
| Business hours for AI | |
| Staff notification emails | |
| Save | PATCH ai-rescheduler API |
| Operations log table | recent AI operations (API-fed) |

**Plan:** Growth/Business for full AI mode per `ar-plan-catalog`.

---

### Analytics (`/appointment-reminders/analytics`)

**Component:** `analytics-page.tsx`

| Control | |
|---------|---|
| Date range | presets + custom |
| KPI stats | sends, failures, replies, etc. |
| By channel table | |
| By reminder step table | |
| No-show cost estimate | illustrative inputs |

---

### Settings

See **`Part C below`** (authoritative for tabs).

---

### Calendars standalone (`/appointment-reminders/calendars`)

Duplicate integration page: header + `CalendarIntegrationsOpus` — same controls as Integrations tab.

---

### Pricing (`/appointment-reminders/pricing`)

**Component:** `ar-pricing-page.tsx` — plan comparison, CTA to billing/checkout (marketing).

---

### Setup wizard (process routes)

| Step | Route | Key controls |
|------|-------|--------------|
| 1 Connect | `/setup/connect` | CalendarIntegrationsOpus, Continue |
| 2 Configure | `/setup/configure` | `ArSetupConfigurePanel` — business, industry, sequence preview, consent copy |
| 3 Activate | `/setup/activate` | Readiness checklist, SMS consent attestation checkbox, Activate |

Not in permanent sidebar; reached from onboarding/product-open.

---

### Booking submodule (routes exist; nav often hidden)

| Route | Purpose |
|-------|---------|
| `/booking` | Booking page editor |
| `/booking/meetings` | Meetings workspace |
| `/booking/services` | Service types |
| new/[id] routes | CRUD forms |

**Component families:** `booking-page-opus.tsx`, `ar-meetings-workspace-opus.tsx`, `booking-services-page.tsx`, etc.

---

### Signup

`/signup/appointment-reminders` — AR product signup (auth layout).

---

### Shared surfaces used by AR

| Route | AR usage |
|-------|----------|
| `/settings/business` | Sidebar Business Settings |
| `/compliance` | Sender/compliance links |
| `/contacts` | Recipient preferences link |

---

### Overlay inventory (AR-specific)

| Overlay | Host page(s) |
|---------|----------------|
| AppointmentDetailDrawer | Appointments |
| Manual add appointment Sheet | Appointments |
| Reminder row detail Sheet | Reminders activity |
| Overview conversation Sheet | Overview |
| Template preview Sheet | Templates library |
| Apply template Sheet | Templates (settings opus) |
| Step edit Sheet | Settings only if `presentation=settings` + sequence tab (legacy; tab removed) |
| Calendar event Sheet | Calendar |
| Dropdown row menus | Appointments |

**Approx. overlay component references:** 60+ JSX occurrences across AR connected/components (includes Sheet headers, dialogs).

---

### Backend-only (no dedicated UI)

Examples: `GET /api/appointment-reminders/ops/metrics`, webhook handlers, dispatch workers, eligibility engine internals, Luna phone extraction — see AR completion matrix for WS rows without UI.

---

### Matrix cross-reference (86 applicable rows)

| UI area | Example matrix IDs |
|---------|-------------------|
| Overview / pause | WS7-06, operational pause |
| Appointments / phone | WS3-05, WS3-14 |
| Integrations / import | WS1-02, WS2-01, WS2-13 |
| Sequence / templates | WS1-13, WS3-07, WS8-08 |
| Responses / SMS | WS2-11, WS3-07, WS3-10 |
| Billing | WS7-01, WS7-02 |
| AI rescheduler | WS5-* (see matrix) |
| Analytics | WS6 / WS7 |

Full row-by-row mapping is in **`Part D below`** (feature-level, not all 86 duplicated here).

---

### Control count reconciliation (estimate)

| Category | Count (estimated) |
|----------|-------------------|
| Distinct routes (app pages) | 25 |
| Primary sidebar destinations | 10 (+ booking when shown) |
| Major tab bars | 5 (Settings, Reminders hub, Responses, Appointments engagement, appointment drawer) |
| Drawers/sheets/modals (distinct flows) | ~10 |
| Significant labeled controls (inputs, buttons, toggles, selects) | **~220–280** across AR UI |

Exact control count varies with dynamic rows (rules, steps, connections). Inventory above enumerates **types**; dynamic lists multiply instances.

---

## Part C — Settings deep inventory

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Primary UI:** `/appointment-reminders/settings?tab={tab}` → `settings-page.tsx` + `AppointmentRemindersSettingsOpus` (`reminder-settings-opus.tsx`)  
**Persistence:** `PATCH /api/appointment-reminders/settings` (workspace platform config), plus integration APIs for calendars.

---

### Settings shell

| Control | Behavior |
|---------|----------|
| Page title | "Settings" |
| Description | Points users to Reminders for sequence/templates |
| Cross-links | "reminder sequence" → `/reminders/sequences`; "template library" → `/reminders/templates` |
| Tab bar | `scheduling` (default), `business`, `notifications`, `integrations`, `billing` |
| Legacy URLs | `?tab=sequence` → redirect Sequences; `?tab=templates` → redirect Templates |
| Global Save | "Save changes" button (all tabs share one save handler) |
| Saved indicator | "Saved" status text when clean |

**Note:** Sequence and template **editing** UI also renders on Reminders hub routes (`presentation=sequence-hub|templates-hub`) with the same underlying component and save API — documented in feature inventory.

---

### Tab: Scheduling & rules (`tab=scheduling`)

**Component:** `ArSchedulingPreferencesPanel` + `ArWeeklyHoursEditor`  
**Also shows (settings presentation only):** workspace stat strip when on sequence/scheduling — Active steps, Scheduled, Sent today, SMS sender, SMS this month (metering).

### Panel: Reminder quiet hours

| Control | Type | Saves to |
|---------|------|----------|
| Enforce quiet hours checkbox | checkbox | `reminderQuietHours.enabled` |
| Earliest send (local) | time input | `reminderQuietHours.start` |
| Latest send (local) | time input | `reminderQuietHours.end` |

### Panel: Scheduling rules

| Control | Type | Saves to |
|---------|------|----------|
| Minimum lead time (minutes) | number | `reminderPreferences.minimumLeadTimeMinutes` |
| Default recipient channel | select: both / sms / email | `reminderPreferences.defaultNotificationChannel` |
| Template locale tag | select en / es / fr | `reminderPreferences.templateLocale` |
| Skip confirmation on historical import | checkbox | `reminderPreferences.skipConfirmationOnHistoricalImport` |

### Panel: Custom merge fields

| Control | Condition | Type |
|---------|-----------|------|
| Disabled message | platform SMS locked | text |
| key=value textarea | non-platform | `reminderPreferences.customMergeFields` |

### Panel: Appointment-type rules

Per rule row (add/remove rules):

| Control | Type |
|---------|------|
| Service contains | text |
| Disabled steps (comma list) | text |
| Channel override | select optional |
| Remove rule | button |

### Weekly hours (`ArWeeklyHoursEditor`)

| Control | Type | Saves to |
|---------|------|----------|
| Timezone | select/change | `config.timezone` |
| Per weekday open/closed | toggles + time ranges | business hours map (saved with settings) |

**Product behavior:** Discovery/dispatch skip windows, step-level "skip off hours/closed days/weekends."

---

### Tab: Business profile (`tab=business`)

**Component:** `ArBusinessProfilePanel`

### Panel: Business information

| Field | Type |
|-------|------|
| Business name | text |
| Business phone | tel |
| Directions URL | url |
| Address / location | textarea |

### Panel: Reminder identity

| Field | Type |
|-------|------|
| Email brand color | text |
| Logo URL | text |
| Preparation instructions | textarea |

### Panel: Merge field preview

| Rows | Read-only KeyValue preview for business_name, business_phone, location, directions_link |

**AR-specific:** Yes (reminder merge + email branding). **Shared:** Business name may mirror org profile elsewhere.

---

### Tab: Notifications & responses (`tab=notifications`)

**Component:** `ArNotificationsResponsesPanel`

### Panel: Default channel preferences

| Control | select: SMS and email / SMS only / email only |

### Panel: Confirmation behavior

| Control | checkbox: skip confirmation steps when appointment confirmed |
| Link | → AI Rescheduler |

### Panel: Customer response actions

| Content | Informational list: confirm, cancel request, reschedule |

### Panel: Sender readiness

| Display | SMS sender status, Email sender status |
| Links | `/compliance`, `/contacts` (**shared** products) |

### Panel: Send test reminder

| Control | Type |
|---------|------|
| Step | select (all sequence steps) |
| Test phone | tel |
| Test email | email |
| Send test | button → `POST /api/appointment-reminders/reminders/test` |

**Plan gates:** Test SMS rules in API; free plan SMS responses disabled at runtime.

---

### Tab: Integrations (`tab=integrations`)

**Component:** `ArIntegrationsSettingsPanel` → `CalendarIntegrationsOpus` (`variant="appointment_reminders"`)

### Panel: Microsoft 365

Full calendar integration UI (shared component, AR variant):

| Area | Typical controls (see `calendar-integrations-opus.tsx`) |
|------|-----------------------------------------------------------|
| Connect / reconnect | OAuth buttons |
| Connection list | per-connection cards |
| Import calendar selection | multi-select checkboxes |
| Save import selection | button → PATCH connection |
| Sync now | button |
| Verify connection | button |
| Disconnect | button |
| Per-calendar import rules | when multi-calendar (advanced) |
| Graph mailbox UPN / delegated | fields when configured |

### Panel: Appointment sources

| Row | Manual appointments link → Appointments page |
| Note | Google/iCloud not available copy |

**Duplicate entry:** Same integration on `/appointment-reminders/calendars`, Setup connect, Overview links.

**Saves to:** `/api/integrations/calendars*` (not AR settings PATCH).

---

### Tab: Plan & billing (`tab=billing`)

**Component:** `ArBillingSettingsOpus`

| Section | Controls |
|---------|----------|
| Current plan | display name, price, legacy grandfather pill |
| Usage period | date range |
| Usage meters | SMS segments, emails, AI conversations, imported calendars |
| Plan cards | Free, Starter, Growth, Business — upgrade buttons |
| Manage subscription | Stripe portal button |
| Cancel at period end | button |
| Error display | inline |

**APIs:** `GET /billing`, `POST /billing/change-plan`, `POST /billing/portal`, `POST /billing/manage`  
**Shared:** Stripe workspace billing; AR-specific plan catalog (`ar-plan-catalog.ts`).

---

### Settings-adjacent: content only on Reminders routes

These use `AppointmentRemindersSettingsOpus` but **not** the Settings tab bar:

| Route | `presentation` | Tabs equivalent |
|-------|----------------|-----------------|
| `/reminders/sequences` | `sequence-hub` | Former "Reminder sequence" |
| `/reminders/templates` | `templates-hub` | Former "Templates" |
| `/reminders/sequences/[stepKey]/edit` | `step-editor-page` | Step editor (full page) |

### Sequence hub controls (summary — see hierarchy doc)

- Save changes
- Reminder sequence panel → `ReminderSequenceTimeline` (toggle, timing, edit message, add step)
- Compliance callout → link `/compliance`
- **No** stat strip on hub (settings-only)

### Templates hub controls

- Starter packs: industry, timing preset, Apply preset pack
- Template library browser (filters, table, preview sheet)
- Customer preview list (enabled steps)

### Nested: Step editor (full page or sheet in legacy settings)

When `presentation=settings`, sequence edit still opens **Sheet** (`SequenceStepEditor` variant=sheet). Sequence hub uses **route** editor instead.

| Control | Notes |
|---------|-------|
| Step name | text |
| Channel | sms / email / voice |
| Send-time checkboxes | skip weekends, off hours, closed days, skip if confirmed (non-confirmation steps) |
| Platform SMS callout | when template locked |
| Industry pack | select → fetches library template |
| Template (message type) | select → fetches body |
| Reset to engine default | button |
| Preview variable defaults | business name, phone, location, first/last name defaults |
| ReminderTemplateEditor | body, subject (email), merge tag chips, segment estimate, read-only when platform SMS |
| Remove step | custom steps only |
| Full-page only: sticky back, save, message preview column |

### Nested: Apply library template sheet (templates tab/hub)

| Control | |
|---------|---|
| Reminder step select | |
| Cancel / Save to sequence | → `POST .../settings/apply-template` |

---

### Plan-specific UI restrictions (settings-related)

| Plan | UI effect |
|------|-----------|
| Free | `reminderStepsMax=1` — timeline grays steps; toggle disabled for extra steps; upgrade link |
| Free | SMS customer responses gated (overview conversations panel message) |
| Starter+ | Up to 3 steps, full timing |
| Growth/Business | AI rescheduler modes (separate page) |
| Platform sender | SMS template read-only; library selection only; custom merge fields hidden |

---

### Settings tab list (canonical)

1. Scheduling & rules  
2. Business profile  
3. Notifications & responses  
4. Integrations  
5. Plan & billing  

**Removed from tab bar (redirect):** Reminder sequence, Templates → Reminders hub.

---

### Interactions to reach from Overview

| Target | Typical depth |
|--------|----------------|
| Integrations | 2 (Settings → tab) |
| Scheduling | 2 |
| Billing | 1–2 (sidebar Plan & Billing or Settings tab) |
| Sequence edit | 3 (Reminders → Sequences → Edit) — not via Settings tab |

---

## Part D — Discoverability matrix

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Click depth:** From Overview (`/appointment-reminders`), counting navigation clicks/taps; **+drawer** = additional interaction without URL change.

| Feature | Current path | Route / component | Click depth | Desktop visible | Mobile visible | Plan / role restrictions | Duplicate entry points | Notes |
|---------|--------------|-------------------|-------------|-----------------|----------------|--------------------------|------------------------|-------|
| Overview dashboard | Sidebar Home | `overview-page.tsx` | 0 | Yes | Bottom Home | — | — | |
| Pause / resume all reminders | Overview banner/button | overview API | 1 | — | — | Activated workspace | — | |
| Upcoming appointments strip | Overview panel | `ArUpcomingAppointmentsPanel` | 1 | — | — | — | Appointments list | |
| Customer replies (thread) | Overview panel → row | `ArOverviewConversationsPanel` + Sheet | 1+drawer | — | — | Starter+ for full SMS threads | Responses page | Free: gated message |
| KPI drill-downs | Overview stats | query links | 1 | — | — | — | Appointments filters | |
| Needs attention table | Overview | table → appointments | 2 | — | — | — | Responses view | |
| Recent reminder activity | Overview → View all | `/reminders` | 1 | — | — | — | Reminders sidebar | |
| Calendar connections summary | Overview → Manage | Settings integrations | 2 | — | — | — | `/calendars`, Setup | |
| Appointments list | Sidebar | `appointments-page.tsx` | 1 | Yes | Bottom | — | Overview links | |
| Appointment detail | Appointments row | `AppointmentDetailDrawer` | 1+drawer | — | — | — | `?open=` deep link | 4 tabs inside |
| Manual appointment | Appointments → Add | Sheet form | 1+drawer | — | — | — | Overview Add | |
| Calendar sync | Appointments → Sync | POST sync | 1 | — | — | Connection required | — | |
| Engagement filters | Appointments tabs | URL `engagement` | 1 | — | — | — | Overview stats | |
| Calendar grid | Sidebar Calendar | `ar-calendar-opus` | 1 | Yes | More menu | — | — | |
| Reminder activity log | Sidebar Reminders | `reminders-page` | 1 | Yes (child) | Bottom Reminders | — | Overview | Hub tab Activity |
| Export reminders CSV | Reminders header | API export | 2 | — | — | — | — | |
| Sequence builder | Reminders → Sequences tab | `sequence-hub` | 2 | Child link | 2 taps | Free: 1 active step | Legacy `?tab=sequence` redirect | |
| Edit step message (full page) | Sequences → Edit | `ar-sequence-step-editor-page` | 3 | — | — | Plan step lock | Sheet if legacy settings | |
| Template library browse | Reminders → Templates | `templates-hub` | 2 | Child | 2 | Platform SMS read-only | Legacy `?tab=templates` | |
| Apply preset pack | Templates | POST presets | 2 | — | — | — | Setup configure | |
| Responses inbox | Sidebar Responses | `ar-responses-opus` | 1 | Yes | More | — | Overview | Tabs not bottom nav |
| Held inbound queue | Responses Held tab | `view=held` | 2 | — | More | — | Legacy `/held-inbound` redirect | |
| Export responses CSV | Responses header | API | 1 | — | — | — | — | |
| AI Rescheduler config | Sidebar | `ar-ai-rescheduler-opus` | 1 | Yes | More | Growth/Business for AI mode | Notifications tab link | |
| Analytics | Sidebar | `analytics-page` | 1 | Yes | More | — | — | |
| Settings scheduling | Sidebar Settings | tab scheduling | 1 | Yes | Bottom | — | — | Default tab |
| Settings business profile | Settings tab | `ArBusinessProfilePanel` | 2 | — | — | — | Setup configure overlap | |
| Settings notifications + test send | Settings tab | `ArNotificationsResponsesPanel` | 2 | — | — | Test SMS API rules | — | |
| Calendar integrations | Settings tab | `CalendarIntegrationsOpus` | 2 | — | — | Microsoft primary | `/calendars`, Setup | **Duplicate** |
| Plan & billing | Sidebar Plan & Billing | `ArBillingSettingsOpus` | 1 | Account section | More | Plan tiers | Settings billing tab | |
| Business Settings (org) | Sidebar | `/settings/business` | 1 | Yes | More | **Shared** | — | |
| Compliance (sender) | Notifications links | `/compliance` | 2+ | — | — | **Shared** | — | Leaves AR shell? product shell dependent |
| Contacts | Notifications links | `/contacts` | 2+ | — | — | **Shared** | — | |
| Setup wizard | Product-open / marketing | setup/* | 2+ | No | No | Activation gates | Integrations | Process nav |
| Pricing page | Marketing links | `/pricing` | — | No | No | — | Billing | |
| Booking submodule | Hidden nav routes | `booking/**` | 1+ if nav on | When `AR_HIDE_BOOKING_NAV=0` | — | — | Out of scope V1 | |

---

### Features with multiple entry points

1. **Calendar connection / import** — Overview, Settings → Integrations, `/calendars`, Setup connect, Appointments connect CTA.  
2. **Reminder sequence** — Reminders → Sequences, Overview quick link, Settings prose links, legacy `?tab=sequence` redirect.  
3. **Templates** — Reminders → Templates, Settings links, legacy redirect, Setup configure preview.  
4. **Responses / needs attention** — Overview stats, table, Responses tabs, appointment drawer.  
5. **Plan upgrade** — Billing tab, sequence timeline upgrade link, plan cards.  
6. **Test reminder** — Settings notifications only.  
7. **Appointment open** — List row, highlight query, open query, responses action column.

---

### Features with weak or no primary nav

| Feature | Entry |
|---------|--------|
| `/appointment-reminders/calendars` | No sidebar item; deep link only |
| Pricing | No sidebar |
| Setup wizard | No sidebar |
| Export CSV | Button on Reminders/Responses only |
| Full-page step editor | Only from Sequences Edit |
| Template apply-to-step sheet | From library browser only |

---

### Deepest common paths (clicks from Overview)

| Depth | Example |
|-------|---------|
| 4 | Overview → Reminders → Sequences → Edit step → (edit fields) |
| 3 | Overview → Settings → Integrations → OAuth provider |
| 3 | Overview → Appointments → row → Preferences tab → Save phone |
| 2 | Most configuration tabs |

---

### Unreachable / code-only (customer)

| Item | Status |
|------|--------|
| Held inbound standalone page | Redirect only — OK |
| Ops metrics API | BACKEND-ONLY |
| Legacy settings sequence tab UI | Removed; redirect only |

---

### AR matrix (86 rows) — UI location summary

| Status | Meaning | Count guidance |
|--------|---------|----------------|
| **UI mapped** | Customer can reach via documented path | Majority of WS1–WS7 customer features |
| **Backend-only** | Matrix row without customer UI | e.g. dispatch idempotency, webhook internals |
| **Shared product** | UI outside `/appointment-reminders` | Compliance, Contacts, Business Settings |

Uncertain without live tenant: exact product-status card hrefs from overview API (dynamic). Marked CODE-INFERRED.

---

## Part E — Full UI hierarchy

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Not a proposed sitemap** — reflects current code structure.

```
Transovo Application Shell (product = Appointment Reminders)
├── Desktop Sidebar
│   ├── Overview → /appointment-reminders
│   ├── Appointments → /appointment-reminders/appointments
│   ├── Calendar → /appointment-reminders/calendar
│   ├── Reminders → /appointment-reminders/reminders
│   │   ├── [child] Activity & delivery
│   │   ├── [child] Sequences → /reminders/sequences
│   │   └── [child] Templates → /reminders/templates
│   ├── Responses → /appointment-reminders/responses
│   ├── AI Rescheduler → /appointment-reminders/ai-rescheduler
│   ├── Analytics → /appointment-reminders/analytics
│   ├── Settings → /appointment-reminders/settings
│   ├── [Account] Plan & Billing → settings?tab=billing
│   └── [Account] Business Settings → /settings/business [SHARED]
├── Mobile Bottom Nav (4 + More)
│   ├── Home → Overview
│   ├── Appointments
│   ├── Reminders → (hub)
│   ├── Settings
│   └── More → (full sidebar)
│
├── OVERVIEW (/appointment-reminders)
│   ├── Header: status pill, Add appointment, Settings, Refresh
│   ├── [conditional] Paused callout → Resume
│   ├── [conditional] Pause all reminders
│   ├── Upcoming appointments panel → rows
│   ├── Stat grid (4) → filtered appointments / responses
│   ├── Customer replies panel
│   │   └── Sheet: conversation thread
│   │       ├── messages list
│   │       └── Open appointment link
│   ├── Product status cards (dynamic)
│   ├── Needs attention table → Open appointment
│   ├── [conditional] Calendar warning callout
│   ├── Feature strip → Integrations
│   ├── Recent reminder activity table
│   ├── Connected calendars panel
│   └── Quick links panel (4)
│
├── APPOINTMENTS (/appointments)
│   ├── Header: sync meta, Add appointment [Sheet], Sync / Connect
│   ├── Stat grid (4)
│   ├── Engagement tabs (8)
│   ├── Toolbar: search, date, reminder status, calendar, pagination
│   ├── Table
│   │   └── Row → AppointmentDetailDrawer [Sheet]
│   │       ├── Tab: Details
│   │       │   ├── metadata, response summary
│   │       │   ├── reschedule approve/reject
│   │       │   └── evidence / links
│   │       ├── Tab: Reminders (timeline)
│   │       ├── Tab: Activity (history, dispatches)
│   │       └── Tab: Preferences
│   │           ├── phone, email, channel
│   │           ├── save contact
│   │           └── suppress reminders toggle
│   └── Manual add Sheet
│       └── name, email, phone, service, datetime, save
│
├── CALENDAR (/calendar)
│   ├── Grid view
│   └── Event Sheet (ar-calendar-event-sheet)
│
├── REMINDERS HUB (shell tabs on all /reminders/*)
│   ├── Tab: Activity & delivery (/reminders)
│   │   ├── Actions: Edit sequence, Refresh, Export CSV
│   │   ├── Stat grid (4)
│   │   ├── Filters + table
│   │   └── Row Sheet (delivery detail)
│   │
│   ├── Tab: Sequences (/reminders/sequences)
│   │   ├── Save changes
│   │   ├── Panel: Reminder sequence
│   │   │   └── Drip sequence timeline
│   │   │       ├── Per step:
│   │   │       │   ├── timing amount + unit (non-confirmation)
│   │   │       │   ├── title + preview text
│   │   │       │   ├── enable switch
│   │   │       │   └── Edit message → route edit page
│   │   │       ├── Add step / upgrade CTA
│   │   │       └── Appointment start marker
│   │   └── Compliance callout
│   │
│   ├── Tab: Templates (/reminders/templates)
│   │   ├── Save changes
│   │   ├── Starter packs (industry, timing, apply)
│   │   ├── Template library browser
│   │   │   ├── filters + search + table
│   │   │   ├── Sheet: template preview
│   │   │   └── Apply to step → Sheet (pick step)
│   │   └── Customer preview (enabled steps)
│   │
│   └── [route] Step editor (/reminders/sequences/{stepKey}/edit)
│       ├── Sticky: Back, Save
│       ├── SequenceStepEditor (page variant)
│       │   ├── step name, channel
│       │   ├── send-time checkboxes (non-confirmation)
│       │   ├── platform SMS callout
│       │   ├── industry pack + template type selects
│       │   ├── reset default
│       │   ├── preview variable defaults panel
│       │   ├── ReminderTemplateEditor
│       │   │   ├── subject (email)
│       │   │   ├── body textarea
│       │   │   ├── merge tag insert chips
│       │   │   ├── variable validation hints
│       │   │   └── segment count (SMS)
│       │   └── remove step (custom)
│       └── Message preview column (desktop)
│
├── RESPONSES (/responses)
│   ├── Tabs: Needs attention | All | Held
│   ├── Export CSV
│   └── Table → Open appointment / held actions
│
├── AI RESCHEDULER (/ai-rescheduler)
│   ├── Mode cards (plan-gated)
│   ├── SMS policy sections (cancel / reschedule / confirm)
│   ├── Staff emails, hours, save
│   └── Operations table
│
├── ANALYTICS (/analytics)
│   ├── Date range
│   ├── KPIs
│   ├── By channel / by step tables
│   └── No-show estimate panel
│
├── SETTINGS (/settings?tab=)
│   ├── Cross-links → Sequences, Templates
│   ├── Tabs: scheduling | business | notifications | integrations | billing
│   ├── [tab scheduling]
│   │   ├── Quiet hours panel
│   │   ├── Scheduling rules panel
│   │   ├── Custom merge fields (or disabled)
│   │   ├── Service rules list
│   │   └── Weekly hours editor
│   ├── [tab business] → business profile panels
│   ├── [tab notifications]
│   │   ├── default channel
│   │   ├── confirmation skip checkbox
│   │   ├── response actions info
│   │   ├── sender readiness + links
│   │   └── test send form
│   ├── [tab integrations] → CalendarIntegrationsOpus
│   └── [tab billing] → ArBillingSettingsOpus
│
├── CALENDARS STANDALONE (/calendars) [orphan nav]
│   └── CalendarIntegrationsOpus (duplicate)
│
├── SETUP (process)
│   ├── /setup/connect → CalendarIntegrationsOpus
│   ├── /setup/configure → ArSetupConfigurePanel
│   └── /setup/activate → readiness + consent + activate
│
├── PRICING (/pricing)
│   └── plan marketing CTAs
│
└── BOOKING (optional nav)
    ├── /booking
    ├── /booking/meetings[/new|/id]
    └── /booking/services[/new|/id]
```

---

### CalendarIntegrationsOpus (nested hierarchy, shared)

Used under Settings, Setup, `/calendars`:

```
CalendarIntegrationsOpus
├── Connect Microsoft (OAuth)
├── [per connection card]
│   ├── Status, account email
│   ├── Import calendar multiselect
│   ├── Save selection
│   ├── Sync now
│   ├── Verify
│   ├── Disconnect
│   └── [advanced] per-calendar rules, mailbox UPN
└── Error / reauth callouts
```

---

### ReminderTemplateEditor (nested)

```
ReminderTemplateEditor
├── Email subject input (if email)
├── Body textarea (readOnly if platform SMS)
├── Merge tag chips → insert
├── Highlighted variable tokens in preview
├── Rendered preview paragraph
├── Missing variable warnings
└── SMS segment / encoding estimate
```

---

### Hierarchy depth notes

- **Deepest customer configuration:** Reminders → Sequences → Edit step → template/industry controls (4 navigation levels from Overview).  
- **Deepest drawer:** Appointments → Detail → Preferences → suppress/save (3 clicks + 2 tab switches).  
- **Settings** remains appropriate for low-frequency workspace rules; **sequence/templates** primary home is Reminders hub (as of current branch).

---

### Verification gaps (CODE-INFERRED)

- Mobile More menu renders full sidebar — exact scroll order not screenshot-verified.  
- Booking pages not expanded in this tree when nav hidden (routes still in repo).  
- Dynamic step count (core 3 + up to 8 additional) affects timeline list length.
