# Transovo Mode 4 — Approved Rebuild Manifest

**Status:** Active allowlist — only these surfaces may be rebuilt  
**Machine-readable:** `.ui-agent/mode4/rebuild-manifest.json` (sync: `npm run ui:kimi-mode4-sync-manifest`)  
**Orchestration:** `docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md`

> **Do not use** `docs/V1-ACTIVE-PAGE-MANIFEST.md` as the rebuild allowlist — it reflects legacy mass-SMS nav, not the current appointments-platform IA.

---

## Authority

This manifest is the **only** source of customer-facing pages Kimi Mode 4 may rebuild.

- Routes in the repo that are **not** listed here are **out of scope** (legacy, hidden, experiments, mass SMS, MCTB, AI receptionist, etc.).
- Every **reachable** approved surface **must** be listed — including tabs, detail views, wizards, drawers, and public booking flows.

**Canonical global IA** (`src/lib/products/appointments-nav.ts`):

1. Home  
2. Appointments  
3. Booking  
4. Contacts  
5. Messages  
6. Automations  
7. Meetings  
8. Payments  
9. Analytics  
10. Integrations  
11. Settings  

---

## Execution stages

| Stage | Purpose | Concurrency |
|-------|---------|-------------|
| **foundations** | Shared shell, tokens, sidebar, header, shared components | **Serial** — Cursor orchestrates |
| **golden** | Six archetype reference screens | Low (≤2) or serial |
| **bulk** | Remaining approved inventory | **Up to 10** concurrent, 5s stagger |

### Golden screens (establish Transovo visual language)

| ID | Canonical page | Route | Archetype |
|----|----------------|-------|-----------|
| `home` | Home | `/appointments/overview` | Dashboard |
| `appointments-calendar` | Appointments → Calendar | `/appointments/calendar` | Calendar |
| `appointments-list` | Appointments → List | `/appointments` | List |
| `appointment-detail` | Appointments → Appointment Detail | `/appointments/[id]` | Detail |
| `booking-types` | Booking → Booking Types | `/appointments/types` | Configuration |
| `workflow-builder` | Automations → Workflows | `/appointments/workflows` | Builder |

After golden screens pass acceptance, subsequent jobs receive them as **Transovo-native visual references** (below Campaign/Inbox art direction, above old page appearance).

---

## Approved rebuild inventory

### Foundations (serial)

| ID | Canonical | Notes |
|----|-----------|-------|
| `foundation-shell` | Platform → Shared Shell | Run `npm run ui:kimi-sidebar` + token/shell pass before bulk |

### Appointments

| ID | Canonical | Route | Archetype |
|----|-----------|-------|-----------|
| `appointments-calendar` | Appointments → Calendar | `/appointments/calendar` | Calendar ★ |
| `appointments-list` | Appointments → List | `/appointments` | List ★ |
| `appointments-waitlist` | Appointments → Waitlist | `/appointments/waitlist` | List |
| `appointments-recalls` | Appointments → Recalls | `/appointments/recalls` | List |
| `appointments-recall-campaigns` | Appointments → Recall Campaigns | `/appointments/recall-campaigns` | Configuration |
| `appointments-no-show-recovery` | Appointments → No-Show Recovery | `/appointments/no-show-recovery` | Configuration |
| `appointment-detail` | Appointments → Detail | `/appointments/[id]` | Detail ★ |
| `appointments-new` | Appointments → New | `/appointments/new` | Configuration |
| `appointments-setup` | Appointments → Get Started | `/appointments/setup` | Configuration |

★ = golden screen

### Booking

| ID | Canonical | Route |
|----|-----------|-------|
| `booking-types` | Booking → Booking Types | `/appointments/types` ★ |
| `booking-pages` | Booking → Booking Pages | `/appointments/booking` |
| `availability` | Booking → Availability | `/appointments/availability` |
| `ai-booking` | Booking → AI Booking | `/appointments/ai-booking` |
| `routing-forms` | Booking → Routing | `/appointments/routing-forms` |
| `meeting-polls` | Booking → Meeting Polls | `/appointments/polls` |
| `team-pages` | Booking → Team Booking Pages | `/appointments/team-pages` |

### Automations

| ID | Canonical | Route |
|----|-----------|-------|
| `reminder-sequences` | Automations → Reminder Sequences | `/appointments/reminders` |
| `workflow-builder` | Automations → Workflows | `/appointments/workflows` ★ |
| `workflow-new` | Automations → New Workflow | `/appointments/workflows/new` |
| `workflow-edit` | Automations → Edit Workflow | `/appointments/workflows/[id]/edit` |
| `workflow-setup` | Automations → Setup Wizard | `/appointments/workflows/setup/[templateId]` |
| `automation-templates` | Automations → Templates | `/appointments/automations/templates` |
| `automation-activity` | Automations → Activity | `/appointments/automations/activity` |

### Contacts & Messages

| ID | Canonical | Route |
|----|-----------|-------|
| `contacts` | Contacts | `/contacts` |
| `contact-detail` | Contacts → Detail | `/contacts/[id]` |
| `contacts-lists` | Contacts → Lists | `/contacts/lists` |
| `contacts-segments` | Contacts → Segments | `/contacts/segments` |
| `contacts-fields` | Contacts → Custom Fields | `/contacts/fields` |
| `contacts-imports` | Contacts → Imports | `/contacts/imports` |
| `messages-inbox` | Messages → Inbox | `/conversations` |
| `messages-saved-replies` | Messages → Saved Replies | `/conversations/saved-replies` |

### Meetings, Payments, Analytics

| ID | Canonical | Route |
|----|-----------|-------|
| `meetings-upcoming` | Meetings → Upcoming | `/video` |
| `meetings-recaps` | Meetings → Recaps | `/meetings` |
| `meeting-detail` | Meetings → Recap Detail | `/meetings/[id]` |
| `payments-transactions` | Payments → Transactions | `/payments/transactions` |
| `analytics-overview` | Analytics → Overview | `/appointments/analytics` |
| `analytics-booking` | Analytics → Booking | `/appointments/analytics/booking` |
| `analytics-reminders` | Analytics → Reminders | `/appointments/analytics/reminders` |
| `analytics-automations` | Analytics → Automations | `/appointments/analytics/automations` |
| `analytics-reports` | Analytics → Reports | `/appointments/analytics/reports` |

### Integrations & Settings

| ID | Canonical | Route |
|----|-----------|-------|
| `integrations-calendars` | Integrations → Calendars | `/integrations/calendars` |
| `integrations-payments` | Integrations → Payments | `/integrations/payments` |
| `settings-business` | Settings → Business | `/settings/business` |
| `settings-users` | Settings → Team | `/settings/users` |
| `settings-messaging` | Settings → Messaging | `/settings/messaging` |
| `settings-calendar` | Settings → Calendar | `/settings/calendar` |
| `settings-meetings` | Settings → Meetings | `/settings/ai-notetaker` |
| `settings-security` | Settings → Security | `/settings/security` |
| `settings-billing` | Settings → Billing | `/settings/billing` |
| `help-getting-started` | Help → Getting Started | `/getting-started` |

### Public customer-facing surfaces

| ID | Canonical | Route |
|----|-----------|-------|
| `public-booking` | Public → Booking Page | `/book/[slug]` |
| `public-booking-service` | Public → Service Select | `/book/[slug]/[serviceId]` |
| `public-embed-booking` | Public → Embed Booking | `/embed/book/[slug]` |
| `public-confirm` | Public → Confirm | `/appointments/confirm/[token]` |
| `public-cancel` | Public → Cancel | `/appointments/cancel/[token]` |
| `public-reschedule` | Public → Reschedule | `/appointments/reschedule/[token]` |
| `public-waitlist-accept` | Public → Waitlist Accept | `/waitlist/accept/[token]` |

---

## Explicitly excluded (do not rebuild)

Even if code/routes exist:

| Area | Examples | Reason |
|------|----------|--------|
| Mass SMS marketing | `/campaigns`, `/send`, `/grow/**`, `/automations` (legacy SMS builder) | Hidden from V1 appointments nav |
| MCTB / Voice | `/voice/**` | `MISSED_CALL_TEXT_BACK_IN_V1_NAV = false` |
| AI Receptionist | `/voice/agents/**` | Deferred |
| Legacy dashboard | `/dashboard`, `/sms/**` | Replaced by `/appointments/overview` |
| Admin / internal | `/admin/**`, `/verify/**` | Not customer-facing |
| Duplicate appointment experiments | `/appointments/enterprise`, `/staff`, `/locations` | Not in approved IA |

---

## Feature → canonical page matrix

| Feature | Domain | Canonical page | Contextual surfaces |
|---------|--------|----------------|---------------------|
| Operations dashboard | Home | `/appointments/overview` | — |
| Calendar views | Appointments | `/appointments/calendar` | Home cards |
| Scheduled list / filters | Appointments | `/appointments` | Home → Today's appointments |
| Waitlist | Appointments | `/appointments/waitlist` | Appointment detail |
| Recalls | Appointments | `/appointments/recalls` | Recall campaigns, no-show recovery |
| Appointment detail / timeline | Appointments | `/appointments/[id]` | Calendar overlay, Home |
| Create / edit appointment | Appointments | `/appointments/new`, detail edit | Calendar slot click |
| Booking types | Booking | `/appointments/types` | Settings (read-only links only) |
| Booking pages / preview | Booking | `/appointments/booking` | Type cards |
| Availability rules | Booking | `/appointments/availability` | Type editor |
| AI booking config | Booking | `/appointments/ai-booking` | Messages contextual |
| Routing forms | Booking | `/appointments/routing-forms` | — |
| Meeting polls | Booking | `/appointments/polls` | — |
| Public booking flow | Booking | `/book/[slug]`, `/book/[slug]/[serviceId]` | Type Copy Link |
| Confirm / cancel / reschedule links | Appointments | `/appointments/confirm|cancel|reschedule/[token]` | SMS / email |
| Reminder sequences | Automations | `/appointments/reminders` | Type override, appointment detail |
| Workflows | Automations | `/appointments/workflows` (+ new/edit/setup) | — |
| Automation templates / activity | Automations | `/appointments/automations/templates`, `activity` | — |
| Shared inbox | Messages | `/conversations` | Appointment/MCTB context badges |
| Contacts / lists / segments | Contacts | `/contacts`, `/contacts/lists`, `/contacts/segments` | Appointment picker |
| Upcoming meetings | Meetings | `/video` | Appointment video host |
| Meeting recaps | Meetings | `/meetings`, `/meetings/[id]` | Appointment link |
| Payment transactions | Payments | `/payments/transactions` | Booking deposit (future) |
| Operational analytics | Analytics | `/appointments/analytics/**` | Home summary (subset) |
| Calendar / payment integrations | Integrations | `/integrations/calendars`, `payments` | Settings |
| Workspace settings | Settings | `/settings/**` | — |

---

## File ownership rules

Every Kimi job receives:

- **Primary files** — route page + related presentation components (from manifest / Page Contract)
- **Shared consume** — `src/components/layout/`, `src/components/ui/`, `src/styles/`
- **Shared forbidden** — global sidebar, header, `globals.css`, `product-theme.css`, `src/components/ui/` (modify only via controlled foundation task)

---

## Commands

```bash
# Sync machine-readable manifest from scripts/ui-agent/mode4-manifest.ts
npm run ui:kimi-mode4-sync-manifest

# Generate Page Contract for one surface
npm run ui:kimi-mode4-contract -- --id appointments-calendar

# Run golden screen batch (low concurrency)
npm run ui:kimi-mode4 -- --stage golden

# Run bulk rebuild (10 concurrent, 5s stagger)
npm run ui:kimi-mode4 -- --stage bulk --concurrency 10 --stagger-ms 5000

# Status / completion records
npm run ui:kimi-mode4 -- --status
```
