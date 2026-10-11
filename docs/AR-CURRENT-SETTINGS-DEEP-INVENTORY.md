# Appointment Reminders — Settings Deep Inventory

**Pass type:** READ-ONLY · **Date:** 2026-10-11  
**Primary UI:** `/appointment-reminders/settings?tab={tab}` → `settings-page.tsx` + `AppointmentRemindersSettingsOpus` (`reminder-settings-opus.tsx`)  
**Persistence:** `PATCH /api/appointment-reminders/settings` (workspace platform config), plus integration APIs for calendars.

---

## Settings shell

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

## Tab: Scheduling & rules (`tab=scheduling`)

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

## Tab: Business profile (`tab=business`)

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

## Tab: Notifications & responses (`tab=notifications`)

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

## Tab: Integrations (`tab=integrations`)

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

## Tab: Plan & billing (`tab=billing`)

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

## Settings-adjacent: content only on Reminders routes

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

## Plan-specific UI restrictions (settings-related)

| Plan | UI effect |
|------|-----------|
| Free | `reminderStepsMax=1` — timeline grays steps; toggle disabled for extra steps; upgrade link |
| Free | SMS customer responses gated (overview conversations panel message) |
| Starter+ | Up to 3 steps, full timing |
| Growth/Business | AI rescheduler modes (separate page) |
| Platform sender | SMS template read-only; library selection only; custom merge fields hidden |

---

## Settings tab list (canonical)

1. Scheduling & rules  
2. Business profile  
3. Notifications & responses  
4. Integrations  
5. Plan & billing  

**Removed from tab bar (redirect):** Reminder sequence, Templates → Reminders hub.

---

## Interactions to reach from Overview

| Target | Typical depth |
|--------|----------------|
| Integrations | 2 (Settings → tab) |
| Scheduling | 2 |
| Billing | 1–2 (sidebar Plan & Billing or Settings tab) |
| Sequence edit | 3 (Reminders → Sequences → Edit) — not via Settings tab |
