# Appointment Reminders — Discoverability & Navigation Depth Matrix

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

## Features with multiple entry points

1. **Calendar connection / import** — Overview, Settings → Integrations, `/calendars`, Setup connect, Appointments connect CTA.  
2. **Reminder sequence** — Reminders → Sequences, Overview quick link, Settings prose links, legacy `?tab=sequence` redirect.  
3. **Templates** — Reminders → Templates, Settings links, legacy redirect, Setup configure preview.  
4. **Responses / needs attention** — Overview stats, table, Responses tabs, appointment drawer.  
5. **Plan upgrade** — Billing tab, sequence timeline upgrade link, plan cards.  
6. **Test reminder** — Settings notifications only.  
7. **Appointment open** — List row, highlight query, open query, responses action column.

---

## Features with weak or no primary nav

| Feature | Entry |
|---------|--------|
| `/appointment-reminders/calendars` | No sidebar item; deep link only |
| Pricing | No sidebar |
| Setup wizard | No sidebar |
| Export CSV | Button on Reminders/Responses only |
| Full-page step editor | Only from Sequences Edit |
| Template apply-to-step sheet | From library browser only |

---

## Deepest common paths (clicks from Overview)

| Depth | Example |
|-------|---------|
| 4 | Overview → Reminders → Sequences → Edit step → (edit fields) |
| 3 | Overview → Settings → Integrations → OAuth provider |
| 3 | Overview → Appointments → row → Preferences tab → Save phone |
| 2 | Most configuration tabs |

---

## Unreachable / code-only (customer)

| Item | Status |
|------|--------|
| Held inbound standalone page | Redirect only — OK |
| Ops metrics API | BACKEND-ONLY |
| Legacy settings sequence tab UI | Removed; redirect only |

---

## AR matrix (86 rows) — UI location summary

| Status | Meaning | Count guidance |
|--------|---------|----------------|
| **UI mapped** | Customer can reach via documented path | Majority of WS1–WS7 customer features |
| **Backend-only** | Matrix row without customer UI | e.g. dispatch idempotency, webhook internals |
| **Shared product** | UI outside `/appointment-reminders` | Compliance, Contacts, Business Settings |

Uncertain without live tenant: exact product-status card hrefs from overview API (dynamic). Marked CODE-INFERRED.
