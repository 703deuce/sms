# Appointment Reminders — Complete Feature Inventory (Current UI)

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Method:** Static analysis of `src/newui-transplant/**/appointment-reminders/**`, `src/app/(app)/appointment-reminders/**`, shared integration components.  
**Visual:** CODE-INFERRED unless noted.

This document lists **customer-facing** surfaces and controls. Backend-only behavior is marked **BACKEND-ONLY**.

---

## Overview (`/appointment-reminders`)

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

## Appointments (`/appointment-reminders/appointments`)

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

## Calendar (`/appointment-reminders/calendar`)

**Component:** `ar-calendar-opus.tsx` + `ar-calendar-opus-view.tsx`

| Surface | |
|---------|---|
| Read-only event grid | |
| Event click | **Sheet** `ar-calendar-event-sheet` — event metadata, link to appointment if mapped |
| Refresh / connection state | |

---

## Reminders — Activity (`/appointment-reminders/reminders`)

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

## Reminders — Sequences (`/reminders/sequences`)

**Component:** `ar-reminders-sequences-page.tsx` → settings opus `sequence-hub`

| Control | |
|---------|---|
| Save changes | |
| Drip sequence timeline | per-step: timing (non-confirmation), enable switch, channel pill, preview snippet, Edit message → **full-page editor route** |
| Add step / upgrade CTA | plan limit |
| Compliance callout | → /compliance |

---

## Reminders — Templates (`/reminders/templates`)

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

## Reminders — Step editor (`/reminders/sequences/[stepKey]/edit`)

Full-page `SequenceStepEditor` — see Settings deep inventory for full control list; adds sticky Save/Back and desktop preview panel.

---

## Responses (`/appointment-reminders/responses`)

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

## AI Rescheduler (`/appointment-reminders/ai-rescheduler`)

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

## Analytics (`/appointment-reminders/analytics`)

**Component:** `analytics-page.tsx`

| Control | |
|---------|---|
| Date range | presets + custom |
| KPI stats | sends, failures, replies, etc. |
| By channel table | |
| By reminder step table | |
| No-show cost estimate | illustrative inputs |

---

## Settings

See **`AR-CURRENT-SETTINGS-DEEP-INVENTORY.md`** (authoritative for tabs).

---

## Calendars standalone (`/appointment-reminders/calendars`)

Duplicate integration page: header + `CalendarIntegrationsOpus` — same controls as Integrations tab.

---

## Pricing (`/appointment-reminders/pricing`)

**Component:** `ar-pricing-page.tsx` — plan comparison, CTA to billing/checkout (marketing).

---

## Setup wizard (process routes)

| Step | Route | Key controls |
|------|-------|--------------|
| 1 Connect | `/setup/connect` | CalendarIntegrationsOpus, Continue |
| 2 Configure | `/setup/configure` | `ArSetupConfigurePanel` — business, industry, sequence preview, consent copy |
| 3 Activate | `/setup/activate` | Readiness checklist, SMS consent attestation checkbox, Activate |

Not in permanent sidebar; reached from onboarding/product-open.

---

## Booking submodule (routes exist; nav often hidden)

| Route | Purpose |
|-------|---------|
| `/booking` | Booking page editor |
| `/booking/meetings` | Meetings workspace |
| `/booking/services` | Service types |
| new/[id] routes | CRUD forms |

**Component families:** `booking-page-opus.tsx`, `ar-meetings-workspace-opus.tsx`, `booking-services-page.tsx`, etc.

---

## Signup

`/signup/appointment-reminders` — AR product signup (auth layout).

---

## Shared surfaces used by AR

| Route | AR usage |
|-------|----------|
| `/settings/business` | Sidebar Business Settings |
| `/compliance` | Sender/compliance links |
| `/contacts` | Recipient preferences link |

---

## Overlay inventory (AR-specific)

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

## Backend-only (no dedicated UI)

Examples: `GET /api/appointment-reminders/ops/metrics`, webhook handlers, dispatch workers, eligibility engine internals, Luna phone extraction — see AR completion matrix for WS rows without UI.

---

## Matrix cross-reference (86 applicable rows)

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

Full row-by-row mapping is in **`AR-CURRENT-UI-DISCOVERABILITY-MATRIX.md`** (feature-level, not all 86 duplicated here).

---

## Control count reconciliation (estimate)

| Category | Count (estimated) |
|----------|-------------------|
| Distinct routes (app pages) | 25 |
| Primary sidebar destinations | 10 (+ booking when shown) |
| Major tab bars | 5 (Settings, Reminders hub, Responses, Appointments engagement, appointment drawer) |
| Drawers/sheets/modals (distinct flows) | ~10 |
| Significant labeled controls (inputs, buttons, toggles, selects) | **~220–280** across AR UI |

Exact control count varies with dynamic rows (rules, steps, connections). Inventory above enumerates **types**; dynamic lists multiply instances.
