# Appointment Reminders — page inventory (copy-friendly)

Generated from codebase audit. Use this to see **what exists on each surface**.

---

## A. CURRENT HOME (production) — `/appointment-reminders`

**Route:** `src/app/(app)/appointment-reminders/page.tsx`  
**Page component:** `AppointmentRemindersCalendarWorkspacePage`  
**File:** `src/newui-transplant/connected/appointment-reminders/ar-calendar-workspace-page.tsx`

**Breadcrumb label:** `Overview / Calendar` (product section “Overview”, page title “Calendar”)  
**Sidebar nav label:** **Calendar** (first item under Appointment Reminders)

This replaced the old dashboard as the canonical AR home (Layout B).

### A.1 App shell (shared — not owned by this page file)

- Product sidebar: Calendar, Appointments, Reminders (+ sub-items), Responses, AI Rescheduler, Analytics, Settings, Account links
- Top bar: workspace switcher, global search, notifications, user menu
- Mobile bottom nav (when applicable)

### A.2 Page header (workspace-owned)

| UI element | Component / type | Behavior |
|------------|-------------------|----------|
| Page title | `<h1>Calendar</h1>` | Static |
| Search field | `OpusSearchField` (`id=ar-calendar-search`) | Filters calendar events client-side: customer name, title, phone, email |
| Sync timestamp pill | `Pill` | Shows last sync from overview API (`sync.lastSyncAt`) |
| Sync button | `Button` + `RefreshCw` | POST `/api/appointment-reminders/sync`, reload events + overview |

### A.3 Page states (mutually exclusive main regions)

| State | What shows |
|-------|------------|
| Loading (overview not ready) | Full-width pulse skeleton |
| Not connected | `EmptyState` “Connect a calendar” + link to Settings → Integrations |
| Calendar load error | Error message + “Try again” (refetch events) |
| Connected + healthy | Two-column layout: calendar + right panel (desktop) |

### A.4 Left column — calendar (`ArCalendarOpusView`)

**File:** `src/newui-transplant/components/appointment-reminders/ar-calendar-opus-view.tsx`  
**Wrapper:** `OpusDataSurface` (compact chrome, fill height)

#### Toolbar inside calendar card

| Control | Feature |
|---------|---------|
| Period title + subtitle | Formatted from cursor, view, timezone |
| Today | Jump cursor to today (week snaps to week start) |
| Previous / Next | Navigate by day, week, month, or agenda window |
| View segmented control | **Day**, **Week** (default), **Month**, **Agenda** |
| Calendars dropdown | `SimpleSelect` — filter by integration `connectionId` (hidden if only one connection) |

#### Calendar views

| View | Content |
|------|---------|
| **Week** | 7-day time grid, 6 AM–9 PM (configurable in `ar-calendar-layout.ts`), scrollable |
| **Day** | Single-day time grid |
| **Month** | Month grid; day click → switches to day view |
| **Agenda** | Sorted list of events in range |

#### Appointment blocks (week/day)

- Clickable blocks: time, title, reminder dot hints (`on` / `off` / `blocked` via metadata)
- Click → selects appointment (opens detail in right panel or mobile sheet)

#### Data / behavior (behind calendar)

- GET `/api/appointment-reminders/calendar/events?from=&to=&q=&refresh=`
- Auto-refresh every 20s when tab visible and calendar connected
- URL sync: `view`, date cursor, `q`, `calendar` query params on `/appointment-reminders`
- Legacy URL `/appointment-reminders/calendar` → redirects to `/appointment-reminders` (query preserved)

### A.5 Right column — desktop (`lg+`) — `aside[aria-label="Appointment context"]`

#### Mode A — no appointment selected (`ArCalendarActivityPanel`)

**File:** `src/newui-transplant/components/appointment-reminders/ar-calendar-activity-panel.tsx`  
**Data:** GET `/api/appointment-reminders/overview` (same payload as old dashboard, subset)

| Section | Rows | Row click | Empty state |
|---------|------|-----------|-------------|
| **Upcoming reminders** | Up to 6 | Opens appointment, **Reminders** tab | “No upcoming appointments…” |
| | Link: **View all** → `/appointment-reminders/reminders` | | |
| **Recent replies** | Up to 5 | Opens appointment, **Activity** tab | “No recent customer replies.” |
| **Needs attention** | Up to 6 | Opens appointment, **Details** tab | “Nothing needs attention…” |
| | Link: **Appointments** → `/appointment-reminders/appointments` | | |
| **Recent reminder activity** | Up to 5 | Opens appointment, **Activity** tab | “No recent reminder sends.” |
| Footer note | “Operational feed — select a row…” | | |

#### Mode B — appointment selected (`AppointmentDetailDrawer` `layout="panel"`)

**File:** `src/newui-transplant/components/appointment-reminders/appointment-detail-drawer.tsx`

**Header (panel only)**

- **← Activity** — clear selection, return to Mode A (calendar date/view preserved)
- **Conversation** — opens `ArConversationThreadSheet`
- Title, customer, date/time range
- `ReminderStatusPill`, `CustomerResponsePill`

**Tabs:** Details | Reminders | Activity | Preferences

| Tab | Features |
|-----|----------|
| **Details** | Customer action summary (if any); appointment details (customer, title, date, time, calendar, source); reschedule request block with Approve/Reject when pending |
| **Reminders** | On/off status; **Stop reminders** / **Resume reminders** (per appointment); reminder engagement timeline OR scheduled/sent timeline from API |
| **Activity** | **Open full conversation**; customer action history; delivery ledger |
| **Preferences** | Phone/email display; edit reminder phone & email; notification channel (SMS / email / both); **Save preferences** |

**APIs used by drawer**

- GET `/api/appointment-reminders/appointments/:id`
- GET `/api/appointment-reminders/appointments/:id/reminder-timeline`
- PATCH endpoints for phone, suppress, reschedule approval (as implemented in drawer)

**Selection note:** Row is built from calendar event via `calendarEventToAppointmentRow` — appointment must exist in loaded calendar events for panel to open from grid click.

### A.6 Mobile / tablet (`< lg`)

| Element | Feature |
|---------|---------|
| **Today’s activity** button | Opens bottom `Sheet` with same `ArCalendarActivityPanel` |
| Appointment tap on calendar | `AppointmentDetailDrawer` `layout="sheet"` (full-screen sheet) |
| Activity sheet | Select row → closes sheet → opens appointment sheet |

### A.7 React components used on this page (checklist)

- `ArOpusPage`
- `OpusSearchField`
- `Pill`
- `Button` (shadcn/ui)
- `EmptyState`
- `ArCalendarOpusView` → `OpusDataSurface`, `Segmented`, `SimpleSelect`, `MonthView`, `TimeGridView`, `AgendaView`
- `ArCalendarActivityPanel` → `Section`, `FeedRow`, `TextLink`
- `AppointmentDetailDrawer` → pills, tabs, `KeyValueRow`, `Input`, `SimpleSelect`, `ArConversationThreadSheet`
- `Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` (mobile activity)

---

## B. LEGACY DASHBOARD (still in repo — **not** the current `/appointment-reminders` route)

**Component:** `AppointmentRemindersOverviewPage`  
**File:** `src/newui-transplant/connected/appointment-reminders/overview-page.tsx`  

**Status:** No `page.tsx` import found in `src/app` — **not mounted as a live route** after Calendar became home. Listed here because it is the old “overview dashboard” and still defines many overview API fields.

If you remember an “Appointment Reminders overview” with KPI cards and tables, this is that page.

### B.1 Header

- Title: **Appointment Reminders**
- Status pill: Active | Paused | Needs attention | Setup incomplete
- Description paragraph
- Actions: **Add appointment**, **Settings**, **Refresh**

### B.2 Banners / callouts

- Load error callout + Try again
- **Reminders paused** callout + Resume reminders
- **Pause all reminders** button (when activated and not paused)
- Calendar connection warning → Integrations link
- Failed deliveries (7d) callout → Reminder log link

### B.3 Main sections (top to bottom)

| Section | Component | Features |
|---------|-----------|----------|
| Customer replies & conversations | `ArOverviewConversationsPanel` | List from `/api/appointment-reminders/conversations`; unread count; open thread sheet; link to Responses |
| Needs attention table | `Panel` + HTML table | Customer, appointment, issue, last activity, Conversation link |
| Upcoming appointments | `ArUpcomingAppointmentsPanel` | Hero list with response pills; link to all appointments |
| KPI stat grid | `ArStatGrid` / `Stat` × 4 | Upcoming, Awaiting reply, Confirmed, Needs attention (each links to filtered lists) |
| Product status cards | Grid of links | Readiness items from overview API (label, ready/action, detail, href) |
| Feature emphasis strip | `FeatureEmphasisStrip` | “Automatic SMS from your calendar” + Manage calendars CTA |
| Recent reminder activity table | `Panel` + table | Recipient, channel, message, status, time |
| Connected calendars | `Panel` + `KeyValueRow` list | Provider, account, import count, last sync |
| Quick links | `Panel` | Appointments, Responses, Reminder log, SMS sequence |

### B.4 Overview API (shared by legacy page + calendar activity panel)

`GET /api/appointment-reminders/overview` — fields used across UI:

- `counts`, `stats`, `activity`, `calendars`, `readiness`, `productStatus`
- `needsAttentionRows`, `upcomingAppointments`, `customerResponses`
- `sync`, `timezone`

---

## C. Quick comparison

| Item | Current `/appointment-reminders` | Legacy overview page |
|------|----------------------------------|----------------------|
| Primary UX | Calendar-first + right context panel | Dashboard KPIs + tables |
| KPI stat cards | No | Yes (4 stats) |
| Full needs-attention table | No (compact feed only) | Yes |
| Conversations panel | No (via detail drawer / Responses) | Yes |
| Connected calendars panel | No (empty state links to Integrations) | Yes |
| Calendar week/day/month | Yes | No |
| Per-appointment detail panel | Yes | No (links out) |

---

## D. Source file index

| Purpose | Path |
|---------|------|
| Calendar home page | `src/newui-transplant/connected/appointment-reminders/ar-calendar-workspace-page.tsx` |
| Activity panel (Mode A) | `src/newui-transplant/components/appointment-reminders/ar-calendar-activity-panel.tsx` |
| Calendar grid | `src/newui-transplant/components/appointment-reminders/ar-calendar-opus-view.tsx` |
| Appointment panel/sheet (Mode B) | `src/newui-transplant/components/appointment-reminders/appointment-detail-drawer.tsx` |
| Legacy overview dashboard | `src/newui-transplant/connected/appointment-reminders/overview-page.tsx` |
| Nav config | `src/lib/products/appointment-reminders-nav.ts` |
| Routes | `src/lib/appointment-reminders/routes.ts` |
