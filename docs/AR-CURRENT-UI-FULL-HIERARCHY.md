# Appointment Reminders — Full UI Hierarchy (As Built)

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

## CalendarIntegrationsOpus (nested hierarchy, shared)

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

## ReminderTemplateEditor (nested)

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

## Hierarchy depth notes

- **Deepest customer configuration:** Reminders → Sequences → Edit step → template/industry controls (4 navigation levels from Overview).  
- **Deepest drawer:** Appointments → Detail → Preferences → suppress/save (3 clicks + 2 tab switches).  
- **Settings** remains appropriate for low-frequency workspace rules; **sequence/templates** primary home is Reminders hub (as of current branch).

---

## Verification gaps (CODE-INFERRED)

- Mobile More menu renders full sidebar — exact scroll order not screenshot-verified.  
- Booking pages not expanded in this tree when nav hidden (routes still in repo).  
- Dynamic step count (core 3 + up to 8 additional) affects timeline list length.
