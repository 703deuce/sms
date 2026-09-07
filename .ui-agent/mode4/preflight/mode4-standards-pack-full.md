TRANSOVO GOVERNING STANDARDS — FULL ORIGINAL DOCUMENTS
Mandatory authority order (top = highest). Lower layers never override higher.
Page Contract is SUPPLEMENTAL — it does not replace these master specifications.

===== [MODE 4 ACTIVE SCOPE — product/feature authority (supersedes stale V1 passages)] docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md =====
# Transovo V1 — Appointments Platform Scope (Mode 4 Authority)

**Status:** Active — **highest product-scope authority for Kimi Mode 4**  
**Audience:** Kimi Mode 4, Cursor orchestration  
**Supersedes:** Any stale passages in `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` that reference MCTB, standalone Compliance, standalone Numbers, mass SMS, Grow, Campaigns, legacy `/voice/**`, or pre–10-domain IA.

**Governance:** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`  
**Page allowlist:** `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`  
**Nav flags (code):** `src/lib/products/v1-launch-nav.ts`  
**Canonical IA (code):** `src/lib/products/appointments-nav.ts`

---

## What Transovo is (current customer-facing product)

Transovo is an **appointments and scheduling platform** for businesses that need:

- calendar and list views of appointments
- booking types, booking pages, and availability
- appointment SMS reminders and automation workflows
- shared Messages (inbox) with appointment context
- contacts tied to appointments
- meetings (notetaker recaps)
- payments for appointments (where enabled)
- operational analytics
- integrations and workspace settings

This is **one coherent product** — not a collection of legacy SMS marketing, telephony, or growth tools.

---

## Launch products IN SCOPE for Mode 4 UI rebuild

Per `v1-launch-nav.ts` and the 57-surface manifest:

| Product area | In Mode 4 rebuild | Notes |
|--------------|-------------------|-------|
| Appointments / Scheduling | **Yes** | Calendar, list, waitlist, recalls, detail, create |
| Appointment SMS reminders | **Yes** | Reminder sequences, workflow steps |
| Conversations (Messages) | **Yes** | `/conversations` — appointment-context inbox |
| Contacts | **Yes** | Lists, segments, fields, imports |
| Booking (types, pages, availability, AI booking, routing, polls) | **Yes** | |
| Automations (reminders, workflows, templates, activity) | **Yes** | Appointment workflows — not mass-SMS drip builder |
| Meetings (upcoming + recaps) | **Yes** | |
| Payments (transactions) | **Yes** | |
| Analytics (operational) | **Yes** | Appointment/booking/reminder/automation metrics |
| Integrations | **Yes** | Calendars, payments |
| Settings | **Yes** | Business, team, messaging, calendar, meetings, security, billing |
| Public booking + token actions | **Yes** | Book, confirm, cancel, reschedule, waitlist accept |
| Help / Getting started | **Yes** | |

---

## Explicitly OUT OF SCOPE for Mode 4 UI rebuild

**Do not create, preserve, surface, route to, or visually incorporate these in Mode 4 jobs** — even if code exists in the repo:

| Excluded area | Examples | Flag / reason |
|---------------|----------|---------------|
| **Missed Call Text Back (MCTB)** | `/voice/missed-calls`, `/voice/setup`, MCTB onboarding | `MISSED_CALL_TEXT_BACK_IN_V1_NAV = false` |
| **Mass SMS marketing** | `/campaigns`, `/send`, drip broadcast builder | `MASS_MESSAGING_IN_V1_NAV = false` |
| **Grow / lead capture** | `/grow/**` keywords, forms, QR, popups | Hidden from appointments nav |
| **Legacy SMS automations** | `/automations` mass-SMS flow builder | `AUTOMATIONS_IN_V1_NAV = false` |
| **Playbooks** | `/playbooks` | `PLAYBOOKS_IN_V1_NAV = false` |
| **AI Receptionist / voice agents** | `/voice/agents/**` | `AI_RECEPTIONIST_IN_V1_NAV = false` |
| **Smart Routing** | `/smart-routing/**` | `SMART_ROUTING_IN_V1_NAV = false` |
| **Standalone Compliance page** | `/compliance` as primary nav | `COMPLIANCE_IN_V1_NAV = false` — consent in-context per standards |
| **Standalone Numbers marketplace** | `/numbers`, `/numbers/buy` | `NUMBERS_IN_V1_NAV = false` — sender config under Settings/Messaging |
| **Legacy dashboard** | `/dashboard`, `/sms/**` | Replaced by `/appointments/overview` |

**Preserved in repo ≠ in scope for rebuild.** Backend/routes may exist for safety; Mode 4 must not reactivate them in customer-facing UI.

---

## Canonical global IA (10 work domains)

From `src/lib/products/appointments-nav.ts` — **do not invent additional top-level areas**:

1. **Home** — `/appointments/overview`
2. **Appointments** — Calendar · List · Waitlist · Recalls
3. **Booking** — Booking Types · Booking Pages · Availability · AI Booking · Routing · Meeting Polls
4. **Contacts** — `/contacts` (+ lists, segments, fields, imports as reachable surfaces)
5. **Messages** — `/conversations` (+ saved replies)
6. **Automations** — Reminder Sequences · Workflows · Templates · Activity
7. **Meetings** — Upcoming (`/video`) · Recaps (`/meetings`)
8. **Payments** — Transactions
9. **Analytics** — Overview · Booking · Reminders · Automations · Reports
10. **Integrations** — Calendars · Payments
11. **Settings** — Business · Team · Messaging · Calendar · Meetings · Security · Billing

Plus **Help** (`/getting-started`).

Local navigation within each domain is governed by `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`.

---

## Per-page feature authority

Detailed per-page requirements remain in `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` **sections 6–17, 21–23, 27, 32** (appointments, booking, conversations, contacts, analytics, settings, integrations, public booking).

**Ignore for Mode 4** in that same file:

- §3 (obsolete nav table — use this document + `appointments-nav.ts`)
- §18 Missed Call Text Back
- §19 Numbers (standalone)
- §20 Compliance (standalone page)
- MCTB metrics in §21 Analytics
- MCTB onboarding track in §28
- MCTB positioning in §31
- MCTB implementation steps in §33
- Appendix A rows for MCTB, Campaigns, Grow, legacy automations

---

## Domain engines (reuse — do not recreate in UI)

| Engine | Location | UI consumes |
|--------|----------|-------------|
| Appointments / calendar | `src/lib/agents/appointment-booking/**`, appointments APIs | Calendar, list, detail |
| Reminders | `src/lib/jobs/*`, messaging dispatch | Reminder sequences |
| Appointment workflows | `src/lib/appointment-workflows/**` | `/appointments/workflows` |
| Messaging / inbox | `src/lib/messaging/**`, inbox components | `/conversations` |
| Contacts | contacts APIs + components | `/contacts/**` |
| Booking public | public book routes | `/book/[slug]` |
| Payments | payments APIs | `/payments/transactions` |

See `docs/appointments-workflows-architecture.md` for workflow UI surfaces.

---

## Mode 4 conflict resolution rule

If any document in the standards pack conflicts with this scope document or `TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`:

**This document + Governance win.**

Kimi must not follow instructions to build MCTB UI, mass-SMS UI, Grow UI, standalone compliance/numbers pages, or legacy nav — even when quoted verbatim from older specs.

---

## Art direction vs product scope

Campaign and Inbox reference videos establish **visual polish only**. They must never import competitor product structure, Campaigns navigation, or Grow features into Transovo.


===== [Per-page feature specs (appointments sections; ignore OUT OF MODE 4 sections)] docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md =====
# Transovo V1 Refocus — Appointments Platform

> **Historical filename note:** This file was originally named for Appointments + MCTB.  
> **MODE 4 ACTIVE SCOPE:** For Kimi Mode 4, `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md` is the authoritative product-scope document. It **supersedes** stale passages below that reference MCTB UI, standalone Compliance/Numbers nav, mass SMS, Grow, Campaigns, or legacy `/voice/**`. Sections marked **OUT OF MODE 4 SCOPE** are preserved for engineering history only — Kimi must not implement them.

**Status:** Active product/UI rebuild directive (appointments sections)  
**Audience:** Cursor agents and engineers  
**Principle:** Audit and reuse before building. **Do not delete** legacy infrastructure — hide from launch nav.

**Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`  
**Mode 4 scope (read first for Kimi):** `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`  
**Mode 4 rebuild:** `docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md` · `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`

Related: `src/lib/products/v1-launch-nav.ts` (nav flags) · Appendix A (reuse map)

---

## Launch products (V1 — Mode 4 active subset)

**Mode 4 rebuilds only the appointments-platform surfaces in** `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`.

1. **Appointments / Scheduling**
2. **Appointment SMS reminders** (reminder sequences + appointment workflows)
3. **Conversations (Messages)**
4. **Contacts**
5. **Booking** (types, pages, availability, AI booking, routing, polls)
6. **Automations** (appointment workflows — not legacy mass-SMS builder)
7. **Meetings** (notetaker recaps)
8. **Payments** (transactions)
9. **Operational Analytics**
10. **Integrations + Settings**

**OUT OF MODE 4 SCOPE** (preserved in repo, hidden from appointments nav): Missed-Call Text Back, standalone Compliance, standalone Numbers, Mass SMS (Campaigns, Drips, Keywords, Grow), legacy `/voice/**`, AI receptionist.

Mass SMS infrastructure is **preserved but hidden** from primary navigation until reactivation.

---

## 1. Non-negotiable rules

### Do NOT delete existing SMS functionality

Preserve routes, APIs, workers, and components for:

- Campaigns, Drips, Keywords, Playbooks, Automations
- Bulk sending, queue/worker infrastructure
- SMS composer, templates, delivery status
- Contacts, Conversations/inbox
- Number/provider, consent/compliance, analytics, billing/credits
- Existing MCTB pages/backend, Smart Routing / telephony

**If not part of launch → hide from navigation, not delete.**

---

## 2. Reuse before building

Before creating a new component, audit existing app surfaces.

**Reuse or adapt** for: contact picker, detail drawer, phone/email fields, SMS composer, template editor, variable insertion, delivery status, scheduling, conversations, search/filters/tables/cards, analytics counters, provider/number config, compliance/consent, billing/usage, empty states, dialogs, side panels, page headers, shared nav.

**Do not** create a separate “appointment messaging system.” Appointments generate messages through the **same messaging infrastructure**.

---

## 3. Primary navigation (V1)

> **MODE 4:** Use `src/lib/products/appointments-nav.ts` (10-domain IA) and `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`. The table below is **obsolete** for Mode 4.

| Section | Items |
|---------|--------|
| **Home** | Operations dashboard (`/appointments/overview`) |
| **Appointments** | Calendar · List · Waitlist · Recalls |
| **Booking** | Types · Pages · Availability · AI Booking · Routing · Polls |
| **Contacts** | Contacts (+ lists, segments, fields, imports) |
| **Messages** | Inbox (`/conversations`) |
| **Automations** | Reminder Sequences · Workflows · Templates · Activity |
| **Meetings** | Upcoming · Recaps |
| **Payments** | Transactions |
| **Analytics** | Overview · Booking · Reminders · Automations · Reports |
| **Integrations** | Calendars · Payments |
| **Settings** | Business · Team · Messaging · Calendar · Meetings · Security · Billing |

Nav flags: `src/lib/products/v1-launch-nav.ts` · Canonical builder: `appointments-nav.ts`

---

## 4. Hide for now (routes preserved)

Remove from **primary nav** only:

- Campaigns, Drips, Keywords, Playbooks, Automations
- Bulk SMS analytics, marketing list/segment standalone pages
- Mass-SMS templates unrelated to appointments
- Full visual automation builder

Use centralized flags — **no scattered hardcoded conditionals**.

---

## 5. Global UI requirements

One product feel:

- One global sidebar + header
- Consistent content width, padding, cards, filters, tables, drawers
- Responsive; no horizontal overflow
- Operational first — user sees what needs attention in seconds
- Do not create separate-looking mini-apps for Appointments, Conversations, or Booking

---

## 6. Overview page

**Job:** *What is happening with my appointments and customer conversations today?*

**Summary cards:** Appointments Today · Confirmed · Awaiting Confirmation · Reschedule Requests · Unread Conversations

**Sections:**

- **Today's Appointments** — time, customer, service, confirmation, reminder state → click opens detail
- **Needs Attention** — awaiting confirmation, reschedule requests, unread conversations, failed reminders → each links to proper screen
- **Recent Conversations** — reuse existing components

No generic marketing charts. **Operations dashboard.**

---

## 7. Calendar page

**Route:** `/appointments/calendar`

**Views:** Day · Week · Month (default **Week** on desktop)

**Controls:** Previous · Today · Next · view selector · New Appointment

**Blocks:** customer name, service/title, time, status indicator (confirmed / awaiting / reschedule / canceled)

**Interactions:**

- Click empty slot → New Appointment drawer with date/time prefilled
- Click appointment → compact overlay/drawer (Google Calendar popover pattern) — do not always navigate away

**Overlay actions:** Edit · Message · Confirm · Reschedule · Cancel · Open full details

Drag/resize later unless trivial and reliable.

**Visual:** Calendar grid dominates — sparse, not dashboard-heavy. Config in side panels/drawers.

Use a **mature calendar library**; engineering focus on booking → consent → reminders → conversation flow.

---

## 8. Appointments list (Scheduled Appointments)

**Route:** `/appointments`

Operational booked-event list (Calendly “Scheduled Events” pattern).

**Tabs/filters:** Today · Upcoming · Awaiting Confirmation · Confirmed · Reschedule Requested · Canceled · Past

**Search:** name, phone, email, service

**Columns:** Date/Time · Customer · Service · Status · Reminder Status · Last Communication · Actions

**Actions:** Open · Reschedule · Cancel · Message

Mobile → stacked cards.

---

## 9. Appointment Types (first-class)

**Route:** `/appointments/types` (or `/appointments/appointment-types`)

Reusable configuration — **not buried in Settings**.

Each type stores: name · description · duration · location · optional price · assigned staff · availability rules · booking questions · reminder sequence · active/inactive · **public booking URL**

**Type cards show:** name · duration · booking page status · Copy Link · Preview · Edit

Do not require recreating settings per booking.

**Data model:** `AppointmentType` (config) vs `Appointment` (instance) — never mix.

---

## 10. Create / edit appointment

Simple form:

**Customer:** search existing · create new · name · phone · email

**Appointment:** service/type · date · start · duration · optional staff · location · notes

**Communication:** SMS reminder toggle · email if supported · reminder preview

**Status:** scheduled · confirmed · completed · canceled · no-show

Advanced options collapsible. Fast-create from calendar: click slot → type → customer → save in seconds.

---

## 11. Appointment detail

Header example: **Sarah Johnson** · Water Heater Estimate · Thursday, September 10 · 2:00 PM

Show: status · contact info · service · duration · staff · notes

**Actions:** Message Customer · Reschedule · Cancel · Mark Complete

**Communication timeline** — reuse messaging/history: confirmation sent, customer confirmed, reminders, replies, reschedule/cancel events — one chronological history.

**Reminder schedule:** Confirmation — Sent · 24h — Scheduled · 2h — Scheduled. Failed reminders visible.

---

## 12. Booking page management

**Route:** `/appointments/booking` (global) + per-type URLs on Appointment Types

**Status:** Enabled/Disabled · public URL · Copy Link · **Preview** · Open Page

**Business info:** display name · logo · phone · address · timezone

**Availability (robust):**

- Weekly recurring hours + multiple windows/day (e.g. 9–12, 2–5)
- Date-specific overrides · blackout dates
- Minimum notice · maximum horizon · buffer before/after
- Reusable schedules (Standard Hours, Evening Hours) selectable by type

**Booking fields:** name · phone · email + optional custom questions (short/long text, dropdown, checkbox — V1 simple)

**Preview** must show exactly what customers see before enable.

**Sharing:** Copy link · Open · Preview on every type card — never bury URL in Settings.

---

## 13. Public booking experience

No customer account required.

1. Select service/type  
2. Select date/time (dates first, then slots — Calendly layout: details left · date center · slots right; stack on mobile)  
3. Enter name · phone · email  
4. **SMS consent** — separate checkbox, **unchecked by default**, approved Transovo wording, Terms + Privacy links  
5. Book  

Confirmation: business · service · date/time · status · Add to Calendar (if easy) · reschedule/cancel links

Consumer-facing design — not admin dashboard.

---

## 14. Reminder settings

**Route:** `/appointments/reminders` (global default) + per-type override optional

Simple controlled sequence — **not** a visual workflow canvas.

**Default:**

| Reminder | Timing |
|----------|--------|
| Booking confirmation | Immediately |
| Reminder 1 | 24 hours before |
| Reminder 2 | 2 hours before |

Each card: enabled toggle · timing · channel · template · edit · preview

**Variables:** `{{first_name}}` `{{business_name}}` `{{service}}` `{{appointment_date}}` `{{appointment_time}}` `{{reschedule_link}}` `{{cancel_link}}`

Reuse existing SMS template editor + Drip/scheduled-message infrastructure.

---

## 15. Confirm / cancel / reschedule flow

**Confirm:** reply YES and/or link → status update + timeline event

**Cancel:** secure link → cancel pending reminders → confirmation to customer

**Reschedule:** link → valid slots only → cancel old reminder jobs → update appointment → new jobs → updated confirmation + timeline

Deterministic. Idempotent worker behavior.

---

## 16. Conversations

**Do not rebuild.** Adapt existing inbox.

Show context on every thread:

- *Appointment:* Water Heater Estimate — Sept 10 at 2 PM  

Filters: All · Unread · Appointments (hide legacy campaign filters)

---

## 17. Contacts

Keep existing Contacts. Extend profile with:

- Upcoming appointment  
- Appointment history (upcoming · completed · canceled · no-show)  
- Conversations (reuse)  
- Consent (SMS)

**Same contact records** — no separate customer DB.

---

## 18. Missed Call Text Back — OUT OF MODE 4 SCOPE

> **MODE 4:** `MISSED_CALL_TEXT_BACK_IN_V1_NAV = false`. Do not rebuild `/voice/**` MCTB surfaces. Preserved in repo for future reactivation only.

**Do not rebuild in Mode 4.** Audit and tighten UI to match Appointments shell *(deferred)*.

Pages: Missed Calls · Setup · Numbers/Forwarding

**Missed Calls list:** caller · context · date/time · disposition · consent · text started? · conversation status

Statuses: Missed · Waiting for consent · Opted in · Conversation started · Voicemail · Opted out

Click → detail or Conversation.

**Setup onboarding:** forwarding → business name → greeting → test forward → test IVR → test text-back → ready

Separate: submitted compliance script vs production live IVR prompt.

Preserve **both** MCTB modes: `press_1` and `existing_consent`.

---

## 19. Numbers — OUT OF MODE 4 SCOPE

> **MODE 4:** `NUMBERS_IN_V1_NAV = false`. Sender/number configuration belongs under **Settings → Messaging**, not a standalone Numbers product area.

- Business phone vs forwarding setup vs messaging sender vs provider status

Do not show mass-SMS dedicated-number registration to Appointments/MCTB-only users.

---

## 20. Compliance — OUT OF MODE 4 SCOPE (standalone page)

> **MODE 4:** `COMPLIANCE_IN_V1_NAV = false`. Surface appointment/SMS consent **in-context** per `TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` — not a standalone Compliance nav item.

- **Appointment consent** — wording · captured? · timestamp · source · terms version  
- **MCTB consent** — Press-1 · timestamp · call ID · sender · opt-out state  
- **Messaging status** — active · STOP · UNSTOP  

---

## 21. Analytics (operational)

**Appointments:** Booked · Confirmed · Canceled · No-Shows · Confirmation Rate · Reminder Delivery · Reschedule Requests

**Conversations:** unread · response rate (if reliable)

*(MCTB metrics excluded from Mode 4 — see scope doc.)*

Ranges: 7 days · 30 days. No fake/mock production data.

---

## 22. Settings

Consolidate: Business · Appointment Defaults · Notifications · Messaging · Team · Billing · Integrations · Compliance

---

## 23. Integrations

Transovo calendar = **source of truth for V1**. Do not block launch on Google/Outlook/Calendly.

Architecture-ready for later sync. No fake integration buttons. Preserve working integrations.

---

## 24. Data model

Appointment relates to: workspace · contact · service/type · start · end/duration · timezone · status · notes · staff · consent · reminder config · conversation · created source

Event history: created · confirmation sent · confirmed · reminder sent · reply · reschedule requested · rescheduled · canceled · completed · no-show

---

## 25. Reminder engine

Reuse existing SMS worker/scheduling. **No second cron** if current worker supports appointment jobs safely.

On create → calculate jobs. On update → cancel stale → recalculate. On cancel → cancel remaining. Past appointments → no stale sends. Idempotent. Workspace-scoped.

---

## 26. Tenant isolation

Everything workspace-scoped. Never resolve appointment/contact/conversation/consent without workspace ownership.

Inbound: number → provider context → workspace → contact → conversation → appointment

Cross-tenant regression tests required.

---

## 27. Empty states

Every page: useful first-run copy with clear next action (create appointment, enable booking page, configure forwarding, etc.)

---

## 28. First-run onboarding

Checklist (non-blocking between tracks):

**Appointments:** hours · first service/type · enable booking · reminders · test appointment  

*(MCTB onboarding track excluded from Mode 4.)*

---

## 29. V1 success criteria

See full checklist in original spec §29 (appointments 17-step + MCTB 10-step smoke paths).

---

## 30. What NOT to build before launch

AI receptionist, AI calendar optimizer, transcription, classes/group scheduling, POS, payroll, memberships, advanced staff scheduling, marketplace, giant automation builder, mass SMS expansion, unnecessary integrations.

**Preserve existing code — hide from launch surface.**

---

## 31. Product positioning → UI emphasis

**Appointments:** reduce no-shows, stop manual chasing → show confirmation state, reminders, replies, reschedule/cancel, needs attention

Not just calendar boxes.

---

## 32. Calendly / Google Calendar UX additions

1. Calendar visually sparse — grid dominates  
2. Appointment Types as first-class objects  
3. Robust availability (multi-window days, overrides, blackouts, buffers, reusable schedules)  
4. Real booking page preview  
5. Obvious sharing (Copy · Open · Preview on types)  
6. Calendar click → overlay/drawer not full navigation  
7. Appointment Types management page with cards  
8. Explicit timezone everywhere — no silent shifts  
9. Lightweight booking questions per type  
10. Payment architecturally possible later (free / optional / required deposit) — do not hardcode always-free  
11. Separate AppointmentType vs Appointment entities  
12. Scheduled Appointments = operational list (`/appointments`)  
13. Consumer booking: service → date → slots → info → consent  
14. Skip Calendly bloat (polls, round-robin, workflow canvas)  
15. Fast-create from calendar  
16. Reusable availability schedules  
17. Status visible on calendar blocks  
18. Open booking page link everywhere relevant  

---

## 33. Implementation order

1. **Audit** routes/components/backend (done — Appendix A)  
2. **Reuse map** — keep / modify / hide / new-build  
3. **Do not delete** existing functionality  
4. **Consolidate** global sidebar/header first (`appointments-nav.ts` + `v1-launch-nav.ts`)  
5. **Build Appointments** on Contacts, Conversations, SMS, scheduler, billing  
6. **Hide** mass-SMS and legacy voice from launch nav  
7. Static verification on every Mode-4-visible page  
8. Real SMS/reminder E2E before declaring V1 ready  

*(MCTB UI tightening deferred — out of Mode 4 scope.)*

---

## Appendix A — Reuse map (audit snapshot)

| Area | Path(s) | Action | Notes |
|------|---------|--------|-------|
| MCTB Missed Calls | `/voice/missed-calls` | **out-of-mode4** | Preserved; not in rebuild manifest |
| MCTB Setup | `/voice/setup` | **out-of-mode4** | Preserved; not in rebuild manifest |
| MCTB Consent Log | `/voice/consent-log` | keep-as-is | Audit trail |
| MCTB Schedule | `/voice/schedule` | keep-as-is | Business hours |
| MCTB Conversations | `/voice/conversations`, `/conversations` | modify | Consolidate entry |
| MCTB runtime | `src/lib/mctb/**` | keep-as-is | Frozen TeXML pipeline |
| Appointments hub | *(none)* | **new-build** | `/appointments`, `/appointments/calendar`, `/appointments/types` |
| Appointments seed UI | `/integrations/native/appointments`, `/voice/calendars` | modify | Pull patterns/data |
| Appointment booking runtime | `src/lib/agents/appointment-booking/**` | keep-as-is | Reuse engine; not V1 nav |
| Conversations | `/conversations`, inbox components | keep-as-is | Add context badges |
| Contacts | `/contacts/**` | keep-as-is | Add appointment sections |
| Campaigns | `/campaigns/**` | hide-from-nav | 18 pages preserved |
| Drips | `/automations/drip-campaigns/**` | hide-from-nav | |
| Keywords / Grow | `/grow/**` | hide-from-nav | |
| Playbooks | `/playbooks` | hide-from-nav | |
| Automations | `/automations/**` | hide-from-nav | |
| Smart Routing | `/smart-routing/**` | hide-from-nav | Deferred |
| AI Receptionist | `/voice/agents/**` | hide-from-nav | Deferred |
| SMS composer/templates | `components/inbox/*`, `lib/messaging/**` | keep-as-is | Appointment reminders |
| Scheduler/worker | `lib/jobs/*`, `lib/messaging/dispatch/**` | keep-as-is | Appointment jobs |
| Nav chrome | `sms-platform-nav.ts`, `voice-nav.ts`, `platform-launch.ts` | modify | Use `v1-launch-nav.ts` |
| Compliance | `/compliance` | keep-as-is | Extend sections |
| Numbers | `/numbers`, `/voice/numbers` | modify | Canonical route pick |

**Current nav:** Use `buildAppointmentsV1Nav()` from `appointments-nav.ts` with `v1-launch-nav.ts` flags.

---

## Appendix B — Suggested Appointments submenu

```
Appointments
├── Calendar              /appointments/calendar
├── Scheduled Appointments /appointments
├── Appointment Types     /appointments/types
└── Reminder Settings     /appointments/reminders
```

Per-type: availability · booking page · questions · reminders · Copy Link · Preview · Open


===== [Approved customer-facing page/subpage/wizard/surface inventory] docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md =====
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


===== [Appointments platform domain architecture (replaces legacy PRODUCT_ARCHITECTURE.md)] docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md =====
# Transovo Appointments Platform — Domain Architecture

**Status:** Active domain reference for Mode 4 (appointments platform only)  
**Supersedes for Mode 4:** `docs/PRODUCT_ARCHITECTURE.md` (legacy mass-SMS campaign catalog — **not** included in Mode 4 standards pack)

---

## Core domain objects

| Object | Purpose | Primary UI surfaces |
|--------|---------|---------------------|
| **Appointment** | Scheduled occurrence | Calendar, list, detail, create |
| **AppointmentType / BookingType** | Reusable service configuration | Booking Types, type editor |
| **BookingPage** | Public booking surface | Booking Pages, `/book/[slug]` |
| **Availability** | Schedules, hours, buffers | Availability, per-type rules |
| **Contact** | Customer/person record | Contacts, detail, picker in forms |
| **ReminderSequence** | SMS reminder configuration | Reminder Sequences |
| **AppointmentWorkflow** | Lifecycle automation | Workflows list, builder, setup wizard |
| **Conversation** | SMS thread with context | Messages inbox |
| **MeetingRecap** | Notetaker output | Meetings recaps |
| **PaymentTransaction** | Appointment-related payment | Payments transactions |

---

## Product areas → routes

| Area | Routes | Engine / lib |
|------|--------|--------------|
| Home | `/appointments/overview` | Dashboard metrics APIs |
| Appointments | `/appointments/calendar`, `/appointments`, waitlist, recalls, `[id]`, `new` | Appointment booking runtime |
| Booking | `/appointments/types`, `booking`, `availability`, `ai-booking`, `routing-forms`, `polls` | Booking config + public book |
| Contacts | `/contacts`, `[id]`, lists, segments, fields, imports | Contacts CRUD |
| Messages | `/conversations`, saved-replies | `src/lib/messaging/**`, inbox |
| Automations | `/appointments/reminders`, `workflows/**`, `automations/templates`, `activity` | Reminders + `appointment-workflows` |
| Meetings | `/video`, `/meetings`, `[id]` | Video/notetaker |
| Payments | `/payments/transactions` | Stripe/payments lib |
| Analytics | `/appointments/analytics/**` | Operational metrics |
| Integrations | `/integrations/calendars`, `payments` | OAuth connections |
| Settings | `/settings/**` | Workspace config |
| Public | `/book/**`, confirm/cancel/reschedule tokens, waitlist accept | Public booking client |

---

## Explicitly not appointments-platform UI

The following are **separate legacy products** preserved in repo but excluded from Mode 4:

- Mass SMS campaigns (`/campaigns`, 14-category catalog in `src/lib/campaigns/catalog.ts`)
- Grow tools (`/grow/**`)
- MCTB / voice telephony (`/voice/**`, `src/lib/mctb/**`)
- Legacy SMS automation builder (`/automations` drip/marketing flows)

Mode 4 Kimi jobs must not reference or rebuild these surfaces.


===== [Appointment workflows domain + UI surfaces] docs/appointments-workflows-architecture.md =====
# Appointment Workflows Architecture

## Overview

Appointment Workflows are an **isolated clone** of the Playbooks/Drips pattern, specialized for appointment lifecycle automation. They do **not** share database records with SMS DripCampaigns or Playbooks.

## Components

| Layer | Path | Role |
|-------|------|------|
| Types | `src/lib/appointment-workflows/types.ts` | Triggers, steps, conditions, timing |
| Templates | `src/lib/appointment-workflows/templates.ts` | 7 prebuilt workflow definitions |
| Service | `src/lib/appointment-workflows/service.ts` | CRUD, list active workflows |
| Conditions | `src/lib/appointment-workflows/conditions.ts` | AND/OR appointment condition evaluation |
| Scheduler | `src/lib/appointment-workflows/scheduler.ts` | Relative-to-appointment-time scheduling |
| Engine | `src/lib/appointment-workflows/engine.ts` | Execution, invalidation, step processing |
| Triggers | `src/lib/appointment-workflows/triggers.ts` | Lifecycle hooks (booked, rescheduled, etc.) |
| Capabilities | `src/lib/appointment-workflows/capabilities.ts` | Entitlement-ready feature keys |

## Database

- `appointment_workflows` — workflow definitions
- `appointment_workflow_executions` — per-appointment execution instances
- `appointment_workflow_step_executions` — scheduled/sent step state with idempotency keys

## Runtime

Jobs of type `appointment_workflow_step` are enqueued into the **existing** `jobQueue` worker infrastructure (same as drip campaigns and reminder scan). No separate worker service.

## Prebuilt Templates

1. Standard Reminders
2. Confirmation Required
3. High-Value Appointment
4. Last-Minute Reminders
5. Post-Appointment Follow-Up
6. Review Request
7. Reschedule Follow-Up
8. No-Show Recovery
9. Re-Engagement / Book Again
10. Payment Follow-Up

## Invalidation Rules

- **Canceled** → cancel all pending steps
- **Rescheduled** → invalidate old relative-time jobs, restart booked workflow
- **Confirmed** → skip steps with `stopIfConfirmed`
- **Completed/no-show** → cancel pending before-appointment steps

## Preserved Systems

`scanPlatformAppointmentReminders` (24h/2h) and booking confirmation SMS continue for workspaces **without** an active `appointment_booked` workflow scoped to the appointment type. When such a workflow is active, platform default reminders are skipped for that lifecycle so workflow steps are the single source of truth (see `platform-guard.ts`).

## UI

- `/appointments/workflows` — list + prebuilt cards + custom workflows
- `/appointments/workflows/setup/[templateId]` — prebuilt wizard
- `/appointments/workflows/new` — custom workflow builder (Drip-style)

## AI Booking

See `src/lib/appointments/ai-scheduling/` — shared intent service used by public booking and prepared for Conversations reuse.


===== [Domain definitions, terminology, product experience principles (30 rules)] docs/TRANSOVO-UI-DESIGN-GUIDE.md =====
# Transovo UI Design Guide

**Status:** Active — required reference for all UI work  
**Audience:** Engineers, designers, and Cursor agents building or changing Transovo interfaces  
**Scope:** Information architecture, navigation, layout, interaction patterns, terminology, and visual hierarchy  
**Not in scope:** Company-specific “house style” mimicry (Shopify, Atlassian, etc.). These rules come from established HCI/UX practice: ISO 9241-210 human-centered design, Nielsen Norman usability heuristics, information architecture methods, Gestalt principles, WCAG predictability/navigation guidance, and enterprise design-system conventions.

**Related docs**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- **Accessibility (WCAG 2.2 AA):** `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- **Human-centered design (ISO 9241):** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- **IA & navigation (hard standard):** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- **Interaction/keyboard/focus (hard standard):** `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- **Forms & validation (hard standard):** `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- **Responsive/reflow/zoom (hard standard):** `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- **Tables/grids (hard standard):** `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- **Privacy/consent/compliance (hard standard):** `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- **Security/authentication (hard standard):** `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- **Date/time/timezone/locale (hard standard):** `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- **Internationalization/localization (hard standard):** `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- Page architecture: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- V1 launch nav flags: `src/lib/products/v1-launch-nav.ts`
- V1 UI rebuild directive: `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md`

---

## When to use this guide

**Follow these rules whenever you:**

- Add or change a page, drawer, modal, wizard, or settings surface
- Add or move navigation items (global or local)
- Design forms, lists, detail views, or dashboards
- Choose labels, button placement, status display, or error copy
- Decide whether something belongs in global nav, local nav, a tab, a contextual action, or settings

**If a design choice conflicts with this guide, resolve the conflict before shipping UI.**

---

## The application shell (non-negotiable)

Every normal authenticated page uses **one** application shell. Kimi (or any page template) must not reinvent chrome per screen.

```
┌─────────────────────────────────────────────────────────┐
│ Global header                                           │
├──────────┬──────────────────────────────────────────────┤
│ Global   │ Page header (title, primary action, context) │
│ sidebar  ├──────────────────────────────────────────────┤
│          │ Local navigation (when this domain has it)   │
│          ├──────────────────────────────────────────────┤
│          │ Content workspace                            │
└──────────┴──────────────────────────────────────────────┘
```

**Preserve spatial consistency:** search, primary actions, settings entry, and navigation placement must not move between pages. Users build spatial memory.

---

## Transovo domain definitions (mutually exclusive)

These definitions prevent IA drift. If a feature does not fit one definition cleanly, rename it, make it contextual, or question whether it belongs in the product.

| Domain | Mental model | User question it answers |
|--------|--------------|-------------------------|
| **Appointments** | Scheduled occurrences that already exist | “What’s on my calendar / list?” |
| **Booking** | Rules and surfaces for *creating* appointments | “How do customers book with me?” |
| **Contacts** | People | “Who is this customer?” |
| **Messages** | Appointment-related conversations (not marketing) | “What are customers saying?” |
| **Automations** | Rules Transovo runs automatically | “What should happen automatically?” |
| **Meetings** | AI notetaker: recording, transcript, recap | “What happened in the meeting?” |
| **Payments** | Money collected for appointments | “What was paid?” |
| **Analytics** | Aggregate performance | “How is the operation performing?” |
| **Integrations** | External system connections | “What is connected?” |
| **Settings** | Organization-wide configuration | “How is my account set up?” |

**Sharp distinctions (do not blur):**

- **Appointments vs Booking vs Calendar** — Appointments = existing scheduled items; Booking = creation rules/pages; Calendar is a *view* inside Appointments.
- **Messages vs Automations** — Messages = conversations; Automations = triggered rules (reminders, workflows).
- **Meetings vs Appointments** — Appointments = scheduled slot; Meetings = what happened in Zoom/Meet/Teams/Webex (recording, recap).
- **Integrations vs Settings** — Integrations = connect external systems; Settings = defaults and org policy (A2P, team, security).

**Appointment platform boundary:** Do not reintroduce legacy SMS marketing, Grow, contests, AI receptionist, or unrelated telephony into primary product IA unless explicitly in scope for that product.

---

## The 30 rules

### 1. Start with the user’s mental model, not the feature inventory

The question is not “What features did we build?” It is “How does the user mentally divide the work they came here to do?”

- Use **card sorting** (generative) to discover natural groupings.
- Use **tree testing** (evaluative) to verify findability in the proposed hierarchy.
- The feature matrix is **input** to IA, not the IA itself.

### 2. Categories must be mutually distinguishable

A user must not wonder which of two top-level labels a feature lives under.

- Avoid overlapping, vague, or catch-all categories (“Tools”, “Management”, “Other”).
- Top-level labels must be **descriptive, specific, and mutually exclusive**.

### 3. Match the system to the real world

Use language and concepts customers already understand—not internal architecture.

| Prefer | Avoid (internal only) |
|--------|------------------------|
| Appointment | Event object |
| Booking page | Scheduling resource |
| Reminder | Workflow execution |
| Contact | Party record |
| Payment | Merchant transaction entity |

Internal names may exist in code; they must not drive UI labels.

### 4. Recognition beats recall

Users should **see** choices and recognize what they need—not remember where a hidden setting lives.

**Bad:** “Where do I change which calendar blocks availability? Integrations? Settings? Booking?”

**Good:** Inside **Booking → Availability**, show connected blocking calendars inline, with a link: **Manage connected calendars**.

Use **contextual links** between related objects so users do not memorize configuration locations.

### 5. Information hierarchy must reflect importance

Structure communicates priority. Typical order on a page:

1. What this page is (title / context)
2. Primary task
3. Most important current information
4. Secondary controls
5. Advanced / configuration details

**Gestalt:** proximity groups related items; similarity groups controls of the same type. Spacing is semantic—not decoration.

**Example (appointment detail):**

- **Group A:** Customer, date/time, service, staff
- **Group B:** Confirmation, payment, SMS eligibility, reminder state (operational status)
- **Group C:** Activity timeline

### 6. Use progressive disclosure

Show common controls first; reveal advanced complexity when needed.

**Booking type — show first:** Name, duration, host, availability, location.

**Reveal under sections:** Advanced scheduling, customer questions, notifications & reminders, payments, confirmation, permissions.

Same capability; far less cognitive load.

### 7. Use consistency aggressively

Across the entire product:

- Same global sidebar on every normal page
- Same header structure
- Same primary button placement (primary action top-right of page header unless domain standard differs)
- Same meaning for status colors and badges
- Same terminology everywhere
- Same drawer / modal behavior
- Same filter placement (lists)
- Same save / cancel conventions
- Same form field order patterns where applicable
- Same delete confirmation behavior

One team designed this—not a page-by-page assembly.

### 8. Preserve spatial consistency

If search is always top-right, keep it there. If Settings is always in the global sidebar footer area, keep it there. Predictable placement speeds navigation (WCAG consistent navigation).

### 9. Global navigation and local navigation are different systems

| System | Question |
|--------|----------|
| **Global** | What major area of Transovo do I want? |
| **Local** | What part of *this* area am I working in? |

**Example**

- Global: **Appointments**
- Local: Calendar | List | Waitlist | Recalls

Do not promote every local view to global navigation. Side navigation is for hierarchical sub-navigation within a section (typically one to three levels).

### 10. Keep breadth and depth balanced

There is no magic “max 7 items” rule. Balance **breadth** (too many top-level items) vs **depth** (too many nested clicks).

- Too broad: 27 global menu items
- Too deep: Settings → Scheduling → Availability → Staff → Calendars → Conflict rules

**Target for Transovo:** ~7–10 meaningful global destinations with shallow local navigation underneath—because that matches the jobs we support, not because of a folklore number.

### 11. Minimize decision cost (Hick’s Law)

Do not present 18 choices when 3 fit the moment.

**Bad — one global “New” menu:** New appointment, booking page, booking type, workflow, reminder, contact, routing form, poll, campaign…

**Good — context determines action:**

- On **Appointments:** New appointment
- On **Contacts:** Add contact
- On **Automations:** New automation

### 12. Minimize memory load

Carry context forward. The system remembers; the user should not re-enter or re-find context.

| From | Action | System should already know |
|------|--------|----------------------------|
| Contact (Anthony) | Book appointment | Anthony |
| Appointment | Send message | Customer + appointment |
| Meeting recap | Create follow-up | Meeting, contact, appointment |

### 13. Actions belong next to the object they affect

On an **appointment**, place confirm, reschedule, cancel, message, payment, reminder override **on that appointment**.

- **Global Automations** = rules for many appointments
- **Appointment detail** = this appointment’s status and overrides

Do not force users into Automations to answer “Did John get tomorrow’s reminder?”

### 14. Separate objects from configuration

| Objects (frequent) | Configuration (occasional) |
|--------------------|----------------------------|
| Appointments | Availability schedules |
| Contacts | Booking types |
| Conversations | Reminder sequences |
| Meetings | Integrations |
| Payments | Team roles, A2P, security |

Objects deserve prominent navigation. Configuration is set up once and changed rarely—do not give it equal visual weight with daily work.

### 15. Visibility of system status

The product is asynchronous: calendar sync, SMS, reminders, OAuth, payments, notetaker, transcription, workflows.

Always show **state**, not static labels.

| Weak | Strong |
|------|--------|
| Microsoft | Microsoft 365 — Connected — Last synced 2 min ago |
| SMS reminder | Scheduled — Tomorrow 9:00 AM → Sent 9:00 AM → Delivered |

This principle applies across the entire UI.

### 16. Error prevention beats error messages

Prevent failures before they happen.

| Weak | Strong |
|------|--------|
| SMS failed: A2P required | Disable SMS + explain: Business texting registration required for imported appointments |
| Conflict on save | 2:00 PM unavailable — Microsoft Work Calendar (before save) |

### 17. Errors must explain the problem and the solution

| Weak | Strong |
|------|--------|
| Error 401 | Microsoft connection expired. Reconnect to resume sync. **[Reconnect]** |

When the system can recover silently, the user should not see an error at all.

### 18. User control and freedom

Provide cancel, back, undo where reasonable, restore where reasonable, confirmation before destructive actions, and easy reschedule instead of delete/recreate. Wizards must not trap users.

### 19. The system should be forgiving

Normalize phone numbers, times, and formats. Reconcile external calendar changes instead of duplicating. Eliminate avoidable work.

### 20. Focus the interface on frequent tasks

Something used every hour beats something configured twice a year for placement priority.

**Appointments** near the top. **SAML** deep in Settings. Feature completeness ≠ information architecture.

### 21. Shortcuts for experts without complicating novices

Later: global search, command menu, keyboard shortcuts, saved filters, duplicate booking type, clone workflow, bulk actions. Novices ignore them; power users depend on them.

### 22. Use plain, specific labels

Avoid: Tools, Management, Resources, Advanced, Miscellaneous, Other.

Use: Appointments, Contacts, Payments, Automations.

**One concept → one canonical name.** If the UI says “Booking type”, do not also call the same object “Service”, “Event type”, and “Appointment type” unless they are truly different entities.

### 23. Maintain clear location and wayfinding

Users must always know where they are. Descriptive page titles and headings are required.

Hierarchy should be apparent: `Booking / Booking types / Initial consultation` — breadcrumbs optional, clarity not optional.

### 24. Multiple ways to reach important things

The same **object** may be reachable from:

- Calendar
- Appointment list
- Contact record
- Home / dashboard
- Global search (when available)

That is multiple **access paths**, not multiple duplicate objects.

### 25. Keep workflows task-oriented

Multi-step flows ask for one coherent chunk per step—organized by user tasks, not database tables or APIs.

**Example — create booking type:** Basics → Hosts & availability → Booking rules → Customer information → Notifications → Payment → Confirmation.

### 26. Don’t make users configure what can be defaulted

Default timezone to workspace timezone, default reminder sequence, default calendar, default staff to current user when sensible. Only expose decisions that matter.

### 27. Destructive actions: spare and separated

Primary: **Save changes**. Delete / revoke / cancel booking type: **Danger zone** lower on the page, visually distinct from primary actions.

### 28. Accessibility is part of the system, not polish later

Design for:

- Logical focus order
- Visible keyboard focus
- Descriptive headings and labels
- Consistent navigation and component identification
- Predictable context changes

### 29. Test the information architecture

Expertise produces a **hypothesis**; validation produces confidence.

Recommended flow:

```
Feature inventory
    → User tasks / mental models
    → Taxonomy
    → Card sort
    → Proposed hierarchy
    → Tree test
    → Revise
    → Low-fidelity nav prototype
    → Task-based usability testing
    → UI design / implementation
```

Changing IA after screens are built is expensive. Test navigation before polishing pixels.

### 30. Evaluation lenses (professional framework)

Evaluate every UI decision against:

**Information architecture**

- Mental models, taxonomy, mutually exclusive labels
- Hierarchy, breadth vs depth, findability
- Card sort + tree test when structure changes

**Nielsen heuristics**

- Visibility of status, real-world language, user control
- Consistency, error prevention, recognition over recall
- Efficiency, minimalism, error recovery, help

**Gestalt / visual hierarchy**

- Proximity, similarity, common region, continuity, figure/ground

**Human-centered design (ISO 9241-210)**

- Understand users, tasks, context; involve users; evaluate; iterate; whole experience

**Accessibility / predictability (WCAG)**

- Focus, consistent navigation, consistent identification, descriptive labels, multiple findability paths

---

## IA placement checklist (every capability)

Before adding UI for any capability, answer:

| Question | Options |
|----------|---------|
| Object or configuration? | Object → prominent nav or contextual surface; Configuration → Settings / Booking setup |
| Daily or occasional? | Daily → higher in hierarchy |
| Which user job? | Must map to one domain definition above |
| Customer-expected location? | Tree-test mentally: “Where would I look?” |
| Navigation level? | Global nav · Local nav · Tab · Contextual action · Advanced settings only |
| Related links? | What object pages should link here with recognition, not recall? |
| Canonical term? | One label across product |

---

## Implementation references (appointments platform)

Current global IA implementation lives in:

- `src/lib/products/appointments-nav.ts` — sidebar structure
- `src/lib/products/appointments-routes.ts` — route helpers and domain prefixes
- `src/lib/products/appointments-settings-tabs.ts` — Settings / Integrations / Analytics subnav
- `src/components/layout/sidebar.tsx` — shell wiring
- `src/components/layout/app-shell.tsx` — page titles and layout

When changing navigation, update nav tests: `npx tsx scripts/test-appointments-nav.ts`

---

## What we do next (process, not pixels)

1. **Inventory** — complete capability list (appointment platform scope).
2. **Classify** — object vs configuration; frequency; domain; canonical term.
3. **Place** — global / local / tab / contextual / settings per checklist.
4. **Tree test** — validate findability for top tasks (see card-sort tree tests in product IA work).
5. **Page design** — apply rules 5–8, 13–19, 22–28 per surface.
6. **Ship** — one shell, consistent patterns, status visibility, progressive disclosure.

Do not skip steps 1–4 by jumping straight to sidebar labels or mockups.

---

## Quick “reject this design” triggers

Stop and redesign if:

- Two top-level nav items could reasonably contain the same feature
- User must remember where a related setting lives with no contextual link
- A list page hides critical async status (sync, delivery, payment, workflow)
- Primary and destructive actions are adjacent without separation
- The same concept has different names on adjacent screens
- A new page uses a different shell, header, or button placement “just for this screen”
- Configuration is promoted to the same level as daily operational objects
- A wizard has no cancel/back and no saved progress for long flows
- Error copy names a code or internal reason without a user fix

---

*This document is the authoritative UI ruleset for Transovo. **Read `TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` first** for authority order and conflict resolution. Hard implementation standards: Guide #1 `TRANSOVO-ACCESSIBILITY-STANDARDS.md` · Guide #2 `TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` · Guide #3 `TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #4 `TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md` · Guide #5 `TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · Guide #6 `TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · Guide #7 `TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · Guide #8 `TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 `TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 `TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 `TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`. When in doubt, prefer user mental models, mutual exclusivity, recognition over recall, and consistent shell behavior.*


===== [TRANSOVO Product Design & UX Governance (authority hierarchy)] docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md =====
# Transovo Product Design & UX Governance Guide

**Status:** Active — highest governing authority for Transovo product design, UX, and UI implementation decisions  
**Audience:** Engineers, designers, product owners, Cursor agents, and Kimi building or changing Transovo  
**Role:** Standards hierarchy, conflict resolution, and implementation authority — sits **above** all individual Transovo design/UX standards documents

---

## Master Cursor rule

> **Transovo must be developed as one coherent product system, not as a collection of individually designed pages. Product scope determines what exists. Information architecture determines where it lives. Human-centered design determines how the workflow should work. Page architecture determines where information/actions belong. The visual design system determines how it looks. Shared components determine how repeated UI behaves. Formal standards determine accessibility, interaction, forms, responsive behavior, data semantics, privacy, security, time, and internationalization requirements. Existing implementation is reusable only when it conforms to these higher-level rules. When inconsistency is discovered, fix the underlying shared system rather than applying page-specific patches. Preserve correct existing business logic, reuse canonical domain engines, consolidate duplicate patterns, and ensure every visible control and state reflects actual runtime truth. The goal is a product whose behavior, visual language, terminology, interaction model, and architecture remain so consistent that the number of people who built it is irrelevant to the user’s experience.**

---

## Purpose

This document tells Cursor which Transovo design/UX documents control a decision, what order to follow them in, how to resolve conflicts between them, and how to prevent old implementation patterns from overriding the new professional product system.

The goal is not merely to make individual pages attractive.

The goal is for Transovo to behave, look, read, and feel like one professionally designed SaaS product created by a coordinated product, design, accessibility, frontend, security, and UX organization.

**Cursor must not design each screen independently.**

All product work must inherit the same:

- product architecture
- terminology
- information architecture
- page structure
- visual language
- component behavior
- interaction rules
- accessibility requirements
- responsive behavior
- data-entry behavior
- security/privacy behavior
- date/time rules
- internationalization architecture

**Related Transovo documents (authority order summarized below)**

| Layer | Document |
|-------|----------|
| **Governance (this file)** | `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` |
| **Mode 4 UI rebuild orchestration** | `docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md` · `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md` |
| Product scope / domain | `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` · `docs/TRANSOVO-UI-DESIGN-GUIDE.md` |
| IA & terminology | `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` |
| HCD principles | `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` |
| Page structure | `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` |
| Visual system | `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md` |
| Formal standards Guides #1–#11 | See Level 7 below |

---

## 1. The standards are a system, not optional reference material

The Transovo UX/design documents are **governing implementation requirements**.

Cursor must not treat them as suggestions, inspiration, examples, optional polish, or something to apply only when creating new pages.

When modifying an existing surface, Cursor must apply the relevant standards unless doing so would create a larger regression or conflict with a higher-authority Transovo rule.

---

## 2. Order of authority

When multiple documents apply, use this order.

### Level 1 — Product Scope & Domain Architecture

Highest product-level authority.

This determines: what Transovo is, which features belong in the product, which features do not belong, canonical domain objects, product boundaries, canonical architecture, shared engines, and business/runtime behavior.

Examples: Appointment, Booking Type, Booking Page, Contact, Reminder Sequence, Workflow, Meeting, Payment.

**Hard rule:** No lower-level UX or visual document may invent a feature, domain, integration, product area, or terminology that violates the approved Transovo product scope.

If old code contains an out-of-scope feature, its existence does not give it product authority.

---

## 3. Level 2 — Canonical Information Architecture & Terminology

This controls global navigation, local navigation, feature placement, canonical naming, object relationships, and where users expect to find things.

**Current top-level Transovo IA:**

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

**Hard rule:** Every feature has one canonical home and one canonical user-facing name.

Do not duplicate a feature in several permanent navigation areas because doing so appears convenient. Contextual links to the same canonical object are allowed. Duplicate product architectures are not.

**Primary document:** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · `docs/TRANSOVO-UI-DESIGN-GUIDE.md`

---

## 4. Level 3 — Human-Centered Design & Product Experience Principles

Use the Human-Centered Design / ISO-based guide to decide whether a workflow fits the user's actual task, whether unnecessary steps exist, whether the user retains control, whether the interface minimizes cognitive load, whether the workflow is understandable, whether error recovery is practical, and whether the complete task is efficient.

This level answers: **Should the experience work this way at all?**

Before asking "What component should we use?", Cursor must first ask: **What is the user's goal, and what is the simplest coherent workflow that accomplishes it?**

**Primary document:** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`

---

## 5. Level 4 — Page Architecture & Layout Standards

This controls the structure of the page: page archetype, header placement, title placement, primary action placement, local navigation, filters, data region, detail layout, configuration layout, builder layout, empty/error/loading states, and hierarchy of page content.

This level answers: **Where does everything belong on the page?**

Do not redesign basic page anatomy separately for every route.

**Primary document:** `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`

---

## 6. Level 5 — Visual Design System

This controls visual consistency: typography, font scale, spacing, color, semantic colors, surfaces, borders, radius, shadows, iconography, density, alignment, button hierarchy, form visual treatment, table styling, light/dark behavior, and responsive visual rules.

This level answers: **What should the system look like?**

**Hard rule:** Visual values should come from shared tokens/system definitions rather than arbitrary page-level values.

Avoid random font sizes, padding, radius, colors, shadows, and control heights inside individual screens.

**Primary document:** `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## 7. Level 6 — Shared Component System

Once a reusable component exists, it should be the default implementation.

Examples: Button, Icon Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Tabs, Table, Badge, Alert, Toast, Modal, Drawer, Dropdown Menu, Empty State, Page Header, Filter Bar, Search Field, Pagination, Status Indicator, Skeleton, Timeline, Date Picker, Time Picker.

**Hard rule:** Do not recreate a common component inside an individual page when the product already has an appropriate shared component.

If the shared component is insufficient:

1. determine whether the requirement is legitimate
2. improve the shared component
3. use the improved component everywhere appropriate

Do not create `AppointmentButton`, `BookingButton`, `ContactButton`, and `SettingsButton` that all independently reinvent the same button behavior.

---

## 8. Level 7 — Formal Standards Guides

Apply every relevant standards document to the implementation.

These currently include:

1. `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
2. `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
3. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
4. `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
5. `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
6. `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
7. `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
8. `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
9. `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
10. `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
11. `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

These documents are cross-cutting. A page may need several simultaneously.

**Example — New Appointment form:** Human-Centered Design, Page Architecture, Visual Design System, Accessibility, Interaction/Keyboard, Forms/Validation, Responsive/Reflow, Date/Timezone, Internationalization.

Do not choose one guide and ignore the others.

---

## 9. Level 8 — Existing implementation

Existing code is the **lowest authority**.

Existing implementation may be reused when it already conforms to the higher-level system.

It must not override the standards merely because "This is how the old page currently works."

**Hard rule:** Legacy implementation is evidence of existing behavior, not evidence that the behavior is correct.

Before copying an old pattern, verify it against the governing documents.

---

## 10. Conflict-resolution rule

When two rules appear to conflict, resolve them in this order:

1. **First** — Protect correctness, security, privacy, accessibility, and data integrity.
2. **Second** — Protect approved product scope and domain behavior.
3. **Third** — Protect user task completion and understandable interaction.
4. **Fourth** — Protect information architecture and terminology.
5. **Fifth** — Protect component/design consistency.
6. **Sixth** — Optimize visual aesthetics.

**Example:** A visually cleaner control cannot override keyboard accessibility, legally required consent clarity, correct appointment timezone behavior, or authorization boundaries.

Professional design is not visual appearance at the expense of correctness.

---

## 11. Formal standard vs Transovo best practice

Cursor must understand the difference.

**Formal requirement** — Examples: WCAG keyboard operability, WCAG error identification, RFC 3339 timestamp representation, IANA timezone handling, BCP 47 language tags. These should not be casually overridden.

**Transovo design rule** — Examples: page title upper-left, primary action upper-right, medium-density operational layout, use drawers to preserve certain list contexts. These are product-system rules and should normally be followed, but can be adjusted when the actual task clearly requires a better solution.

If deviating: explain the reason and preserve consistency elsewhere.

---

## 12. Do not design page-by-page

This is one of the strongest rules in this document.

Cursor must not think "How should this appointment page look?" in isolation.

Instead: **Which existing page archetype, component patterns, tokens, interaction rules, and object conventions apply to this appointment page?**

Professional systems reuse patterns. One-off design decisions create inconsistency.

---

## 13. System-first implementation rule

When the same UX problem occurs in multiple places:

- **Bad approach:** fix it separately on six pages.
- **Correct approach:** (1) identify the reusable pattern, (2) determine whether an existing component already owns it, (3) fix or extend the shared component, (4) use the same implementation everywhere applicable.

**Example:** If tables across Appointments, Contacts, Payments, and Meetings all need the same row-action behavior, build/fix the canonical table/action pattern. Do not invent four solutions.

---

## 14. One component, one behavioral contract

Shared components must define their complete states.

**Example button:** default, hover, focus, pressed, loading, disabled, destructive where appropriate.

**Input:** empty, filled, focused, disabled, read-only, invalid, success where appropriate, loading where applicable.

**Modal:** initial focus, focus containment, close, Escape, restoration, loading, error, confirmation behavior.

Do not leave individual pages responsible for reinventing component behavior.

---

## 15. Do not duplicate components because styling differs slightly

If two components perform the same semantic job but need minor presentation variations, use variants, size props, semantic props, and composition rather than separate unrelated implementations.

Example: `<Button variant="primary">`, `<Button variant="secondary">`, `<Button variant="danger">` — instead of three unrelated button implementations.

---

## 16. Component variants must represent real differences

Do not create 18 button variants because individual pages wanted slightly different padding.

Variants should reflect meaningful system differences such as primary / secondary / ghost / destructive, or small / medium. Keep the system constrained.

---

## 17. Tokens before arbitrary values

Cursor should prefer semantic design tokens such as `space-2`, `space-3`, `surface-secondary`, `text-muted`, `border-subtle`, `status-warning`, `radius-md` over arbitrary one-off values.

Avoid `margin-top: 17px`, `border-radius: 11px`, `color: #747783` unless there is an exceptional documented reason.

---

## 18. Shared terminology is part of the design system

Do not treat words as arbitrary page copy.

Canonical Transovo terms include: Appointment, Booking Type, Booking Page, Contact, Conversation, Reminder Sequence, Workflow, Meeting, Payment.

Do not casually replace them with Event, Session, Customer Booking Object, or Automation Campaign unless the concept genuinely differs.

---

## 19. One action should normally have one canonical name

If the action is "Create appointment", avoid pages alternatively saying Add event, New booking, Schedule customer, or Create meeting unless they represent different operations. Consistency reduces learning cost.

---

## 20. Same object = same visual/state language

An Appointment status should use the same terminology, badge, semantic color, icon where used, and state definition across Calendar, Appointment List, Contact detail, Analytics, Search, and Home. No page-specific interpretation.

---

## 21. Same action = same interaction pattern

If editing an object opens a drawer across the product, don't randomly make one page inline edit and another modal unless the workflow genuinely differs.

Consistency is not aesthetic sameness. It is behavioral predictability.

---

## 22. Choose UI surfaces according to task

- **Page** — substantial independent work
- **Drawer** — preserving parent context matters
- **Modal** — short contained decisions/actions
- **Popover** — lightweight contextual controls
- **Menu** — secondary commands
- **Tooltip** — supplementary explanation only
- **Wizard** — genuinely ordered multi-step work

Do not choose based on what looks fashionable.

---

## 23. Do not use cards as the answer to everything

Cards are appropriate for independent grouped content, dashboard summaries, and selected information blocks.

They are not required around every form section, table, subsection, or sentence. Avoid card inside card inside card.

Hierarchy should come from whitespace, typography, grouping, and borders when necessary — before excessive containers.

---

## 24. Professional density must remain consistent

Transovo is an operational SaaS, not a marketing landing page. Default: medium-density, calm, efficient.

Avoid pages with giant hero spacing, enormous headings, huge empty cards, excessive 64px padding, and oversized decorative illustrations.

Operational pages should maximize comprehension, scanning, and task completion without becoming cramped.

---

## 25. Healthy state should be quiet

Do not turn every normal state into green badges, success boxes, icons, and celebratory UI.

Example: Connected calendar does not need a giant green alert indefinitely. Normal healthy state should be easy to see but visually calm. Exceptions deserve more attention.

---

## 26. Problems get prominence proportional to consequence

High priority: Microsoft sync disconnected. Lower priority: Optional profile field missing.

Do not give everything equal alert treatment. This preserves attention.

---

## 27. Every page has one primary job

Before modifying a page, Cursor must state internally: **What is the main task this page enables?**

Anything not serving that job should be secondary, moved elsewhere, progressively disclosed, or removed if redundant. A page should not become a feature dump.

---

## 28. Every page needs one dominant primary action

Examples: Appointments → New appointment; Booking Types → New booking type; Workflows → New workflow.

Do not present five equal bright buttons. Secondary actions are subordinate.

---

## 29. Actions stay near the objects they affect

Appointment action Reschedule belongs with the Appointment. Contact action Book appointment belongs with Contact context.

Do not make users search Settings or a global action center for object-specific operations.

---

## 30. Global configuration and local configuration must remain separate

Example: **Settings** — default reminder behavior. **Appointment** — override reminder behavior for this appointment.

Do not duplicate the entire reminder system inside both areas. Global defines defaults/policy. Local modifies the current object.

---

## 31. Inheritance must be visible

When an object uses a default, show "Using calendar default" or equivalent.

When overridden, show "Custom for this appointment".

Do not make users guess whether changing something affects one appointment, calendar, workspace, or every future booking.

---

## 32. Existing code must be audited before creating something new

Before creating a component, service, route, page pattern, formatter, or state model, Cursor must first inspect whether an appropriate implementation already exists.

Use: **Audit → Preserve → Extend → Consolidate**

Do not: **Ignore → Duplicate → Diverge.**

---

## 33. Preserve correct existing behavior

Standards migration does not mean rebuilding everything.

If current implementation already works correctly, uses canonical architecture, and meets standards — reuse it.

Do not rewrite stable systems for aesthetic purity.

---

## 34. Fix the source, not merely the symptom

If five screens have incorrect button spacing because shared Button is wrong, fix Button.

Do not apply `className="special-page-fix"` five times.

Likewise: if table row actions behave inconsistently because Table component lacks an action API, improve Table.

---

## 35. Avoid permanent compatibility hacks

Short-lived migration compatibility may be necessary. But do not allow old navigation, old terminology, old component, and new component to coexist indefinitely. Migration needs a destination.

---

## 36. One source of truth for navigation

Global navigation should come from one shared configuration/component. Do not manually recreate sidebar entries on each page.

Same principle for headers, route labels, permissions, and major feature definitions.

---

## 37. One global shell

All standard authenticated product pages should share the same sidebar, header, content region, and responsive behavior — except intentionally immersive workspaces such as a builder.

No page-specific duplicate sidebar/header implementation.

---

## 38. Immersive workspaces are controlled exceptions

Examples: Workflow Builder may reduce global shell distractions.

But still preserve identity, exit path, save state, accessibility, and core product terminology.

An immersive mode is not permission to abandon the design system.

---

## 39. Feature state must come from canonical domain state

Do not calculate status independently in five components.

Example: Appointment confirmation state should come from the appointment domain. Do not have table compute confirmed, detail compute it differently, and analytics infer it another way. Shared domain truth.

---

## 40. Visual UI must never contradict runtime truth

Examples of broken UI:

- UI says SMS enabled but runtime cannot send.
- UI says Microsoft connected but refresh credentials are invalid.
- UI says Workflow published but runtime uses draft.

Professional UI means truthful UI.

---

## 41. A visible control must actually work

**Hard rule: No fake controls.**

Every visible toggle, button, select, filter, setting, and menu item must have real behavior.

If feature is unavailable: hide it when appropriate, or explicitly mark it unavailable with explanation. Never ship decorative functionality.

---

## 42. Normal, loading, empty, error, partial and success states are all part of the component

Do not design only loaded with perfect data.

Every major component/page needs: (1) Normal, (2) First use / Empty, (3) Loading, (4) Error, (5) Partial/degraded where applicable, (6) Success/updated state where applicable.

These states should use shared patterns.

---

## 43. Exceptional states must preserve the page structure

If table fails, don't replace the entire page with "Something went wrong."

Keep page title, nav, filters where useful, and retry/error region. Users should retain orientation.

---

## 44. Error messages need three things

Where applicable:

1. What happened?
2. What does it affect?
3. What can the user do?

**Example:** "Microsoft calendar sync is paused. New Microsoft changes won't import until the connection is restored. Reconnect Microsoft"

Not: "Error 401." 

---

## 45. Never expose backend implementation language to ordinary users

Avoid enum values, raw Graph errors, provider IDs, stack traces, database names, and webhook codes.

Translate into product language. Diagnostics can expose technical details in appropriate developer/admin contexts.

---

## 46. Accessibility is part of component completeness

A component is not complete because it looks right.

It also needs applicable semantics, keyboard operation, focus, accessible name, screen-reader state, contrast, and responsive reflow.

Do not defer accessibility to final polish.

---

## 47. Responsive behavior belongs to the shared pattern

If Drawer becomes full-screen on mobile, that behavior belongs to Drawer. Don't reimplement that transformation differently on every page.

Same for tables, filters, tabs, navigation, action bars, and forms.

---

## 48. Mobile is the same product, not a second product

Responsive layouts may transform. Information architecture, terminology, and business behavior remain the same.

Do not create desktop Transovo and unrelated mobile Transovo.

---

## 49. Security/privacy requirements override convenience

No design-system rule can justify exposing a secret, bypassing authorization, fabricating consent, sending after opt-out, or weakening authentication.

Security/privacy correctness always outranks visual convenience.

---

## 50. Date/time correctness overrides visual simplicity

Do not remove timezone context merely because the label looks cleaner.

If timezone ambiguity could result in incorrect appointment behavior, show necessary context. Correct scheduling outranks aesthetic minimalism.

---

## 51. Avoid premature abstraction

System-first does not mean turn every 8 lines into a component.

Create abstraction where there is actual reuse, stable semantic pattern, and shared behavior.

Do not build giant generic components with 40 props just to claim standardization.

---

## 52. Reuse semantics, not necessarily every DOM fragment

Two pages may share page-header pattern, filter pattern, and status pattern without being literally one giant component.

The goal is consistent architecture, not abstraction for abstraction's sake.

---

## 53. Component APIs should use product meaning

Better: `status="confirmed"` than `color="green"`. Better: `variant="destructive"` than `background="#EF4444"`. Better: compact data row than `42px height`.

Semantic APIs keep components consistent.

---

## 54. Design-system exceptions must be intentional

Sometimes a unique workflow genuinely needs something different. Before creating a one-off:

1. verify existing pattern cannot solve it
2. determine whether new pattern will recur
3. ensure it follows accessibility/interaction standards
4. document why it is an exception

Do not casually fork the system.

---

## 55. New reusable patterns must become part of the system

If a new pattern is genuinely needed — e.g., Appointment eligibility diagnostic panel — and it will recur, define structure, states, spacing, interaction, and responsive behavior. Then reuse it.

Do not leave it as anonymous page CSS.

---

## 56. Audit existing screens against the new system

Existing Transovo pages were created across different periods. Therefore they must not be assumed consistent.

Audit should identify: terminology inconsistencies, duplicate components, different headers, different sidebars, spacing drift, typography drift, button drift, modal/drawer inconsistencies, fake controls, missing states, responsive failures, accessibility failures, wrong page archetypes, and duplicated feature placement. Then consolidate.

---

## 57. Audit by pattern before auditing page-by-page

Efficient order:

1. Global shell
2. Tokens
3. Core components
4. Page archetypes
5. Domain-specific pages

Otherwise Cursor may polish 30 pages and later discover the shared Button/Table/Header needed to change.

---

## 58. Recommended system-consolidation order

**Phase 1 — Foundations:** typography, color tokens, spacing, surfaces, borders, radius, responsive primitives

**Phase 2 — Core controls:** Button, Input, Select, Combobox, Checkbox, Radio, Switch, Date/time controls

**Phase 3 — Interaction surfaces:** Modal, Drawer, Menu, Popover, Tooltip, Tabs

**Phase 4 — Data presentation:** Table, List, Cards, Badges/status, Empty state, Skeleton, Pagination, Filters

**Phase 5 — Page patterns:** Dashboard, List, Calendar, Detail, Settings, Editor, Builder

**Phase 6 — Product domains:** Appointments, Booking, Contacts, Messages, Automations, Meetings, Payments, Analytics, Integrations, Settings

---

## 59. Do not visually polish before structural correctness

Correct order:

1. product/domain correctness
2. IA
3. workflow
4. page architecture
5. components
6. accessibility/interaction
7. visual polish

Do not spend time perfecting shadows on a page whose information architecture is wrong.

---

## 60. Professional consistency beats novelty

Transovo does not need every screen to feel uniquely designed.

Professional software usually feels consistent precisely because users recognize patterns.

Cursor should favor familiar, predictable, polished over clever, unusual, visually surprising.

---

## 61. Do not copy competitor UI blindly

Competitors can provide feature research, workflow evidence, and user expectation evidence. They are not Transovo's design authority.

Do not reproduce layout, terminology, unusual interaction solely because Calendly/AppointmentReminder/etc. does it. Evaluate against Transovo's standards.

---

## 62. Product rules outrank visual screenshots

If Cursor is given a screenshot as a visual reference, it may study spacing, hierarchy, density, and polish — but must not copy incorrect IA, out-of-scope functionality, inaccessible controls, terminology conflicting with Transovo, or poor interaction patterns.

A reference is not authority.

---

## 63. Validate whole user journeys

A screen can look perfect and still create a bad product.

Test workflows such as: Book an appointment; Manual appointment; Microsoft import; Automation create/configure/publish; Meeting with Notetaker/transcript/recap.

Professional quality exists across the transitions.

---

## 64. Cross-page consistency is an acceptance criterion

Before declaring a feature polished, compare it against related pages.

Ask: Same header? Same button hierarchy? Same status? Same action placement? Same terminology? Same interaction? Same spacing? Same error model?

A page is not complete in isolation.

---

## 65. User-visible duplication is usually a warning sign

If users see the same setting in Appointment, Booking, Automations, and Settings, verify whether those are genuinely different scopes.

Often duplication indicates unclear architecture. Do not solve discoverability by copying entire configuration panels everywhere. Use contextual links and inheritance instead.

---

## 66. Multiple entry points can lead to one canonical object

Good: Contact → Book appointment, Calendar → New appointment, Home → New appointment — all can lead to the same appointment creation engine. That is professional reuse.

Do not build three unrelated appointment creation systems.

---

## 67. Shared domain engines must power every entry point

Examples:

- **Availability engine** serves Booking Page, staff manual booking, AI Booking, routing, reschedule.
- **Reminder engine** serves manually created appointments, Booking Page appointments, imported appointments where eligible, AI-created appointments.

One domain engine. Many interfaces.

---

## 68. Do not fork business logic for visual convenience

Example: Mobile appointment creation must not use simplified scheduling logic different from desktop.

It can have a different presentation. Same engine. Same validation. Same result.

---

## 69. UI should communicate actual hierarchy of importance

Do not make advanced setting, edge-case metadata, or internal diagnostic visually equal to customer, appointment time, status, or primary action.

Visual hierarchy should mirror task importance.

---

## 70. Reduce cognitive noise

Professional does not mean show everything.

Hide or subordinate advanced options, rarely used metadata, and internal diagnostics until context requires them. Use progressive disclosure.

---

## 71. Prefer recognition over recall

Show "Using Standard Reminders" rather than making the user remember which reminder sequence is active.

Show "Microsoft Work Calendar" not an opaque calendar ID. Show current state. Do not require memory.

---

## 72. Preserve spatial consistency

Users learn: primary action lives here, filters live here, object status lives here, page tabs live here.

Do not randomly rearrange those patterns. Spatial memory is part of efficiency.

---

## 73. Respect established defaults

Default behavior should satisfy the common case. Advanced users can customize.

Do not require 15 decisions merely to create a 30-minute appointment. Professional products reduce work.

---

## 74. Expert workflows should remain efficient

As users become experienced, keyboard, search, remembered filters, bulk actions, and contextual shortcuts can accelerate work. But novice clarity remains intact.

---

## 75. Every important object should have a canonical detail view

Examples: Appointment, Contact, Meeting, Transaction, Workflow.

Contextual drawers can provide previews. But there should be one authoritative representation of the complete object.

---

## 76. Timelines should be canonical where history matters

For Appointment, timeline can represent created, changed, confirmation, reminders, replies, payment, reschedule, cancellation, meeting, and sync events.

Do not create five unrelated history widgets describing different fragments with different terminology.

---

## 77. Diagnostics should explain system decisions

Examples: Why is this slot unavailable? Why wasn't SMS sent? Why is Microsoft disconnected? Why didn't this workflow run?

Expose actionable reasons where users need them. Do not require support for ordinary system explanations.

---

## 78. Diagnostics must come from actual reason codes/state

No guessed explanations. Backend/system should provide `reason = customer_opted_out`. UI translates it.

Do not ask AI to guess why SMS probably failed.

---

## 79. Every new feature must answer these questions before implementation

Cursor should determine:

1. What user problem does this solve?
2. Which canonical domain owns it?
3. Where does it live in the IA?
4. What page archetype does it use?
5. Which shared components apply?
6. Which formal standards apply?
7. What are its states?
8. What permissions apply?
9. What responsive behavior applies?
10. Does it reuse an existing domain engine?
11. What existing implementation can be reused?
12. What must not be duplicated?

If those cannot be answered, implementation is premature.

---

## 80. Every page must answer five user questions

Within a few seconds the user should understand:

1. Where am I?
2. What is this page for?
3. What can I do here?
4. Is anything requiring my attention?
5. Where do I go next if needed?

If not, hierarchy/navigation needs improvement.

---

## 81. Professional quality is determined by the weakest repeated pattern

One great dashboard cannot hide inconsistent modals, poor form validation, broken mobile tables, or strange error messages.

The repeated components determine perceived quality. Therefore prioritize fixing systems used everywhere over polishing one showcase page.

---

## 82. Acceptance means system consistency, not merely technical completion

A feature is not complete because endpoint works, button exists, or page renders.

It is complete when: domain behavior is correct, IA placement is correct, terminology is correct, page structure is correct, shared components are used, accessibility works, responsive behavior works, all relevant states exist, error/recovery works, visual system matches, and no duplicate implementation was introduced.

---

## 83. Cursor must inspect before changing

Before modifying UI: inspect relevant existing pages, shared shell, shared components, tokens, domain implementation, and relevant standards docs.

Then determine the smallest correct system-level change. Do not assume.

---

## 84. Do not rebuild stable systems unnecessarily

If an existing component/system satisfies the requirements: preserve it. If it is incomplete: extend it. If duplicates exist: consolidate carefully.

This follows **Audit → Preserve → Extend → Consolidate** — not Rebuild everything.

---

## 85. Do not perform visual work in isolation from code reality

The page design must account for real states, real data, permissions, loading, backend constraints, and runtime eligibility.

Do not create mock controls the backend cannot support.

---

## 86. When uncertain, prefer consistency with the governing system

If there are two equally valid approaches, choose the one already used by the canonical shared pattern. Do not introduce unnecessary variation.

---

## 87. When existing implementation and standards disagree

Do this:

1. identify the conflict
2. determine which higher-level rule applies
3. inspect whether changing the shared pattern affects other pages
4. fix at the lowest reusable level possible
5. preserve working business logic
6. migrate dependent usage where necessary
7. remove obsolete duplicate pattern when safe

Do not blindly copy the old implementation.

---

## 88. When two existing patterns conflict

Do not choose whichever appears on more pages automatically.

Evaluate both against standards, product architecture, usability, accessibility, and component system.

Choose the stronger canonical pattern. Then consolidate toward it.

---

## 89. Temporary exceptions need an explicit reason

If a page cannot yet follow the canonical pattern, document what differs, why, whether temporary, and migration target.

Avoid unexplained permanent divergence.

---

## 90. No "special CSS until it looks right" workflow

Cursor should not solve visual inconsistency by repeatedly adding random margins, one-off widths, arbitrary colors, and increasingly specific selectors.

Determine which design token/component/layout rule is wrong. Fix the system.

---

## 91. Avoid duplicated style constants

If the same value appears repeatedly, promote to token/component rule when semantically appropriate.

But do not create meaningless tokens like `appointment-page-left-gap-17`. Tokens represent reusable design decisions.

---

## 92. Keep design decisions semantic

Think secondary surface — not `#F7F8FA`. Think destructive action — not red button. Think compact data row — not `42px height`.

This allows the system to evolve coherently.

---

## 93. Maintain one professional visual personality

Transovo should feel: **Professional, calm, precise, modern, trustworthy, operational, medium-density.**

Avoid mixing playful consumer UI, neon startup aesthetic, enterprise gray bureaucracy, oversized marketing aesthetic, glassmorphism, and random gradients inside the same product.

---

## 94. Brand should support the product, not compete with it

Brand accent can appear in primary actions, active navigation, and controlled highlights.

Operational state should still use semantic colors. Do not paint the whole application in the brand color.

---

## 95. Product UI is not the marketing site

Marketing can be expressive, spacious, and persuasive.

Application should prioritize speed, clarity, information, state, and action.

Do not bring landing-page design patterns into every dashboard.

---

## 96. Complexity must be earned

Do not add tabs, nested navigation, accordions, wizard steps, or dropdown layers without real organizational need.

The simplest pattern that accurately represents the task should win.

---

## 97. Consistency does not mean forcing everything into one component

Appointment calendar is not a table. Workflow Builder is not a settings form. Meeting transcript is not an analytics dashboard.

Use different archetypes when tasks differ. Consistency means each archetype itself behaves consistently.

---

## 98. The system should be able to grow without redesigning navigation every month

New features should normally fit under an existing domain.

Before adding another top-level destination, ask: **Does this represent a genuinely new recurring mental workspace?**

Not: Is this feature important? Importance alone does not justify global navigation.

---

## 99. Do not let implementation architecture leak into product architecture

Users should not see navigation based on microservices, API modules, database tables, or provider integrations.

They think in appointments, customers, booking, reminders, meetings, and payments.

Product architecture follows user mental models.

---

## 100. Final governing principle

Transovo must be developed as one coherent product system, not as a collection of individually designed pages.

- **Product scope** determines what exists.
- **Information architecture** determines where it lives.
- **Human-centered design** determines how the workflow should work.
- **Page architecture** determines where information/actions belong.
- **The visual design system** determines how it looks.
- **Shared components** determine how repeated UI behaves.
- **Formal standards** determine accessibility, interaction, forms, responsive behavior, data semantics, privacy, security, time, and internationalization requirements.
- **Existing implementation** is reusable only when it conforms to these higher-level rules.

When inconsistency is discovered, fix the underlying shared system rather than applying page-specific patches. Preserve correct existing business logic, reuse canonical domain engines, consolidate duplicate patterns, and ensure every visible control and state reflects actual runtime truth.

**The goal is a product whose behavior, visual language, terminology, interaction model, and architecture remain so consistent that the number of people who built it is irrelevant to the user's experience.**

---

## Cursor Pre-Implementation Checklist

Before changing any significant Transovo UI:

- [ ] Confirm feature is inside approved Transovo scope
- [ ] Identify canonical domain
- [ ] Identify canonical terminology
- [ ] Identify canonical IA location
- [ ] Identify page archetype
- [ ] Inspect existing shared shell
- [ ] Inspect existing shared components
- [ ] Inspect design tokens
- [ ] Inspect existing domain/runtime behavior
- [ ] Identify all relevant standards guides
- [ ] Determine whether an existing implementation can be preserved
- [ ] Avoid creating duplicate component/domain logic
- [ ] Define loading/empty/error/partial/success states
- [ ] Define keyboard/focus behavior
- [ ] Define responsive behavior
- [ ] Define permission/privacy/security implications where applicable
- [ ] Define date/time/timezone implications where applicable
- [ ] Use shared component/system changes before page-level patches
- [ ] Preserve working business logic
- [ ] Keep visible UI synchronized with authoritative runtime state

---

## Cursor Completion Checklist

Before considering the work complete:

- [ ] Page follows approved Transovo IA
- [ ] Canonical terminology is used
- [ ] Page matches its approved page archetype
- [ ] Shared components used wherever applicable
- [ ] No unnecessary duplicate component created
- [ ] No arbitrary style values introduced unnecessarily
- [ ] Button/action hierarchy is consistent
- [ ] Normal/loading/empty/error/partial states handled
- [ ] Keyboard/focus interaction follows standards
- [ ] Accessibility requirements satisfied
- [ ] Forms/validation follow standards where applicable
- [ ] Responsive/reflow behavior follows standards
- [ ] Tables/grids use correct semantics where applicable
- [ ] Privacy/consent behavior follows canonical policy where applicable
- [ ] Security/authorization behavior remains server-enforced
- [ ] Dates/timezones use canonical temporal architecture
- [ ] Internationalization architecture is preserved
- [ ] Mobile and desktop use the same authoritative business state
- [ ] Visible settings actually affect runtime
- [ ] No stale legacy pattern remains merely because old code used it
- [ ] Related pages were checked for cross-product consistency
- [ ] Shared-system fix was preferred over page-specific patching

---

## Complete Transovo design & UX document hierarchy

```
LEVEL 0  TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md     → This file (authority & conflict resolution)
LEVEL 1  V1-APPOINTMENTS-MCTB-UI-REBUILD.md           → Product scope & domain
         TRANSOVO-UI-DESIGN-GUIDE.md                   → IA principles & domain definitions
LEVEL 2  TRANSOVO-IA-NAVIGATION-STANDARDS.md          → Guide #3: Canonical IA & navigation
LEVEL 3  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md  → Guide #2: HCD & usability
LEVEL 4  TRANSOVO-PAGE-ARCHITECTURE-RULES.md          → Page structure & behavior
LEVEL 5  TRANSOVO-VISUAL-DESIGN-GUIDE.md              → Visual design system
LEVEL 6  Shared component library                     → Reusable UI components
LEVEL 7  TRANSOVO-ACCESSIBILITY-STANDARDS.md          → Guide #1
         TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Guide #4
         TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Guide #5
         TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md  → Guide #6
         TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md   → Guide #7
         TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Guide #8
         TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md → Guide #9
         TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Guide #10
         TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Guide #11
LEVEL 8  Existing implementation                      → Lowest authority; audit before copying
```

---

*Transovo Product Design & UX Governance. Read this document first. Then apply the governing documents in authority order. Cursor and Kimi must adhere to this system for all Transovo UI work.*


===== [Human-centered design principles (foundational)] docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md =====
# Transovo Human-Centered Design & Usability Standards Guide

**Series:** Implementation standards · **Guide #2 of 12**  
**Status:** Active — mandatory standard for feature conception, organization, simplification, evaluation, and refinement  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Not:** A visual-style guide (see `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`)

---

## Master Cursor rule

> **Transovo follows ISO 9241 human-centered design and usability principles.** Every significant feature must be designed from an **explicit understanding of the user, goal, task, and context of use**. Usability is judged by **effectiveness, efficiency, and satisfaction**—not by visual appearance or technical reachability alone. Follow an iterative process of **understanding context → defining user requirements → producing design solutions → evaluating those solutions**. Interfaces must be suitable for the task, self-descriptive, conform to user expectations, learnable, controllable, error-tolerant, and appropriately adaptable. Minimize unnecessary steps and cognitive load, preserve user context and work, use strong defaults, progressively disclose complexity, and **evaluate complete realistic workflows** rather than isolated screens.

**A feature that is technically reachable but hard to complete correctly is not usable.**

---

## Primary authorities

| Standard | Focus |
|----------|--------|
| **ISO 9241-210:2019** | Human-centred design for interactive systems (confirmed 2025) |
| **ISO 9241-11:2018** | Usability: definitions and concepts (effectiveness, efficiency, satisfaction) |
| **ISO 9241-110** | Interaction principles (suitability for task, self-descriptiveness, etc.) |
| **NIST Human-Centered Design guidance** | Summarizes ISO HCD principles and activities |

**Governing definition:** A system is usable when **specified users** achieve **specified goals** **effectively, efficiently, and satisfactorily** in the **actual context of use**—not because it looks clean.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`  
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`  
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`  
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`  
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Usability has three mandatory dimensions (ISO 9241-11)

| Dimension | Question |
|-----------|----------|
| **Effectiveness** | Can users complete the intended task accurately and completely? |
| **Efficiency** | How much effort, time, and resources does it take? |
| **Satisfaction** | Does interaction meet physical, cognitive, and emotional needs? |

**Cursor rule:** Never evaluate UI solely by whether a feature is technically reachable.

For Transovo, ask on every flow:

- Did they find it?  
- Did they understand it?  
- Did they configure it correctly?  
- How many steps?  
- Did they know whether it worked?  
- Could they recover if something went wrong?

“A user eventually figured out reminders” is **not** enough.

---

## B. Design from explicit understanding of users

Do not design for “the average user.” Identify actual user types.

**Transovo examples:**

- Solo business owner  
- Receptionist / front-desk staff  
- Scheduler  
- Office manager  
- Provider / staff member  
- Team administrator  
- Owner reviewing analytics  

Each differs in: permissions, frequency, expertise, goals, urgency, device, environment.

**Cursor rule:** Before designing or restructuring a feature, state **primary user**, **primary task**, and **context of use**.

---

## C. Design around user goals, not software capabilities

| Bad (capability) | Better (goal) |
|------------------|---------------|
| Expose calendar-import rules | Let the office control which imported appointments receive reminders |
| Surface workflow nodes | Let the business automatically follow up when a customer no-shows |

User goal is primary; implementation is secondary.

---

## D. Context of use is part of usability

Context includes: desktop at office, phone away from desk, busy receptionist on a call, owner at night, weak network, high appointment volume, multiple calendars.

**Cursor rule:** Optimize for **realistic conditions**, not ideal mockup conditions.

---

## E. Users involved throughout design and development

User evaluation is not a final QA step. Understand behavior → validate terminology → test hierarchy → test prototypes → observe tasks → refine → retest.

**Cursor rule:** Code/design assumptions are **hypotheses** until validated against realistic user tasks.

---

## F. Evaluation drives design

```
Understand → Design → Evaluate → Fix → Evaluate again
```

Not: build everything → launch → hope.

Especially for: navigation, booking, calendar config, reminders, A2P onboarding, AI booking, workflow builder.

---

## G. Human-centered design is iterative

Do not treat the first implementation as final. Preserve architecture so experience can refine **without rebuilding business logic**. Avoid coupling logic to one temporary UI layout.

---

## H. Consider the whole user experience

Evaluate **complete journeys**, not isolated screens.

**Microsoft connection** includes: why connect, choose calendars, success, sync status, token refresh, degraded state, recovery, disconnect, availability effects.

**SMS registration** includes: learn why → submit → status → wait → approval/failure → send SMS.

---

## I. Multidisciplinary perspectives

Check features against: product logic, UX, accessibility, engineering, compliance, security, content, data integrity.

A2P can “work” technically and still fail on language, consent framing, accessibility, status, recovery, eligibility behavior.

---

## J. Four core HCD activities (ISO / NIST)

1. **Understand and specify context of use** — Who? What goal? Under what conditions?  
2. **Specify user requirements** — What must the user achieve? (not technical reqs yet)  
3. **Produce design solutions** — Interaction, page, flow  
4. **Evaluate the design** — Does it satisfy user requirements?

Follow this sequence before substantial redesign.

---

## K. Every feature needs an explicit user requirement

**Not enough:** Feature: appointment waitlist.

**Better:** A scheduler must see customers waiting for an opening, offer a newly available slot, and know whether it was accepted without cross-referencing multiple screens.

**Better:** A business must determine why an appointment did not receive an SMS reminder without contacting support.

Requirements must be **testable**.

---

## L. Suitability for the task (ISO 9241-110)

Support the task without unnecessary operations or irrelevant information.

Manual appointment creation should not require: Booking → configure type → Contacts → Calendar Settings → return—if the user only needs customer + type + date/time + save.

**Cursor rule:** Remove steps, fields, navigation, and information that do not materially contribute to the **current task**.

---

## M. Self-descriptiveness

At any point, the interface should make apparent: what is happening, what can be done, what controls mean, what the result will be.

| Bad | Better |
|-----|--------|
| Advanced | Advanced reminder timing |
| Status: Pending | Registration submitted — carrier review pending |

**Cursor rule:** Normal state and actions should not require documentation.

---

## N. Conformity with user expectations

Behave according to known conventions:

- Row click opens object  
- Save persists; Cancel doesn’t save  
- Trash = delete; Search searches  
- Tabs = peer views; Back = previous context  
- Checkbox = independent boolean  

Do not invent novel interactions without strong reason.

---

## O. Preserve terminology users understand

Use: appointment, customer/contact, calendar, reminder, booking page, confirmation, payment.

Do not expose: orchestration, trigger processor, provider event, campaign binding, delta sync token—except in developer/diagnostic contexts.

---

## P. Suitability for learning

Help users learn naturally: predictable structure, repeated patterns, defaults, empty states, contextual explanation, progressive disclosure, consistent terminology.

Users should get **faster** with experience. Relearning every visit violates this principle.

---

## Q. Do not require unnecessary memorization

If users must remember “imported-event SMS is under Settings → Messaging → Calendar Sources…”, the system failed.

Show state directly: `SMS unavailable for this imported appointment` + `Set up business texting`.

---

## R. Controllability

Users initiate and control interactions: cancel, undo when feasible, stop AI/recording, disable workflow, reschedule vs delete/recreate, choose calendars, change reminders, exit wizards.

**Cursor rule:** Do not trap users in irreversible or system-driven flows.

---

## S. Consequential actions require appropriate control

Cancel appointment, refund, delete workflow, revoke recording, disconnect calendar, publish automation—consequences understandable **before** completion.

Proportional safeguards; not every harmless action needs a modal.

---

## T. Error tolerance

Allow intended results with minimal corrective effort: normalize phones, prevent double submit, preserve form data, undo moves, detect conflicts before save, validate reminder timing, block invalid workflow publish.

**Cursor rule:** Prevent, absorb, or cheaply correct errors—don’t punish users.

---

## U. Distinguish user error from system failure

ISO use error: mismatch among user, interface, task, environment.

**Bad:** “The user entered it wrong.”  
**Better:** “Why did the interface make this mistake easy?”

Repeated wrong calendars, SMS confusion, accidental reminder disable, incomplete workflows → likely **design issue**.

---

## V. Suitability for individualization

Support meaningful adaptation: timezone, calendar prefs, saved filters, reminder defaults, roles, staff schedules, booking-type defaults, notifications.

Not every pixel customizable—only adaptation that improves tasks.

---

## W. Defaults should work for most users

Strong defaults first; adjustment second.

Default reminder sequence works immediately; advanced users customize time, channels, stop-on-reply, weekends, per-calendar behavior.

---

## X. Minimize unnecessary cognitive load

Reduce: unnecessary choices, duplicate concepts, hidden dependencies, unexplained technical states, giant forms, long instructions, inconsistent labels.

Powerful feature ≠ complex screen by default.

---

## Y. Progressive disclosure for complexity

Booking type initially: name, duration, host, availability.

**Round robin** selected → eligible hosts, distribution.  
**Group** selected → capacity, attendee behavior.

Do not show every scheduling model at once.

---

## Z. Preserve context across related tasks

| From | Carry forward |
|------|----------------|
| Contact → Book | Contact selected |
| Appointment → Message | Recipient + appointment |
| Appointment → Payment | Customer, amount |
| Meeting recap → Follow up | Meeting, contact |

**Cursor rule:** Carry forward what the system already knows.

---

## AA. Minimize mode errors

Make modes obvious: draft vs published, read-only vs editable, test vs live, staff vs admin, platform-SMS vs business-A2P, selected calendar vs all.

User should never wonder: “Am I changing the real thing?”

---

## AB. Avoid unnecessary interruptions

No excessive modals, trivial confirmations, random banners, repeated onboarding, success dialogs for every save.

Interrupt only when attention is genuinely required.

---

## AC. Frequency should influence prominence

High-frequency (easy access): create appointment, reschedule, search contact, reply, view calendar.

Lower-frequency: SAML, org permissions, A2P, retention policy.

**Cursor rule:** Optimize prominence and interaction cost around **real task frequency**.

---

## AD. Criticality should also influence prominence

Rare but dangerous: calendar disconnected, reminders failing, payment broken—need **high visibility** despite low frequency.

Prioritize by: **frequency + importance + risk**.

---

## AE. Design for novice and experienced users

| Novice | Expert |
|--------|--------|
| Clear labels, defaults, guidance, templates | Shortcuts, bulk, clone, saved filters, keyboard, advanced config |

Don’t force power features on beginners; don’t cripple experts permanently.

---

## AF. Optimize primary workflows before edge workflows

**Create appointment → sync calendar → schedule reminder → confirmation** must be extremely strong before polishing rare enterprise settings.

---

## AG. Use measurable usability requirements

| Dimension | Examples |
|-----------|----------|
| **Effectiveness** | Completion rate, error rate, successful outcome |
| **Efficiency** | Time on task, steps, backtracking, support tickets |
| **Satisfaction** | Ease, confidence, frustration, perceived complexity |

Design should make these **measurable** (even if metrics are collected later).

---

## AH. Define success criteria before redesigning

**Task:** Create manual appointment.

**User requirement:** Staff with normal permissions creates appointment for existing/new contact, chooses type/date/time, enables reminders, saves without leaving workflow.

**Success:** Completes correctly; no unnecessary navigation; conflict before save; calendar sync visible; reminders visible after.

Better than: “Make New Appointment cleaner.”

---

## AI. Evaluate realistic complete tasks

Test scenarios, not isolated buttons:

- “Customer called—move Tuesday to Thursday; reminders update.”  
- “Why doesn’t booking offer 2 PM when Microsoft shows busy?”  
- “Imported appointment didn’t get SMS—find out why.”  
- “Create workflow to follow up after no-show.”

---

## AJ. Test navigation without finished UI

Card sort / tree test: categories, labels, expected paths—**before** polishing pages. Early evaluation is cheaper (NIST / ISO).

---

## AK. Evaluate prototypes before expensive implementation

High-value early evaluation: onboarding, appointment detail, Booking Type editor, Availability, Reminder Sequence, A2P, AI Booking, Workflow builder.

Establish flow/structure before visual polish or heavy implementation.

---

## AL. Users should always know current system state

`Microsoft — Synced 3 minutes ago`  
`SMS reminder — Scheduled for tomorrow, 9 AM`  
`Notetaker — Waiting for admission`  
`Payment — Processing`

Do not force inference.

---

## AM. Expose cause when it affects user action

| Weak | Strong |
|------|--------|
| Unavailable | Unavailable — blocked by Microsoft Work Calendar, 1:30–2:30 PM |
| SMS disabled | SMS unavailable for imported appointments until business texting registration is completed |

---

## AN. Don’t expose irrelevant implementation details

**Good:** Microsoft needs to be reconnected.  
**Bad:** `refresh_token returned AADSTS700082 from v2 token endpoint`.

Engineering details → diagnostics/logging.

---

## AO. Keep conceptual models stable

Once users learn Appointment, Booking Type, Reminder Sequence, Workflow, Meeting—do not rename across pages.

---

## AP. One object, one authoritative representation

Do not create separate user-facing entities for “booking appointment,” “calendar appointment,” “AI appointment,” “imported appointment.”

They are all **Appointments** with different **origins**.

---

## AQ. Multiple paths good; duplicate objects bad

Same appointment from Home, Calendar, Contact, Search, Meeting, Message—all paths → **same state and behavior**.

---

## AR. Do not require unnecessary setup before value

Booking-page-only user should not be forced through A2P if platform-consent SMS covers their case. Non-notetaker user should not configure notetaker in onboarding.

Respect actual goals over product completeness.

---

## AS. Reveal advanced capability at point of need

Imported appointment: `SMS unavailable` + `Register business texting…` at that moment—not lengthy A2P dump on every signup.

---

## AT. Preserve user work through system interruptions

Microsoft fail, network drop, AI timeout, payment error, validation reject—**preserve entered data** when feasible.

---

## AU. Support recovery without rework

Invalid workflow step → highlight problem, preserve rest.  
Calendar auth expired → reconnect, keep mappings.  
Payment failed → retry, don’t recreate appointment.

---

## AV. Don’t force irrelevant information

Reschedule: show current time, available slots, reminder/calendar impact—not every appointment field again.

---

## AW. Meaningful grouping around tasks

Booking Type sections: Basics, Hosts & capacity, Availability, Customer information, Reminders, Payment, Confirmation, Permissions—not database tables.

---

## AX. User-facing complexity grows with task complexity

Change time = simple. Build conditional automation = complex workspace OK.

System complexity must not leak into simple tasks.

---

## AY. Avoid redundant data entry

Prefill contact fields, booking-type duration/location. Override only when needed.

---

## AZ. Least destructive recovery path

Calendar auth lost → reconnect, don’t delete mappings.  
Workflow publish fails → keep draft, explain problem.

---

## BA. Design around interruptions and resumability

Receptionist interrupted mid-appointment; manager returns to A2P later—preserve progress or clearly state what’s saved.

---

## BB. Support verification after consequential actions

Create appointment → visible in calendar/list.  
Schedule reminder → exact time visible.  
Connect Microsoft → calendars + last sync visible.  
Payment → status on appointment.

Not toast alone.

---

## BC. Keep feedback proportional

Small: `Saved.`  
Large: `Appointment canceled. Future reminders stopped and Microsoft event updated.`

---

## BD. User choices must have predictable scope

“Default reminder sequence” must clarify: new only? existing future? all booking types? one calendar?

Scope ambiguity = usability failure.

---

## BE. Expose inheritance/override relationships clearly

Organization → calendar → booking type → appointment override.

```
Reminder sequence
Workspace default: Standard reminders
Use default / Override for this appointment
```

No silent overrides.

---

## BF. Make automation consequences understandable

Before publish: triggers, recipients, timing, scope. Preview/simulation preferred over blind publish.

---

## BG. AI must not obscure deterministic outcomes

AI Booking: user needs confidence appointment was created, time available, identity correct, calendar updated. **System state is authoritative**; AI phrasing is secondary.

---

## BH. Human fallback preserves conversation context

Don’t only say “Contact support.” Hand off with: customer, requested time, conversation, fields gathered, failure reason.

---

## BI. Evaluate satisfaction as well as completion

Registration completed but user says “I had no idea why”—effectiveness passes, satisfaction fails.

---

## BJ. Don’t optimize one user at expense of another without intent

Dense calendar helps receptionist, hurts mobile—decide priorities and provide alternatives.

---

## BK. Every major feature needs context-of-use statement

```markdown
Feature: Appointment calendar
Primary users: receptionist, owner/operator, scheduler
Primary goals: see schedule, find/create/reschedule/cancel, identify exceptions
Context: frequent daily desktop, occasional mobile, moderate/high volume
```

---

## BL. Every major feature needs usability requirements

```markdown
Feature: Reminder diagnostics
User requirements:
- determine whether reminder is scheduled
- see exact send time and delivery state
- see why suppressed/failed
- understand corrective action
```

---

## BM. Evaluate against realistic data volume

Test: 2 vs 200 appointments, long names, multiple recipients, many calendars/workflows, large transcripts.

---

## BN. Evaluate novice and repeat use separately

First-time: can they understand? Repeat: can they do it quickly? Onboarding vs shortcuts.

---

## BO. Qualitative and quantitative evaluation

Observe confusion and terminology; measure completion, time, errors, abandonment, backtracking.

---

## BP. Preference alone is not usability evidence

“I like this screen” ≠ usable. Observe findability, completion, errors, time, outcome understanding.

---

## BQ. Design changes trace to user need

Every move/hide/modal needs reason tied to: user goal, context, frequency, errors, efficiency, learnability, clarity—not merely “looks cleaner.”

---

## BR. Document the design process for major redesigns

1. User/task/context  
2. User requirements  
3. Proposed structure  
4. Design solution  
5. Evaluation  
6. Findings  
7. Changes  

---

## BS. HCD applies throughout the lifecycle

New features, redesigns, integrations, bug fixes affecting workflows, mobile, enterprise—all subject to these rules (ISO 9241-210).

---

## BT. Implementation success ≠ UX success

**Hard Cursor rule:**

| Can be true | And still fail |
|-------------|----------------|
| API works | Unusable |
| Database writes | Confusing |
| UI renders | Inefficient |

Feature certification and usability certification are **different layers**.

---

## Transovo Human-Centered Design acceptance checklist

For each significant page/flow:

- [ ] Primary user(s) identified  
- [ ] Primary user goal identified  
- [ ] Context of use documented  
- [ ] User requirement stated in outcome terms  
- [ ] Primary task can be completed correctly  
- [ ] Unnecessary steps removed  
- [ ] Unnecessary information removed  
- [ ] Terminology matches user expectations  
- [ ] Current state is understandable  
- [ ] Controls are self-descriptive  
- [ ] Common behavior follows familiar conventions  
- [ ] First-time use is learnable  
- [ ] Repeat use is efficient  
- [ ] User retains appropriate control  
- [ ] Consequential actions are understandable  
- [ ] Errors prevented where possible  
- [ ] Errors recoverable with low effort  
- [ ] User work preserved after failure where feasible  
- [ ] Defaults support common use  
- [ ] Advanced complexity progressively disclosed  
- [ ] Related context carried forward automatically  
- [ ] Settings clearly communicate scope  
- [ ] Default/inheritance/override behavior clear  
- [ ] Important asynchronous state visible  
- [ ] Critical causes explained at user level  
- [ ] Primary workflow tested with realistic scenarios  
- [ ] Realistic data volumes considered  
- [ ] Novice and repeat use considered  
- [ ] Whole journey evaluated, not isolated screen  
- [ ] Design iterable without rebuilding business logic  

---

## Feature worksheet (use before major UX work)

```markdown
### Feature: [Name]

**Context of use**
- Primary users:
- Primary goals:
- Context (device, frequency, volume, interruptions):

**User requirements** (outcome terms, testable)
1.
2.

**Success criteria** (effectiveness / efficiency / satisfaction)
-

**Primary workflow steps** (minimum necessary)
-

**Whole journey** (including setup, failure, recovery)
-

**Defaults**
-

**Progressive disclosure** (what’s hidden until needed)
-

**Inheritance / override** (org → type → appointment)
-

**Evaluation scenarios** (realistic tasks to test)
1.
```

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md        → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md → ISO 9241 HCD (this file)
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                           → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                   → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                       → Visual tokens
```

---

*Guide #2: Human-Centered Design & Usability Standards. Next: Guide #3 — `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #5 — `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · Guide #6 — `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · Guide #7 — `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*


===== [Information architecture & navigation (foundational)] docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md =====
# Transovo Information Architecture & Navigation Standards Guide

**Series:** Implementation standards · **Guide #3 of 12**  
**Status:** Active — mandatory hard architectural standard between feature inventory and individual page designs  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** ISO 9241-110:2020 · WCAG 2.2 (Guidelines 2.4 Navigable, 3.2 Predictable) · W3C WAI · U.S. Web Design System (USWDS)

---

## Master Cursor rule

> **Transovo information architecture must be task-based, predictable, shallow enough to understand, and consistent across the product.** Follow ISO 9241-110 interaction principles and WCAG 2.2 navigation/predictability requirements. Every capability has **one canonical home**, **one canonical user-facing name**, and a **clearly defined parent domain**. Global navigation represents major recurring workspaces; local navigation represents peer views within those workspaces; actions stay on the pages where they are performed; states and filters do not become product navigation; organization-wide configuration belongs in Settings or Integrations. Multiple contextual paths may reach the same object, but must never create duplicate versions of that object. Repeated navigation must retain consistent order and identification. Users must always be able to determine where they are, predict where a destination belongs, and move between related objects without reconstructing context.

**This guide sits between the product feature inventory and individual page designs.** It is the hard architectural ruleset for how Transovo organizes information, names destinations, structures navigation, communicates hierarchy, and helps users find where they are going.

---

## Important distinction from Guides #1 and #2

There is **not** one international ISO standard that dictates a specific SaaS sidebar structure or says “use exactly seven navigation items.”

What **is** standardized are the underlying requirements around:

- predictable navigation
- meaningful labels
- user expectations
- location/orientation
- multiple ways to find content
- consistent identification
- logical hierarchy
- task suitability
- navigation accessibility

---

## Primary authorities

| Authority | Focus |
|-----------|--------|
| **ISO 9241-110:2020** | General interaction principles — suitability for user tasks, self-descriptiveness, conformity with user expectations, controllability, learnability, error robustness; intended to inform UI requirements, style guides, and interactive-system design |
| **W3C WCAG 2.2** | Guideline **2.4 Navigable** and Guideline **3.2 Predictable** |
| **W3C WAI** | Accessibility and navigation semantics |
| **U.S. Web Design System (USWDS)** | Official U.S. federal design-system guidance for hierarchical side navigation, breadcrumbs, and navigation patterns |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Nav implementation: `src/lib/products/appointments-nav.ts`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Navigation must be organized around user tasks and concepts

ISO 9241-110 requires interaction to be suitable for the user’s task and conform to user expectations.

**Therefore:** Navigation must represent concepts and jobs users recognize, not internal architecture, database models, or implementation details.

**For Transovo — good:**

- Appointments
- Booking
- Contacts
- Messages
- Automations
- Meetings
- Payments
- Analytics

**Bad:**

- Event Engine
- Provider Connections
- Workflow Runtime
- Scheduling Objects
- Graph Sync
- Communication Eligibility

**Cursor rule:** Never expose a technical subsystem as primary navigation merely because it exists in the codebase.

---

## B. Every destination must have a clearly defined scope

Two neighboring navigation destinations should not force the user to guess where something belongs.

| Destination | Scope |
|-------------|--------|
| **Appointments** | Appointments that already exist |
| **Booking** | Rules and mechanisms that create appointments |
| **Contacts** | People/customer records |
| **Messages** | Actual conversations |
| **Automations** | Rules Transovo executes automatically |
| **Meetings** | Recordings, transcripts, recaps, and meeting intelligence |
| **Payments** | Transactions |
| **Analytics** | Aggregate operational performance |
| **Integrations** | Connections to external systems |
| **Settings** | Organization-level configuration |

**Cursor rule:** Every top-level destination must have a written definition. No two top-level destinations may intentionally represent substantially overlapping concepts.

---

## C. Navigation labels must describe purpose

WCAG 2.2 requires headings and labels to describe their topic or purpose.

Navigation labels therefore need to be:

- specific
- recognizable
- concise
- unambiguous
- written from the user’s perspective

| Good | Bad |
|------|-----|
| Appointments | Manage |
| Integrations | Connections & Resources |
| Reminder sequences | Communication configuration engine |

**Cursor rule:** Never use vague catch-all labels such as **Tools**, **Resources**, **Management**, **Other**, **Miscellaneous**, or **Advanced** as primary navigation categories.

---

## D. One concept gets one canonical name

WCAG requires components with the same functionality to be identified consistently. That principle applies strongly to information architecture.

If the object is called **Booking type**, don’t call it **Event type** on another page, **Service** elsewhere, or **Appointment type** somewhere else — unless those are actually different objects.

**Transovo canonical object vocabulary:**

- Appointment
- Booking type
- Booking page
- Contact
- Conversation
- Reminder sequence
- Workflow
- Meeting
- Payment

**Cursor rule:** Search the existing UI before introducing a new label for an existing concept. Prefer the established canonical term.

---

## E. Global navigation must remain consistent

WCAG 2.2 SC 3.2.3 requires repeated navigation mechanisms to occur in the same relative order unless the user initiates the change.

Therefore:

- same global navigation structure
- same item order
- same utility placement
- same active-state behavior
- same account/settings placement

across normal Transovo pages.

No page should invent a different sidebar because its designer preferred another layout.

**Cursor rule:** All normal application pages use the canonical global navigation component. Never fork page-specific versions of the main sidebar/header.

---

## F. Stable navigation placement builds spatial memory

W3C explicitly notes that consistent visual layout and source order allow users to use spatial cues and predict where repeated navigation will appear.

Therefore:

If Settings is bottom-left, global search is in the header, and page title begins at the same content position — **keep those relationships stable.**

A redesign of one page must not relocate global utilities.

---

## G. Global navigation is for major destinations, not every feature

A feature does not automatically deserve a sidebar entry. Global navigation should contain major recurring destinations.

**Examples that should not become global entries merely because they exist:**

- New appointment
- Reminder history
- Microsoft calendar
- SMS eligibility
- Teams meeting creation
- Booking approval
- A2P registration

These belong within appropriate domains.

**Cursor rule:** A capability qualifies for global navigation only if it represents a distinct, recurring user workspace rather than an action, setting, state, or subordinate feature.

---

## H. Navigation destinations and actions must be separated

**Navigation means:** Go somewhere.  
**Actions mean:** Do something.

**Sidebar:** Appointments  
**Page action:** New appointment

**Not:** Appointments and New appointment as two equal navigation destinations.

Similarly:

- Add contact → action
- Create workflow → action
- Export → action
- Connect Microsoft → action

**Cursor rule:** Do not put verbs/actions into persistent global navigation unless the action actually represents a durable workspace.

---

## I. Global and local navigation are different levels

**Global navigation answers:** Which major product area?

**Local navigation answers:** Which view inside this area?

**Example:**

- **Global:** Appointments
- **Local:** Calendar | List | Waitlist | Recalls

USWDS describes side navigation as hierarchical navigation for levels within a section.

**Cursor rule:** Do not promote every local subsection into the global sidebar.

---

## J. Local navigation must contain peer concepts

Tabs or local navigation should represent comparable views or subsections of the same parent.

**Good:** Calendar | List | Waitlist | Recalls

**Bad:** Calendar | Create appointment | Export | Settings

Those mix destinations, actions, and configuration.

**Cursor rule:** Local navigation contains peer destinations only. Actions belong in action controls; configuration belongs contextually or under settings.

---

## K. Hierarchies should be as shallow as practical

There is no formal universal “three clicks” rule. But ISO’s task-suitability and efficiency principles strongly argue against unnecessary nesting, while USWDS side-navigation patterns are designed around understandable hierarchical relationships.

**Transovo target:**

```
Global domain → local view/object list → object/detail
```

Usually no deeper than necessary.

**Good:** Booking → Booking types → Consultation

**Poor:** Booking → Setup → Scheduling → Types → Services → Consultation

**Cursor rule:** Do not introduce a navigation level merely to group one or two obvious destinations.

---

## L. Do not flatten everything just to avoid hierarchy

The inverse matters too. A sidebar with 30 unrelated links may technically be shallow but still imposes too much scanning and categorization burden.

Depth and breadth must be balanced around meaningful user concepts.

**Cursor rule:** Prefer a small number of meaningful parent categories with clear local navigation over a flat list of every capability.

---

## M. One feature has one canonical home

A feature can be reachable from multiple contexts. It still gets one authoritative management location.

**Example — Reminder sequence**

- **Canonical management:** Automations → Reminder sequences
- **Referenced from:** appointment, booking type, calendar configuration

Those contextual links should reach the same underlying object, not create separate copies of its editor.

**Cursor rule:** Multiple access paths are encouraged; duplicated feature implementations are not.

---

## N. Important pages should have multiple findability paths

WCAG 2.2 SC 2.4.5 requires more than one way of locating pages within sets of pages, except for steps in a process.

For an application, important objects can appropriately be reached through:

- navigation
- search
- contextual relationships
- dashboard queues
- related records

**Example appointment:**

- Appointments calendar
- Appointment list
- Contact record
- Dashboard
- Search

**Cursor rule:** Do not force users to return to the global navigation tree whenever the system already knows the related destination.

---

## O. Multiple routes should lead to the same object

Multiple findability does not mean creating duplicates.

If appointment A123 is opened from Contact, Calendar, or Search, the authoritative appointment remains A123. Its status, reminders, payment, meeting, and activity must remain identical.

---

## P. Related objects need associative navigation

Users frequently navigate relationships rather than hierarchies.

| From | Link |
|------|------|
| Appointment | Contact → Anthony Johnson |
| Meeting | Appointment → Initial consultation |
| Contact | Next appointment → Sep 8, 2 PM |
| Payment | Appointment → Initial consultation |

Those should be links.

**Cursor rule:** Related primary objects should expose direct navigation to each other wherever that relationship is useful to the current task.

---

## Q. Preserve context when following relationships

If a user opens an appointment from Calendar, a quick detail drawer may preserve the calendar context better than immediately replacing the entire workspace.

If deeper work is needed, **Open full appointment** can navigate to the full record.

Navigation should account for where the user came from and what they were doing.

---

## R. Breadcrumbs represent hierarchy, not browsing history

USWDS explicitly describes breadcrumbs as showing where the current page sits in the site hierarchy and notes they are not appropriate as a representation of a step-by-step process.

**Good:** Booking / Booking types / Initial consultation

**Bad:** Home / Search / Anthony / Appointment / Edit — merely because those happened to be the user’s previous clicks.

**Cursor rule:** Breadcrumbs represent structural ancestors, never arbitrary browser history.

---

## S. Don’t use breadcrumbs unnecessarily

USWDS notes breadcrumbs may be unnecessary when:

- the site is shallow
- the hierarchy is already obvious
- existing navigation communicates location sufficiently

Do not mechanically add breadcrumbs to every Transovo page.

For **Appointments**, the active sidebar item + page heading may be sufficient.

For **Booking → Booking type → Consultation**, a breadcrumb/back relationship becomes more useful.

---

## T. Step-based processes use a stepper, not breadcrumbs

**Example A2P registration:** Business → Messaging use → Consent → Review

That’s a process. It should not be presented as:

Settings / Messaging / Business / Messaging Use / Consent

Use process navigation such as a step indicator. USWDS explicitly distinguishes hierarchical breadcrumbs from linear processes.

---

## U. Users must be able to determine where they are

WCAG Guideline 2.4 is specifically about helping users navigate, find content, and determine location. It includes an explicit AAA location criterion as well.

Transovo should provide location through combinations of:

- active global destination
- page heading
- local active tab
- breadcrumb when hierarchy warrants it
- object title on details

A user should not need the URL to know where they are.

---

## V. Every page requires a descriptive page title

WCAG 2.4.2 requires page titles that describe topic or purpose. Browser/document title should reflect the current context where practical.

**Examples:**

- Appointments — Transovo
- Initial consultation — Booking types — Transovo
- Anthony Johnson — Contacts — Transovo

**Not:** Dashboard on every route.

---

## W. Every page needs a clear primary heading

WCAG requires headings and labels that describe topic or purpose. The visible page heading should reinforce the current navigation destination.

**Example:**

- Sidebar active: Automations
- Local tab: Reminder sequences
- Page heading: **Reminder sequences**

Not: Messaging Automation Engine. Terminology should align.

---

## X. Link purpose must be understandable

WCAG requires link purpose to be determinable from the link text or its programmatically determined context.

Avoid repeated ambiguous links such as **Click here**, **More**, or **View** when context does not sufficiently establish the destination.

**Better:** View appointment · Open contact · Manage Microsoft calendars

---

## Y. Avoid duplicate labels that lead to unrelated places

Do not have **Calendar** in the sidebar, under Booking, and under Integrations if they represent three different concepts.

Use differentiated labels:

- Appointments → Calendar
- Booking → Availability
- Integrations → Connected calendars

**Cursor rule:** When two destinations could reasonably be confused, change their labels until their scopes can be predicted without opening them.

---

## Z. Navigation should conform to familiar conventions

ISO 9241-110’s conformity-with-user-expectations principle means familiar interactions should behave familiarly.

**Examples:**

- logo/home affordance behaves consistently
- sidebar items navigate
- tabs switch peer content
- breadcrumb ancestors navigate upward
- back returns to previous/parent context appropriately
- selected nav item appears selected

Do not invent a new interaction vocabulary for common navigation.

---

## AA. Do not trigger navigation merely from focus

WCAG 3.2.1 prohibits a component receiving focus from automatically changing context.

Keyboard user tabs to **Appointments** — that must not navigate merely because it received focus. Navigation occurs on activation.

---

## AB. Input changes should not unexpectedly navigate

WCAG 3.2.2 says changing a UI setting should not unexpectedly cause a context change unless users are advised beforehand.

**Example:** Selecting **Staff: Sarah** from a filter should filter results. It shouldn’t suddenly navigate to Sarah’s profile unless that behavior is explicitly communicated.

---

## AC. Preserve user orientation after navigation

When users move between related views, the destination should provide enough contextual continuity to explain where they arrived.

**Example — Contact → appointment**

Destination shows:

```
Initial consultation
Anthony Johnson
Sep 8 · 2:00 PM
```

Not a generic page with no obvious relationship.

---

## AD. Back behavior must be predictable

Distinguish:

| Type | Meaning |
|------|---------|
| **Browser Back** | Previous navigation state/history |
| **Structural Back** | Parent workspace |

**Example:** ← Booking types inside a Booking Type editor.

Avoid controls labeled simply **Back** when it is unclear whether they mean previous browser page, parent section, cancel, or previous wizard step.

---

## AE. Preserve list state when returning from a detail

If a user:

1. searches appointments
2. filters to Unconfirmed
3. scrolls
4. opens an appointment
5. returns

the app should preserve reasonable state: query, filters, sort, pagination/scroll where practical.

Forcing users to reconstruct the same view harms efficiency.

---

## AF. Tabs should preserve predictable state

When switching Calendar → List → Calendar, the application should preserve relevant date/filter state where doing so matches user expectations.

Do not reset to today’s date or erase filters for no reason.

---

## AG. URL/state should support meaningful navigation where practical

Important workspaces and objects should have durable routes.

**Examples:** appointment detail, contact detail, booking type, workflow, meeting recap

This enables browser navigation, deep links, sharing internally, and restoring context.

Pure transient UI state should not unnecessarily become separate routes.

---

## AH. Do not create pages for simple states

Don’t create separate global pages for **Confirmed appointments**, **Failed reminders**, or **Paid appointments** when those are better represented as filters, views, or status queues.

Navigation should remain structurally stable even as data states change.

---

## AI. Status is not taxonomy

**Needs attention** may be an operational queue. It is not generally a permanent information category.

Likewise **Failed**, **Pending**, **Confirmed**, and **Disconnected** are states. Do not confuse state with product architecture.

---

## AJ. Configuration and operational work should be separated

**Operational objects:** appointments, contacts, messages, meetings, payments

**Configuration:** business settings, calendars, A2P, permissions, integrations

A common architecture problem is mixing these as equals.

**Cursor rule:** Frequently operated business objects receive higher navigational prominence than infrequent system configuration.

---

## AK. Local configuration stays with the object it affects

**Example — Payment required for a booking type:**

Booking → Booking type → Payment

**Not:** Settings → Payments → Booking behavior → Type X

**Global provider connection:** Integrations → Payments

This distinction reduces navigation cost.

---

## AL. Global Settings holds defaults and organization-wide behavior

Settings should not become a duplicate copy of the product.

**It may contain:** organization defaults, account settings, team/security, messaging registration, default calendar behavior

**It should not contain complete copies of:** Booking Types, Reminder Sequences, Contacts, Appointment management

**Cursor rule:** Settings controls global/default behavior; primary product objects remain in their canonical domain.

---

## AM. External-system connections belong together

For Transovo, connecting Microsoft or Google is conceptually **Integrations → Calendars** rather than making **Microsoft** a global navigation destination.

Similarly **Stripe / Square** belong under payment integrations/configuration. The provider is subordinate to the user’s job.

---

## AN. Feature flags/entitlements should not contaminate the IA

If a feature isn’t available to a user:

- hide it where it would otherwise create irrelevant clutter, or
- show it intentionally where discovery/upgrade is part of the product strategy

Do not produce a sidebar full of permanently disabled modules. Navigation should reflect usable product structure.

---

## AO. Role-based navigation must remain coherent

A staff member may have fewer destinations than an owner. That’s acceptable.

But the remaining destinations should preserve normal ordering, normal names, and normal grouping.

Do not invent an entirely different product architecture per role unless their work truly differs substantially.

---

## AP. Avoid excessive nested sidebar accordions

Collapsing 30 items into accordions does not actually solve information overload.

If every primary section expands into six children, the sidebar simply becomes a hidden tree of complexity.

**Cursor rule:** Global navigation should select the workspace. Local navigation generally handles depth within that workspace.

---

## AQ. Sidebar section headings should create meaningful grouping

If visual groups are used, they should communicate conceptual relationships.

**Possible logical groupings:**

```
WORK
  Appointments
  Messages
  Contacts
AUTOMATE
  Booking
  Automations
  Meetings
BUSINESS
  Payments
  Analytics
```

The headings themselves should be visually subordinate. Do not create a section heading for every two links just to decorate the sidebar.

---

## AR. Ordering should be stable and purposeful

Order global navigation based on:

- task frequency
- task importance
- conceptual workflow
- user expectations

**Not:** alphabetical order, order features were implemented, database/domain order

Once established, avoid unnecessary reordering because users develop spatial memory. W3C’s consistent-navigation guidance explicitly recognizes this benefit.

---

## AS. The most frequent destination should be inexpensive to reach

If Appointments is the operational center of Transovo:

- it gets prominent placement
- Home should link into it
- relevant contacts/meetings should link back into appointments

Do not make the highest-frequency workflow navigate through lower-frequency setup areas.

---

## AT. Deep configuration can use within-page navigation

A long settings/editor page can use section navigation, tabs, or anchored subsections where those sections are meaningful.

Do not create 15 separate routes solely because a configuration object has 15 groups of fields.

---

## AU. Do not use tabs merely to make a page look organized

Tabs introduce navigation and hidden content. Use them when sections are:

- meaningful peers
- independently useful
- understandable without seeing simultaneously

If users need to compare two sections at once, hiding them behind tabs may be wrong.

---

## AV. Don’t use accordions for frequently compared information

Accordions are useful for progressive disclosure. They are poor when users repeatedly need to scan several sections together.

Choose architecture according to the task, not aesthetics.

---

## AW. Search complements navigation; it does not repair bad navigation

Global search can help users reach appointments, contacts, and meetings quickly.

But do not rely on search because the hierarchy is confusing.

**Cursor rule:** Primary information architecture must remain understandable without requiring search.

---

## AX. Search scopes must be explicit

If global search searches contacts, appointments, and meetings, say so through result grouping or labels.

If a page search only searches contacts, keep it within Contacts.

Do not make users guess what a search field covers.

---

## AY. Filters stay within the object domain they operate on

**Example:** Appointment status filter belongs on Appointment list/calendar. It is not navigation.

Likewise date filter, staff filter, and booking type filter are view controls.

Do not put changing datasets into the global navigation tree.

---

## AZ. Saved views are shortcuts, not new product domains

If users save **Tomorrow’s unconfirmed appointments**, that’s a user-created view. It does not become a new top-level architectural category.

---

## BA. Navigation must remain usable with long labels and realistic data

Do not design solely around short English labels. Test:

- longer section names
- narrow viewport
- translated labels eventually
- badges/counts
- role variation

The IA should survive realistic UI constraints.

---

## BB. Counts/badges must not destabilize navigation

A navigation item can display **Messages 4** if meaningful.

But dynamic counts should not:

- shift labels
- alter ordering
- become the only indication of status
- produce dozens of distracting badges

Use notification counts selectively.

---

## BC. New/attention indicators need consistent meaning

If a dot means **new item** everywhere, keep that meaning.

If amber means **needs attention**, do not use the same treatment merely to advertise a new feature.

Navigation status needs semantic discipline.

---

## BD. Navigation should not become an alert center

System problems can be indicated contextually.

But don’t add **Microsoft error**, **reminder failure**, **payment failure**, or **A2P pending** as separate navigation destinations.

Those are states that should link users to their canonical locations.

---

## BE. Page hierarchy should map to URL hierarchy where practical

Not every URL has to mirror navigation literally. But meaningful relationships are beneficial:

```
/appointments
/appointments/:id
/booking/types
/booking/types/:id
/automations/workflows
/automations/workflows/:id
```

Avoid route structures that reveal obsolete implementation concepts even though the UI claims a new IA.

---

## BF. Legacy routes may redirect; legacy navigation must not remain

If old routes exist for compatibility, that’s fine.

But do not preserve obsolete duplicate menu destinations solely because legacy routes still exist.

Canonical navigation controls the product’s conceptual architecture.

---

## BG. One primary navigation system should dominate

Do not simultaneously give users:

- giant sidebar
- giant global header menu
- second nested sidebar
- top nav with duplicates

A secondary local system is fine. Multiple competing global systems are not.

---

## BH. Navigation must remain understandable at responsive breakpoints

WCAG consistency still applies when layouts adapt; repeated navigation should stay predictable within the same page variation.

| Breakpoint | Pattern |
|------------|---------|
| **Desktop** | persistent/collapsible sidebar |
| **Mobile** | drawer/menu |

The structure, labels, and order should remain conceptually the same. Mobile is not a different IA.

---

## BI. Mobile should not hide essential destinations permanently

Reduced screen space can change presentation. It should not make Payments, Settings, or Integrations impossible to reach.

The complete authorized architecture still needs a route.

---

## BJ. Focus order must track meaningful navigation order

WCAG 2.4.3 requires focus order to preserve meaning and operability.

If visual nav order is Home → Appointments → Booking → Contacts, keyboard order should not begin Settings → Contacts → Home because CSS visually rearranged it.

---

## BK. Skip navigation must be available where repeated blocks exist

WCAG 2.4.1 requires a mechanism for bypassing repeated blocks.

For Transovo, implement a reliable **Skip to main content** mechanism so keyboard users don’t traverse the entire sidebar on every route.

---

## BL. Persistent help should remain consistently located

WCAG 2.2 introduced **Consistent Help**: repeated help mechanisms must occur in consistent relative order.

If Transovo has persistent support, help, documentation, or AI help — keep its placement predictable.

Don’t put Support in the header on one screen, footer on another, and sidebar on another without reason.

---

## BM. Empty states must preserve architectural orientation

Even when there is no data, **Booking types** should remain visibly inside **Booking**.

The empty state does not replace the architecture.

**Good:**

```
Booking
Booking types
No booking types yet.
```

**Not:** Welcome! Let’s get started! with no indication where the user actually is.

---

## BN. First-run onboarding must not create a second permanent architecture

Setup checklists and guided onboarding can provide shortcuts.

After onboarding, the same object should still live in its canonical location.

**Example:** Setup checklist **Create booking type** takes the user to **Booking → Booking types** — not a special separate onboarding implementation that creates something different.

---

## BO. Wizards represent process state, not product hierarchy

During A2P registration, steps might be: Business → Use case → Consent → Review.

Those steps disappear after the process. Do not add them to persistent Settings navigation.

---

## BP. Object creation returns users to a meaningful context

**Example — From Appointment Calendar:**

New appointment → Save should return/show the new appointment in calendar or detail drawer — rather than sending the user to an unrelated generic success page.

Context after navigation matters as much as before navigation.

---

## BQ. Deleting an object must result in a valid destination

If user deletes **Booking type / Initial consultation**, the interface cannot leave them on a nonexistent route.

Return to **Booking → Booking types** with appropriate confirmation.

---

## BR. Missing/unauthorized objects need meaningful recovery

If a deep link points to a deleted appointment, object user lacks permission to view, or unavailable booking type — don’t display a generic blank 404 if the application can provide useful context.

**Examples:**

- This booking type no longer exists. Return to Booking types.
- You don’t have permission to view this workflow. Return to Automations.

---

## BS. External navigation should be distinguishable where it matters

Links that leave Transovo for Microsoft, Stripe, Square, or public booking page preview should avoid surprising users.

Where material, indicate that they’re opening an external destination or preview.

---

## BT. Public/customer navigation is a separate IA from admin navigation

This is critical.

**Customer journey:** choose booking type → choose time → information → confirm

**Admin journey:** configure booking type → availability → payments → reminders

Different users, different goals, different architecture.

Do not leak admin navigation into public booking experiences.

---

## BU. Authentication/onboarding has a separate temporary navigation model

Login, signup, recovery, and setup can use a simplified shell. They do not need the full operational sidebar.

Once inside normal application work, return to the canonical app shell.

---

## BV. Immersive builders may temporarily reduce global navigation

For workflow builder or complex routing builder, workspace efficiency may justify collapsing/minimizing normal navigation.

But there must always be a clear route back: **← Workflows**

This is a temporary workspace mode, not a new product hierarchy.

---

## BW. Current-page state must be programmatically identifiable

The active destination cannot rely only on a subtle visual difference.

For accessible navigation, expose appropriate current-state semantics such as `aria-current` where applicable. Visual state and semantic state should agree.

---

## BX. Repeated navigation controls need consistent accessible names

If the sidebar is labeled **Main navigation**, use a consistent label.

If secondary navigation is **Booking navigation**, make it distinct.

Screen-reader users should be able to distinguish multiple navigation regions.

---

## BY. Never create fake hierarchy solely from indentation

If an item visually appears as a child, it should actually be conceptually and semantically subordinate.

Do not indent **Settings** under **Analytics** merely for layout convenience. Visual hierarchy must reflect real IA.

---

## BZ. Architecture changes require an inventory pass

Before moving/removing a navigation destination:

1. Identify every feature currently under it.
2. Assign each feature a new canonical home.
3. Update contextual links.
4. Update terminology.
5. Redirect old routes as appropriate.
6. Ensure no orphaned UI exists.

**Cursor rule:** Never remove a navigation item until every reachable capability underneath it has been accounted for.

This is particularly important for the Transovo redesign.

---

## CA. Architecture decisions must be documented separately from visual decisions

Do not justify “Booking belongs above Contacts because it looks better there.”

Architecture decisions should be based on:

- task model
- conceptual relationship
- frequency
- expected location
- hierarchy

Visual styling comes afterward.

---

## CB. Card sorting is an IA discovery method, not implementation truth

For large feature inventories:

- put concepts/features into cards
- group them according to user mental models
- identify candidate labels

The result is a hypothesis. Do not hard-code the first grouping merely because the design team produced it.

---

## CC. Tree testing validates findability before visual design

Once a hierarchy exists, test realistic tasks against the text tree.

**Example task:** Where would you go to change the time customers can book you?

**Expected:** Booking → Availability

If many users expect Settings → Calendar, that’s evidence the taxonomy or labels may need work.

Cursor doesn’t simulate human research results; it preserves the architecture so actual testing can be performed.

---

## CD. Navigation should be evaluated using tasks, not aesthetics

Tests should resemble:

- Find an appointment and reschedule it.
- Connect Microsoft Calendar.
- Find out why an SMS didn’t send.
- Change the default reminder sequence.

**Not:** Which sidebar looks cleaner?

Findability is an outcome.

---

## CE. Measure IA failure signals

Useful signals include:

- repeated backtracking
- wrong-section visits
- search immediately after opening nav
- excessive support questions such as “where is X?”
- repeated use of browser back
- abandonment
- users entering Settings for operational actions

Those indicate architecture problems. Do not automatically add more links to solve them.

---

## CF. Do not compensate for bad IA with duplicate shortcuts everywhere

Contextual shortcuts are valuable.

But if every screen needs links saying “Looking for Booking Types? Click here.” the underlying hierarchy may be wrong.

Fix the architecture rather than accumulating patches.

---

## CG. Architecture should survive product growth

When a new capability is added, it should usually have an obvious parent.

| New capability | Expected parent |
|----------------|-----------------|
| New reminder delivery option | Automations / Reminder sequence |
| New calendar provider | Integrations / Calendars |
| New appointment lifecycle state | Appointments |

If every new feature demands another top-level navigation item, the taxonomy is too feature-driven.

---

## CH. Taxonomy must not be based on current code ownership

Engineering teams may own calendar service, messaging service, or AI service. Users do not care.

Product architecture should remain stable even if backend services are refactored.

---

## CI. Information architecture must remain source-of-truth documented

For Transovo, maintain one canonical IA map documenting:

```
Global domain
  → local destinations
  → canonical objects
  → contextual relationships
  → settings ownership
```

Cursor must consult it before adding new navigation.

**Implementation references:**

- `docs/TRANSOVO-UI-DESIGN-GUIDE.md` — domain definitions and placement principles
- `src/lib/products/appointments-nav.ts` — canonical global/local nav structure

---

## CJ. Every new feature needs an IA placement decision

Before creating a UI for any future feature, Cursor should answer:

1. What user job does it serve?
2. What canonical object does it affect?
3. What is its primary home?
4. Is it global, local, contextual, settings, or process-only?
5. What existing locations should link to it?
6. Does it introduce terminology that overlaps existing concepts?

**No placement → no new route yet.**

---

## CK. Canonical Transovo global architecture

Based on the inventory already scoped, the approved top-level architecture should remain:

```
Home
Appointments
Booking
Contacts
Messages
Automations
Meetings
Payments
Analytics
────────────
Integrations
Settings
```

This is not because a formal standard mandates those ten labels.

It is our task-model implementation of the standards:

- distinct user domains
- understandable labels
- shallow structure
- predictable navigation
- consistent terminology
- clear separation between work and configuration

---

## CL. Canonical local architecture

### Appointments

Calendar · List · Waitlist · Recalls

### Booking

Booking types · Booking pages · Availability · AI booking · Routing · Meeting polls

### Contacts

Primary list + contextual contact detail.

### Messages

Inbox — use filters rather than artificial navigation where possible.

### Automations

Reminder sequences · Workflows · Templates · Activity

### Meetings

Upcoming · Recaps

### Payments

Transactions

### Analytics

Overview · Booking · Reminders · Automations · Reports

### Integrations

Calendars · Payments

### Settings

Business · Team · Messaging · Calendar · Meetings · Security · Billing

---

## Transovo IA / Navigation Acceptance Checklist

Before a page, route, or navigation change is considered complete:

- [ ] Feature has one defined user job
- [ ] Feature has one canonical home
- [ ] Top-level category scope is documented
- [ ] No sibling category materially overlaps its meaning
- [ ] Label uses canonical user-facing terminology
- [ ] Same concept uses same label elsewhere
- [ ] Global navigation remains in canonical relative order
- [ ] Page uses canonical global navigation component
- [ ] Action has not been incorrectly promoted into navigation
- [ ] State/filter has not been incorrectly promoted into navigation
- [ ] Local navigation contains peer destinations only
- [ ] Hierarchy is no deeper than necessary
- [ ] Important object can be reached through useful contextual paths
- [ ] Multiple paths resolve to same authoritative object
- [ ] Related objects cross-link where useful
- [ ] Breadcrumbs, when used, represent hierarchy
- [ ] Process steps are not represented as breadcrumbs
- [ ] Current page/location is obvious
- [ ] Browser/document title describes current context
- [ ] Visible primary heading describes current page
- [ ] Link purpose is understandable
- [ ] Navigation does not change merely on focus
- [ ] Filter/input changes do not unexpectedly navigate
- [ ] List/filter state is preserved when returning where practical
- [ ] Responsive navigation preserves same conceptual architecture
- [ ] Keyboard order matches meaningful navigation order
- [ ] Skip-to-main mechanism exists
- [ ] Persistent help location remains consistent
- [ ] Unauthorized/removed objects have meaningful recovery
- [ ] Public/customer flows do not inherit admin navigation
- [ ] Legacy routes do not create duplicate canonical destinations
- [ ] New navigation does not expose backend implementation terminology
- [ ] Feature remains discoverable without requiring search
- [ ] Architecture documentation updated with any approved changes

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md           → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md  → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation (this file)
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                             → IA principles & domain definitions
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                     → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                         → Visual tokens
src/lib/products/appointments-nav.ts                    → Canonical nav implementation
```

---

*Guide #3: Information Architecture & Navigation Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*


===== [Page architecture & layout rules] docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md =====
# Transovo Page Architecture Rules

**Status:** Active — required reference for every page, screen, and surface  
**Audience:** Engineers, designers, and Cursor agents (including Kimi) building Transovo UI  
**Layer:** Page structure and behavioral grammar — **after** information architecture, **before** pixel-level design  

**Prerequisite:** Read `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` first, then `docs/TRANSOVO-UI-DESIGN-GUIDE.md` (mental models, IA, heuristics). This document defines **how every page is built** so 40 attractive screens do not each behave differently.

**Related docs**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- **Accessibility (WCAG 2.2 AA):** `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- **Human-centered design (ISO 9241):** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- **IA & navigation (hard standard):** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- **Interaction/keyboard/focus (hard standard):** `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- **Forms & validation (hard standard):** `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- **Responsive/reflow/zoom (hard standard):** `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- **Tables/grids (hard standard):** `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- **Privacy/consent/compliance (hard standard):** `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- **Security/authentication (hard standard):** `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- **Date/time/timezone/locale (hard standard):** `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- **Internationalization/localization (hard standard):** `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- Page architecture: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Appointments nav implementation: `src/lib/products/appointments-nav.ts`
- V1 UI rebuild: `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md`

---

## When to use this guide

**Before designing or implementing any page**, classify it and apply these rules.

**Follow this guide whenever you:**

- Create a new page or redesign an existing one
- Add headers, tabs, filters, drawers, modals, or wizards
- Build list, detail, dashboard, calendar, editor, or builder surfaces
- Decide where a primary action, status badge, or empty state goes

**If a page cannot be described with one primary job (Rule 1), split it or move content elsewhere.**

---

## The Transovo page template

Not every row appears on every page. The **page archetype** (Rule 10) determines which sections exist.

```
┌─────────────────────────────────────────────────────┐
│ GLOBAL APP SHELL                                    │
│ Sidebar + global utilities                          │
├─────────────────────────────────────────────────────┤
│ PAGE HEADER                                         │
│ Title                           [Primary Action]     │
│ Short context/status             Secondary actions  │
├─────────────────────────────────────────────────────┤
│ LOCAL NAVIGATION                                    │
│ Tabs / views — only when this domain has them       │
├─────────────────────────────────────────────────────┤
│ CONTROL BAR                                         │
│ Search · Filters · Sort · View controls             │
│ Only on list/calendar/management pages              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PRIMARY WORKSPACE                                   │
│ The actual task                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ CONTEXT / DETAILS / ACTIVITY                        │
│ Only where the page archetype requires them         │
└─────────────────────────────────────────────────────┘
```

### Element classification (Rule 50)

Every UI element on a page belongs to one level:

| Level | What it is | Examples |
|-------|------------|----------|
| **Global** | Product-wide navigation and context | Sidebar, global header, account menu |
| **Page** | Title and actions for this workspace | Page title, `+ New appointment`, page description |
| **Local** | Views/filters within this workspace | Calendar \| List \| Waitlist tabs |
| **Object** | Information/actions on the selected thing | Appointment status, Reschedule, customer name |
| **Contextual** | Related objects or shortcuts | Link to contact, payment, meeting recap |
| **Advanced** | Less common config, progressively disclosed | Round-robin weights, advanced timing |
| **System** | Loading, error, sync, async feedback | Skeleton rows, “Synced 3 min ago”, toasts |

---

## Page archetypes (Rule 10)

Almost every Transovo screen fits **one** archetype. Pick the archetype before layout.

### A. Dashboard page

**Examples:** Home, Analytics Overview

```
Page header
Critical status / alerts
Primary KPIs
Operational queues
Recent activity
Secondary insights
```

Dashboard cards must **answer questions**, not decorate.

---

### B. List / management page

**Examples:** Appointment List, Contacts, Booking Types, Workflows, Recaps, Transactions

```
Header + primary action
Local tabs (if needed)
Search / filter / action bar
Table or list
Pagination or load more
```

One reusable pattern across all list pages.

---

### C. Calendar page

**Examples:** Appointments → Calendar

```
Header
Date navigation + Today
Calendar / list view controls
Filters
Calendar surface
Context drawer when event selected
```

**Clicking an appointment** should open a **detail drawer** by default—not navigate away immediately (preserves context). Offer **Open full appointment** when the full detail screen is needed.

---

### D. Detail page

**Examples:** Appointment, Contact, Meeting recap, Payment

```
Breadcrumb or back
Object identity + status
Primary actions
Overview / important state
Related information (grouped)
Activity / history (bottom or tab)
```

See **Object detail anatomy** (Rule 11).

---

### E. Configuration / editor page

**Examples:** Booking Type, Availability Schedule, Reminder Sequence, Integration settings

```
Back / context
Title
Save state + primary action
Basic configuration
──────────────────
Most-used settings
Advanced sections
──────────────────
Less-frequent configuration
Danger zone
```

---

### F. Builder / workspace (immersive)

**Examples:** Workflow Builder, Routing Form Builder

```
Top builder bar
← Back    Workflow name    Test    Save / Publish
Palette | Canvas / workspace | Properties
```

Normal product sidebar **collapses** or becomes minimal. Maximize workspace.

---

## The 50 rules

### Purpose and shell

#### 1. Every page must have one primary job

Before designing, complete this sentence:

> “The purpose of this page is to ______.”

| Page | Primary job |
|------|-------------|
| Appointments | Find, review, create, and manage appointments |
| Booking Types | Create and configure appointment types customers can book |
| Reminder Sequences | Configure communications that automatically happen around appointments |

If three unrelated sentences are needed, the page probably contains things that belong elsewhere.

---

#### 2. Every normal page uses the same shell

No page invents its own header, sidebar, or layout.

```
┌──────────────┬────────────────────────────────────┐
│              │ Global header                      │
│              ├────────────────────────────────────┤
│ Global       │ Page header                        │
│ navigation   │ Title                Primary action│
│              │ Description / status               │
│              ├────────────────────────────────────┤
│              │ Local navigation / filters         │
│              ├────────────────────────────────────┤
│              │ Main workspace                     │
└──────────────┴────────────────────────────────────┘
```

**Same everywhere:** sidebar width, global header, content start, max widths, page-header spacing, button placement, tabs, filters, status treatment. Content changes; architecture does not.

---

#### 3. Page title always goes in the same place

**Top-left** of the content workspace.

```
Appointments
Manage upcoming, completed, and imported appointments.
```

**Top-right:** `+ New appointment`

Not: giant hero, centered title, button buried below, different title styles per screen.

---

#### 4. One obvious primary action per page

One visually dominant action per page.

| Page | Primary action |
|------|----------------|
| Appointments | New appointment |
| Booking Types | New booking type |
| Contacts | Add contact |
| Reminder Sequences | New sequence |
| Workflows | New workflow |

Secondary actions stay visually quieter: `Import` `Export` ··· `+ New appointment`

---

#### 5. Don’t put actions in navigation

| Sidebar | Page |
|---------|------|
| **Places** — where am I going? | **Actions** — what am I doing? |

❌ New Appointment in sidebar  
❌ Add Contact in sidebar  
❌ Create Workflow in sidebar  

✅ **Appointments** in sidebar → **+ New appointment** on the page

---

#### 6. Local navigation has a fixed location

Domain views sit **directly under the page header**.

```
Appointments                              + New appointment
Manage your scheduled appointments.
Calendar   List   Waitlist   Recalls
────────────────────────────────────────
```

```
Booking
Booking Types   Booking Pages   Availability   AI Booking   Routing   Polls
────────────────────────────────────────────────────────────────────────
```

Do not put tabs sometimes at top, sometimes left, sometimes inside cards, sometimes in dropdowns—unless the archetype genuinely requires a different pattern (e.g. builder).

---

#### 7. Tabs represent peer views, not actions

**Good:** `Calendar | List | Waitlist` — which view?  
**Bad:** `Save | Delete | Export` — those are actions.

Avoid tabs where one item is really a settings button, not a peer view.

---

#### 8. Filters and search live above the data they control

```
Page header
Local tabs
Search    Status ▼   Type ▼   Date ▼    More filters
Table / list
```

Not in the sidebar. Not at the bottom. Not scattered in column headers (except deliberate table-column filters).

Gestalt proximity: controls affect content **below** them.

---

#### 9. Don’t show filters until they are useful

**Default:** search + one or two important filters + **More filters**

**Expanded:** source, staff, booking type, status, calendar, date range, payment status, confirmation state

Do not show eleven dropdowns because eleven filters exist.

---

### Object detail and status

#### 11. Object detail pages need consistent anatomy

**Appointment detail** — same conceptual order every time:

| Level | Content |
|-------|---------|
| **1 — Identity** | Initial Consultation · Tue, Sep 8 · 2:00–2:30 PM · `Confirmed` |
| **2 — Primary actions** | Message · Reschedule · Cancel · `•••` |
| **3 — Operational state** | Confirmation, payment, reminder status, calendar sync, SMS eligibility |
| **4 — Core information** | Customer, booking type, staff, location, meeting, source |
| **5 — Related processes** | Scheduled reminders, messages, payment, meeting recap |
| **6 — Activity** | Chronological timeline |

---

#### 12. Status belongs near the object it describes

- **Confirmed** → next to appointment identity  
- **Paid** → near payment  
- **Synced** → near calendar  
- **SMS unavailable** → near reminders / communication  

Do not create separate pages for every state.

---

#### 13. Badges are for state, not decoration

Controlled vocabulary. Examples:

**Appointment:** Scheduled · Confirmed · Completed · Canceled · No-show  

**Reminder:** Scheduled · Sending · Sent · Delivered · Failed · Suppressed  

**Calendar:** Synced · Pending · Needs attention · Disconnected  

Do not use green pill, blue pill, Active, Healthy, Ready for four concepts that mean the same thing. **One canonical term per concept.**

---

#### 14. Critical state must be readable without color

Use labels: **Connected**, **Needs attention**, **Failed** — with color/icons assisting, not replacing text.

---

### Empty, error, and async states

#### 15. Empty states must teach

**Bad:** No appointments.

**Good:**
```
No appointments yet
Appointments appear here when customers book or you add one manually.
[Create appointment]
```

Every important empty state answers:

1. What is this?  
2. Why would I use it?  
3. What should I do next?

---

#### 16. First-use state and empty state aren’t always the same

**Never connected:** Connect Microsoft to sync appointments and block unavailable times.

**Previously connected, broken:** Microsoft needs attention. We couldn’t refresh authorization.

Different situations → different UI.

---

#### 17. Error states must be actionable

**Bad:** Something went wrong.

**Good:** SMS reminder couldn’t be scheduled — imported appointments aren’t eligible for platform SMS. Complete business texting registration. **[Set up business texting]**

Problem + cause + next action.

---

#### 18. Show system status where asynchronous work happens

Show: **what is happening + latest state + when**

| Feature | Example |
|---------|---------|
| Calendar sync | Synced 3 minutes ago |
| SMS reminder | Scheduled for Sep 8 at 9:00 AM |
| Notetaker | Waiting for host admission |
| Transcript | Processing |
| Payment | Succeeded · $50.00 · 10:43 AM |

Not an afterthought.

---

#### 47. Every page must handle six states

For every significant page, design:

1. **Normal**  
2. **First-use / empty**  
3. **Loading**  
4. **Error**  
5. **Partial / degraded**  
6. **Success / completed**  

Mockups that only show #1 break in production.

---

#### 48. Every page must answer five questions immediately

Acceptance test — within seconds the user knows:

1. Where am I?  
2. What is this page for?  
3. What can I do here?  
4. What needs my attention?  
5. How do I get to the related thing I need next?

Fail one → redesign.

---

### Lists, tables, and layout

#### 19. Every list row needs predictable hierarchy

```
Primary identity     — Who / what?
Secondary context    — When, type, source
State                — Confirmed, paid
Actions              — One common action or overflow
```

Example:
```
Anthony Johnson
Initial Consultation · Tomorrow 2:00 PM
Confirmed · SMS scheduled                                    •••
```

Not twelve icons per row.

---

#### 20. Tables when comparison matters

Use tables to scan/compare across many objects (Contacts, Appointments list).

Do not turn complex detail into a table. Tables are for comparison, not because data exists.

---

#### 21. Cards are for grouping, not everything

Avoid card-inside-card-inside-card. Use cards for meaningful regions; white space can group too.

---

### Forms and configuration

#### 22. Forms follow one reading direction

Primarily **top-to-bottom**. Group semantically:

```
Basics — Name, Duration, Location
Hosts — Host strategy, Staff
Availability — Schedule, Buffers, Limits
```

Two columns only for strongly related short fields: `Start date | End date`, `First name | Last name`.

---

#### 23. Required information first

Order: required/common → optional/common → advanced → destructive/system

Not alphabetical. Not backend-model order.

---

#### 24. Hide conditional controls until relevant

**One host** → hide round-robin, required-host rules, seat capacity.

**Round robin** selected → reveal round-robin controls.

---

#### 25. Use sensible defaults

Preselect workspace timezone, primary calendar, default reminder sequence, 30-minute duration, no payment—when that matches most users.

---

#### 26. Advanced settings need hierarchy

No single dump called “Advanced Settings.”

- Booking Type → **Advanced booking rules**  
- Reminder Sequence → **Advanced timing**  
- Microsoft → **Advanced synchronization**  

Advanced lives **within** the object it affects.

---

#### 27. Save behavior must be predictable

**Editor pages:** Save changes top-right (and/or sticky when needed).

**Immediate toggles:** auto-save only if visibly communicated (`Saved`).

Do not mix silent save, auto-save, and manual save without clear indication.

---

#### 28. Unsaved changes must be protected

On navigate away with dirty form:

```
You have unsaved changes.
[Discard]  [Keep editing]
```

---

#### 29. Destructive actions in predictable places

Delete does not compete with Save.

```
Danger zone
Delete booking type
Permanently removes this booking type. Existing appointments remain.
[Delete]
```

---

#### 33. Page-specific settings stay close to the feature

Affects **this booking type** → Booking Type → Reminders  
Affects **every booking type** → Settings → Appointment defaults  

**Local first. Global defaults second.**

---

#### 34. Global settings provide defaults, not duplicate the app

Settings → Calendar: default write calendar, default conflict calendars.

Per-type availability stays under **Booking → Availability / Booking Type**.

Settings is not a second copy of the whole product.

---

### Surfaces: drawer, modal, wizard

#### 30. Use drawers when maintaining context matters

**Good for:** appointment detail from calendar, contact quick view, reminder detail, log detail.

Calendar → click appointment → **right drawer** → optional **Open full appointment**.

---

#### 31. Use modals for short, focused decisions

**Good:** confirm cancel, choose calendar, add one contact, confirm delete  

**Bad:** entire booking type editor, giant appointment form, workflow builder  

---

#### 32. Wizards for genuine multi-step setup

**Good:** business texting registration (ordered steps, clear completion)  

**Bad:** ordinary configuration turned into a wizard because there are many fields  

---

### Linking, timeline, diagnostics

#### 35. Related objects clickable, not copied

Appointment detail:

- **Customer: Anthony Johnson** → opens contact  
- **Meeting: Zoom · Sep 8** → opens recap  
- **Payment: $50 paid** → opens transaction  

Show enough context; link to the authoritative object.

---

#### 36. Timeline is the canonical “what happened?”

Especially for appointments. Example:

```
Sep 7 · 10:03 AM  Appointment booked via public booking page
Sep 7 · 10:03 AM  SMS consent recorded
Sep 7 · 10:04 AM  Microsoft event created
Sep 8 ·  9:00 AM  Reminder sent via SMS
Sep 8 ·  9:00 AM  Delivered
Sep 8 ·  9:14 AM  Customer replied YES
Sep 8 ·  9:14 AM  Appointment confirmed
```

One of the highest-value UX investments in the product.

---

#### 37. Diagnostics should be contextual

**At 2 PM unavailable:**
```
Unavailable
Microsoft Work Calendar — Team Meeting, 1:30–2:30 PM
```

**Reminder not scheduled:**
```
Not scheduled — Customer opted out of SMS.
```

Explain at the point of failure. Deep diagnostic pages are secondary.

---

#### 38. Show policy restrictions before users commit

Imported appointment without A2P:

Do not enable SMS toggle that fails later. Show:

```
SMS reminders 🔒
Business texting registration required for imported/manual appointments.
[Set up texting]
```

---

#### 49. Every feature gets one primary home

One **canonical management location**; multiple **access paths** only.

**Reminder sequences**  
- Primary: Automations → Reminder Sequences  
- Referenced from: Appointment, Booking Type, Calendar settings  
- Not: a separate full editor in each place  

---

### Responsive, interaction, and polish

#### 39. Responsive rules are structural

| Desktop | Mobile |
|---------|--------|
| Sidebar | Navigation drawer |
| Wide table | Rows/cards |
| Drawer | Full-screen sheet/page |
| Filter bar | Filter button/sheet |

Same IA. No horizontal overflow. Primary action stays obvious.

---

#### 40. Don’t hide core actions behind hover

Edit, Delete, Reschedule must work on touch, keyboard, and mouse.

---

#### 41. Keyboard and focus everywhere

Visible focus, logical tab order, modal focus trap, Escape closes appropriate surfaces, focus returns to trigger, labeled inputs, keyboard-accessible menus, visible errors.

---

#### 42. Loading preserves page structure

Skeleton rows, skeleton cards, calendar shell visible—not blank full-page spinners.

---

#### 43. Immediate feedback on every action

Save → loading → Saved. Create → processing → object appears + toast.

Never: click → nothing → maybe it worked.

---

#### 44. Toasts are confirmation, not the only record

“Appointment created” + the appointment **visible on the page**. Toasts must not be the only place critical info appears.

---

#### 45. Detail screens prioritize exceptions

When all is well: compact status rows.

When broken: **prominent** exception (SMS blocked, sync failed). Surface what needs attention.

---

#### 46. Don’t expose implementation terminology

No delta tokens, Graph subscription IDs, webhook lifecycle, idempotency keys, queue workers, orchestration service—in customer UI. Translate to user state.

---

## Page design worksheet (use before Kimi / implementation)

Copy this for each new or redesigned page:

```markdown
### Page: [Name]
**Archetype:** Dashboard | List | Calendar | Detail | Editor | Builder
**Primary job:** The purpose of this page is to ______.
**Domain:** Appointments | Booking | … (from UI Design Guide)
**Primary action:** ______
**Local nav:** ______ (or none)
**Control bar:** search / filters (list which)
**Primary workspace:** ______
**Drawer vs full page:** ______
**Six states designed:** empty / loading / error / degraded / success / normal
**Five questions pass:** Y/N each
**Canonical home for any nested feature:** ______
```

---

## Screen-by-screen spec (next pass)

With IA complete (`TRANSOVO-UI-DESIGN-GUIDE.md`) and page grammar defined (this document), the next deliverable is **page-by-page specification**:

For each domain (Home → Appointments → Booking → …):

- What appears above the fold  
- Sections and grouping  
- Buttons and actions  
- Drawer vs full page  
- Advanced / hidden settings  
- Empty, error, and async states  

That spec is what Kimi designs against. **Do not skip to pixels before completing the worksheet for each page.**

---

## Quick reject triggers (page level)

- Page has no single-sentence primary job  
- Title or primary action in a non-standard position  
- Primary action in sidebar instead of page header  
- Tabs used for Save/Delete/Export  
- Filters below the list or in the sidebar  
- Detail page with random section order (not Rule 11)  
- Empty state with no next action  
- Error with no fix path  
- Async feature with no visible state  
- Only the “happy path” designed (missing Rule 47 states)  
- Same feature with two full editors in different nav areas (violates Rule 49)  
- Long form trapped in a modal (Rule 31)  
- Core actions hover-only (Rule 40)  

---

*This document is the authoritative page architecture ruleset for Transovo. Pair it with `docs/TRANSOVO-UI-DESIGN-GUIDE.md` for every screen.*


===== [Visual design system (typography, color, spacing, motion, density)] docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md =====
# Transovo Visual Design Guide

**Status:** Active — required reference for all visual design and styling  
**Audience:** Engineers, designers, and Cursor agents (including Kimi) building Transovo UI  
**Layer:** Visual design system — **after** IA and page architecture, **before** individual page polish  

**Prerequisites (read in order):**

0. `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` — authority order, conflict resolution, system rules  
1. `docs/TRANSOVO-UI-DESIGN-GUIDE.md` — what goes where (IA, heuristics)  
2. `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` — how every page is structured  
3. **This document** — how everything looks, feels, scales, aligns, and behaves  

**Standards basis:** WCAG 2.2 (accessibility floor), professional design-system practice (semantic tokens, component states, restrained color), Gestalt hierarchy—not one company’s house style copied blindly.

**Related implementation (evolve toward this guide, do not bypass it):**

- Global tokens: `src/app/globals.css` (`:root`, `@theme inline`)
- Kimi surfaces: `src/styles/kimi/`
- Shared UI components: `src/components/ui/`

---

## When to use this guide

**Follow these rules whenever you:**

- Choose typography, color, spacing, radius, shadow, or motion  
- Style buttons, inputs, tables, badges, cards, drawers, modals, charts  
- Design empty, loading, error, or success states visually  
- Add a new component variant or “one-off” style on a page  

**Kimi must not design each page independently.** Design **within the Transovo system**.

If a visual choice conflicts with this guide, resolve it before shipping.

---

## The three questions this layer answers

| Layer | Question |
|-------|----------|
| IA | What goes where? |
| Page architecture | How is the page structured? |
| **Visual design** | How should it look, feel, scale, align, and behave so the product feels premium, consistent, and professional? |

---

## Visual direction (locked aesthetic)

**Professional, calm, precise, modern, medium-density operational SaaS.**

| Aim for | Avoid |
|---------|--------|
| Neutral foundation, one restrained accent | Futuristic AI neon, glowing gradients |
| Strong type hierarchy, deliberate spacing | Bubbly consumer SaaS, giant hero typography |
| Subtle borders, minimal shadow | Old gray enterprise boxes |
| Clear operational status | Giant-card startup dashboard |
| Advanced features quiet until needed | Decorative effects competing with data |

The product should feel comfortable for a dental office, consulting firm, sales team, healthcare office, or contractor to keep open all day.

**Density target:** Professional **medium-density** — not ultra-dense legacy enterprise, not luxurious consumer whitespace. ~14–16px body, compact-but-comfortable controls, efficient table rows, no giant in-app hero type.

---

## Design System Foundation (required before page redesign)

Do not let Kimi redesign Home, Appointments, or Booking until this foundation is specified and tokenized. Every page must consume it.

### Typography

- Font family (+ fallbacks)  
- Named size scale (display → caption)  
- Weight roles (regular / medium / semibold)  
- Line heights per text role  

### Color

- Page / surface / background levels  
- Primary / secondary / muted text  
- Borders (subtle, default, strong)  
- Accent (brand)  
- Semantic: success, warning, danger, info, neutral  
- Light theme tokens (+ dark theme if supported)  

### Spacing

- Base unit (4px grid)  
- Spacing scale  
- Page gutters  
- Section gaps (title→subtitle, header→tabs, section→content)  

### Shape

- Radius scale (controls, cards, panels, pills)  
- Border thickness  
- Elevation / shadows (when allowed)  

### Components (documented variants + states)

Buttons, inputs, selects, tabs, badges, alerts, cards, tables, drawers, modals, tooltips, dropdowns, toasts, skeletons.

Each component spec includes: **variants, sizes, states** (default, hover, pressed, focus, selected, disabled, loading, error).

### Interaction

Hover, active, selected, focus, disabled, loading, error — per component.

### Responsive

Breakpoints, sidebar behavior, drawer→sheet, table→cards, mobile spacing/type compression.

### Accessibility

WCAG AA contrast, focus visibility, 200% zoom, non-color state, touch targets, `prefers-reduced-motion`.

---

## Recommended token map (semantic)

Prefer **semantic** tokens over literal names (`blue500`, `gray300`).

```
color-bg-page
color-bg-surface
color-bg-surface-raised
color-text-primary
color-text-secondary
color-text-muted
color-text-disabled
color-border-subtle
color-border-default
color-accent
color-accent-foreground
color-status-success
color-status-warning
color-status-danger
color-status-info
color-focus-ring
```

Map existing `:root` variables in `globals.css` toward this vocabulary over time; new work should use semantic names.

---

## Typography scale (named roles)

Do not freestyle font sizes. Use **named roles** only.

| Role | Size (target) | Use |
|------|----------------|-----|
| Display | 32–36px | Rare hero only (marketing/onboarding) |
| Page title | 24–28px | Every page header |
| Section heading | 18–20px | In-page sections |
| Card heading | 16px | Card/panel titles |
| Body | 14–16px | Default reading |
| Secondary body | 13–14px | Supporting copy |
| Label | 12–13px | Form labels, table headers |
| Caption / metadata | 11–12px | Timestamps, hints |

**Weights:** regular (body), medium (labels/actions), semibold (headings). Avoid excessive bold (600–700 everywhere). No ultra-light weights in UI.

**Line height:** Define per role—not browser default. Body gets breathing room; dense labels can be tighter.

**One typeface family** for the app (e.g. Plus Jakarta Sans via `--font-sans` / `--font-display`). No mixing heading/body/nav fonts without deliberate brand reason.

**Prose width:** Explanatory text ~50–75 characters per line. Tables, calendars, builders may span wide.

**Alignment:** Left-align body, labels, settings, forms, table text. Center only for empty states, small confirmations, marketing/login—not operational pages.

**Capitalization:** **Sentence case** for UI labels (`New appointment`, `Booking types`). Pick one system; never drift.

---

## Spacing scale (4px base)

Use the scale—not random values.

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64
```

**Proximity = relationship:** title + subtitle (small gap) → status badges (moderate) → new section (large).

**Vertical rhythm:** Same gaps everywhere for title→subtitle, header→tabs, section→content, card→card, field→field.

---

## Surface hierarchy

| Level | Use |
|-------|-----|
| App background | Shell; subtle neutral |
| Primary content surface | Main workspace |
| Elevated surface | Cards, drawers; slight differentiation |
| Overlay surface | Modals, popovers; above scrim |

Not 15 slightly different grays. **Borders before heavy shadows** for B2B panels. Shadows for genuinely elevated UI: dropdowns, menus, popovers, modals, drawers—not every card.

---

## Radius system

| Element | Radius |
|---------|--------|
| Small controls | 4–6px |
| Cards / fields | 6–8px |
| Large panels | 8–12px |
| Pills | Full round **only** for compact states/categories |

Premium ≠ everything extremely round.

---

## Color discipline

**Most UI:** neutral backgrounds, neutral text, neutral borders.

**Color for:** primary action, active/selected state, semantic status, limited data viz—not decoration.

**One accent** for: primary action, active nav, selection, focus emphasis. If everything is accent-colored, accent means nothing.

**Semantic colors (fixed meanings):**

| Token | Meaning |
|-------|---------|
| Success / green | Successful, healthy, confirmed |
| Warning / amber | Needs attention |
| Danger / red | Error, destructive, failure |
| Info / accent | Active, interactive, informational |

Never swap meanings by page. **Never state with color alone** — always pair with label/icon (`Failed`, not red dot only).

**Contrast (WCAG AA minimum):** 4.5:1 normal text, 3:1 large text; ~3:1 for component boundaries/state indicators. No trendy ultra-light gray for labels, placeholders, or metadata.

**No transparency shortcuts** for text (`rgba(0,0,0,.45)` everywhere). Use defined `text-primary`, `text-secondary`, `text-muted`, `text-disabled` tokens.

**Dark mode:** Real theme tokens per role—not inverted white/black.

**Reserve red** for destructive/error. **Reserve accent** for meaningful interaction—not decorative backgrounds.

---

## Icons

- **One visual family** (e.g. Lucide): consistent stroke, corners, optical alignment  
- **Sizes:** 16 (small), 20 (standard), 24 (prominent)—not per-screen improvisation  
- **Icon + text** when concept is unfamiliar (Routing, Automations, AI booking)  
- Icon-only OK for search, close, more, back  

---

## Buttons

| Variant | Use |
|---------|-----|
| Primary | One dominant action per cluster |
| Secondary | Important, not dominant |
| Tertiary / ghost | Low-emphasis contextual |
| Destructive | Delete / revoke in danger zone |

**One primary button** per action cluster. Match visual hierarchy to consequence (Publish > Test > overflow > Delete).

**Heights:** compact / default / large — standardized; no 34, 39, 43px randomness.

**Touch targets:** ~44px effective hit area when practical (WCAG 2.5.8).

**States:** default, hover, pressed, focus, selected, disabled, loading — all designed. **Do not remove focus outline** without a visible replacement.

**Disabled:** Visually distinct + user must understand why (or link to fix). Not the default way to explain unavailable actions.

---

## Forms

**Anatomy (every field):**

```
Label
[ input                         ]
Helper text / error
```

Visible label always. Placeholder = example only (`name@example.com`), not the label.

**Order:** required/common → optional → advanced → destructive.

**Max widths** match content (business name ≠ 1200px wide; phone/ZIP/date = short).

**Errors:** color + marker + text (`⚠ Enter a complete email address.`).

**Validation timing:** not hostile red on every keystroke; blur/submit where appropriate; clear when fixed.

**Conditional fields:** hidden until relevant (round-robin controls only when round-robin selected).

**Defaults:** prefill sensible workspace defaults.

---

## Tables and data

- **Density** without cramping: consistent row height, aligned columns, quiet secondary text  
- **Right-align** numbers and money where comparison matters  
- **One date/time format system** (see Page Architecture Rules)  
- **Status density:** at most ~2 badges per row; rest in detail  
- **Row states:** hover, selected, focus — distinct and keyboard-accessible  
- **Full width** when comparison matters  

**Numbers:** `$1,250.00`, `23%`, `1,204` — consistent formatting.

---

## Cards, dividers, whitespace

**Cards** for distinct regions—not card-in-card-in-card. Prefer whitespace and section headings first.

**Whitespace** before borders/shadows for grouping.

**Dividers:** subtle, between true sections or table rows—not after every field.

---

## Motion

**Purpose:** show relationship, state transition, spatial context.

| Duration | Use |
|----------|-----|
| Fast | Small feedback, dropdowns |
| Moderate | Drawer, modal |
| Restrained | Page transitions |

Respect `prefers-reduced-motion`. No decorative bounce/pulse.

**Stability:** skeletons match final geometry; buttons don’t jump width on loading; tables don’t collapse to 20px.

---

## Charts and analytics

- **Separate palette** from UI accent (categorical, sequential, diverging)  
- **Chart only when pattern matters** — big KPI may beat a chart for `86%`  
- **Data ink:** quiet gridlines, clear labels, no gradient chart chrome  
- No 3D, no rainbow donuts without categorical need  

---

## Empty and loading states

**Empty:** compact, professional — icon, heading, short explanation, one action. Not enormous illustrations on operational pages.

**Loading:** skeleton shaped like final content (table rows, cards, detail blocks).

**Success:** subtle for toggles (`Saved`); more substantial for consequential flows (A2P submitted).

---

## Layout width by task

| Width | Pages |
|-------|--------|
| **Wide / full** | Calendar, tables, builders, analytics |
| **Medium** | Detail pages, booking type editor |
| **Narrow** | Settings forms, onboarding, confirmations |

Shell is consistent; **workspace width follows the job**.

**Desktop:** not overly airy—operational efficiency over landing-page whitespace.

**Navigation:** visually quieter than content. Active = clear; inactive = subdued; section labels = quietest.

---

## Drawers, modals, sticky UI

| Surface | Width |
|---------|--------|
| Modal small | Confirm delete |
| Modal medium | Add contact |
| Modal large | Complex preview only |
| Drawer standard / wide | Fixed tokens—not random per page |
| Mobile | Drawers → full-screen sheets |

**Sticky:** save bar, table header, calendar controls, builder toolbar — yes.  
**Not:** header + subheader + tabs + filters + banners all sticky.

**Tooltips:** supplementary only. Required info (why SMS disabled) must be visible or behind explicit info action.

**Truncation:** recovery via tooltip, detail view, or expand—not permanent loss of critical text.

---

## Visual emphasis budget

Per viewport, only a few elements demand strong attention:

- Page title  
- Primary action  
- One critical warning  
- Selected object  

If 8 colored cards + 5 bright buttons + 7 badges compete, hierarchy is broken.

**Healthy status** (`Connected`, `Synced`, `Paid`) = quiet. **Exceptions** = prominent.

---

## Alignment and grid

- Invisible alignment lines: titles, toolbars, columns, form labels share x-positions  
- Macro grid: sidebar + gutters + 12-column (or equivalent) content  
- **Optical alignment** for icons next to text (not only mathematical center)  

---

## Writing supports visual hierarchy

Short labels: `Needs attention`, `Send reminder`—not paragraph button text.

---

## Brand restraint

Brand through logo, accent, typography—not gradients and motifs on every operational page. No glassmorphism, glowing borders, animated backgrounds on productivity surfaces.

**Operational transparency** (reminder times, sync state, slot diagnostics) should look **clean**, not flashy—that is premium for Transovo.

---

## The 90 rules (index)

### System and hierarchy (1–11)

1. Build a system, not pretty one-offs — tokens for type, space, color, radius, borders, elevation, heights, icons, motion, breakpoints, status  
2. Visual hierarchy obvious before reading — size, weight, spacing, contrast, position, grouping; premium = quieter  
3. One primary typeface family  
4. Fixed typography scale with named roles  
5. Weight communicates hierarchy — regular / medium / semibold  
6. Line height per text style  
7. Constrain prose line length (~50–75 chars)  
8. Left-align operational text  
9. Spacing scale (4px base), no random margins  
10. Spacing communicates relationship (Gestalt proximity)  
11. Consistent vertical rhythm  

### Surfaces and shape (12–16)

12. Don’t overuse cards  
13. Clear surface hierarchy (background → content → elevated → overlay)  
14. Borders before heavy shadows  
15. Standardized radius scale  
16. Pills for compact states/categories only  

### Color and accessibility (17–23)

17. Restrained color — neutrals dominate  
18. One accent with clear meaning  
19. Fixed semantic color meanings  
20. Never state with color alone  
21. WCAG contrast minimums  
22. No transparency shortcuts for text — use text tokens  
23. Dark mode = real theme tokens  

### Icons and controls (24–32)

24. Single icon family, consistent size/weight  
25. Icons support labels for unfamiliar concepts  
26. Strict button hierarchy (variants)  
27. One primary button per cluster  
28. Standardized component heights  
29. Usable touch targets (~44px)  
30. Designed focus states (WCAG 2.4.11+)  
31. Full interactive states per component  
32. Disabled needs explanation, not mystery  

### Forms and tables (33–38)

33. Consistent input anatomy (label, field, helper/error)  
34. Errors: color + marker + text  
35. Table density without cramping  
36. Number alignment and formatting  
37. One date/time formatting system  
38. Controlled status density in rows  

### Layout polish (39–51)

39. Whitespace before decorative separators  
40. Subtle, purposeful dividers  
41. Motion clarifies state change  
42. Standard animation timing + reduced motion  
43. Charts have their own visual system  
44. Charts only when they reveal patterns  
45. Data ink favors meaning  
46. Empty states intentional, not broken-looking  
47. Loading skeletons match geometry  
48. Avoid visual jumping  
49. Responsive spacing/type scale (not 70% shrink)  
50. Content width responds to task type  
51. Desktop layouts not overly airy  

### Navigation and language (52–55)

52. Navigation quieter than content  
53. Selected state unmistakable but restrained  
54. Consistent capitalization (sentence case)  
55. Concise UI writing  

### Craft details (56–70)

56. Icons aligned to text baseline  
57. Restrained in-app branding  
58. Premium ≠ gradients everywhere  
59. Decorative effects never compete with data  
60. Consistency beats novelty — reuse components  
61. Documented component variants  
62. Semantic design tokens  
63. Accessibility part of visual design  
64. Errors win hierarchy over decoration  
65. Don’t make every healthy status loud  
66. Page density reflects frequency  
67. Explicit medium-density target  
68. Visual emphasis budget  
69. Alignment as design tool  
70. Optical alignment where needed  

### Grid, surfaces, responsive (71–81)

71. Macro layout grid  
72. Forms: controlled max widths  
73. Tables: use available width  
74. Modal width matches complexity  
75. Standard drawer widths  
76. Sticky UI sparingly  
77. Tooltips supplementary only  
78. Truncation with recovery path  
79. Row hover/selected/focus distinct  
80. Design for real messy content  
81. Layout survives i18n / longer strings  

### Forms and feedback (82–90)

82. Visible labels, not placeholder-as-label  
83. Validation at the right time  
84. Success feedback proportional to consequence  
85. Red reserved for destructive/error  
86. Accent reserved for meaningful interaction  
87. Typography and spacing carry most of the design  
88. Calm despite powerful functionality  
89. Clean status treatment exposes product quality  
90. **Foundation spec before page redesign** (see Design System Foundation above)  

---

## Component checklist (before shipping any new component)

```markdown
### Component: [Name]
**Variants:** ______
**Sizes:** compact / default / large
**States:** default, hover, pressed, focus, selected, disabled, loading, error
**Tokens used:** (semantic only)
**Contrast checked:** Y/N
**Focus visible:** Y/N
**Touch target:** Y/N
**Reduced motion:** Y/N
**Reuses existing component:** Y/N (if no, justify)
```

---

## Quick reject triggers (visual)

- New font size or gray not from scale/tokens  
- New button style “because it looks good on this page”  
- Card nested in card in card  
- Heavy shadow on every panel  
- Status communicated by color dot only  
- Placeholder used as label  
- Red or accent used decoratively  
- Icon-only for unfamiliar feature  
- Focus outline removed with no replacement  
- Chart when a KPI number suffices  
- Giant hero typography on operational page  
- 8+ competing emphasized elements in one viewport  
- Modal used for long complex editor  
- Random drawer/modal width  

---

## Doc stack (full UI pipeline)

```
0. TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md       → Authority & conflict resolution (read first)
1. TRANSOVO-UI-DESIGN-GUIDE.md                    → IA, mental models, heuristics
2. TRANSOVO-PAGE-ARCHITECTURE-RULES.md            → Page structure and behavior
3. TRANSOVO-VISUAL-DESIGN-GUIDE.md                → Look, feel, tokens, components
4. TRANSOVO-ACCESSIBILITY-STANDARDS.md            → Guide #1: WCAG 2.2 AA
5. TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md    → Guide #2: ISO 9241 HCD
6. TRANSOVO-IA-NAVIGATION-STANDARDS.md            → Guide #3: IA & navigation
7. TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Guide #4: Interaction, keyboard & focus
8. TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md   → Guide #5: Forms & validation
9. TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md   → Guide #6: Responsive/reflow/zoom
10. TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md    → Guide #7: Tables & grids
11. TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Guide #8: Privacy/consent/compliance
12. TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Guide #9: Security & authentication
13. TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Guide #10: Date/time/timezone/locale
14. TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Guide #11: Internationalization & localization
15. Page-by-page spec                             → Per-screen worksheet
16. Implementation in Kimi / components           → Must satisfy all applicable guides
```

---

*This document is the authoritative visual design ruleset for Transovo. Design within the system; do not freestyle per page.*


===== [Formal #1 — Accessibility (WCAG / ARIA)] docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md =====
# Transovo Accessibility Standards Guide

**Series:** Implementation standards · **Guide #1 of 12**  
**Status:** Active — mandatory hard standard for all UI and interactive features  
**Audience:** Engineers, designers, and Cursor agents building Transovo  
**Baseline:** **WCAG 2.2 Level AA** (mandatory floor)

---

## Master Cursor rule

> **Transovo accessibility baseline is WCAG 2.2 Level AA.** Use native semantic HTML wherever possible. When custom widgets are required, implement the corresponding **WAI-ARIA Authoring Practices** interaction model, including keyboard behavior, focus management, accessible naming, states and properties—not merely ARIA attributes. **Accessibility must be implemented during component/page construction, not added after visual completion.** A feature that cannot be completed with keyboard and assistive technology is **incomplete**.

**No feature is considered complete if its primary functionality:**

- requires a mouse  
- relies only on color  
- cannot be understood by assistive technology  
- loses functionality when zoomed/reflowed  
- exposes inaccessible custom controls  

---

## Primary authorities

| Authority | Scope |
|-----------|--------|
| **W3C WAI** | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Perceivable, Operable, Understandable, Robust; Level A / AA / AAA success criteria |
| **W3C WAI** | [WAI-ARIA](https://www.w3.org/TR/wai-aria/) + [Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/) — patterns for complex widgets |
| **U.S. Access Board** | [Section 508](https://www.access-board.gov/ict/) — ICT accessibility (incorporates WCAG for covered federal ICT) |
| **ETSI** | **EN 301 549** — European ICT accessibility (aligned with WCAG for web/software) |

**Implementation principle:** Prefer **native HTML semantics** wherever they express the required widget or behavior. Use ARIA only when native elements cannot.

**Procurement note:** Private SaaS is not automatically Section 508–covered, but building to **WCAG 2.2 AA** positions Transovo for customers with federal/European procurement requirements. Do not maintain two unrelated accessibility systems—one foundation: semantic web + WCAG conformance.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`  
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`  
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`  
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Core accessibility rule (WCAG four principles)

Every user must be able to:

| Principle | Meaning |
|-----------|---------|
| **Perceivable** | Information and UI components are presentable to users in ways they can perceive |
| **Operable** | UI components and navigation are operable |
| **Understandable** | Information and operation of the UI are understandable |
| **Robust** | Content is robust enough for assistive technologies and agents |

---

## B. Semantic HTML first

Always use native semantic elements where they match the task.

| Use | For |
|-----|-----|
| `<button>` | Actions |
| `<a>` | Navigation |
| `<input>`, `<select>`, `<textarea>` | Input (native select when appropriate) |
| `<table>` | Real tabular data |
| `<h1>`–`<h6>` | Document structure (not font size) |
| `<main>`, `<nav>`, `<header>`, `<aside>` | Landmarks |

**Do not:**

```html
<div onclick="save()">Save</div>
```

**Do:**

```html
<button type="button">Save</button>
```

Custom ARIA widgets require authors to implement keyboard and focus behavior; native controls provide much of this by default. W3C warns that custom ARIA GUI components need explicit keyboard support.

---

## C. Every control must have an accessible name

Every interactive control must expose its purpose **programmatically**.

**Good:** visible text — `<button>Cancel appointment</button>`  
**Acceptable when icon-only:** `<button aria-label="Close appointment">…</button>`

Applies to: buttons, inputs, toggles, calendar controls, row menus, filters, pagination, AI actions, recording controls.

WCAG requires controls and non-text interactive content to have text alternatives/names describing purpose.

---

## D. Keyboard access is mandatory

Every mouse action must be operable from keyboard unless the action inherently requires path-based motion (e.g. freehand drawing).

**Test:** Tab, Shift+Tab, Enter, Space, arrow keys (per pattern), Escape, Home/End where applicable.

Users must **never** become trapped in a control or region.

WAI-ARIA APG defines keyboard patterns and predictable focus movement for complex controls.

---

## E. Focus must always be visible

Never remove focus outlines without an **equally visible** replacement.

The user must always answer: **“Where is keyboard focus?”**

Applies to: sidebar links, tabs, buttons, fields, actionable cards, appointment rows, date-picker cells, workflow nodes, dialogs, dropdown items.

---

## F. Focus order must follow logical reading/task order

DOM/focus order should follow meaningful progression:

```
Page title → Primary action → Tabs → Filters → Results → Pagination
```

- Do not use CSS to appear visually first while remaining last in tab order.  
- Do not use positive `tabindex` to force arbitrary sequences.

---

## G. Modal dialogs have strict behavior

A true modal must:

1. Move focus **into** the modal when opened  
2. Keep Tab / Shift+Tab **inside** the modal  
3. Make background **inert** (non-interactive)  
4. Have an accessible **name/title**  
5. Provide obvious **close/cancel**  
6. Close with **Escape** where appropriate  
7. **Restore focus** to the triggering control on close  

Never implement a visually modal panel that leaves keyboard focus roaming behind it.

---

## H. Tabs must behave like tabs

If using a real tab interface:

- Container uses appropriate tab semantics (`tablist`, `tab`, `tabpanel`)  
- Active tab exposes **selected** state  
- Tab controls and panels are **associated**  
- Keyboard follows [tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) (e.g. Left/Right for horizontal tabs)  
- Focus and selection are **distinguishable**

Do not style a row of buttons as tabs without correct semantics and keyboard behavior.

---

## I. Comboboxes / autocomplete must follow APG

For staff search, contact picker, timezone, booking-type selector, etc.:

- Field exposes expanded/collapsed state  
- Popup associated with input  
- Keyboard: enter/leave/navigate results, Escape dismisses, Enter selects  
- Standard text-editing keys continue to work  

Do not build mouse-only custom dropdowns.

---

## J. Static table vs interactive grid — choose intentionally

| Pattern | When |
|---------|------|
| **Semantic `<table>`** | Read/compare tabular data (most appointment lists) |
| **ARIA grid** | Spreadsheet-like: cell nav, in-cell edit, complex selection |

ARIA grids require managed focus and directional-key navigation—substantially more complex. **Do not make every table an ARIA grid.**

---

## K. Headings must describe document structure

Use heading levels for **structure**, not font size. Style with CSS.

```
H1 Appointments
  H2 Today's appointments
  H2 Needs attention
  H2 Recent activity
```

Every page needs a clear primary **H1**.

---

## L. Landmarks must be meaningful

Expose structural regions: `navigation`, `main`, `header`, `complementary`/`aside` where appropriate so screen-reader users can jump between major sections.

---

## M. Color can never be the sole information carrier

Never rely only on green = confirmed, red = canceled, yellow = warning.

Always pair with **text** (and optionally icon): `Confirmed`, `Canceled`, `Needs attention`.

Color may reinforce; it cannot be the only signal.

Applies to: calendar events, appointment status, reminders, payments, charts, connection health, validation errors.

WCAG: color must not be the only visual means of conveying information, action, or state.

---

## N. Text contrast must meet WCAG AA

| Text | Minimum contrast |
|------|------------------|
| Normal text | **4.5:1** |
| Large text (≥18pt / 14pt bold) | **3:1** |

Applies to helper text, captions, placeholders (when they convey info), table text, sidebar text—not only body copy.

---

## O. Important non-text UI needs sufficient contrast

Focus indicators, field boundaries, and states needed to operate the UI must remain discernible (~**3:1** for UI components per WCAG / design-system practice).

Checkbox boundaries, selected states, and focus rings cannot be imperceptibly faint.

---

## P. Do not rely on hover

Essential information or actions on hover must also be available via:

- keyboard focus  
- touch interaction  
- persistent visible control  

Especially: row actions, tooltips, menus, calendar actions, workflow nodes.

---

## Q. Tooltips must be accessible

- Work from keyboard focus  
- Must not contain **required** information unavailable elsewhere  
- Must not disappear before user can perceive  
- Cannot be sole explanation for critical restrictions  

**Bad:** Disabled SMS button; explanation only in hover tooltip.  
**Good:** `SMS unavailable` + `Business texting registration required.` visible or via explicit info action.

---

## R. Forms require persistent labels

Never use placeholder as the only label.

```
Email address
[ name@example.com ]
```

Labels must be **programmatically associated** (`<label for=…>`, `aria-labelledby`, etc.).

---

## S. Required and optional status must be understandable

Do not rely only on red `*`. Explain asterisk meaning globally, or use:

```
Email address
Notes — Optional
```

Be consistent across Transovo.

---

## T. Form instructions before they are needed

Format requirements, phone rules, password rules, A2P fields—explain **before or during** entry, not only after rejection.

---

## U. Errors must identify field and problem

**Bad:** `Invalid.`  
**Good:** `Enter a valid email address.`

Errors need **text**, not only red border/icon/color. Long forms: consider error summary with links to fields.

---

## V. Errors must preserve entered data

Server validation failure must not erase completed forms—especially booking-type setup, A2P registration, org settings, payment setup, workflows.

---

## W. Status messages must be exposed to assistive technology

When status changes without moving focus (`Saved`, `Appointment created`, `Sync failed`), use appropriate **live region** / status semantics—without making every tiny change aggressively interruptive.

---

## X. Dynamic loading must announce meaningful state

For calendar sync, AI processing, transcription, payments, reminders:

- `Syncing calendar` → `Calendar synced` or `Calendar sync failed`  
- Loading must not make the interface disappear from AT without explanation  

---

## Y. Touch targets must be sufficiently usable

**Practical standard:** ~**44×44 CSS px** effective hit area for important touch controls (WCAG 2.2 target size at AA; AAA is stricter).

Icon may be 16–20px; hit area must still be usable. No microscopic close buttons or overflow menus.

---

## Z. Content must survive zoom and reflow

Users must enlarge content substantially (WCAG: **200% zoom** without loss of content/function) without overlap, clipped controls, or required horizontal scroll for ordinary reading.

---

## AA. Do not lock orientation unnecessarily

Responsive web product works in available orientations unless orientation is essential to function.

---

## AB. Accessible names should match visible labels

If button shows `Reconnect Microsoft`, accessible name should not be `Retry authorization flow button` unless strongly justified. Helps voice-control users.

---

## AC. Links and buttons must not be confused

| Element | Use |
|---------|-----|
| **Link** (`<a>`) | Navigates (URL change) |
| **Button** | Performs action in place |

`Open contact` → link. `Save changes` → button. `Delete appointment` → button.

---

## AD. No drag-and-drop-only interactions

Reorder booking types, move appointments, workflow connections, scheduling drag—must have **non-pointer alternative** for the same operation.

---

## AE. Calendar interaction must not be mouse-only

Users must navigate dates, open/create appointments, inspect events, and perform required actions without precise pointer interaction. Drag may be an **accelerator**, not the only method.

---

## AF. Charts need accessible equivalents

Essential information cannot live only in the chart. Provide labels, values, descriptions, and underlying table/data where appropriate. Do not differentiate important series by color alone.

---

## AG. Recording and media controls must be accessible

Notetaker: play/pause keyboard-operable, state communicated, transcript available, meaningful labels, captions/transcript where relevant.

---

## AH. Notifications cannot steal focus arbitrarily

`Reminder delivered` should **announce**, not move focus away from current task. Reserve focus changes for interactions that require immediate user action.

---

## AI. Focus must return intelligently after temporary UI closes

- Action menu closed → focus returns to menu trigger  
- Modal canceled → focus returns to opener  
- Item deleted → focus moves to meaningful adjacent target, not top of document  

---

## AJ. Hidden content must be hidden from AT when appropriate

Inactive tab panels, modal background, collapsed accordions, removed conditional fields—inactive content must not remain focusable in the accessibility tree.

---

## AK. Disabled state must be programmatically conveyed

`disabled` / `aria-disabled` semantically—not only gray styling. If **why** matters, explain nearby:

```
SMS reminders unavailable
Complete business texting registration for imported appointments.
```

---

## AL. Navigation must be consistent

Same global sidebar, main areas, terminology, placement (aligns with IA guide). WCAG / Section 508 consistent navigation expectations.

---

## AM. Same function → same identification

`More actions` vs `Options` for the same control type—avoid without reason. `Close` / `X` behavior consistent everywhere.

---

## AN. Avoid unexpected context changes

Selecting from dropdown must not unexpectedly submit, navigate, or erase work unless clearly informed. Focus change alone must not trigger destructive behavior.

---

## AO. Time limits treated carefully

Session expiry or timed actions: warn, allow extension where possible, preserve entered work. Do not silently destroy a 20-minute setup form.

---

## AP. Auto-updating content must not overwhelm

Inbox, appointments, workflow logs, calendar sync—avoid constant reordering under the user. Preserve position and context.

---

## AQ. Flashing content avoided

No flashing visual effects. Calm status transitions.

---

## AR. Motion must respect user preferences

Honor `prefers-reduced-motion` for non-essential animation (drawers, loading, expand/collapse).

---

## AS. Page language must be declared

`<html lang="en">` (or appropriate). Mark language changes in content portions where needed (WCAG Understandable).

---

## AT. Responsive layout must preserve reading order

Mobile CSS must not invert visual vs DOM/screen-reader order in ways that confuse task flow.

---

## AU. Screen-reader-only text when visual context is insufficient

Icon-only delete in Anthony’s row → `Delete Anthony Johnson's appointment`—not verbose everywhere, but contextual when it helps.

---

## AV. Decorative images/icons should not create noise

If visible text already conveys meaning (`Connected`), decorative check icon → `aria-hidden="true"`.

---

## AW. Custom components must implement the full interaction contract

ARIA role alone is **not enough**. Must implement:

- Keyboard behavior (per APG)  
- Focus management  
- States and properties (`aria-expanded`, `aria-selected`, etc.)  
- Accessible naming  
- Screen-reader behavior  

---

## AX. Accessibility testing must include keyboard testing

For every major page/component:

1. Ignore the mouse  
2. Complete primary task by keyboard  
3. Verify visible focus  
4. Verify no traps  
5. Verify modal/menu/tab/calendar behavior  
6. Verify all required operations reachable  

Automated tools **supplement**; they do not replace manual keyboard QA.

---

## AY. Screen-reader testing for critical patterns

Practical AT verification minimum for:

- Login / onboarding  
- Appointment create & manage  
- Booking page  
- Payment  
- Messaging  
- Modals / dialogs  
- Workflow UI  
- **Calendar** (high risk)  
- Any custom control  

---

## AZ. WCAG AA is the floor, not always the ceiling

| Level | Transovo policy |
|-------|-----------------|
| **A** | Subset of AA |
| **AA** | **Mandatory baseline** |
| **AAA** | Use individual techniques when practical and high value—not a blanket engineering requirement |

---

## Transovo accessibility acceptance checklist

A page or feature is **not complete** until all applicable items pass:

- [ ] Semantic HTML used wherever native semantics exist  
- [ ] Every interactive element has an accessible name  
- [ ] Entire primary workflow usable by keyboard  
- [ ] Logical Tab/focus order  
- [ ] Visible focus indicator  
- [ ] No keyboard traps  
- [ ] Modal focus correctly contained and restored  
- [ ] Tabs/comboboxes/grids use appropriate WAI-ARIA behavior  
- [ ] One logical page H1  
- [ ] Logical heading hierarchy  
- [ ] Appropriate landmarks  
- [ ] Text contrast meets WCAG AA  
- [ ] UI state not communicated by color alone  
- [ ] Interactive boundaries/states sufficiently visible  
- [ ] Persistent labels on form controls  
- [ ] Errors associated with affected controls  
- [ ] Errors described in text  
- [ ] Entered form values preserved after validation failures  
- [ ] Dynamic status changes exposed appropriately  
- [ ] Touch targets usable (~44px where feasible)  
- [ ] Responsive reflow preserves content/function  
- [ ] 200% zoom remains functional  
- [ ] No required hover-only interaction  
- [ ] Drag/drop has equivalent alternative  
- [ ] Charts have accessible data/labels  
- [ ] Media controls accessible  
- [ ] `prefers-reduced-motion` honored  
- [ ] Disabled state programmatically conveyed  
- [ ] Hidden content removed from focus/AT when appropriate  
- [ ] Navigation and component naming consistent  
- [ ] Real keyboard QA performed  
- [ ] Critical custom components receive assistive-technology QA  

---

## High-risk Transovo components (extra scrutiny)

| Component | Requirements |
|-----------|----------------|
| **Appointment calendar** | Full keyboard nav; drag optional; event state not color-only |
| **Combobox / pickers** | APG combobox pattern |
| **Data tables** | Semantic table unless true grid needed; row actions keyboard-accessible |
| **Modals / drawers** | Focus trap, restore, Escape |
| **Workflow builder** | Non-drag alternatives for connections/reorder |
| **Notetaker / media** | Controls, transcript, state |
| **Status-heavy surfaces** | Live regions, text labels, async state |

---

## Implementation stack (where this guide sits)

```
TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md → Authority & conflict resolution (read first)
TRANSOVO-UI-DESIGN-GUIDE.md           → IA
TRANSOVO-PAGE-ARCHITECTURE-RULES.md   → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md       → Visual tokens & components
TRANSOVO-ACCESSIBILITY-STANDARDS.md        → WCAG 2.2 AA + ARIA (this file) ← hard standard
TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md → ISO 9241 HCD
TRANSOVO-IA-NAVIGATION-STANDARDS.md        → IA & navigation
TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md   → Date/time/timezone/locale
TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
```

**Build accessibility into components at construction time.** Retrofitting after visual completion is not acceptable.

---

*Guide #1: Accessibility Standards. Next: Guide #2 — `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` · Guide #3 — `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #4 — `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md` · Guide #5 — `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · Guide #6 — `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · Guide #7 — `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*


===== [Formal #2 — Human-Centered Design (ISO 9241)] docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md =====
# Transovo Human-Centered Design & Usability Standards Guide

**Series:** Implementation standards · **Guide #2 of 12**  
**Status:** Active — mandatory standard for feature conception, organization, simplification, evaluation, and refinement  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Not:** A visual-style guide (see `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`)

---

## Master Cursor rule

> **Transovo follows ISO 9241 human-centered design and usability principles.** Every significant feature must be designed from an **explicit understanding of the user, goal, task, and context of use**. Usability is judged by **effectiveness, efficiency, and satisfaction**—not by visual appearance or technical reachability alone. Follow an iterative process of **understanding context → defining user requirements → producing design solutions → evaluating those solutions**. Interfaces must be suitable for the task, self-descriptive, conform to user expectations, learnable, controllable, error-tolerant, and appropriately adaptable. Minimize unnecessary steps and cognitive load, preserve user context and work, use strong defaults, progressively disclose complexity, and **evaluate complete realistic workflows** rather than isolated screens.

**A feature that is technically reachable but hard to complete correctly is not usable.**

---

## Primary authorities

| Standard | Focus |
|----------|--------|
| **ISO 9241-210:2019** | Human-centred design for interactive systems (confirmed 2025) |
| **ISO 9241-11:2018** | Usability: definitions and concepts (effectiveness, efficiency, satisfaction) |
| **ISO 9241-110** | Interaction principles (suitability for task, self-descriptiveness, etc.) |
| **NIST Human-Centered Design guidance** | Summarizes ISO HCD principles and activities |

**Governing definition:** A system is usable when **specified users** achieve **specified goals** **effectively, efficiently, and satisfactorily** in the **actual context of use**—not because it looks clean.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`  
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`  
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`  
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`  
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Usability has three mandatory dimensions (ISO 9241-11)

| Dimension | Question |
|-----------|----------|
| **Effectiveness** | Can users complete the intended task accurately and completely? |
| **Efficiency** | How much effort, time, and resources does it take? |
| **Satisfaction** | Does interaction meet physical, cognitive, and emotional needs? |

**Cursor rule:** Never evaluate UI solely by whether a feature is technically reachable.

For Transovo, ask on every flow:

- Did they find it?  
- Did they understand it?  
- Did they configure it correctly?  
- How many steps?  
- Did they know whether it worked?  
- Could they recover if something went wrong?

“A user eventually figured out reminders” is **not** enough.

---

## B. Design from explicit understanding of users

Do not design for “the average user.” Identify actual user types.

**Transovo examples:**

- Solo business owner  
- Receptionist / front-desk staff  
- Scheduler  
- Office manager  
- Provider / staff member  
- Team administrator  
- Owner reviewing analytics  

Each differs in: permissions, frequency, expertise, goals, urgency, device, environment.

**Cursor rule:** Before designing or restructuring a feature, state **primary user**, **primary task**, and **context of use**.

---

## C. Design around user goals, not software capabilities

| Bad (capability) | Better (goal) |
|------------------|---------------|
| Expose calendar-import rules | Let the office control which imported appointments receive reminders |
| Surface workflow nodes | Let the business automatically follow up when a customer no-shows |

User goal is primary; implementation is secondary.

---

## D. Context of use is part of usability

Context includes: desktop at office, phone away from desk, busy receptionist on a call, owner at night, weak network, high appointment volume, multiple calendars.

**Cursor rule:** Optimize for **realistic conditions**, not ideal mockup conditions.

---

## E. Users involved throughout design and development

User evaluation is not a final QA step. Understand behavior → validate terminology → test hierarchy → test prototypes → observe tasks → refine → retest.

**Cursor rule:** Code/design assumptions are **hypotheses** until validated against realistic user tasks.

---

## F. Evaluation drives design

```
Understand → Design → Evaluate → Fix → Evaluate again
```

Not: build everything → launch → hope.

Especially for: navigation, booking, calendar config, reminders, A2P onboarding, AI booking, workflow builder.

---

## G. Human-centered design is iterative

Do not treat the first implementation as final. Preserve architecture so experience can refine **without rebuilding business logic**. Avoid coupling logic to one temporary UI layout.

---

## H. Consider the whole user experience

Evaluate **complete journeys**, not isolated screens.

**Microsoft connection** includes: why connect, choose calendars, success, sync status, token refresh, degraded state, recovery, disconnect, availability effects.

**SMS registration** includes: learn why → submit → status → wait → approval/failure → send SMS.

---

## I. Multidisciplinary perspectives

Check features against: product logic, UX, accessibility, engineering, compliance, security, content, data integrity.

A2P can “work” technically and still fail on language, consent framing, accessibility, status, recovery, eligibility behavior.

---

## J. Four core HCD activities (ISO / NIST)

1. **Understand and specify context of use** — Who? What goal? Under what conditions?  
2. **Specify user requirements** — What must the user achieve? (not technical reqs yet)  
3. **Produce design solutions** — Interaction, page, flow  
4. **Evaluate the design** — Does it satisfy user requirements?

Follow this sequence before substantial redesign.

---

## K. Every feature needs an explicit user requirement

**Not enough:** Feature: appointment waitlist.

**Better:** A scheduler must see customers waiting for an opening, offer a newly available slot, and know whether it was accepted without cross-referencing multiple screens.

**Better:** A business must determine why an appointment did not receive an SMS reminder without contacting support.

Requirements must be **testable**.

---

## L. Suitability for the task (ISO 9241-110)

Support the task without unnecessary operations or irrelevant information.

Manual appointment creation should not require: Booking → configure type → Contacts → Calendar Settings → return—if the user only needs customer + type + date/time + save.

**Cursor rule:** Remove steps, fields, navigation, and information that do not materially contribute to the **current task**.

---

## M. Self-descriptiveness

At any point, the interface should make apparent: what is happening, what can be done, what controls mean, what the result will be.

| Bad | Better |
|-----|--------|
| Advanced | Advanced reminder timing |
| Status: Pending | Registration submitted — carrier review pending |

**Cursor rule:** Normal state and actions should not require documentation.

---

## N. Conformity with user expectations

Behave according to known conventions:

- Row click opens object  
- Save persists; Cancel doesn’t save  
- Trash = delete; Search searches  
- Tabs = peer views; Back = previous context  
- Checkbox = independent boolean  

Do not invent novel interactions without strong reason.

---

## O. Preserve terminology users understand

Use: appointment, customer/contact, calendar, reminder, booking page, confirmation, payment.

Do not expose: orchestration, trigger processor, provider event, campaign binding, delta sync token—except in developer/diagnostic contexts.

---

## P. Suitability for learning

Help users learn naturally: predictable structure, repeated patterns, defaults, empty states, contextual explanation, progressive disclosure, consistent terminology.

Users should get **faster** with experience. Relearning every visit violates this principle.

---

## Q. Do not require unnecessary memorization

If users must remember “imported-event SMS is under Settings → Messaging → Calendar Sources…”, the system failed.

Show state directly: `SMS unavailable for this imported appointment` + `Set up business texting`.

---

## R. Controllability

Users initiate and control interactions: cancel, undo when feasible, stop AI/recording, disable workflow, reschedule vs delete/recreate, choose calendars, change reminders, exit wizards.

**Cursor rule:** Do not trap users in irreversible or system-driven flows.

---

## S. Consequential actions require appropriate control

Cancel appointment, refund, delete workflow, revoke recording, disconnect calendar, publish automation—consequences understandable **before** completion.

Proportional safeguards; not every harmless action needs a modal.

---

## T. Error tolerance

Allow intended results with minimal corrective effort: normalize phones, prevent double submit, preserve form data, undo moves, detect conflicts before save, validate reminder timing, block invalid workflow publish.

**Cursor rule:** Prevent, absorb, or cheaply correct errors—don’t punish users.

---

## U. Distinguish user error from system failure

ISO use error: mismatch among user, interface, task, environment.

**Bad:** “The user entered it wrong.”  
**Better:** “Why did the interface make this mistake easy?”

Repeated wrong calendars, SMS confusion, accidental reminder disable, incomplete workflows → likely **design issue**.

---

## V. Suitability for individualization

Support meaningful adaptation: timezone, calendar prefs, saved filters, reminder defaults, roles, staff schedules, booking-type defaults, notifications.

Not every pixel customizable—only adaptation that improves tasks.

---

## W. Defaults should work for most users

Strong defaults first; adjustment second.

Default reminder sequence works immediately; advanced users customize time, channels, stop-on-reply, weekends, per-calendar behavior.

---

## X. Minimize unnecessary cognitive load

Reduce: unnecessary choices, duplicate concepts, hidden dependencies, unexplained technical states, giant forms, long instructions, inconsistent labels.

Powerful feature ≠ complex screen by default.

---

## Y. Progressive disclosure for complexity

Booking type initially: name, duration, host, availability.

**Round robin** selected → eligible hosts, distribution.  
**Group** selected → capacity, attendee behavior.

Do not show every scheduling model at once.

---

## Z. Preserve context across related tasks

| From | Carry forward |
|------|----------------|
| Contact → Book | Contact selected |
| Appointment → Message | Recipient + appointment |
| Appointment → Payment | Customer, amount |
| Meeting recap → Follow up | Meeting, contact |

**Cursor rule:** Carry forward what the system already knows.

---

## AA. Minimize mode errors

Make modes obvious: draft vs published, read-only vs editable, test vs live, staff vs admin, platform-SMS vs business-A2P, selected calendar vs all.

User should never wonder: “Am I changing the real thing?”

---

## AB. Avoid unnecessary interruptions

No excessive modals, trivial confirmations, random banners, repeated onboarding, success dialogs for every save.

Interrupt only when attention is genuinely required.

---

## AC. Frequency should influence prominence

High-frequency (easy access): create appointment, reschedule, search contact, reply, view calendar.

Lower-frequency: SAML, org permissions, A2P, retention policy.

**Cursor rule:** Optimize prominence and interaction cost around **real task frequency**.

---

## AD. Criticality should also influence prominence

Rare but dangerous: calendar disconnected, reminders failing, payment broken—need **high visibility** despite low frequency.

Prioritize by: **frequency + importance + risk**.

---

## AE. Design for novice and experienced users

| Novice | Expert |
|--------|--------|
| Clear labels, defaults, guidance, templates | Shortcuts, bulk, clone, saved filters, keyboard, advanced config |

Don’t force power features on beginners; don’t cripple experts permanently.

---

## AF. Optimize primary workflows before edge workflows

**Create appointment → sync calendar → schedule reminder → confirmation** must be extremely strong before polishing rare enterprise settings.

---

## AG. Use measurable usability requirements

| Dimension | Examples |
|-----------|----------|
| **Effectiveness** | Completion rate, error rate, successful outcome |
| **Efficiency** | Time on task, steps, backtracking, support tickets |
| **Satisfaction** | Ease, confidence, frustration, perceived complexity |

Design should make these **measurable** (even if metrics are collected later).

---

## AH. Define success criteria before redesigning

**Task:** Create manual appointment.

**User requirement:** Staff with normal permissions creates appointment for existing/new contact, chooses type/date/time, enables reminders, saves without leaving workflow.

**Success:** Completes correctly; no unnecessary navigation; conflict before save; calendar sync visible; reminders visible after.

Better than: “Make New Appointment cleaner.”

---

## AI. Evaluate realistic complete tasks

Test scenarios, not isolated buttons:

- “Customer called—move Tuesday to Thursday; reminders update.”  
- “Why doesn’t booking offer 2 PM when Microsoft shows busy?”  
- “Imported appointment didn’t get SMS—find out why.”  
- “Create workflow to follow up after no-show.”

---

## AJ. Test navigation without finished UI

Card sort / tree test: categories, labels, expected paths—**before** polishing pages. Early evaluation is cheaper (NIST / ISO).

---

## AK. Evaluate prototypes before expensive implementation

High-value early evaluation: onboarding, appointment detail, Booking Type editor, Availability, Reminder Sequence, A2P, AI Booking, Workflow builder.

Establish flow/structure before visual polish or heavy implementation.

---

## AL. Users should always know current system state

`Microsoft — Synced 3 minutes ago`  
`SMS reminder — Scheduled for tomorrow, 9 AM`  
`Notetaker — Waiting for admission`  
`Payment — Processing`

Do not force inference.

---

## AM. Expose cause when it affects user action

| Weak | Strong |
|------|--------|
| Unavailable | Unavailable — blocked by Microsoft Work Calendar, 1:30–2:30 PM |
| SMS disabled | SMS unavailable for imported appointments until business texting registration is completed |

---

## AN. Don’t expose irrelevant implementation details

**Good:** Microsoft needs to be reconnected.  
**Bad:** `refresh_token returned AADSTS700082 from v2 token endpoint`.

Engineering details → diagnostics/logging.

---

## AO. Keep conceptual models stable

Once users learn Appointment, Booking Type, Reminder Sequence, Workflow, Meeting—do not rename across pages.

---

## AP. One object, one authoritative representation

Do not create separate user-facing entities for “booking appointment,” “calendar appointment,” “AI appointment,” “imported appointment.”

They are all **Appointments** with different **origins**.

---

## AQ. Multiple paths good; duplicate objects bad

Same appointment from Home, Calendar, Contact, Search, Meeting, Message—all paths → **same state and behavior**.

---

## AR. Do not require unnecessary setup before value

Booking-page-only user should not be forced through A2P if platform-consent SMS covers their case. Non-notetaker user should not configure notetaker in onboarding.

Respect actual goals over product completeness.

---

## AS. Reveal advanced capability at point of need

Imported appointment: `SMS unavailable` + `Register business texting…` at that moment—not lengthy A2P dump on every signup.

---

## AT. Preserve user work through system interruptions

Microsoft fail, network drop, AI timeout, payment error, validation reject—**preserve entered data** when feasible.

---

## AU. Support recovery without rework

Invalid workflow step → highlight problem, preserve rest.  
Calendar auth expired → reconnect, keep mappings.  
Payment failed → retry, don’t recreate appointment.

---

## AV. Don’t force irrelevant information

Reschedule: show current time, available slots, reminder/calendar impact—not every appointment field again.

---

## AW. Meaningful grouping around tasks

Booking Type sections: Basics, Hosts & capacity, Availability, Customer information, Reminders, Payment, Confirmation, Permissions—not database tables.

---

## AX. User-facing complexity grows with task complexity

Change time = simple. Build conditional automation = complex workspace OK.

System complexity must not leak into simple tasks.

---

## AY. Avoid redundant data entry

Prefill contact fields, booking-type duration/location. Override only when needed.

---

## AZ. Least destructive recovery path

Calendar auth lost → reconnect, don’t delete mappings.  
Workflow publish fails → keep draft, explain problem.

---

## BA. Design around interruptions and resumability

Receptionist interrupted mid-appointment; manager returns to A2P later—preserve progress or clearly state what’s saved.

---

## BB. Support verification after consequential actions

Create appointment → visible in calendar/list.  
Schedule reminder → exact time visible.  
Connect Microsoft → calendars + last sync visible.  
Payment → status on appointment.

Not toast alone.

---

## BC. Keep feedback proportional

Small: `Saved.`  
Large: `Appointment canceled. Future reminders stopped and Microsoft event updated.`

---

## BD. User choices must have predictable scope

“Default reminder sequence” must clarify: new only? existing future? all booking types? one calendar?

Scope ambiguity = usability failure.

---

## BE. Expose inheritance/override relationships clearly

Organization → calendar → booking type → appointment override.

```
Reminder sequence
Workspace default: Standard reminders
Use default / Override for this appointment
```

No silent overrides.

---

## BF. Make automation consequences understandable

Before publish: triggers, recipients, timing, scope. Preview/simulation preferred over blind publish.

---

## BG. AI must not obscure deterministic outcomes

AI Booking: user needs confidence appointment was created, time available, identity correct, calendar updated. **System state is authoritative**; AI phrasing is secondary.

---

## BH. Human fallback preserves conversation context

Don’t only say “Contact support.” Hand off with: customer, requested time, conversation, fields gathered, failure reason.

---

## BI. Evaluate satisfaction as well as completion

Registration completed but user says “I had no idea why”—effectiveness passes, satisfaction fails.

---

## BJ. Don’t optimize one user at expense of another without intent

Dense calendar helps receptionist, hurts mobile—decide priorities and provide alternatives.

---

## BK. Every major feature needs context-of-use statement

```markdown
Feature: Appointment calendar
Primary users: receptionist, owner/operator, scheduler
Primary goals: see schedule, find/create/reschedule/cancel, identify exceptions
Context: frequent daily desktop, occasional mobile, moderate/high volume
```

---

## BL. Every major feature needs usability requirements

```markdown
Feature: Reminder diagnostics
User requirements:
- determine whether reminder is scheduled
- see exact send time and delivery state
- see why suppressed/failed
- understand corrective action
```

---

## BM. Evaluate against realistic data volume

Test: 2 vs 200 appointments, long names, multiple recipients, many calendars/workflows, large transcripts.

---

## BN. Evaluate novice and repeat use separately

First-time: can they understand? Repeat: can they do it quickly? Onboarding vs shortcuts.

---

## BO. Qualitative and quantitative evaluation

Observe confusion and terminology; measure completion, time, errors, abandonment, backtracking.

---

## BP. Preference alone is not usability evidence

“I like this screen” ≠ usable. Observe findability, completion, errors, time, outcome understanding.

---

## BQ. Design changes trace to user need

Every move/hide/modal needs reason tied to: user goal, context, frequency, errors, efficiency, learnability, clarity—not merely “looks cleaner.”

---

## BR. Document the design process for major redesigns

1. User/task/context  
2. User requirements  
3. Proposed structure  
4. Design solution  
5. Evaluation  
6. Findings  
7. Changes  

---

## BS. HCD applies throughout the lifecycle

New features, redesigns, integrations, bug fixes affecting workflows, mobile, enterprise—all subject to these rules (ISO 9241-210).

---

## BT. Implementation success ≠ UX success

**Hard Cursor rule:**

| Can be true | And still fail |
|-------------|----------------|
| API works | Unusable |
| Database writes | Confusing |
| UI renders | Inefficient |

Feature certification and usability certification are **different layers**.

---

## Transovo Human-Centered Design acceptance checklist

For each significant page/flow:

- [ ] Primary user(s) identified  
- [ ] Primary user goal identified  
- [ ] Context of use documented  
- [ ] User requirement stated in outcome terms  
- [ ] Primary task can be completed correctly  
- [ ] Unnecessary steps removed  
- [ ] Unnecessary information removed  
- [ ] Terminology matches user expectations  
- [ ] Current state is understandable  
- [ ] Controls are self-descriptive  
- [ ] Common behavior follows familiar conventions  
- [ ] First-time use is learnable  
- [ ] Repeat use is efficient  
- [ ] User retains appropriate control  
- [ ] Consequential actions are understandable  
- [ ] Errors prevented where possible  
- [ ] Errors recoverable with low effort  
- [ ] User work preserved after failure where feasible  
- [ ] Defaults support common use  
- [ ] Advanced complexity progressively disclosed  
- [ ] Related context carried forward automatically  
- [ ] Settings clearly communicate scope  
- [ ] Default/inheritance/override behavior clear  
- [ ] Important asynchronous state visible  
- [ ] Critical causes explained at user level  
- [ ] Primary workflow tested with realistic scenarios  
- [ ] Realistic data volumes considered  
- [ ] Novice and repeat use considered  
- [ ] Whole journey evaluated, not isolated screen  
- [ ] Design iterable without rebuilding business logic  

---

## Feature worksheet (use before major UX work)

```markdown
### Feature: [Name]

**Context of use**
- Primary users:
- Primary goals:
- Context (device, frequency, volume, interruptions):

**User requirements** (outcome terms, testable)
1.
2.

**Success criteria** (effectiveness / efficiency / satisfaction)
-

**Primary workflow steps** (minimum necessary)
-

**Whole journey** (including setup, failure, recovery)
-

**Defaults**
-

**Progressive disclosure** (what’s hidden until needed)
-

**Inheritance / override** (org → type → appointment)
-

**Evaluation scenarios** (realistic tasks to test)
1.
```

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md        → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md → ISO 9241 HCD (this file)
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                           → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                   → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                       → Visual tokens
```

---

*Guide #2: Human-Centered Design & Usability Standards. Next: Guide #3 — `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #5 — `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · Guide #6 — `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · Guide #7 — `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*


===== [Formal #3 — IA & Navigation Standards] docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md =====
# Transovo Information Architecture & Navigation Standards Guide

**Series:** Implementation standards · **Guide #3 of 12**  
**Status:** Active — mandatory hard architectural standard between feature inventory and individual page designs  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** ISO 9241-110:2020 · WCAG 2.2 (Guidelines 2.4 Navigable, 3.2 Predictable) · W3C WAI · U.S. Web Design System (USWDS)

---

## Master Cursor rule

> **Transovo information architecture must be task-based, predictable, shallow enough to understand, and consistent across the product.** Follow ISO 9241-110 interaction principles and WCAG 2.2 navigation/predictability requirements. Every capability has **one canonical home**, **one canonical user-facing name**, and a **clearly defined parent domain**. Global navigation represents major recurring workspaces; local navigation represents peer views within those workspaces; actions stay on the pages where they are performed; states and filters do not become product navigation; organization-wide configuration belongs in Settings or Integrations. Multiple contextual paths may reach the same object, but must never create duplicate versions of that object. Repeated navigation must retain consistent order and identification. Users must always be able to determine where they are, predict where a destination belongs, and move between related objects without reconstructing context.

**This guide sits between the product feature inventory and individual page designs.** It is the hard architectural ruleset for how Transovo organizes information, names destinations, structures navigation, communicates hierarchy, and helps users find where they are going.

---

## Important distinction from Guides #1 and #2

There is **not** one international ISO standard that dictates a specific SaaS sidebar structure or says “use exactly seven navigation items.”

What **is** standardized are the underlying requirements around:

- predictable navigation
- meaningful labels
- user expectations
- location/orientation
- multiple ways to find content
- consistent identification
- logical hierarchy
- task suitability
- navigation accessibility

---

## Primary authorities

| Authority | Focus |
|-----------|--------|
| **ISO 9241-110:2020** | General interaction principles — suitability for user tasks, self-descriptiveness, conformity with user expectations, controllability, learnability, error robustness; intended to inform UI requirements, style guides, and interactive-system design |
| **W3C WCAG 2.2** | Guideline **2.4 Navigable** and Guideline **3.2 Predictable** |
| **W3C WAI** | Accessibility and navigation semantics |
| **U.S. Web Design System (USWDS)** | Official U.S. federal design-system guidance for hierarchical side navigation, breadcrumbs, and navigation patterns |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Nav implementation: `src/lib/products/appointments-nav.ts`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Navigation must be organized around user tasks and concepts

ISO 9241-110 requires interaction to be suitable for the user’s task and conform to user expectations.

**Therefore:** Navigation must represent concepts and jobs users recognize, not internal architecture, database models, or implementation details.

**For Transovo — good:**

- Appointments
- Booking
- Contacts
- Messages
- Automations
- Meetings
- Payments
- Analytics

**Bad:**

- Event Engine
- Provider Connections
- Workflow Runtime
- Scheduling Objects
- Graph Sync
- Communication Eligibility

**Cursor rule:** Never expose a technical subsystem as primary navigation merely because it exists in the codebase.

---

## B. Every destination must have a clearly defined scope

Two neighboring navigation destinations should not force the user to guess where something belongs.

| Destination | Scope |
|-------------|--------|
| **Appointments** | Appointments that already exist |
| **Booking** | Rules and mechanisms that create appointments |
| **Contacts** | People/customer records |
| **Messages** | Actual conversations |
| **Automations** | Rules Transovo executes automatically |
| **Meetings** | Recordings, transcripts, recaps, and meeting intelligence |
| **Payments** | Transactions |
| **Analytics** | Aggregate operational performance |
| **Integrations** | Connections to external systems |
| **Settings** | Organization-level configuration |

**Cursor rule:** Every top-level destination must have a written definition. No two top-level destinations may intentionally represent substantially overlapping concepts.

---

## C. Navigation labels must describe purpose

WCAG 2.2 requires headings and labels to describe their topic or purpose.

Navigation labels therefore need to be:

- specific
- recognizable
- concise
- unambiguous
- written from the user’s perspective

| Good | Bad |
|------|-----|
| Appointments | Manage |
| Integrations | Connections & Resources |
| Reminder sequences | Communication configuration engine |

**Cursor rule:** Never use vague catch-all labels such as **Tools**, **Resources**, **Management**, **Other**, **Miscellaneous**, or **Advanced** as primary navigation categories.

---

## D. One concept gets one canonical name

WCAG requires components with the same functionality to be identified consistently. That principle applies strongly to information architecture.

If the object is called **Booking type**, don’t call it **Event type** on another page, **Service** elsewhere, or **Appointment type** somewhere else — unless those are actually different objects.

**Transovo canonical object vocabulary:**

- Appointment
- Booking type
- Booking page
- Contact
- Conversation
- Reminder sequence
- Workflow
- Meeting
- Payment

**Cursor rule:** Search the existing UI before introducing a new label for an existing concept. Prefer the established canonical term.

---

## E. Global navigation must remain consistent

WCAG 2.2 SC 3.2.3 requires repeated navigation mechanisms to occur in the same relative order unless the user initiates the change.

Therefore:

- same global navigation structure
- same item order
- same utility placement
- same active-state behavior
- same account/settings placement

across normal Transovo pages.

No page should invent a different sidebar because its designer preferred another layout.

**Cursor rule:** All normal application pages use the canonical global navigation component. Never fork page-specific versions of the main sidebar/header.

---

## F. Stable navigation placement builds spatial memory

W3C explicitly notes that consistent visual layout and source order allow users to use spatial cues and predict where repeated navigation will appear.

Therefore:

If Settings is bottom-left, global search is in the header, and page title begins at the same content position — **keep those relationships stable.**

A redesign of one page must not relocate global utilities.

---

## G. Global navigation is for major destinations, not every feature

A feature does not automatically deserve a sidebar entry. Global navigation should contain major recurring destinations.

**Examples that should not become global entries merely because they exist:**

- New appointment
- Reminder history
- Microsoft calendar
- SMS eligibility
- Teams meeting creation
- Booking approval
- A2P registration

These belong within appropriate domains.

**Cursor rule:** A capability qualifies for global navigation only if it represents a distinct, recurring user workspace rather than an action, setting, state, or subordinate feature.

---

## H. Navigation destinations and actions must be separated

**Navigation means:** Go somewhere.  
**Actions mean:** Do something.

**Sidebar:** Appointments  
**Page action:** New appointment

**Not:** Appointments and New appointment as two equal navigation destinations.

Similarly:

- Add contact → action
- Create workflow → action
- Export → action
- Connect Microsoft → action

**Cursor rule:** Do not put verbs/actions into persistent global navigation unless the action actually represents a durable workspace.

---

## I. Global and local navigation are different levels

**Global navigation answers:** Which major product area?

**Local navigation answers:** Which view inside this area?

**Example:**

- **Global:** Appointments
- **Local:** Calendar | List | Waitlist | Recalls

USWDS describes side navigation as hierarchical navigation for levels within a section.

**Cursor rule:** Do not promote every local subsection into the global sidebar.

---

## J. Local navigation must contain peer concepts

Tabs or local navigation should represent comparable views or subsections of the same parent.

**Good:** Calendar | List | Waitlist | Recalls

**Bad:** Calendar | Create appointment | Export | Settings

Those mix destinations, actions, and configuration.

**Cursor rule:** Local navigation contains peer destinations only. Actions belong in action controls; configuration belongs contextually or under settings.

---

## K. Hierarchies should be as shallow as practical

There is no formal universal “three clicks” rule. But ISO’s task-suitability and efficiency principles strongly argue against unnecessary nesting, while USWDS side-navigation patterns are designed around understandable hierarchical relationships.

**Transovo target:**

```
Global domain → local view/object list → object/detail
```

Usually no deeper than necessary.

**Good:** Booking → Booking types → Consultation

**Poor:** Booking → Setup → Scheduling → Types → Services → Consultation

**Cursor rule:** Do not introduce a navigation level merely to group one or two obvious destinations.

---

## L. Do not flatten everything just to avoid hierarchy

The inverse matters too. A sidebar with 30 unrelated links may technically be shallow but still imposes too much scanning and categorization burden.

Depth and breadth must be balanced around meaningful user concepts.

**Cursor rule:** Prefer a small number of meaningful parent categories with clear local navigation over a flat list of every capability.

---

## M. One feature has one canonical home

A feature can be reachable from multiple contexts. It still gets one authoritative management location.

**Example — Reminder sequence**

- **Canonical management:** Automations → Reminder sequences
- **Referenced from:** appointment, booking type, calendar configuration

Those contextual links should reach the same underlying object, not create separate copies of its editor.

**Cursor rule:** Multiple access paths are encouraged; duplicated feature implementations are not.

---

## N. Important pages should have multiple findability paths

WCAG 2.2 SC 2.4.5 requires more than one way of locating pages within sets of pages, except for steps in a process.

For an application, important objects can appropriately be reached through:

- navigation
- search
- contextual relationships
- dashboard queues
- related records

**Example appointment:**

- Appointments calendar
- Appointment list
- Contact record
- Dashboard
- Search

**Cursor rule:** Do not force users to return to the global navigation tree whenever the system already knows the related destination.

---

## O. Multiple routes should lead to the same object

Multiple findability does not mean creating duplicates.

If appointment A123 is opened from Contact, Calendar, or Search, the authoritative appointment remains A123. Its status, reminders, payment, meeting, and activity must remain identical.

---

## P. Related objects need associative navigation

Users frequently navigate relationships rather than hierarchies.

| From | Link |
|------|------|
| Appointment | Contact → Anthony Johnson |
| Meeting | Appointment → Initial consultation |
| Contact | Next appointment → Sep 8, 2 PM |
| Payment | Appointment → Initial consultation |

Those should be links.

**Cursor rule:** Related primary objects should expose direct navigation to each other wherever that relationship is useful to the current task.

---

## Q. Preserve context when following relationships

If a user opens an appointment from Calendar, a quick detail drawer may preserve the calendar context better than immediately replacing the entire workspace.

If deeper work is needed, **Open full appointment** can navigate to the full record.

Navigation should account for where the user came from and what they were doing.

---

## R. Breadcrumbs represent hierarchy, not browsing history

USWDS explicitly describes breadcrumbs as showing where the current page sits in the site hierarchy and notes they are not appropriate as a representation of a step-by-step process.

**Good:** Booking / Booking types / Initial consultation

**Bad:** Home / Search / Anthony / Appointment / Edit — merely because those happened to be the user’s previous clicks.

**Cursor rule:** Breadcrumbs represent structural ancestors, never arbitrary browser history.

---

## S. Don’t use breadcrumbs unnecessarily

USWDS notes breadcrumbs may be unnecessary when:

- the site is shallow
- the hierarchy is already obvious
- existing navigation communicates location sufficiently

Do not mechanically add breadcrumbs to every Transovo page.

For **Appointments**, the active sidebar item + page heading may be sufficient.

For **Booking → Booking type → Consultation**, a breadcrumb/back relationship becomes more useful.

---

## T. Step-based processes use a stepper, not breadcrumbs

**Example A2P registration:** Business → Messaging use → Consent → Review

That’s a process. It should not be presented as:

Settings / Messaging / Business / Messaging Use / Consent

Use process navigation such as a step indicator. USWDS explicitly distinguishes hierarchical breadcrumbs from linear processes.

---

## U. Users must be able to determine where they are

WCAG Guideline 2.4 is specifically about helping users navigate, find content, and determine location. It includes an explicit AAA location criterion as well.

Transovo should provide location through combinations of:

- active global destination
- page heading
- local active tab
- breadcrumb when hierarchy warrants it
- object title on details

A user should not need the URL to know where they are.

---

## V. Every page requires a descriptive page title

WCAG 2.4.2 requires page titles that describe topic or purpose. Browser/document title should reflect the current context where practical.

**Examples:**

- Appointments — Transovo
- Initial consultation — Booking types — Transovo
- Anthony Johnson — Contacts — Transovo

**Not:** Dashboard on every route.

---

## W. Every page needs a clear primary heading

WCAG requires headings and labels that describe topic or purpose. The visible page heading should reinforce the current navigation destination.

**Example:**

- Sidebar active: Automations
- Local tab: Reminder sequences
- Page heading: **Reminder sequences**

Not: Messaging Automation Engine. Terminology should align.

---

## X. Link purpose must be understandable

WCAG requires link purpose to be determinable from the link text or its programmatically determined context.

Avoid repeated ambiguous links such as **Click here**, **More**, or **View** when context does not sufficiently establish the destination.

**Better:** View appointment · Open contact · Manage Microsoft calendars

---

## Y. Avoid duplicate labels that lead to unrelated places

Do not have **Calendar** in the sidebar, under Booking, and under Integrations if they represent three different concepts.

Use differentiated labels:

- Appointments → Calendar
- Booking → Availability
- Integrations → Connected calendars

**Cursor rule:** When two destinations could reasonably be confused, change their labels until their scopes can be predicted without opening them.

---

## Z. Navigation should conform to familiar conventions

ISO 9241-110’s conformity-with-user-expectations principle means familiar interactions should behave familiarly.

**Examples:**

- logo/home affordance behaves consistently
- sidebar items navigate
- tabs switch peer content
- breadcrumb ancestors navigate upward
- back returns to previous/parent context appropriately
- selected nav item appears selected

Do not invent a new interaction vocabulary for common navigation.

---

## AA. Do not trigger navigation merely from focus

WCAG 3.2.1 prohibits a component receiving focus from automatically changing context.

Keyboard user tabs to **Appointments** — that must not navigate merely because it received focus. Navigation occurs on activation.

---

## AB. Input changes should not unexpectedly navigate

WCAG 3.2.2 says changing a UI setting should not unexpectedly cause a context change unless users are advised beforehand.

**Example:** Selecting **Staff: Sarah** from a filter should filter results. It shouldn’t suddenly navigate to Sarah’s profile unless that behavior is explicitly communicated.

---

## AC. Preserve user orientation after navigation

When users move between related views, the destination should provide enough contextual continuity to explain where they arrived.

**Example — Contact → appointment**

Destination shows:

```
Initial consultation
Anthony Johnson
Sep 8 · 2:00 PM
```

Not a generic page with no obvious relationship.

---

## AD. Back behavior must be predictable

Distinguish:

| Type | Meaning |
|------|---------|
| **Browser Back** | Previous navigation state/history |
| **Structural Back** | Parent workspace |

**Example:** ← Booking types inside a Booking Type editor.

Avoid controls labeled simply **Back** when it is unclear whether they mean previous browser page, parent section, cancel, or previous wizard step.

---

## AE. Preserve list state when returning from a detail

If a user:

1. searches appointments
2. filters to Unconfirmed
3. scrolls
4. opens an appointment
5. returns

the app should preserve reasonable state: query, filters, sort, pagination/scroll where practical.

Forcing users to reconstruct the same view harms efficiency.

---

## AF. Tabs should preserve predictable state

When switching Calendar → List → Calendar, the application should preserve relevant date/filter state where doing so matches user expectations.

Do not reset to today’s date or erase filters for no reason.

---

## AG. URL/state should support meaningful navigation where practical

Important workspaces and objects should have durable routes.

**Examples:** appointment detail, contact detail, booking type, workflow, meeting recap

This enables browser navigation, deep links, sharing internally, and restoring context.

Pure transient UI state should not unnecessarily become separate routes.

---

## AH. Do not create pages for simple states

Don’t create separate global pages for **Confirmed appointments**, **Failed reminders**, or **Paid appointments** when those are better represented as filters, views, or status queues.

Navigation should remain structurally stable even as data states change.

---

## AI. Status is not taxonomy

**Needs attention** may be an operational queue. It is not generally a permanent information category.

Likewise **Failed**, **Pending**, **Confirmed**, and **Disconnected** are states. Do not confuse state with product architecture.

---

## AJ. Configuration and operational work should be separated

**Operational objects:** appointments, contacts, messages, meetings, payments

**Configuration:** business settings, calendars, A2P, permissions, integrations

A common architecture problem is mixing these as equals.

**Cursor rule:** Frequently operated business objects receive higher navigational prominence than infrequent system configuration.

---

## AK. Local configuration stays with the object it affects

**Example — Payment required for a booking type:**

Booking → Booking type → Payment

**Not:** Settings → Payments → Booking behavior → Type X

**Global provider connection:** Integrations → Payments

This distinction reduces navigation cost.

---

## AL. Global Settings holds defaults and organization-wide behavior

Settings should not become a duplicate copy of the product.

**It may contain:** organization defaults, account settings, team/security, messaging registration, default calendar behavior

**It should not contain complete copies of:** Booking Types, Reminder Sequences, Contacts, Appointment management

**Cursor rule:** Settings controls global/default behavior; primary product objects remain in their canonical domain.

---

## AM. External-system connections belong together

For Transovo, connecting Microsoft or Google is conceptually **Integrations → Calendars** rather than making **Microsoft** a global navigation destination.

Similarly **Stripe / Square** belong under payment integrations/configuration. The provider is subordinate to the user’s job.

---

## AN. Feature flags/entitlements should not contaminate the IA

If a feature isn’t available to a user:

- hide it where it would otherwise create irrelevant clutter, or
- show it intentionally where discovery/upgrade is part of the product strategy

Do not produce a sidebar full of permanently disabled modules. Navigation should reflect usable product structure.

---

## AO. Role-based navigation must remain coherent

A staff member may have fewer destinations than an owner. That’s acceptable.

But the remaining destinations should preserve normal ordering, normal names, and normal grouping.

Do not invent an entirely different product architecture per role unless their work truly differs substantially.

---

## AP. Avoid excessive nested sidebar accordions

Collapsing 30 items into accordions does not actually solve information overload.

If every primary section expands into six children, the sidebar simply becomes a hidden tree of complexity.

**Cursor rule:** Global navigation should select the workspace. Local navigation generally handles depth within that workspace.

---

## AQ. Sidebar section headings should create meaningful grouping

If visual groups are used, they should communicate conceptual relationships.

**Possible logical groupings:**

```
WORK
  Appointments
  Messages
  Contacts
AUTOMATE
  Booking
  Automations
  Meetings
BUSINESS
  Payments
  Analytics
```

The headings themselves should be visually subordinate. Do not create a section heading for every two links just to decorate the sidebar.

---

## AR. Ordering should be stable and purposeful

Order global navigation based on:

- task frequency
- task importance
- conceptual workflow
- user expectations

**Not:** alphabetical order, order features were implemented, database/domain order

Once established, avoid unnecessary reordering because users develop spatial memory. W3C’s consistent-navigation guidance explicitly recognizes this benefit.

---

## AS. The most frequent destination should be inexpensive to reach

If Appointments is the operational center of Transovo:

- it gets prominent placement
- Home should link into it
- relevant contacts/meetings should link back into appointments

Do not make the highest-frequency workflow navigate through lower-frequency setup areas.

---

## AT. Deep configuration can use within-page navigation

A long settings/editor page can use section navigation, tabs, or anchored subsections where those sections are meaningful.

Do not create 15 separate routes solely because a configuration object has 15 groups of fields.

---

## AU. Do not use tabs merely to make a page look organized

Tabs introduce navigation and hidden content. Use them when sections are:

- meaningful peers
- independently useful
- understandable without seeing simultaneously

If users need to compare two sections at once, hiding them behind tabs may be wrong.

---

## AV. Don’t use accordions for frequently compared information

Accordions are useful for progressive disclosure. They are poor when users repeatedly need to scan several sections together.

Choose architecture according to the task, not aesthetics.

---

## AW. Search complements navigation; it does not repair bad navigation

Global search can help users reach appointments, contacts, and meetings quickly.

But do not rely on search because the hierarchy is confusing.

**Cursor rule:** Primary information architecture must remain understandable without requiring search.

---

## AX. Search scopes must be explicit

If global search searches contacts, appointments, and meetings, say so through result grouping or labels.

If a page search only searches contacts, keep it within Contacts.

Do not make users guess what a search field covers.

---

## AY. Filters stay within the object domain they operate on

**Example:** Appointment status filter belongs on Appointment list/calendar. It is not navigation.

Likewise date filter, staff filter, and booking type filter are view controls.

Do not put changing datasets into the global navigation tree.

---

## AZ. Saved views are shortcuts, not new product domains

If users save **Tomorrow’s unconfirmed appointments**, that’s a user-created view. It does not become a new top-level architectural category.

---

## BA. Navigation must remain usable with long labels and realistic data

Do not design solely around short English labels. Test:

- longer section names
- narrow viewport
- translated labels eventually
- badges/counts
- role variation

The IA should survive realistic UI constraints.

---

## BB. Counts/badges must not destabilize navigation

A navigation item can display **Messages 4** if meaningful.

But dynamic counts should not:

- shift labels
- alter ordering
- become the only indication of status
- produce dozens of distracting badges

Use notification counts selectively.

---

## BC. New/attention indicators need consistent meaning

If a dot means **new item** everywhere, keep that meaning.

If amber means **needs attention**, do not use the same treatment merely to advertise a new feature.

Navigation status needs semantic discipline.

---

## BD. Navigation should not become an alert center

System problems can be indicated contextually.

But don’t add **Microsoft error**, **reminder failure**, **payment failure**, or **A2P pending** as separate navigation destinations.

Those are states that should link users to their canonical locations.

---

## BE. Page hierarchy should map to URL hierarchy where practical

Not every URL has to mirror navigation literally. But meaningful relationships are beneficial:

```
/appointments
/appointments/:id
/booking/types
/booking/types/:id
/automations/workflows
/automations/workflows/:id
```

Avoid route structures that reveal obsolete implementation concepts even though the UI claims a new IA.

---

## BF. Legacy routes may redirect; legacy navigation must not remain

If old routes exist for compatibility, that’s fine.

But do not preserve obsolete duplicate menu destinations solely because legacy routes still exist.

Canonical navigation controls the product’s conceptual architecture.

---

## BG. One primary navigation system should dominate

Do not simultaneously give users:

- giant sidebar
- giant global header menu
- second nested sidebar
- top nav with duplicates

A secondary local system is fine. Multiple competing global systems are not.

---

## BH. Navigation must remain understandable at responsive breakpoints

WCAG consistency still applies when layouts adapt; repeated navigation should stay predictable within the same page variation.

| Breakpoint | Pattern |
|------------|---------|
| **Desktop** | persistent/collapsible sidebar |
| **Mobile** | drawer/menu |

The structure, labels, and order should remain conceptually the same. Mobile is not a different IA.

---

## BI. Mobile should not hide essential destinations permanently

Reduced screen space can change presentation. It should not make Payments, Settings, or Integrations impossible to reach.

The complete authorized architecture still needs a route.

---

## BJ. Focus order must track meaningful navigation order

WCAG 2.4.3 requires focus order to preserve meaning and operability.

If visual nav order is Home → Appointments → Booking → Contacts, keyboard order should not begin Settings → Contacts → Home because CSS visually rearranged it.

---

## BK. Skip navigation must be available where repeated blocks exist

WCAG 2.4.1 requires a mechanism for bypassing repeated blocks.

For Transovo, implement a reliable **Skip to main content** mechanism so keyboard users don’t traverse the entire sidebar on every route.

---

## BL. Persistent help should remain consistently located

WCAG 2.2 introduced **Consistent Help**: repeated help mechanisms must occur in consistent relative order.

If Transovo has persistent support, help, documentation, or AI help — keep its placement predictable.

Don’t put Support in the header on one screen, footer on another, and sidebar on another without reason.

---

## BM. Empty states must preserve architectural orientation

Even when there is no data, **Booking types** should remain visibly inside **Booking**.

The empty state does not replace the architecture.

**Good:**

```
Booking
Booking types
No booking types yet.
```

**Not:** Welcome! Let’s get started! with no indication where the user actually is.

---

## BN. First-run onboarding must not create a second permanent architecture

Setup checklists and guided onboarding can provide shortcuts.

After onboarding, the same object should still live in its canonical location.

**Example:** Setup checklist **Create booking type** takes the user to **Booking → Booking types** — not a special separate onboarding implementation that creates something different.

---

## BO. Wizards represent process state, not product hierarchy

During A2P registration, steps might be: Business → Use case → Consent → Review.

Those steps disappear after the process. Do not add them to persistent Settings navigation.

---

## BP. Object creation returns users to a meaningful context

**Example — From Appointment Calendar:**

New appointment → Save should return/show the new appointment in calendar or detail drawer — rather than sending the user to an unrelated generic success page.

Context after navigation matters as much as before navigation.

---

## BQ. Deleting an object must result in a valid destination

If user deletes **Booking type / Initial consultation**, the interface cannot leave them on a nonexistent route.

Return to **Booking → Booking types** with appropriate confirmation.

---

## BR. Missing/unauthorized objects need meaningful recovery

If a deep link points to a deleted appointment, object user lacks permission to view, or unavailable booking type — don’t display a generic blank 404 if the application can provide useful context.

**Examples:**

- This booking type no longer exists. Return to Booking types.
- You don’t have permission to view this workflow. Return to Automations.

---

## BS. External navigation should be distinguishable where it matters

Links that leave Transovo for Microsoft, Stripe, Square, or public booking page preview should avoid surprising users.

Where material, indicate that they’re opening an external destination or preview.

---

## BT. Public/customer navigation is a separate IA from admin navigation

This is critical.

**Customer journey:** choose booking type → choose time → information → confirm

**Admin journey:** configure booking type → availability → payments → reminders

Different users, different goals, different architecture.

Do not leak admin navigation into public booking experiences.

---

## BU. Authentication/onboarding has a separate temporary navigation model

Login, signup, recovery, and setup can use a simplified shell. They do not need the full operational sidebar.

Once inside normal application work, return to the canonical app shell.

---

## BV. Immersive builders may temporarily reduce global navigation

For workflow builder or complex routing builder, workspace efficiency may justify collapsing/minimizing normal navigation.

But there must always be a clear route back: **← Workflows**

This is a temporary workspace mode, not a new product hierarchy.

---

## BW. Current-page state must be programmatically identifiable

The active destination cannot rely only on a subtle visual difference.

For accessible navigation, expose appropriate current-state semantics such as `aria-current` where applicable. Visual state and semantic state should agree.

---

## BX. Repeated navigation controls need consistent accessible names

If the sidebar is labeled **Main navigation**, use a consistent label.

If secondary navigation is **Booking navigation**, make it distinct.

Screen-reader users should be able to distinguish multiple navigation regions.

---

## BY. Never create fake hierarchy solely from indentation

If an item visually appears as a child, it should actually be conceptually and semantically subordinate.

Do not indent **Settings** under **Analytics** merely for layout convenience. Visual hierarchy must reflect real IA.

---

## BZ. Architecture changes require an inventory pass

Before moving/removing a navigation destination:

1. Identify every feature currently under it.
2. Assign each feature a new canonical home.
3. Update contextual links.
4. Update terminology.
5. Redirect old routes as appropriate.
6. Ensure no orphaned UI exists.

**Cursor rule:** Never remove a navigation item until every reachable capability underneath it has been accounted for.

This is particularly important for the Transovo redesign.

---

## CA. Architecture decisions must be documented separately from visual decisions

Do not justify “Booking belongs above Contacts because it looks better there.”

Architecture decisions should be based on:

- task model
- conceptual relationship
- frequency
- expected location
- hierarchy

Visual styling comes afterward.

---

## CB. Card sorting is an IA discovery method, not implementation truth

For large feature inventories:

- put concepts/features into cards
- group them according to user mental models
- identify candidate labels

The result is a hypothesis. Do not hard-code the first grouping merely because the design team produced it.

---

## CC. Tree testing validates findability before visual design

Once a hierarchy exists, test realistic tasks against the text tree.

**Example task:** Where would you go to change the time customers can book you?

**Expected:** Booking → Availability

If many users expect Settings → Calendar, that’s evidence the taxonomy or labels may need work.

Cursor doesn’t simulate human research results; it preserves the architecture so actual testing can be performed.

---

## CD. Navigation should be evaluated using tasks, not aesthetics

Tests should resemble:

- Find an appointment and reschedule it.
- Connect Microsoft Calendar.
- Find out why an SMS didn’t send.
- Change the default reminder sequence.

**Not:** Which sidebar looks cleaner?

Findability is an outcome.

---

## CE. Measure IA failure signals

Useful signals include:

- repeated backtracking
- wrong-section visits
- search immediately after opening nav
- excessive support questions such as “where is X?”
- repeated use of browser back
- abandonment
- users entering Settings for operational actions

Those indicate architecture problems. Do not automatically add more links to solve them.

---

## CF. Do not compensate for bad IA with duplicate shortcuts everywhere

Contextual shortcuts are valuable.

But if every screen needs links saying “Looking for Booking Types? Click here.” the underlying hierarchy may be wrong.

Fix the architecture rather than accumulating patches.

---

## CG. Architecture should survive product growth

When a new capability is added, it should usually have an obvious parent.

| New capability | Expected parent |
|----------------|-----------------|
| New reminder delivery option | Automations / Reminder sequence |
| New calendar provider | Integrations / Calendars |
| New appointment lifecycle state | Appointments |

If every new feature demands another top-level navigation item, the taxonomy is too feature-driven.

---

## CH. Taxonomy must not be based on current code ownership

Engineering teams may own calendar service, messaging service, or AI service. Users do not care.

Product architecture should remain stable even if backend services are refactored.

---

## CI. Information architecture must remain source-of-truth documented

For Transovo, maintain one canonical IA map documenting:

```
Global domain
  → local destinations
  → canonical objects
  → contextual relationships
  → settings ownership
```

Cursor must consult it before adding new navigation.

**Implementation references:**

- `docs/TRANSOVO-UI-DESIGN-GUIDE.md` — domain definitions and placement principles
- `src/lib/products/appointments-nav.ts` — canonical global/local nav structure

---

## CJ. Every new feature needs an IA placement decision

Before creating a UI for any future feature, Cursor should answer:

1. What user job does it serve?
2. What canonical object does it affect?
3. What is its primary home?
4. Is it global, local, contextual, settings, or process-only?
5. What existing locations should link to it?
6. Does it introduce terminology that overlaps existing concepts?

**No placement → no new route yet.**

---

## CK. Canonical Transovo global architecture

Based on the inventory already scoped, the approved top-level architecture should remain:

```
Home
Appointments
Booking
Contacts
Messages
Automations
Meetings
Payments
Analytics
────────────
Integrations
Settings
```

This is not because a formal standard mandates those ten labels.

It is our task-model implementation of the standards:

- distinct user domains
- understandable labels
- shallow structure
- predictable navigation
- consistent terminology
- clear separation between work and configuration

---

## CL. Canonical local architecture

### Appointments

Calendar · List · Waitlist · Recalls

### Booking

Booking types · Booking pages · Availability · AI booking · Routing · Meeting polls

### Contacts

Primary list + contextual contact detail.

### Messages

Inbox — use filters rather than artificial navigation where possible.

### Automations

Reminder sequences · Workflows · Templates · Activity

### Meetings

Upcoming · Recaps

### Payments

Transactions

### Analytics

Overview · Booking · Reminders · Automations · Reports

### Integrations

Calendars · Payments

### Settings

Business · Team · Messaging · Calendar · Meetings · Security · Billing

---

## Transovo IA / Navigation Acceptance Checklist

Before a page, route, or navigation change is considered complete:

- [ ] Feature has one defined user job
- [ ] Feature has one canonical home
- [ ] Top-level category scope is documented
- [ ] No sibling category materially overlaps its meaning
- [ ] Label uses canonical user-facing terminology
- [ ] Same concept uses same label elsewhere
- [ ] Global navigation remains in canonical relative order
- [ ] Page uses canonical global navigation component
- [ ] Action has not been incorrectly promoted into navigation
- [ ] State/filter has not been incorrectly promoted into navigation
- [ ] Local navigation contains peer destinations only
- [ ] Hierarchy is no deeper than necessary
- [ ] Important object can be reached through useful contextual paths
- [ ] Multiple paths resolve to same authoritative object
- [ ] Related objects cross-link where useful
- [ ] Breadcrumbs, when used, represent hierarchy
- [ ] Process steps are not represented as breadcrumbs
- [ ] Current page/location is obvious
- [ ] Browser/document title describes current context
- [ ] Visible primary heading describes current page
- [ ] Link purpose is understandable
- [ ] Navigation does not change merely on focus
- [ ] Filter/input changes do not unexpectedly navigate
- [ ] List/filter state is preserved when returning where practical
- [ ] Responsive navigation preserves same conceptual architecture
- [ ] Keyboard order matches meaningful navigation order
- [ ] Skip-to-main mechanism exists
- [ ] Persistent help location remains consistent
- [ ] Unauthorized/removed objects have meaningful recovery
- [ ] Public/customer flows do not inherit admin navigation
- [ ] Legacy routes do not create duplicate canonical destinations
- [ ] New navigation does not expose backend implementation terminology
- [ ] Feature remains discoverable without requiring search
- [ ] Architecture documentation updated with any approved changes

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md           → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md  → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation (this file)
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                             → IA principles & domain definitions
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                     → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                         → Visual tokens
src/lib/products/appointments-nav.ts                    → Canonical nav implementation
```

---

*Guide #3: Information Architecture & Navigation Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*


===== [Formal #4 — Interaction, Keyboard & Focus (complete A–DZ)] docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md =====
# Transovo Interaction, Keyboard & Focus Standards Guide

**Series:** Implementation standards · **Guide #4 of 12**  
**Status:** Active — mandatory hard standard for how Transovo behaves when users interact with it — especially with keyboards, focus, dialogs, tabs, menus, dropdowns, composite controls, builders, calendars, and temporary UI  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** W3C WCAG 2.2 · WAI-ARIA · WAI-ARIA Authoring Practices Guide (APG)

---

## Master Cursor rule

> **Transovo interaction behavior must follow WCAG 2.2 keyboard/focus requirements and established WAI-ARIA Authoring Practices for custom widgets. Use native HTML controls whenever possible. Every essential function must be keyboard operable without requiring hover, dragging, pointer precision, or memorized shortcuts. Tab moves between components; established component-specific keys move within composite widgets. Keyboard focus must always be visible, meaningful, persistent, and restored logically after temporary UI closes or focused elements are removed. Modals, menus, tabs, comboboxes, accordions, grids, calendars, and other complex controls must implement their complete established interaction contract—not merely visual appearance or ARIA attributes. Interactions must preserve user context and work, prevent duplicate/destructive errors, communicate loading/saving/system state, and provide predictable recovery when operations fail.**

**This guide controls how Transovo behaves when users interact with it — especially with keyboards, focus, dialogs, tabs, menus, dropdowns, composite controls, builders, calendars, and temporary UI.**

---

## Important distinction

**WCAG is the conformance standard. APG is implementation guidance for common accessible interaction patterns.**

Cursor should follow native HTML first and use APG patterns when implementing custom widgets. W3C explicitly notes that when authors create custom ARIA GUI widgets, the browser does not automatically provide the expected keyboard behavior; the developer must implement it.

**Primary authorities**

| Authority | Role |
|-----------|------|
| **W3C WCAG 2.2** | Normative accessibility requirements for keyboard operability, focus order, focus visibility, dragging alternatives, target size, context changes, etc. |
| **WAI-ARIA** | Specification for roles, states, and properties when native HTML semantics are insufficient |
| **WAI-ARIA Authoring Practices Guide (APG)** | Official implementation guidance and keyboard interaction patterns for dialogs, tabs, menus, comboboxes, grids, accordions, trees, and toolbars |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Every interactive function must be keyboard operable

Any function available through mouse or touch must also be usable from the keyboard unless its nature inherently requires a path-dependent pointer gesture.

That includes navigation, appointment creation, date selection, calendar navigation, rescheduling, menu actions, workflow editing, opening drawers, editing settings, sending messages, choosing contacts, selecting calendars, payment actions, and Notetaker controls.

**Cursor rule:** No essential Transovo action may require a mouse, hover, drag gesture, or touchscreen.

---

## B. Use native controls before building custom controls

Prefer `<button>`, `<input>`, `<select>`, `<textarea>`, and `<a>` over recreating those controls with generic elements and ARIA.

**Cursor rule:** If native HTML provides the required behavior and semantics, use it. Build custom ARIA widgets only when native controls cannot provide the required experience.

---

## C. Tab moves between components

The primary keyboard convention is: **Tab** and **Shift + Tab** move focus between UI components.

Inside composite controls such as tablists, menus, radio groups, grids, trees, and toolbars, other keys — usually arrow keys — move focus within the component.

This distinction should be enforced consistently throughout Transovo.

---

## D. Do not put every item inside a composite widget into the Tab sequence

**Bad example:** A tab bar with six tabs requires six Tab presses.

**Expected pattern:** Tab → enters tablist → Left/Right Arrow → moves among tabs → Tab → leaves tablist.

Likewise with radio groups, menus, listboxes, toolbars, and interactive grids.

**Cursor rule:** Composite widgets must use the established managed-focus interaction model rather than turning every internal option into a separate Tab stop.

---

## E. Focus must always exist somewhere meaningful

**Wrong:** User deletes an appointment from a list → appointment disappears → focus disappears.

**Correct:** appointment disappears → focus moves logically to the next appointment or another meaningful control.

User closes a modal → focus returns to the control that opened the modal, unless the workflow logically requires another destination.

**Cursor rule:** Never allow DOM changes to leave keyboard focus lost on the document body or another meaningless destination.

---

## F. Focus must always be visually discernible

Keyboard users must always be able to answer: **Where am I?**

Cursor must never use `outline: none;` without providing an equally visible replacement.

Focus indicators must be distinguishable from selected state, hover state, active state, and checked state.

---

## G. Focus and selection are different concepts

This matters heavily in tabs, calendars, tables, multi-select, workflow nodes, and listboxes.

A tab can remain **selected** while focus moves elsewhere.

- **Selected** means: this is the active/current item.
- **Focus** means: this is where the next keyboard interaction applies.

**Cursor rule:** Never use the same visual treatment for keyboard focus and persistent selection.

---

## H. Do not automatically activate everything merely because it receives focus

Selection following focus can be appropriate when switching is immediate, harmless, and locally rendered — e.g., tabs whose panels change instantly.

It can be harmful when focus changes cause network requests, expensive loading, navigation, destructive changes, or significant side effects. In those cases: Arrow keys → move focus; Enter / Space → activate selection.

**Cursor rule:** Focus movement must not trigger costly, destructive, or disruptive actions unless the interaction pattern explicitly warrants automatic activation.

---

## I. Never use positive tabindex to manually reorder a page

Avoid `tabindex="1"`, `tabindex="2"`, `tabindex="3"`.

**Cursor rule:** DOM order must represent meaningful interaction order. Fix DOM structure rather than patching bad structure with positive tabindex values.

---

## J. Use tabindex="0" and -1 intentionally

For custom composite widgets:

- `tabindex="0"` → participates in normal Tab order
- `tabindex="-1"` → can receive programmatic focus but is not directly tabbed to

For roving tabindex: one internal item receives `0`, others receive `-1`, and arrow navigation updates which item is focusable.

Use this only when the chosen APG pattern calls for managed focus.

---

## K. Do not invent keyboard bindings when established ones already exist

Users expect common conventions: Enter activates, Space activates buttons/toggles, arrows navigate within composites, Escape dismisses temporary UI, Tab moves forward, Shift + Tab moves backward, Ctrl/Cmd + Z generally means undo.

**Cursor rule:** Use APG/native platform conventions instead of inventing proprietary keyboard behavior.

---

## L. Keyboard shortcuts are accelerators, not accessibility patches

Do not create a bad keyboard interface and compensate with shortcuts.

Potential Transovo accelerators: `/` → focus search, Cmd/Ctrl + S → save in an editor, perhaps N → New appointment where safe and documented.

But the entire application must remain usable without memorizing any shortcut.

---

## M. Keyboard shortcuts must avoid conflicts

Do not hijack browser shortcuts, operating-system shortcuts, or assistive-technology shortcuts.

Shortcuts should be discoverable when materially useful. Do not build a secret keyboard language.

---

## N. Buttons activate actions

Use buttons for actions such as Save, Cancel appointment, Open menu, Send reminder, Reconnect Microsoft.

Use links for navigation such as Open contact, Go to appointment, View transaction.

**Cursor rule:** Button means action. Link means navigation. Do not swap semantics merely because the visual styling is similar.

---

## O. Toggle buttons must expose persistent pressed state

If a button represents an on/off state rather than a one-time action, expose the appropriate state, such as `aria-pressed` for a true toggle button.

For ordinary configuration, checkbox or switch may be more appropriate.

**Cursor rule:** Match the control semantics to whether the user is performing an action or changing persistent state.

---

## P. Modals must behave as true modal dialogs

When a modal opens: focus moves inside, outside content becomes inert, Tab stays within the dialog, Shift + Tab stays within the dialog, Escape closes where appropriate, dialog has an accessible name, and visible close/cancel mechanism exists.

**Cursor rule:** A visually modal panel must also behave modally for keyboard and assistive-technology users.

---

## Q. Initial modal focus must be intentional

Do not blindly focus the first element in DOM.

- **Add contact:** focus First name
- **Confirmation:** focus might appropriately begin on the safe action Keep appointment
- **Long informational dialog:** focus may begin on the heading/content container

**Cursor rule:** Initial focus placement must support the specific dialog task.

---

## R. Closing a modal usually restores focus to its trigger

Example: Appointment → Cancel → dialog → close. Focus returns to Cancel unless the triggering object disappeared or another destination is more logical.

---

## S. Dialog backgrounds must truly be inert

While the modal is open, users must not be able to Tab into the page behind it, click background controls unintentionally, operate underlying fields, or interact with hidden content through assistive technology.

Visual dimming alone is insufficient.

---

## T. Do not use modals for enormous workflows

Use modal for confirmation, small form, focused selection.

Use full page/drawer/workspace for Booking Type editor, Workflow Builder, complex appointment editing, A2P registration, and long configuration flows.

A modal is temporary contained interaction.

---

## U. Menu buttons must follow menu-button behavior

For an actions menu such as ••• More actions, expected behavior includes Enter opens, Space opens, appropriate arrow behavior, focus enters menu appropriately, expanded state exposed, and Escape closes.

**Cursor rule:** Dropdown action menus must be implemented as real accessible menu interactions when menu semantics are chosen.

---

## V. Menus are for commands/actions, not arbitrary navigation styling

Appropriate menu — Appointment: Reschedule, Duplicate, Cancel.

A normal list of navigation links does not automatically need `role="menu"`.

**Cursor rule:** Use menu semantics only when the behavior actually matches a menu.

---

## W. Escape should dismiss temporary UI where convention expects it

Examples: menu, popover, modal, combobox popup, date picker, temporary preview.

But Escape should not silently delete, publish, save, or discard large amounts of unsaved work.

---

## X. Tabs must follow the tab pattern

A real tab system needs tablist, tabs, selected tab, tabpanel, keyboard navigation, and correct selection/focus semantics.

For horizontal tabs: Left / Right → move tab focus; Home → first tab; End → last tab.

Activation can be automatic or manual depending on latency and side effects.

---

## Y. Do not use tabs for simple navigation when links are better

If clicking a label changes route, opens an unrelated page, or represents an independent destination, normal links/navigation may be the correct semantic model.

Do not make something an ARIA tab merely because the design shows horizontal labels.

---

## Z. Accordions must behave as disclosures

Accordion headers need button semantics, keyboard activation, and programmatic expanded/collapsed state.

Potential Transovo uses: advanced reminder timing, Booking Type advanced options, diagnostic sections.

**Cursor rule:** An accordion is a disclosure pattern, not merely a visual card with a chevron.

---

## AA. Do not hide essential information exclusively in accordions

Progressive disclosure should reduce clutter. It should not force users to repeatedly expand sections just to understand basic operational state.

---

## AB. Comboboxes must use a real combobox interaction pattern

Important Transovo examples: contact picker, staff picker, timezone search, calendar picker, booking-type picker.

A combobox must correctly expose expanded/collapsed state, current value, popup relationship, active option, selection, and keyboard navigation.

Do not build `input + floating <div>` without the complete accessibility behavior.

---

## AC. Editable and select-only comboboxes are different

Use editable search when there are many options (e.g., search thousands of contacts). Use simpler selection controls where the option set is small. Don't make every select searchable.

---

## AD. Arrow keys inside comboboxes must not break text editing

If the user is editing text: normal Left/Right cursor behavior remains available, Up/Down can navigate options according to the pattern, Escape dismisses the popup, Enter commits selection when appropriate.

Do not hijack basic text-editing behavior unnecessarily.

---

## AE. Dropdown focus must not disappear when options update

Remote search results can rerender. Preserve text-input focus, active-option state where appropriate, and logical keyboard navigation.

Do not make the user restart the control every time new results arrive.

---

## AF. Listboxes are selection widgets, not generic lists

Use listbox semantics when users are selecting from choices. Do not use listbox for ordinary appointment lists, feeds, navigation, or static data. Semantics follow behavior.

---

## AG. Radio groups should use arrow navigation

For one choice among mutually exclusive options (Scheduling method: One host / Round robin / Collective), native radio controls already provide established behavior. Prefer native radio groups before custom cards.

---

## AH. Switches represent immediate binary state

Good uses: Auto-join meetings, Allow customer cancellation. Not appointment status with five values. The control type must match the data model.

---

## AI. Checkbox vs switch behavior should remain consistent

Checkbox: inclusion, independent selection, form choice. Switch: immediate on/off system state. Do not alternate them based purely on visual preference.

---

## AJ. Interactive grids require complete keyboard implementation

A true ARIA grid behaves more like an application/spreadsheet. Potential cases: complex scheduling matrix, advanced editable table.

Ordinary Appointment List: semantic table/list — not grid.

**Cursor rule:** Use `role="grid"` only when the widget actually implements complete grid behavior.

---

## AK. Do not add role="grid" because rows are clickable

ARIA grid carries substantial keyboard expectations. If the interface does not implement directional cell navigation, predictable focus, and complete interaction semantics, then it is not a grid.

---

## AL. Calendar widgets require deliberate keyboard design

Transovo Calendar must define keyboard access to dates, days/weeks, appointments, create appointment, open detail, move through calendar, and leave the calendar.

Do not place hundreds of cells into Tab order. Use appropriate managed navigation.

---

## AM. Dragging cannot be the only way to reschedule

Desktop can allow drag 2 PM → 4 PM. But also provide Reschedule → select new date/time.

**Cursor rule:** Dragging is an accelerator, never the only essential operation.

---

## AN. Resizing cannot be the only way to change duration

If pointer users can drag an appointment edge, keyboard/touch users also need Edit appointment → Duration.

---

## AO. Hover interactions require focus/touch equivalents

If row actions appear on hover, they must also appear through keyboard focus, action menu, or touch. Hover cannot gate functionality.

---

## AP. Tooltips must work from focus, not only hover

Tooltip content must be accessible to keyboard users. Also: critical instructions should not live only in tooltips.

---

## AQ. Tooltips should not contain complex interactive content

Tooltip: short supplementary explanation. Popover/dialog: links, buttons, interactive controls. Choose the correct interaction model.

---

## AR. Popovers must define focus behavior

For every popover decide: **Noninteractive** — focus remains on trigger. **Interactive** — focus is intentionally managed.

Do not allow accidental keyboard traps or lost focus.

---

## AS. Drawers need an explicit interaction model

A drawer may be a **modal drawer** (background inert and focus contained) or a **nonmodal detail panel** (background remains usable). Choose deliberately.

Do not make it visually modal and functionally nonmodal.

---

## AT. Appointment quick-view drawer should preserve context

Example: Calendar → appointment → quick-view drawer. Keep selected date, filters, and calendar position. Then provide Open full appointment for deeper editing.

---

## AU. Closing temporary UI should return focus predictably

Examples: menu → trigger, modal → invoker/logical next object, drawer → appointment row/card, tooltip → focus remains on trigger.

Never jump randomly to page top.

---

## AV. If the triggering element disappears, choose the logical successor

If an appointment row is deleted, focus goes to: (1) next row, (2) previous row if no next, (3) list heading or primary action if list becomes empty. Never lose focus.

---

## AW. Destructive actions require deliberate interaction design

Use safeguards proportional to consequence. Cancellation may affect customer, reminders, calendar, and payment — so confirmation may be warranted.

Deleting a harmless draft might use Undo. Don't over-confirm everything.

---

## AX. Prefer Undo where reversible

Example: "Removed from waitlist. Undo" can be better than "Are you sure?" for low-risk reversible changes.

Use confirmation for irreversible, broad-impact, financially consequential, or difficult-to-recover actions.

---

## AY. Save behavior must be consistent

Choose intentionally between **Explicit Save** (user edits several fields and chooses Save changes) and **Immediate save** (toggle changes instantly).

Do not make identical controls behave differently without explanation.

---

## AZ. Auto-save must communicate state

Show Saving…, Saved, Couldn't save. Do not make users infer persistence.

---

## BA. Explicit Save must protect unsaved work

If leaving with unsaved changes: Discard changes / Keep editing. Don't silently lose work.

---

## BB. Loading controls should remain spatially stable

Button "Save changes" becomes "Saving…" inside roughly the same footprint. Do not replace it with a tiny spinner that shifts neighboring controls.

---

## BC. Disable repeated submission during active processing

Especially create appointment, payment, send message, publish workflow, connect integration. Once activated "Creating…", prevent duplicate execution.

---

## BD. Disabled state must not become a dead end

If Send SMS is unavailable, explain why — e.g., "Business texting registration is required for imported appointments." Do not force users to guess.

---

## BE. Disabled controls may remain discoverable when useful

Sometimes a disabled option should stay focusable/discoverable because users need to learn why it isn't available. In other cases, ordinary disabled behavior is appropriate. Choose based on task and discoverability.

---

## BF. Selection changes should not unexpectedly commit destructive actions

Selecting "Cancel reason" must not immediately cancel the appointment. Input selection and final commitment should remain distinct for consequential operations.

---

## BG. Changing focus must never trigger destructive actions

Keyboard focus movement must not save, send, delete, purchase, or cancel. Activation is separate.

---

## BH. Filtering should preserve focus predictably

If user selects Status = Unconfirmed and results rerender, focus should remain on the filter control unless there is a deliberate reason to move it.

---

## BI. Search results must not steal focus while typing

As contact-search results load: focus remains in search box; keyboard navigation into results happens intentionally. Do not auto-focus the first result after every request.

---

## BJ. Pagination should manage focus intentionally

After Next page, focus should land somewhere meaningful within the refreshed results context — not in a removed element or at body.

---

## BK. Infinite scrolling requires a stable focus model

If used: loaded content must not shift keyboard location unpredictably, footer/other controls remain reachable, loading state is exposed.

For operational SaaS, pagination or Load more may often be easier to make predictable.

---

## BL. Row click behavior must be predictable

If an appointment row opens detail: keyboard users need equivalent operation, nested buttons work independently, row click doesn't swallow action-menu events. Avoid ambiguous click targets.

---

## BM. Double-click must never be required

No essential feature depends on double click. It may be an optional accelerator in specialized desktop-like interactions.

---

## BN. Right-click cannot be the sole action path

Context menus are optional accelerators. Every important command must also be available through standard visible UI.

---

## BO. Pointer targets need adequate separation

Avoid cramped controls like Edit Delete Resend with tiny hit areas, particularly on mobile. Interaction design must reduce accidental activation.

---

## BP. Primary and destructive actions must remain distinct

Do not make Delete and Save equally prominent adjacent controls. Placement and hierarchy should reflect consequence.

---

## BQ. Forms should support Enter intentionally

Login: Enter submits. Search: Enter searches. Large text editor: Enter inserts newline. Workflow Builder: Enter should not accidentally publish.

Never globally bind Enter to Save.

---

## BR. Escape must not silently destroy unsaved work

Escape may close temporary UI. If closing would discard substantial work: preserve draft, warn appropriately, define cancellation behavior. No silent loss.

---

## BS. Background status updates must not steal focus

Events such as reminder delivered, Microsoft sync finished, payment update, or transcript finished may announce status. They should not move keyboard focus away from the user's current task.

---

## BT. Live updates should not reorder active content unexpectedly

If appointment list changes due to background sync, do not suddenly move the currently focused row. Possible strategy: "New updates available" — then reorder when appropriate.

---

## BU. Selected rows should survive harmless updates

If user selected five appointments and one row refreshes, selection should remain unless validity genuinely changes.

---

## BV. Bulk actions require a clear selection model

When selecting multiple objects: selected count visible, bulk actions grouped, deselect-all available, selection scope predictable. Do not scatter bulk actions across the interface.

---

## BW. Drag-and-drop requires feedback and alternatives

For Workflow Builder/reordering, users need clear dragged object, valid targets, invalid targets, completion feedback — and keyboard-accessible alternative.

---

## BX. Workflow Builder needs an explicit keyboard model

Define operations for navigate node, select node, edit node, add, delete, connect, move, undo/redo, zoom, and exit canvas. Do not rely only on free-form mouse manipulation.

---

## BY. Canvas panning/zooming must not trap users

Provide controls: Zoom in, Zoom out, Fit view, Reset. Pinch/mouse wheel may supplement these. They cannot be the only mechanisms.

---

## BZ. Calendar drag results must clearly report the final state

After moving: "Appointment moved to Tuesday, Sep 8 at 3:00 PM." If save fails: "Couldn't move appointment. It remains at 2:00 PM." Never silently roll back.

---

## CA. Optimistic updates need rollback behavior

If UI updates before server confirmation: represent pending appropriately, rollback on failure, explain what happened. Frontend and backend must never silently diverge.

---

## CB. Long-running actions need truthful progress/state

Examples: calendar import, transcript generation, AI follow-up, business registration. Show "Processing…". If actual percentage is unknown, don't fake "73%".

---

## CC. Cancellation should exist for long-running operations where feasible

Possible: AI generation, export, upload. If operation cannot truly cancel, don't show fake Cancel.

---

## CD. Don't block the whole app for local work

If one appointment is updating, use local loading. Don't cover entire Transovo interface with a full-screen spinner unnecessarily.

---

## CE. Toasts cannot carry required decisions

Toast is appropriate for "Appointment created." Not: "Your connection failed. Click here within 3 seconds to prevent data loss." Important action/state must persist elsewhere.

---

## CF. Success toasts must not steal focus

Feedback is not a navigation destination. Keep focus in the logical workflow.

---

## CG. Errors need recovery actions where possible

Examples: Microsoft connection expired → Reconnect; Payment failed → Retry; Workflow invalid → Review 2 issues. Do not terminate the user's path at "Error." 

---

## CH. Errors should not reset whole workflows

If Step 4 fails, preserve Step 1, Step 2, Step 3, and user's current data. Don't make users start over.

---

## CI. Wizards need predictable Previous/Next behavior

For real multi-step flows: Next moves forward, Back moves backward, state persists, current step clear, final commitment clearly different from intermediate navigation.

---

## CJ. Browser Back must not destroy wizard state unpredictably

Decide browser-history behavior. Do not allow Back to accidentally submit, clear all progress, or create corrupt intermediate state.

---

## CK. Selection state should persist where expected

Example: Calendar filter Sarah → open appointment → close detail → Sarah remains selected. The interface should not repeatedly erase the user's working context.

---

## CL. Draft and published states must be unmistakable

For Workflow: Draft versus Published. If changes aren't live until publication, show that clearly. User must never wonder: Is this already active?

---

## CM. Test and Live must be unmistakable

Especially workflows, AI booking, payments, messaging, and calendar operations. If a test mode exists, show persistent context. Don't rely on a tiny badge.

---

## CN. Read-only state must be obvious

If user lacks permission, do not make everything appear editable and then fail after interaction. Prefer read-only rendering, clear lock/permission explanation, and hide inappropriate dangerous actions.

---

## CO. Permission failures should preserve context

If "You don't have permission to edit this workflow," keep the user on the workflow where possible. Don't redirect them randomly to Home.

---

## CP. External authorization flows need state continuity

Example: Transovo → Microsoft OAuth → return. Restore Integrations → Calendars, relevant setup state, and user context. Do not dump user on Home.

---

## CQ. External auth cancellation must be recoverable

If user cancels Microsoft authorization: "Microsoft wasn't connected. Retry" — not "OAuth error." 

---

## CR. New tabs/windows must be intentional

Normal in-app navigation stays in-app. Potential justified cases: public booking preview, external provider portal. Where appropriate, communicate the destination.

---

## CS. Browser history should remain meaningful

Do not add history entries for every tooltip, every dropdown, every ephemeral popover. Browser Back should represent meaningful navigation.

---

## CT. Deep-linked objects must work independently

Opening `/appointments/:id` directly should load the object, expose valid actions, handle missing permissions, and not depend on hidden list-page state.

---

## CU. Custom keyboard interfaces require real QA

Critical components: calendar, date picker, combobox, modal, drawer, tabs, menu, workflow builder, multi-select tables, AI Booking. APG implementation still needs actual testing.

---

## CV. Keyboard testing must use complete tasks

Don't test only "Can I Tab to Save?" Test: Create an appointment with keyboard only.

Full task: Find New appointment → Choose contact → Choose Booking Type → Select date → Select time → Save → Verify.

---

## CW. Mixed pointer/keyboard use must remain coherent

Example: User clicks third tab, then presses Right Arrow. Keyboard navigation should continue from third tab. It must not jump to tab one because roving tabindex wasn't updated.

---

## CX. Touch should preserve the same conceptual interaction

Desktop: appointment drawer. Mobile: full-screen sheet. Concept remains: inspect appointment → return to calendar.

Responsive presentation can differ. Interaction model remains understandable.

---

## CY. Do not require precision gestures

No important feature may require tiny drag handles, exact swipes, multi-touch gestures, or precise hover. Provide explicit controls.

---

## CZ. Interaction feedback must be immediate

When user activates checkbox, tab, menu, filter, Save, or appointment, the UI should acknowledge immediately. Backend can continue processing afterward.

---

## DA. Don't claim success before success is known

If server hasn't confirmed, don't display "Saved" unless using a deliberate optimistic model with rollback. Truthful state is mandatory.

---

## DB. Prevent duplicate navigation/action race conditions

Examples: Double-click Create Appointment still one appointment. Repeated payment activation no duplicate charge. Rapid state changes no conflicting saves.

Interaction handlers and backend idempotency should cooperate.

---

## DC. Debounce search, not arbitrary actions

Reasonable: debounce contact search. Not reasonable: save button randomly waits 600 ms before doing anything. Different interactions require different techniques.

---

## DD. Essential actions cannot be gesture-only shortcuts

Swipe to delete can exist. Still provide More → Delete.

---

## DE. Menus should close predictably

Typically: choose action → close, Escape → close, outside interaction may close, navigation closes. No orphaned menus.

---

## DF. Avoid deep nested menus

Poor: More → Appointment → Communication → SMS → Advanced. If actions need that much depth, they likely belong on a dedicated detail/configuration page.

---

## DG. Context menus should remain object-local

Appointment menu: Reschedule, Duplicate, Cancel. Not Analytics, Settings, Integrations. Local actions remain local.

---

## DH. Interaction state must have one source of truth

If URL says List, tab says Calendar, and content shows Waitlist, the UI is broken. Route, selected state, and rendered state must remain synchronized.

---

## DI. Focus state should survive re-renders where possible

React/component updates should not recreate the active control unnecessarily. Use stable keys and DOM identity. Focus loss from rerender is a real implementation defect.

---

## DJ. Live validation must not fight the user

Do not show "Invalid email" after they type "a" while still entering it. Validate at sensible times: blur, submit, or after enough input depending on the field.

---

## DK. Correcting errors should clear obsolete error state

When value becomes valid, remove invalid/error treatment appropriately. Don't leave stale red state until an unrelated full-form submit.

---

## DL. Date/time interaction should respect user format

If user uses 12-hour time "2:00 PM", don't suddenly transform input into "14:00" unless their locale/settings call for it.

---

## DM. Timezone changes with meaningful consequences require explanation

If changing timezone alters the actual appointment instant, explain before applying. Don't silently reinterpret time.

---

## DN. Recurring appointment edits need explicit scope

Where supported: This appointment only / This and following / Entire series. No silent series-wide mutation.

---

## DO. Group booking actions need explicit scope

Cancel one attendee does not silently cancel everyone. Cancel group appointment clearly states everyone is affected.

---

## DP. Multi-host appointments need host-impact clarity

If a host changes, show whether appointment remains valid, replacement needed, or availability conflict exists. No hidden mutations.

---

## DQ. Reminder overrides must show inheritance during interaction

Example: Reminder sequence Standard / Using calendar default → Override for this appointment → Reset Use calendar default.

The user should see exactly what level they are editing.

---

## DR. SMS eligibility must be enforced before attempted use

If appointment cannot use SMS, do not let user configure/send normally and discover failure afterward. Show blocked state, reason, and remediation at the interaction point.

---

## DS. AI suggestions and execution must remain distinct

AI: "Tuesday at 2 PM is available." That's a proposal. Actual: "Appointment created." That's system execution.

Do not visually blur generated suggestions and authoritative state.

---

## DT. AI-generated content should remain editable where appropriate

Examples: follow-up email, meeting recap, customer message draft. Make clear whether it is Draft or Sent/published.

---

## DU. AI interactions need complete states

At minimum: generating, completed, failed, retry, cancel where feasible. No endless spinner with no recovery.

---

## DV. Human handoff must retain context

AI Booking failure → human should see conversation, contact, requested time, fields already gathered, availability checks, and failure reason. Do not restart the customer's journey.

---

## DW. Workflow publishing must validate before activation

Check required fields, connections, timing, and action configuration. If invalid, do not publish. Navigate/focus user to issues.

---

## DX. Validation summaries should link to exact problems

Example: "4 issues prevent publishing" — selecting each issue should reveal/focus the relevant node or field. Not "Workflow invalid." 

---

## DY. Complex builders should support Undo/Redo

Especially deleting nodes, moving nodes, changing connections. Use conventional keyboard shortcuts where supported.

---

## DZ. Immersive workspaces must always have an exit

Workflow Builder may minimize global navigation. Still provide ← Back to workflows (keyboard accessible), sensible Browser Back, and unsaved-work protection active.

---

## Transovo Interaction / Keyboard / Focus Acceptance Checklist

Every applicable feature should pass:

- [ ] Entire primary task can be completed without a mouse
- [ ] Native HTML controls used where appropriate
- [ ] Tab/Shift+Tab move predictably between components
- [ ] Composite widgets use correct internal keyboard model
- [ ] No unnecessary positive tabindex values
- [ ] Focus is always visible
- [ ] Focus never silently falls to body after DOM changes
- [ ] Focus and selected state are visually distinct
- [ ] Activation does not occur unexpectedly merely from focus
- [ ] Keyboard shortcuts follow platform conventions
- [ ] Keyboard shortcuts are optional accelerators, not required knowledge
- [ ] Buttons perform actions; links navigate
- [ ] Modal focus enters, stays inside, and restores correctly
- [ ] Modal background is inert
- [ ] Escape behavior is predictable
- [ ] Menu buttons follow WAI-ARIA menu-button interaction
- [ ] Tabs use appropriate semantics and keyboard behavior
- [ ] Accordions expose expanded/collapsed state
- [ ] Comboboxes provide proper popup/selection/focus behavior
- [ ] Radio/switch/checkbox controls use correct interaction model
- [ ] Static tables are not incorrectly implemented as ARIA grids
- [ ] Interactive grids implement complete keyboard navigation if used
- [ ] Calendar can be operated without dragging/pointer precision
- [ ] Drag operations have non-drag alternatives
- [ ] Hover-only functionality has keyboard/touch equivalent
- [ ] Tooltips are keyboard accessible
- [ ] Drawers explicitly use modal or nonmodal behavior
- [ ] Temporary UI returns focus logically
- [ ] Deleted elements transfer focus to a meaningful successor
- [ ] Destructive actions have proportional safeguards
- [ ] Reversible actions use undo where appropriate
- [ ] Save/auto-save behavior is consistent and visible
- [ ] Unsaved work is protected
- [ ] Loading state does not destabilize layout
- [ ] Duplicate submissions are prevented
- [ ] Disabled actions explain why when necessary
- [ ] Search/filter updates do not steal focus
- [ ] Pagination/infinite loading preserve keyboard orientation
- [ ] Row interaction supports keyboard and nested controls correctly
- [ ] Live/background updates do not steal focus
- [ ] Bulk selection model is clear
- [ ] Workflow-builder operations have keyboard-accessible alternatives
- [ ] Canvas zoom/pan has explicit controls
- [ ] Optimistic updates roll back visibly on failure
- [ ] Long-running operations show truthful state
- [ ] Toasts do not contain required transient decisions
- [ ] Error recovery preserves entered data/context
- [ ] Wizard Back/Next behavior is predictable
- [ ] Test/live and draft/published modes are unmistakable
- [ ] Read-only state matches permissions
- [ ] OAuth/external flows restore user context
- [ ] Browser history remains meaningful
- [ ] Pointer and keyboard interaction stay synchronized
- [ ] Real end-to-end keyboard QA performed

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus (this file)
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → i18n/l10n
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #4: Interaction, Keyboard & Focus Standards. This completes all 12 implementation standards guides in the Transovo standards series.*


===== [Formal #5 — Forms, Input & Validation] docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md =====
# Transovo Forms, Input & Validation Standards Guide

**Series:** Implementation standards · **Guide #5 of 12**  
**Status:** Active — mandatory hard standard for every form, field, validation rule, and data-entry interaction  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** WCAG 2.2 (Input Assistance) · W3C WAI Forms Tutorial · WHATWG HTML Living Standard · WAI-ARIA Authoring Practices Guide (APG)

---

## Master Cursor rule

> **Transovo forms must follow WCAG 2.2 Input Assistance requirements, W3C WAI Forms guidance, the HTML form-control standard, and WAI-ARIA Authoring Practices where native controls are insufficient.** Every input must have a persistent, understandable, programmatically associated label; constraints and instructions must be available before they are needed; redundant entry must be avoided; user work must survive validation and system errors; detected errors must be identified in text and associated with the affected control; known corrections should be suggested where safe; and serious legal, financial, or data-changing submissions must provide appropriate review, confirmation, correction, or reversibility. Use native controls and proper input types first, preserve existing values and context, keep client/server validation synchronized, make inheritance and save scope explicit, and **never expose a setting that does not affect actual runtime behavior**.

**This guide controls how every form, field, validation rule, required input, date/time selector, dropdown, contact picker, setup flow, and data-entry interaction in Transovo must behave.**

---

## Primary authorities

| Authority | Focus |
|-----------|--------|
| **W3C WCAG 2.2** | Input Assistance — error identification, labels/instructions, error suggestions, error prevention, redundant entry, accessible authentication, programmatic input purpose |
| **W3C WAI Forms Tutorial** | Labeling, grouping, instructions, validation, notifications, form structure |
| **WHATWG HTML Living Standard** | Form controls, input types, labels, constraint validation, autocomplete, disabled/readonly behavior, submission |
| **WAI-ARIA Authoring Practices Guide** | Custom input widgets (comboboxes, autocomplete) where native HTML is insufficient |

**Governing rule:** Forms must make the required input understandable before entry, preserve the user’s work, identify errors precisely, suggest corrections when possible, and prevent serious mistakes before they become consequential.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Every form control needs a persistent label

Do not use placeholder text as the only label.

**Correct:**

```
Email address
[ name@example.com ]
```

**Incorrect:**

```
[ Enter your email ]
```

because the user’s understanding of the field cannot disappear when they type.

WCAG 3.3.2 requires labels or instructions when content requires user input.

**Cursor rule:** Every user-editable field must have a visible, persistent, programmatically associated label unless the purpose is unambiguously established by an accessible equivalent pattern.

---

## B. Use real `<label>` relationships

For native controls, prefer:

```html
<label for="email">Email address</label>
<input id="email" type="email">
```

or a valid implicit label relationship.

Do not visually place text near a field and assume that creates a programmatic relationship.

The HTML standard defines the label/control association; WAI recommends explicit labels for form controls.

---

## C. Labels must describe purpose, not implementation

| Good | Bad |
|------|-----|
| Mobile number | String value |
| Appointment duration | Duration integer |
| Calendar that receives new appointments | Write-calendar ID |

User language wins.

---

## D. Required vs optional treatment must be consistent

Choose one system.

**Example:**

```
Email address
Phone number — Optional
```

or:

```
Email address *
```

with a visible explanation: `* Required`

Do not sometimes use asterisk, sometimes bold, sometimes red, sometimes nothing.

**Cursor rule:** Required/optional state must be programmatically conveyed and visually consistent across the entire application.

---

## E. Don’t mark every field “required” if almost all are required

For a short form where nearly everything is required, it can be clearer to mark the exceptions:

```
Notes — Optional
```

rather than covering the page in asterisks.

The design must still programmatically convey required fields correctly.

---

## F. Instructions must appear before the user needs them

WCAG 3.3.2 requires labels or instructions where input is required.

If a field has constraints:

```
Password must contain at least 12 characters.
```

tell the user **before or while** they enter it.

Don’t wait until submit to reveal: `Password needs 12 characters.`

Likewise:

- EIN must contain 9 digits.
- Booking can be scheduled up to 90 days ahead.
- Reply-to email must be verified before use.

---

## G. Don’t put essential instructions only in a tooltip

If success depends on understanding it, show it in the form. Tooltip is supplementary.

**Bad:** Campaign type `(?)` — where the only explanation of a legally meaningful choice lives behind hover.

**Better:**

```
Messaging use case
Choose the option that best describes the appointment messages you will send.
```

---

## H. Helper text should explain constraints or consequences

**Useful helper text:** This calendar receives appointments created in Transovo.

**Not useful:** Select a calendar. — The label already says Calendar.

Helper text should add information, not repeat it.

---

## I. Use the correct native input type

The HTML standard defines specialized input types for different data.

Use appropriate inputs where supported: `email`, `tel`, `number`, `date`, `time`, `url`, `password`, `search`

This improves validation, mobile keyboards, assistive technology, and browser functionality.

Do not use `<input type="text">` for every possible value.

---

## J. Native input type does not eliminate server validation

Browser validation improves UX. It is not security/business validation.

**Cursor must validate authoritative rules on the server as well.**

**Example:** Browser can recognize email-shaped string. Server still decides: email allowed? duplicate? verified? belongs to correct tenant?

UI validation and business validation are separate.

---

## K. Input purpose should be programmatically identifiable

WCAG 1.3.5 requires the purpose of certain user-information inputs to be programmatically determinable where applicable.

Use appropriate autocomplete tokens for user data such as name, email, phone, organization, address where applicable.

**Examples:** `autocomplete="name"` · `autocomplete="email"` · `autocomplete="tel"` · `autocomplete="organization"`

Do not disable browser autofill without a legitimate reason.

---

## L. Avoid asking the user to enter information the system already knows

WCAG 2.2 added **3.3.7 Redundant Entry**, requiring previously entered information in the same process to be auto-populated or selectable, with limited exceptions.

For Transovo: If Contact already contains name, phone, and email, and staff starts **Book appointment**, do not make them enter the same fields again. Carry them forward.

---

## M. Preserve values when moving through a multi-step process

**Wizard:** Business information → Messaging use → Consent → Review

Going Step 3 → Back → Step 2 must preserve entered information.

Do not reset the flow simply because navigation occurred.

---

## N. Preserve entered values after validation errors

WAI specifically recommends accessible error handling rather than forcing users to reconstruct the form.

If submission fails because EIN is invalid, do not erase legal business name, address, website, contact name, or phone.

**Cursor rule:** Validation failure must never wipe unrelated valid user input.

---

## O. Choose field width according to expected data

Form fields do not have to occupy the entire container.

| Field | Width |
|-------|-------|
| ZIP code | small |
| Phone | moderate |
| Email | moderate/large |
| Long description | wide |

This helps users visually infer expected input and improves scanability.

But never truncate input merely because the visual field is narrower.

---

## P. Use one-column form flow by default

For complex professional applications, the safe default is a strong top-to-bottom reading order.

**Good:**

```
Name
[________________]
Duration
[________]
Location
[________________]
```

Two-column layouts should be reserved for closely related short fields such as **Start date | Start time** or **First name | Last name**.

Don’t make a six-column form simply to save vertical space.

---

## Q. Field order must follow the user’s task, not the database schema

**Example Booking Type:**

1. Name
2. Duration
3. Location
4. Hosts
5. Availability
6. Booking rules
7. Customer questions
8. Reminders
9. Payment
10. Confirmation

**Not:** ID, foreign key, enum, serialized config

Form order communicates workflow.

---

## R. Group related fields semantically

WAI recommends grouping related controls where that relationship matters.

**Examples:**

**Customer information** — Name, Email, Mobile number

**Availability** — Days, Start time, End time

**Reminder timing** — Channel, Offset, Send time

Use semantic grouping such as `fieldset`/`legend` when appropriate.

---

## S. Use fieldset and legend for meaningful grouped choices

Especially radio groups and multiple related checkboxes.

**Example:**

```
Reminder channels
☑ SMS
☑ Email
☐ Voice
```

Programmatically, **Reminder channels** should be the group label, not merely a nearby heading.

WAI Forms guidance explicitly covers grouping controls.

---

## T. Radio buttons are for one choice from a known small set

**Example:**

```
Scheduling method
○ One host
○ Round robin
○ Collective
```

Use radio when options are mutually exclusive, options should be visible simultaneously, and set is relatively small.

Do not replace this with a dropdown merely to save a few pixels if seeing the choices helps understanding.

---

## U. Checkboxes represent independent selections

**Example:**

```
Send reminders using:
☑ SMS
☑ Email
☐ Voice
```

Each can be selected independently. Don’t use radio semantics for multi-selection.

---

## V. Switches represent immediate binary state

Use switch for things like **Auto-join meetings: On/Off** or **Allow customer cancellation: On/Off**.

But not when the user’s intent is include this item as part of a form selection — where checkbox may be semantically clearer.

---

## W. Select/dropdown is appropriate for moderate known option sets

Examples: timezone, calendar, reminder sequence, booking type

For very small sets, radio buttons may be easier. For huge searchable sets, combobox/autocomplete is better. Choose based on interaction need.

---

## X. Large option sets should use search/combobox behavior

Examples: choose contact from thousands, choose timezone, select staff from large organization

WAI APG defines the expected combobox interaction pattern.

Do not produce a 2,000-item native-looking dropdown unless it is genuinely usable.

---

## Y. Comboboxes require correct state and keyboard behavior

A custom autocomplete must support:

- expanded/collapsed state
- accessible popup relationship
- arrow navigation where applicable
- Enter to select
- Escape to dismiss
- appropriate active-option semantics
- normal text editing

W3C provides detailed requirements through APG.

---

## Z. Search results must not silently become the selected value

Typing **Ant** and displaying **Anthony Johnson** must not choose Anthony until the user actually selects/confirms the option.

**Suggestion ≠ committed value.**

---

## AA. Multi-select controls need clear selected state

If a booking type can have multiple hosts, user must be able to determine: available hosts, selected hosts, how to remove selection, maximum/constraints if any.

Do not rely solely on subtle background color.

---

## AB. Date fields must distinguish date from date-time

A date such as **Sep 9** is not the same conceptual input as **Sep 9 at 2:00 PM**.

Don’t force every scheduling field through one overly generic date-time widget. Use the simplest field appropriate to the task.

---

## AC. Date pickers need direct text alternatives where practical

A user should not necessarily have to click next month → next month → next month → day for distant dates.

Where reasonable, allow direct date entry or efficient month/year navigation.

---

## AD. Time input must respect locale/user convention

If user works in 12-hour time: **2:00 PM**

Don’t force **14:00** unless locale/settings call for it.

Formatting standards belong in our separate date/time guide, but form controls must preserve that convention consistently.

---

## AE. Timezone must not be silently ambiguous

When entering a date/time whose timezone materially matters, expose the timezone.

**Example:** `2:00 PM Eastern Time` — where ambiguity could affect bookings.

Do not leave users guessing whether customer timezone, workspace timezone, or calendar timezone is being used.

---

## AF. Duration inputs should use domain-appropriate controls

For appointment duration, prefer **15 minutes · 30 minutes · 45 minutes · 1 hour · Custom** if these are common.

Don’t require users to enter `0.5` into a numeric field representing hours. Match the real-world concept.

---

## AG. Numbers must define units explicitly

**Bad:** `Buffer: 30`

**Better:**

```
Buffer before appointment
30 minutes
```

A number without a unit is ambiguous. Applies to minutes, days, seats, dollars, percentages, booking limits.

---

## AH. Avoid free-text when structured input improves correctness

If the system needs **State** and supported choices are known, use appropriate structured control.

If it needs appointment status, don’t use arbitrary text.

Structured controls reduce invalid values. But don’t over-structure genuinely free-form information such as notes.

---

## AI. Input masks must not fight the user

Phone/card/date formatting may improve readability. But input masks must:

- preserve editing
- allow paste
- not jump cursor unexpectedly
- not reject valid international formats unnecessarily
- not make screen-reader interaction confusing

Normalize canonical value separately.

---

## AJ. Store normalized values separately from presentation

**Example phone:**

- User sees: `(571) 407-3615`
- Backend may store: `+15714073615`

Do not force backend representation into the UI. Same principle applies to dates, currency, percentages.

---

## AK. Validation has three different layers

Cursor should distinguish:

| Layer | Example |
|-------|---------|
| **1. Format validation** | Invalid email structure |
| **2. Business-rule validation** | This time is no longer available |
| **3. System/provider validation** | Microsoft rejected this calendar update |

Do not collapse everything into **Invalid input.**

---

## AL. Validate at an appropriate time

Avoid aggressive validation while the user is still entering incomplete data.

**Example:** User starts typing `a` — don’t immediately show **Invalid email.**

Prefer validation after blur, after meaningful completion, on submit, or contextually after enough input.

The goal is assistance, not punishment.

---

## AM. Client-side validation should be immediate where safe

Examples: required field missing, invalid email format, impossible negative seat capacity — can often be detected locally.

Do not make the user wait for a server round-trip for trivial format problems.

---

## AN. Server errors must be mapped back to the relevant field where possible

If API returns `calendarId invalid`, translate it to **This calendar is no longer available. Choose another calendar.** and associate it with the calendar field.

Don’t display raw backend messages.

---

## AO. Every validation error must identify the error in text

WCAG 3.3.1 requires detected input errors to be identified and described to the user in text.

**Bad:** Red border only.

**Good:** Enter a valid mobile number.

Color and icon may reinforce it. **Text is required.**

---

## AP. Error messages should explain what needs correction

| Bad | Good |
|-----|------|
| Invalid value. | Enter a number between 1 and 50. |
| Date error. | End time must be later than start time. |

W3C’s error-identification guidance emphasizes describing the error so the user can locate and understand it.

---

## AQ. If a correction is known, suggest it

WCAG 3.3.3 requires correction suggestions when they are known and can be provided without jeopardizing security or purpose.

**Examples:**

- This date is unavailable. Next available time: 3:00 PM.
- Enter the phone number including area code, for example (571) 555-1234.

**Cursor rule:** Don’t stop at telling the user they’re wrong when the system knows how to help them fix it.

---

## AR. Error messages must remain close to the affected control

Use proximity.

**Example:**

```
Email address
[anthony@                    ]
⚠ Enter a complete email address.
```

Do not make the user scan a toast at top of screen to determine which field failed.

---

## AS. Complex forms should also provide an error summary

For long/wizard forms with multiple errors, a summary is useful:

```
3 items need attention
• Legal business name
• Website
• SMS consent description
```

Each error should link/focus the related field where practical. But field-level errors still remain. Summary does not replace them.

---

## AT. Move focus carefully after failed submission

For a large form, reasonable behavior may be focus error summary or first invalid field depending on design — but do not arbitrarily move focus while the user is typing.

The goal is efficient recovery.

---

## AU. Do not erase valid fields because one field failed

**Hard rule.**

If website URL is invalid, keep everything else.

This applies equally to client validation, server validation, and provider errors.

---

## AV. Required-field errors should be specific

| Bad | Better |
|-----|--------|
| Required. | Enter a business name. |
| Required. | Select a calendar. |

The message should name what needs to happen.

---

## AW. Cross-field errors must explain the relationship

**Example:** End time must be later than start time. — Not: Invalid start time.

If minimum notice exceeds booking window, say that relationship explicitly.

---

## AX. Errors caused by another field should point to the actual cause

If SMS toggle becomes invalid because sender registration is missing, don’t blame **SMS field invalid.**

Explain: **Business texting registration is required before SMS can be enabled for imported appointments.** And link to setup if appropriate.

---

## AY. Field validation and business eligibility are not the same thing

An input can be syntactically valid but not eligible.

**Example:** Phone number is valid. But contact opted out.

That’s not a form validation error. That is an eligibility/business state. Present it differently.

---

## AZ. Prevent serious errors before submission

WCAG 3.3.4 requires protections for legal, financial, or data-changing submissions: submissions must be reversible, checked, or confirmed under its defined scope.

For Transovo, apply strong safeguards to: refunds, appointment cancellation where consequential, deleting records, publishing communication workflows, changing sensitive consent settings, payment actions.

Use at least one of: review, confirmation, correction opportunity, reversibility — where applicable.

---

## BA. Financial submissions require review/correction opportunity

**Example — Booking payment:** Before final consequential submission, user should understand amount, customer, appointment, payment method/context.

If staff issues refund, show **Refund $150.00 to Anthony Johnson?** — not **Confirm action?**

Specificity prevents costly mistakes.

---

## BB. Destructive changes should state impact

**Example — Delete booking type**

Explain: Existing appointments will remain. The public booking page for this type will stop accepting new appointments. — Or whatever actual behavior is true.

The user needs scope before committing.

---

## BC. Don’t require confirmation for every harmless save

Error prevention must be proportional.

Do not add **Are you sure?** to changing display name, setting filter, or toggling a harmless preference.

Too many confirmations reduce effectiveness because users stop reading them.

---

## BD. Review screens are appropriate for complex submissions

Good candidates: A2P registration, organization security setup, large import, payment/refund, workflow publication with broad impact.

Review shows what will actually happen before commitment.

---

## BE. Reversible actions can often use Undo instead

For low-risk reversible data changes: **Removed from waitlist. Undo** may be more efficient than a blocking confirmation dialog.

Choose the least disruptive safe mechanism.

---

## BF. Never require re-entry merely to verify a value unless necessary

Don’t ask for Email address + Confirm email address if the purpose can be achieved more effectively another way.

Repeated entry creates errors and violates the spirit of redundant-entry reduction.

Exceptions may exist for genuinely high-risk values, but they should be justified.

---

## BG. Password paste must not be blocked

For authentication fields: Allow password managers and paste.

WCAG 2.2’s accessible-authentication requirements are specifically designed to avoid unnecessary cognitive-function tests and barriers.

Do not force users to manually type long credentials if password managers can supply them.

---

## BH. CAPTCHA/cognitive puzzles must not become authentication barriers

WCAG 3.3.8 Accessible Authentication places restrictions on requiring cognitive function tests in authentication unless alternatives/mechanisms satisfy the criterion.

For Transovo authentication, favor password managers, passkeys/WebAuthn later where appropriate, email links, standard OTP — rather than puzzles.

Security UX gets its own guide later.

---

## BI. Placeholders are examples, not labels

**Appropriate:**

```
Label: Mobile number
Placeholder: (571) 555-1234
```

Do not encode essential formatting rules only in placeholder because it disappears while typing.

---

## BJ. Defaults must be safe and meaningful

Good defaults reduce effort: workspace timezone, primary calendar, standard reminder sequence, 30-minute duration where appropriate.

But defaults that produce consequential behavior must be obvious.

For example: **Send SMS automatically** should not be silently enabled in a context where consent eligibility is unresolved.

---

## BK. Never pre-check consent boxes for the customer

For explicit SMS-consent capture, the customer must make the affirmative selection themselves.

Do not render **☑ I agree to receive appointment texts** preselected.

The compliance guide will carry the legal/carrier specifics; the forms guide carries the UX rule: **Affirmative consent controls must not be preselected when affirmative action is required.**

---

## BL. Consent language must be adjacent to the consent control

Do not put the meaningful consent terms in footer, hidden behind modal, or three screens earlier — and then show **☑ Agree**.

The user must understand what the checkbox means at the point of action.

---

## BM. Different consent purposes need distinguishable controls

Do not collapse appointment reminders and promotional/marketing messages into one vague **I agree to messages** if they represent materially different purposes.

The compliance guide will govern the exact legal model. The form must make choices comprehensible.

---

## BN. Conditional fields appear only when relevant

**Example:** If scheduling method is **One host**, don’t show round-robin distribution, all-host requirement, or group capacity.

If user chooses **Round robin**, then show relevant controls.

This reduces cognitive load and error.

---

## BO. Hiding a conditional field must define what happens to its value

If user selects **Enable payment**, enters $50, then disables payment — Cursor must define whether stored $50 persists invisibly for later re-enable or value resets.

Do not leave stale hidden values producing unintended behavior.

---

## BP. Hidden invalid fields must not block form submission

If a conditional field is no longer applicable and hidden, it should not produce **Please fix field you cannot see.**

Deactivate/remove its validation when out of scope.

---

## BQ. Dependent controls must clearly indicate dependency

**Example:** Reply destination is only relevant if SMS replies enabled.

If disabled, explain or hide it according to task. Avoid presenting settings that appear broken.

---

## BR. Read-only and disabled are different

| State | Meaning |
|-------|---------|
| **Read-only** | User can focus/select/copy value but cannot edit |
| **Disabled** | Control is unavailable for interaction/submission according to HTML behavior |

Choose intentionally. Don’t style a normal field gray and assume its semantics changed.

The HTML standard distinguishes control states such as disabled and readonly.

---

## BS. Disabled fields should not hide important data unnecessarily

If user needs to know **Assigned calendar: Microsoft Work** but can’t change it due to permissions, show it read-only.

Don’t simply disable a select so aggressively that the value becomes hard to perceive.

---

## BT. Form actions must have clear hierarchy

Typical:

```
Cancel                         Save changes
```

Primary action visually strongest. Dangerous action not neighboring Save as an equivalent button.

For long forms, use sticky save area when necessary.

---

## BU. Save button label should describe the action when context benefits

Generic **Save changes** is often fine.

For consequential process: **Submit registration · Create appointment · Issue refund · Publish workflow** is clearer than generic **Submit.**

---

## BV. Avoid “Submit” when a more specific verb exists

Specific labels improve predictability.

Use **Create appointment · Save booking type · Connect Microsoft · Send message · Publish workflow** instead of **Submit · Continue** when the action can be named precisely.

**Continue** remains appropriate for a genuine multi-step flow.

---

## BW. Buttons must not change meaning while the user is reading the form

Avoid forms where primary action unexpectedly switches from **Next** to **Save** to **Publish** without the step/state being obvious.

Users should understand when they are committing something.

---

## BX. Auto-save forms need explicit state

If a setting auto-saves, display **Saving…** then **Saved** and **Couldn’t save** when failure occurs.

Do not mix silent auto-save with explicit-save fields on the same screen without obvious boundaries.

---

## BY. Unsaved-change handling must be consistent

If page uses explicit save and user navigates away with changes, warn.

Options: **Discard changes · Keep editing**

Do not leave some editors protected and others destructive.

---

## BZ. Multi-step forms must reveal progress

For a true wizard: `1 Business · 2 Messaging · 3 Consent · 4 Review`

User should know: current step, remaining progression, how to go back, which step commits.

Do not create fake steps for a simple form.

---

## CA. Do not use a wizard when order doesn’t matter

If settings can be edited independently at any time, a standard configuration page may be better.

Wizard is for setup, registration, ordered dependencies, guided completion — not aesthetic organization.

---

## CB. Long forms should be divided into meaningful sections

**Example Booking Type:** Basics · Hosts and capacity · Availability · Customer questions · Reminders · Payment · Confirmation · Permissions

But don’t split every three fields into a separate card/page. Grouping should reflect decisions.

---

## CC. Section headings must describe the decision being made

**Better:** Hosts and capacity — than Configuration 2

**Better:** When customers can book — than Time settings — where plain language improves comprehension.

---

## CD. Form sections should not duplicate the global navigation

A Booking Type editor can have sections: Availability, Reminders, Payment.

That does not mean these become new global domains. Object-level form structure is contextual.

---

## CE. Inline edit vs full edit must be intentional

**Good inline edit:** appointment status, short note, simple field

**Poor inline edit:** entire Booking Type ruleset, workflow, A2P registration

Complex tasks need dedicated editor context.

---

## CF. Inline editing needs clear save/cancel behavior

If clicking field makes it editable, user must know: how to commit, how to cancel, whether blur saves.

Do not make each field behave differently.

---

## CG. Bulk forms/actions need selection summary

If editing 20 booking types, show **20 booking types selected.** And clearly identify what fields/actions will apply to all.

Never let a single-field edit accidentally become bulk without obvious context.

---

## CH. Bulk changes should communicate destructive scope

**Example:** Disable reminders for 42 appointments? — Not: Save changes?

Scope matters.

---

## CI. Import flows require mapping and validation before commitment

For CSV/calendar-like imports where applicable: show source, show mapping, detect invalid fields, show duplicate behavior, preview counts, review consequences.

Don’t blindly import and report chaos afterward.

---

## CJ. Authentication/API errors must not masquerade as input validation

**Example:** Microsoft Graph returns 401.

Do not show calendar field: **Invalid calendar.**

**Correct:** Microsoft needs to be reconnected. — That’s system state, not user input.

---

## CK. Network failure must preserve form work

If save fails because connection dropped: **Couldn’t save. Try again.** Keep fields. No blank form.

---

## CL. Partial save must be explicit

If a complex process saves some parts but not others, tell the user exactly what happened.

**Example:** Appointment created, but Microsoft calendar sync failed.

Do not show **Success** or **Failed** when reality is partial.

---

## CM. Form submission must prevent duplicate effects

Users may double click, press Enter repeatedly, or retry after latency.

Create/payment/send operations must be idempotent where appropriate.

The UI should move to **Creating…** and suppress repeated execution while request is active.

---

## CN. Input debounce belongs mainly to search/typeahead

Use debounce for remote contact lookup, search, availability preview where appropriate.

Do not delay direct save actions unpredictably.

---

## CO. Dynamic validation/status must be announced accessibly

**Example:** This email is available. or This booking link is already in use.

If updated asynchronously, status should be exposed appropriately to assistive technology under WCAG’s status-message requirements.

---

## CP. Success messages should be specific

| Bad | Better |
|-----|--------|
| Success! | Appointment created. |
| Success! | Appointment created. Microsoft calendar event and two reminders were scheduled. |

Do not overdo verbosity for minor saves.

---

## CQ. Errors should be written in user language

Never expose SQL, HTTP status, provider exception, enum name, or stack trace to regular users.

| Bad | Good |
|-----|------|
| invalid_grant | Microsoft authorization is no longer valid. Reconnect Microsoft to resume sync. |

---

## CR. User should not be blamed

Avoid: **You entered an invalid value.**

Prefer: **Enter a number between 1 and 50.**

Focus on correction.

---

## CS. International phone entry must not assume U.S.-only formatting if international support is enabled

If International SMS exists: country selector/prefix, locale-aware formatting, E.164 normalization backend.

Do not validate every number against a U.S. 10-digit pattern.

---

## CT. Currency fields must identify currency

If workspace is USD: **$50.00** or **Amount (USD)**

Don’t store/display **50** without unit.

If future multi-currency is supported, currency becomes explicit.

---

## CU. Percentage fields must prevent ambiguous input

If UI says **15%**, don’t make user guess whether backend expects **15** or **0.15**.

UI accepts real-world representation and transforms internally.

---

## CV. URL fields should accept normal user input where feasible

If someone enters `example.com`, system may reasonably normalize `https://example.com` rather than forcing protocol where safe/appropriate.

But show canonical value and validate securely.

---

## CW. Confirmation dialogs should repeat the critical value

**Example:** Refund $250.00 to Anthony Johnson? — not Are you sure?

The user should verify the actual consequence.

---

## CX. Dangerous text confirmation should be rare

Requiring **type DELETE** may be appropriate for catastrophic irreversible actions.

It is not appropriate for deleting one harmless draft or canceling a normal modal.

Do not turn friction into a design personality.

---

## CY. Data-changing forms should offer a correction opportunity

WCAG 3.3.4 explicitly allows compliance through reversibility, checking, or confirmation for applicable submissions.

For critical Transovo changes, choose appropriate safeguards.

---

## CZ. Forms must survive zoom/reflow

At high zoom/mobile widths: labels remain associated, controls don’t overlap, helper/error text remains visible, action buttons reachable, two-column layouts stack, no critical horizontal clipping.

This is part of WCAG 2.2 conformance overall.

---

## DA. Error text must satisfy contrast rules too

Do not use pale red on white that fails contrast. Error text is still text. Accessible color rules apply.

---

## DB. Error meaning cannot rely only on red

Use text, perhaps icon, semantic association. Red reinforces. It does not carry meaning alone.

---

## DC. Focus indicators around inputs must remain visible even with error styling

If invalid field has red border and focus also uses border, make both states distinguishable.

Focus cannot disappear just because an error is active.

---

## DD. Autocomplete must not interfere with password managers/browser autofill

Do not use fake autocomplete fields that break user agents unless unavoidable. Use standardized native attributes.

The HTML standard provides the autocomplete model.

---

## DE. Browser validation messages should not be the only error system for complex business rules

Native constraint validation is useful. But for Transovo — scheduling conflicts, A2P eligibility, calendar permissions, payment rules — need application-level explanation.

Use native behavior where it helps, then add domain-specific validation.

---

## DF. Do not prevent copy/paste into ordinary fields

Allow email copy/paste, phone paste, IDs where appropriate, password managers.

Blocking paste often hurts usability and accessibility more than it helps.

---

## DG. Maintain undo/correction for destructive form changes where practical

If a configuration field clears significant dependent data, warn or allow recovery.

**Example:** Changing scheduling method from **Collective** to **One host** might remove multiple required hosts. The UI should explain that before destructive conversion.

---

## DH. Changing a parent field must not silently invalidate child fields

**Example:** Change timezone — if appointment times will shift, explain.

Change payment provider — if active booking types depend on it, warn.

Dependencies need visible handling.

---

## DI. Imported-data eligibility controls must explain why they are unavailable

**Example — Imported appointment:**

```
SMS reminders
Unavailable
Business texting registration required.
[Set up texting]
```

Not merely disabled checkbox.

---

## DJ. Form controls must reflect actual runtime capability

**Hard rule for Cursor:** Never ship a visible toggle, select, or input that does not affect runtime.

If **Stop sequence after reply** exists in UI, the reminder engine must actually honor it.

If backend does not support it: do not expose it, or mark it intentionally unavailable.

**No decorative/fake settings.**

---

## DK. Persisted values and displayed values must remain synchronized

After Save/reload, the UI must reflect the stored state.

If toggle shows **On** while backend value is Off, the form is broken even if both independently “work.”

---

## DL. Inherited/default values must be visually distinct from explicit overrides

**Example:**

```
Reminder sequence
Standard reminders
Using calendar default
```

versus:

```
Reminder sequence
Custom sequence
Overridden for this appointment
```

The user must understand whether they are editing default, inherited value, or explicit override.

---

## DM. “Reset to default” must explain what happens

**Reset to calendar default** is much clearer than **Reset.**

After reset, inherited value should be shown.

---

## DN. Form defaults must not create hidden side effects

**Example:** Default **Notify customer by SMS** should not silently apply when customer lacks eligibility.

Business/default rules still need runtime eligibility checks.

---

## DO. Save scope must be explicit on nested settings

If user edits **Calendar reminder defaults**, button should not imply it modifies all existing appointments unless it actually does.

If behavior affects only future appointments, say so where relevant.

---

## DP. Existing-object changes need migration-impact clarity

**Example:** Change booking duration from 30 → 60.

Does it change future existing appointments? only new bookings? affect public availability immediately?

The form should communicate scope before save where impact matters.

---

## DQ. Forms should show current state before asking for change

Don’t make a user infer current settings from blank controls.

Editing screen must load stored value, inherited default, actual provider state if relevant.

**Editing starts from reality.**

---

## DR. Forms should not silently replace unknown current values with defaults

If backend data fails to load, don’t render **SMS reminders: Off** because Off is the default.

Show: **Unable to load current setting.**

Otherwise saving may accidentally overwrite actual state.

---

## DS. Loading state must be distinguishable from empty/default state

Especially for settings. **Loading ≠ No value.**

Use skeleton/disabled placeholder until authoritative state is known.

---

## DT. Form serialization must not submit stale hidden state accidentally

When conditional fields disappear, ensure backend payload reflects intended state.

Don’t submit old values merely because component state retained them.

---

## DU. Server remains authoritative

After save, use authoritative server response to reconcile UI where relevant.

Do not assume the local value is accepted if backend normalized/rejected/changed it.

---

## DV. Validation rules must be shared or synchronized across client/server

Avoid: Frontend says max 50 seats. Backend says max 25.

One canonical constraint source or synchronized definition should exist.

User should not pass client validation then fail mysteriously server-side.

---

## DW. Validation should distinguish warning from blocking error

| Type | Example |
|------|---------|
| **Warning** | You’re scheduling outside normal business hours. |
| **Blocking error** | End time is before start time. |

Do not make everything red/blocking.

---

## DX. Warnings must state whether user can proceed

**Example:** This time is outside your usual business hours. You can still create the appointment. — Clear.

**Not:** Warning: unusual time.

---

## DY. Confirmation/review page must reflect exact final submission data

No stale summaries. If user changes Step 2 and goes to Review, Review must show updated Step 2 values.

Review is only useful if authoritative.

---

## DZ. Forms must be testable without mouse

Every form flow must pass keyboard QA:

- reach every field
- operate all choices
- open date/select/combobox controls
- see errors
- correct errors
- submit
- recover

This overlaps with Guide #4 and remains mandatory.

---

## EA. Screen-reader field names and descriptions must be QA’d for critical forms

Especially: onboarding, booking, appointment creation, A2P registration, payment, security, team permissions.

Label text alone is not enough if helper/error relationships are broken.

---

## EB. Public booking forms must be especially low-friction

Customer-facing booking forms should not expose admin complexity.

Only ask for data required to schedule, contact, comply, complete payment if applicable.

Do not force customers to understand calendar source, workflow, integration, or host configuration.

---

## EC. Staff forms may be more efficient than customer forms

Manual appointment creation is used repeatedly. Optimize for speed: contact autocomplete, prefilled booking type defaults, keyboard efficiency, direct date/time selection, fewer explanatory paragraphs.

Same data domain, different context.

---

## ED. Forms must use actual validation rules, not placeholder assumptions

Cursor must inspect backend/database/provider constraints before changing form behavior.

Do not invent min/max, required state, or enum choices because they “seem right.”

**UI rules must correspond to real product rules.**

---

## Transovo Forms / Input / Validation Acceptance Checklist

Every applicable form should pass:

- [ ] Every editable control has a persistent visible label
- [ ] Labels are programmatically associated
- [ ] Required/optional treatment is consistent
- [ ] Instructions appear before they are needed
- [ ] Essential instructions are not hidden only in tooltips
- [ ] Correct native input types are used
- [ ] Appropriate autocomplete tokens are used
- [ ] Previously entered data is reused rather than redundantly requested
- [ ] Values survive Back/Next navigation
- [ ] Validation failures preserve valid input
- [ ] Fields are ordered according to user task
- [ ] Related fields are grouped semantically
- [ ] Fieldset/legend used where appropriate
- [ ] Radio/checkbox/switch/select semantics match the choice
- [ ] Large option sets use accessible search/combobox behavior
- [ ] Date/time/timezone inputs are unambiguous
- [ ] Units are visible for numeric values
- [ ] Structured input is used where it prevents invalid values
- [ ] Client validation handles obvious local errors
- [ ] Server validation remains authoritative
- [ ] Client/server validation rules do not conflict
- [ ] Every detected error is described in text
- [ ] Field-level error appears near affected control
- [ ] Known correction suggestions are supplied where appropriate
- [ ] Complex forms provide an error summary where useful
- [ ] Error correction does not erase unrelated values
- [ ] Cross-field errors explain the relationship
- [ ] System/provider failures are not misrepresented as field errors
- [ ] Serious legal/financial/data changes are reversible, checked, or confirmed as appropriate
- [ ] Destructive action explains its scope
- [ ] Consent controls are not preselected when affirmative action is required
- [ ] Consent language is adjacent to the control
- [ ] Distinct consent purposes are not conflated
- [ ] Conditional fields only appear when relevant
- [ ] Hidden fields do not block validation
- [ ] Hidden stale values do not create unintended runtime behavior
- [ ] Read-only and disabled controls are used intentionally
- [ ] Primary action label describes the result
- [ ] Save/autosave behavior is consistent and visible
- [ ] Unsaved changes are protected
- [ ] Wizards show progress and preserve state
- [ ] Network failure preserves form work
- [ ] Duplicate submission is prevented
- [ ] Loading/default/empty states are distinguishable
- [ ] Inherited/default values are visibly distinguishable from overrides
- [ ] Reset-to-default behavior is explicit
- [ ] Save scope is clear
- [ ] Visible controls correspond to actual runtime behavior
- [ ] Stored/server state and displayed state remain synchronized
- [ ] Form works at zoom/reflow/mobile widths
- [ ] Form can be completed using keyboard only
- [ ] Critical forms receive assistive-technology QA

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation (this file)
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md     → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #5: Forms, Input & Validation Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*


===== [Formal #6 — Responsive, Reflow & Zoom] docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md =====
# Transovo Responsive, Reflow & Zoom Standards Guide

**Series:** Implementation standards · **Guide #6 of 12**  
**Status:** Active — mandatory hard standard for viewport adaptation, browser zoom, text enlargement, orientation, and constrained layouts  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** W3C WCAG 2.2 — especially 1.4.4 Resize Text, 1.4.10 Reflow, 1.3.4 Orientation, and related requirements for meaningful sequence, text spacing, non-text contrast, target size, keyboard operation, and hover/focus behavior

---

## Master Cursor rule

> **Transovo must comply with WCAG 2.2 responsive accessibility requirements, including Resize Text 1.4.4, Reflow 1.4.10, Orientation 1.3.4, and related requirements for meaningful sequence, text spacing, keyboard operation, and accessible interaction.** Normal vertically scrolling content must reflow without loss of information or functionality at the equivalent of 320 CSS pixels, while any genuinely essential two-dimensional content such as calendars or workflow canvases must be isolated to its own region and handled intentionally. Text must remain fully usable at 200% enlargement, browser zoom must never be disabled, layouts must support portrait and landscape, and responsive transformations must preserve the same information architecture, business state, task capability, semantic order, and interaction meaning. Adapt layout by reflowing, wrapping, collapsing secondary controls, and transforming components — **not** by shrinking text, hiding essential functionality, or introducing page-wide horizontal scrolling.

**This guide controls how Transovo must adapt across viewport sizes, browser zoom, text enlargement, device orientation, and constrained layouts without losing information or functionality.**

---

## Governing principle

Responsive design is not “make desktop smaller.” The interface must preserve the same task, meaning, relationships, and functionality as available space changes.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Reflow is mandatory

For normal vertically scrolling content, Transovo must reflow down to a viewport width equivalent to **320 CSS pixels** without losing information or functionality and without forcing horizontal plus vertical scrolling at the same time.

**Cursor rule:** Ordinary pages must not depend on a minimum desktop width to remain usable.

This applies to: Home, Contacts, Appointment details, Booking editors, Settings, Integrations, Payments, Analytics text/content, Reminder sequences.

---

## B. Two-dimensional layouts are the exception, not the default

WCAG explicitly permits exceptions where two-dimensional layout is essential to usage or meaning.

**Likely Transovo candidates:** calendar grid, workflow canvas, complex data tables, certain charts, scheduling matrices.

That does not mean the whole page can horizontally scroll.

**Example:**

```
Page header
Filters
Calendar viewport ← may require 2D interaction
Other content
```

Only the essential region gets the exception.

**Cursor rule:** Never use an essential-layout exception as justification for making the entire application fixed-width.

---

## C. 200% text resize must preserve content and functionality

WCAG 1.4.4 requires text to resize to 200% without loss of content/functionality.

At 200%: labels must remain visible, buttons remain operable, text must not clip, input values remain readable, table actions remain reachable, dialogs remain usable, navigation remains understandable.

W3C also specifically notes text containers should accommodate larger text instead of clipping it.

---

## D. Do not disable browser zoom

**Hard rule.** Do not use viewport settings or scripts that prevent users from zooming.

**Cursor must not ship:**

```
maximum-scale=1
user-scalable=no
```

or equivalent behavior that blocks enlargement.

W3C test guidance explicitly includes verifying that the viewport permits zoom.

---

## E. Avoid fixed heights around text

One of the most common zoom failures is `height: 40px; overflow: hidden;` around a component whose text can grow.

At increased text size: label clips, button text disappears, helper text overlaps, row becomes unreadable.

Prefer min-height, intrinsic sizing, wrapping, flexible containers where appropriate.

---

## F. Relative sizing should be preferred for text

W3C lists relative measurements such as em and percentage-based sizing among techniques supporting text resizing.

For Transovo, prefer a scalable typography system using rem, em, relative line heights rather than hard-coding every text metric in a way that defeats user enlargement.

This does not mean every layout dimension must use rem. Use the right unit for the right job.

---

## G. Text-based controls must resize with their text

W3C specifically addresses form elements containing text and the need for them to scale appropriately.

Buttons and inputs must not stay too short while their text doubles in size.

At zoom, **Save changes** must remain readable and clickable — not clip into **Save chan…**

---

## H. No orientation lock

WCAG 1.3.4 says content must operate in either portrait or landscape unless one orientation is essential.

Transovo should work in portrait phone, landscape phone, portrait tablet, landscape tablet, desktop.

Do not show **Rotate your device to continue.** W3C specifically lists such forced-reorientation behavior as a failure pattern.

---

## I. Orientation changes must preserve state

If a user rotates their device while creating an appointment, editing a workflow, viewing a contact, or filling a form — do not reset entered values, selected tab, current appointment, filters, or scroll position unnecessarily.

Layout changes. Task state should survive.

---

## J. Responsive design must preserve semantic order

WCAG requires meaningful sequence to remain programmatically determinable.

**Desktop:** Customer | Appointment details | Status

**Mobile** may visually stack: Customer → Appointment details → Status

DOM order should remain logical. Do not visually reorder with CSS in a way that makes screen-reader/keyboard order nonsensical.

---

## K. Breakpoints should be content-driven

There is no standards rule that says mobile = 768px.

Cursor should not blindly design around device names.

Breakpoints should occur when: navigation stops fitting, table stops being usable, form columns become cramped, actions collide, calendar controls become unusable.

Use actual content pressure.

---

## L. Device classes are secondary to available space

Do not write UX assumptions like if iPad → tablet design, if iPhone → mobile design.

Prefer responsive behavior based on viewport, container width, input capabilities where necessary.

A narrow desktop window may need the same responsive layout as a tablet.

---

## M. The global sidebar must adapt, not disappear conceptually

**Desktop:** persistent/collapsible sidebar

**Smaller viewport:** navigation drawer/menu

The conceptual order and labels remain the same. Do not create a completely different mobile IA.

Responsive presentation changes. Information architecture does not.

---

## N. Primary navigation must remain fully reachable

Mobile adaptation must not permanently remove: Appointments, Booking, Contacts, Messages, Automations, Meetings, Payments, Analytics, Integrations, Settings.

All authorized destinations remain accessible.

---

## O. The page’s primary action must remain prominent

**Desktop:** Appointments + New appointment

**Mobile** might become Appointments with a compact persistent **+ New appointment** action.

But it must not vanish into ••• → More → New appointment unless there is a strong reason.

Primary task priority survives responsive changes.

---

## P. Secondary actions may collapse before primary actions

As width decreases, keep **Save changes** before Export, Duplicate, Advanced actions.

Secondary actions can move into overflow.

**Cursor rule:** Collapse by priority, not arbitrary DOM order.

---

## Q. Responsive reduction order should be predictable

When width becomes constrained, use this sequence conceptually:

1. reflow
2. wrap
3. reduce nonessential spacing
4. collapse secondary controls
5. move secondary actions to overflow
6. transform component presentation
7. only hide content that is genuinely nonessential

Do not start by deleting information.

---

## R. Do not shrink text below the design system minimum to make things fit

**Bad:** Mobile layout doesn’t fit → make everything 9px.

Responsive layout should restructure. It should not sacrifice readability.

---

## S. Tables require an explicit responsive strategy

Every Transovo table must declare how it behaves at narrow widths.

| Pattern | When |
|---------|------|
| **1 — Horizontal scrolling region** | Column comparison is essential |
| **2 — Priority columns** | Hide lower-priority columns; preserve access through detail |
| **3 — Row/card transformation** | Each row becomes a structured mobile record |
| **4 — Summary + detail** | Show essential fields; open full detail |

**Cursor rule:** A table is not “responsive” merely because the page has `overflow-x: auto`.

---

## T. If horizontal table scrolling is required, isolate it

Do not make the entire page scroll sideways.

```
Page header
Filters
┌──────────────────────┐
│ scrollable table     │ ← horizontal if needed
└──────────────────────┘
```

Normal page content continues vertically. This aligns with the WCAG reflow exception approach.

---

## U. Preserve row identity when tables collapse

**Desktop:**

| Customer | Date | Type | Status |

**Mobile:**

```
Anthony Johnson
Sep 8 · 2:00 PM
Initial consultation
Confirmed
```

Do not turn it into unlabeled Anthony / Sep 8 / Consultation / Confirmed if context becomes ambiguous.

---

## V. Data labels may need to become explicit on mobile

Desktop column heading supplies context: **Status: Confirmed**

Mobile card may require **Status: Confirmed** because the column heading is gone.

Responsive transformation must preserve relationships.

---

## W. Calendars need multiple viewport strategies

A desktop week calendar may not work on a 320px screen. Do not simply compress seven columns into microscopic cells.

**Possible responsive hierarchy:**

| Width | View |
|-------|------|
| Wide desktop | Week / day / month |
| Narrow desktop/tablet | Reduced week / day |
| Phone | Agenda/day/list-oriented view |

All underlying appointments remain reachable.

**Cursor rule:** Preserve scheduling capability; adapt the visualization.

---

## X. Calendar mobile view must not lose appointment actions

User must still be able to inspect appointment, create appointment, reschedule, cancel, message, see status — even if the week grid becomes an agenda.

---

## Y. “Why unavailable?” diagnostics must adapt too

**Desktop:** Hover/click on slot may show explanation.

**Mobile:** Tap unavailable slot or explicit info control.

Never rely on hover.

---

## Z. Drawers become different surfaces at small widths

**Desktop:** right-side detail drawer

**Mobile:** full-screen sheet/page

Do not force a 480px-wide drawer into a 375px viewport.

The conceptual action remains: inspect appointment without losing logical context.

---

## AA. Modals need responsive maximum dimensions

A modal must fit within the viewport.

At small widths: near-full-width, content scrolls internally where necessary, actions remain reachable, no horizontal clipping.

Long workflows should not remain in modals at all.

---

## AB. Modal actions must remain reachable at 200% zoom

Do not position Cancel / Save outside the visible region with no way to reach them.

Scrollable modal content must preserve correct focus and access.

---

## AC. Forms should collapse columns

**Desktop:** Start date | Start time

**At narrow width:**

```
Start date
Start time
```

Do not keep narrow side-by-side fields until labels/values overlap.

---

## AD. Form grouping must remain intact after reflow

If Start date + Start time are conceptually related, stack them together.

Don’t let responsive CSS scatter Start date at top, other fields, Start time later.

Meaningful grouping survives layout changes.

---

## AE. Button groups should wrap intelligently

**Example desktop:** Cancel · Preview · Save changes

**On mobile** potentially Save changes, Preview, Cancel — depending on design system conventions and task priority.

But never let controls overlap or shrink below usable size.

---

## AF. Destructive and primary actions must stay distinct after wrapping

A mobile stack must not accidentally put **Delete** directly where **Save** used to be with identical visual priority.

Responsive transformations must preserve hierarchy and safety.

---

## AG. Tabs need a narrow-screen strategy

If tabs no longer fit, possible approaches: horizontally scrollable tablist, controlled overflow, local dropdown in certain contexts, reduced tabs where architecture supports it.

Do not shrink labels until unreadable or wrap tabs across confusing multiple lines without deliberate design.

---

## AH. Horizontal tab scrolling must keep selected tab discoverable

If local tabs scroll horizontally: selected tab should remain visible, focus should reveal offscreen tab, keyboard navigation still works, clipping should communicate scrollability appropriately.

---

## AI. Do not convert every tabset into a dropdown on mobile automatically

Sometimes horizontal scrolling or fewer local views is more discoverable. The responsive pattern should fit the specific task.

---

## AJ. Filters need a responsive transformation

**Desktop:** Search | Status | Staff | Date | More filters

**Mobile:** Search + **[ Filters (3) ]** then filter sheet/dialog.

Selected filters should remain visible through chips, count, or summary. User must know filtering is active.

---

## AK. Filter state survives breakpoint changes

If user narrows browser window, do not clear date filter, staff, status, or search query.

Presentation changes. State remains.

---

## AL. Search should retain adequate input width

Don’t squeeze search into a 70px field because toolbar contains too many buttons.

On small screens, give search its own row if necessary. Core findability beats toolbar compactness.

---

## AM. Long labels must wrap rather than clip where appropriate

Buttons may sometimes use concise labels. But headings, field labels, helper text, warning messages must be allowed to wrap.

Do not truncate essential instructions.

---

## AN. Truncated content needs a recovery path

For unavoidable truncation **Initial consultation for…** provide full value through object detail, accessible name, tooltip/focus behavior where appropriate.

Critical information cannot become permanently unavailable.

---

## AO. Fixed-width containers must be justified

Avoid `width: 1200px` for normal content.

Prefer flexible max-width, minmax, grid/flex, percentages, container queries where appropriate.

Fixed widths are appropriate for specific controls/components, not entire normal pages.

---

## AP. min-width is a frequent reflow hazard

Be careful with tables, cards, toolbars, input groups.

A stray `min-width: 900px` can break the entire 320px reflow requirement. Audit min-width usage.

---

## AQ. Flex/Grid children need to be allowed to shrink

Common CSS issue: a grid/flex child refuses to shrink because of intrinsic minimum sizing.

Use patterns such as `min-width: 0` where semantically appropriate to allow content containers to reflow rather than overflow.

Cursor should check actual rendered behavior rather than assume flexbox makes everything responsive.

---

## AR. Long unbroken values must not blow out layouts

Potential offenders: email addresses, URLs, meeting links, IDs, webhook URLs, long customer names.

Allow appropriate wrapping, truncation with recovery, overflow handling.

Do not let one URL create horizontal page scrolling.

---

## AS. Code/technical strings may have a justified horizontal scroll region

Developer-oriented content such as webhook payload, API example, long code may appropriately scroll horizontally inside its own region.

Again: exception belongs to the specific content, not whole page.

---

## AT. Text spacing overrides must not break the UI

WCAG 1.4.12 requires content/functionality to survive specified user text-spacing adjustments.

Cursor must avoid layouts dependent on exact line-height/letter-spacing assumptions.

Do not clip text, overlap lines, or hide controls when text spacing is increased.

---

## AU. Do not use text embedded in images for UI labels

Besides accessibility concerns, image text does not reflow/resize properly.

Navigation, labels, status, buttons should be real text.

---

## AV. Icons should not shrink below recognition merely to fit

Responsive may reduce some decorative size but should not make meaningful icon controls microscopic.

If space is insufficient, reorganize.

---

## AW. Touch-target usability must survive responsive layouts

Even though Guide #4 covers interaction, responsive layouts must preserve target usability.

Do not let desktop 36px compact icon button become 22px tiny icon on mobile.

Usually the reverse is needed: mobile hit areas should be at least as usable.

---

## AX. Dense desktop tables may become more spacious touch layouts

Mobile need not preserve desktop density.

Touch interaction benefits from larger row targets, clearer separation, fewer simultaneous controls.

Same information, adapted interaction density.

---

## AY. Hover-only content must have a mobile equivalent

**Desktop:** hover appointment → quick controls

**Mobile:** tap appointment / overflow menu

Do not omit the action entirely.

---

## AZ. Responsive states need explicit design for empty/loading/error

Do not only design the normal desktop state.

For each major page verify at small widths: loading, empty, error, warning, many items, long labels, form errors, open drawer/modal.

Responsive design includes all system states.

---

## BA. Skeletons must reflow with final content

Desktop table skeleton should not remain a desktop-wide artifact when mobile layout transforms to cards.

Loading geometry should match the active responsive pattern.

---

## BB. Sticky elements must not consume the whole viewport at zoom

At high zoom, stacking global header, page header, tabs, filter bar, save bar can leave almost no usable content.

**Cursor rule:** Audit cumulative sticky height at narrow widths and high zoom.

---

## BC. Sticky headers must not cover focused content

When keyboard focus moves to an anchor/control, it must not be hidden beneath sticky UI.

Use appropriate scroll margins/offset handling.

---

## BD. Fixed bottom bars must not cover page content

Mobile save/action bars need content padding so final fields/actions are still reachable.

No hidden bottom rows behind sticky controls.

---

## BE. Safe areas must be respected on mobile devices

Where browser/device environments expose safe-area insets, avoid putting critical controls under notches, home indicator areas, rounded corners.

This is platform-responsive quality even though WCAG itself doesn’t prescribe specific safe-area CSS.

---

## BF. Do not assume hover or fine pointer at any width

Large-screen touch devices exist. Small-screen mouse-driven windows exist.

Use responsive layout and input-capability detection carefully.

**Viewport ≠ input method.**

---

## BG. Do not remove functionality simply because viewport is small

**Hard rule.** Mobile can reorganize advanced settings, complex editors, analytics — but authorized functionality remains reachable unless that function truly cannot meaningfully operate on that device and an equivalent method is provided.

“Desktop only” should be rare and justified.

---

## BH. Complex builders may use an adapted mobile read-only/limited mode only if essential functionality is otherwise available

For a workflow canvas, editing on a 320px viewport may be exceptionally difficult.

If editing is genuinely impractical: allow inspection, offer accessible alternative editing controls, or explicitly support a structured non-canvas editor.

Do not simply show **Use a desktop.** without evaluating whether an accessible alternative can satisfy the task.

---

## BI. Calendar grid exception does not eliminate responsive alternatives

Even though a calendar can qualify as two-dimensional essential content, Transovo should still provide agenda/list, date navigation, appointment detail where that improves usability.

WCAG exception is a minimum compliance boundary, not a design goal.

---

## BJ. Charts need responsive alternatives

At narrow width: simplify labels, stack legends, allow horizontal region where essential, provide data table/value summaries.

Never shrink chart text until unreadable.

---

## BK. Analytics KPI grids should reflow

**Desktop:** 4 KPI cards in one row

**Tablet:** 2 × 2

**Phone:** single-column or compact 2-column where legible

Do not preserve desktop columns at the expense of readability.

---

## BL. Page gutters should adapt

Desktop may use larger gutters. Mobile uses smaller but still comfortable gutters.

Example conceptual system: Wide 24–32 · Medium 20–24 · Narrow 16

Exact values belong to the visual design system.

The rule is: reduce margins before shrinking content itself.

---

## BM. Component density can adapt without changing semantics

**Desktop** may show customer | booking type | source | status | reminder | payment

**Mobile** may prioritize customer, time/type, status — with full detail one tap away.

This is acceptable because the same authoritative object remains available.

---

## BN. Content priority must be explicitly defined

For each dense component, define:

| Level | Content |
|-------|---------|
| **Must remain visible** | Critical identity/state |
| **Can collapse** | Secondary detail |
| **Can move to detail/overflow** | Rare actions/metadata |

Without priority rules, responsive implementations become arbitrary.

---

## BO. Source order should prioritize meaningful content

When layout transforms, users should encounter: object identity → primary state → important context → actions → secondary metadata.

Not whatever column happened to be first in desktop CSS.

---

## BP. Breakpoint transitions should not cause state loss

Test resizing live while: modal open, drawer open, filters active, form partially complete, tab selected, calendar date selected.

The app should not reset or crash because layout mode changed.

---

## BQ. Avoid duplicated desktop/mobile DOM when possible

Rendering desktop table + mobile cards and hiding one with CSS can cause duplicate accessibility content, duplicate focusable controls, state divergence.

Prefer shared semantic data/component structure when practical.

If duplicate representations are necessary, hidden variant must truly be removed from interaction/accessibility exposure.

---

## BR. Responsive behavior belongs at component level too

Do not solve responsiveness only at the page shell.

Each component needs rules for: button group, card, table, tabs, alert, form section, modal, drawer, timeline, chart, calendar control.

A responsive shell cannot fix rigid children.

---

## BS. Container-based behavior is often preferable for reusable components

A component may appear in full page, drawer, dashboard card. Its available width may differ even on same viewport.

Where supported/appropriate, design reusable components according to their container, not only global viewport breakpoints.

This is implementation guidance rather than WCAG requirement, but it prevents brittle responsive behavior.

---

## BT. Do not make text size depend excessively on viewport width

Avoid aggressive patterns that make typography tiny on small viewports or enormous on large displays.

Typography should primarily follow the design-system scale. Responsive type adjustments should be restrained.

---

## BU. Zoom is not the same as responsive simulation

A page that looks fine at 320px responsive viewport may still break at 1280px browser → 400% zoom.

WCAG explicitly relates the 320 CSS px reflow condition to 400% zoom on a 1280px starting viewport.

**Test both.**

---

## BV. Text-only enlargement must also be considered

WCAG Resize Text specifically concerns text resizing, not merely page scaling.

Fixed-height components can pass ordinary browser zoom but fail when font sizing/spacing changes independently.

Audit text containers.

---

## BW. At 200% text size, no essential text may be clipped behind ellipsis without recovery

If truncation exists: full value remains discoverable; critical instructions/errors should generally wrap instead.

Do not truncate form errors or primary object names without access to full value.

---

## BX. At 400% zoom, normal reading should remain one-directional where required

For ordinary pages, vertical scroll is expected.

Repeated horizontal → vertical → horizontal → vertical to read each line is the failure WCAG’s Reflow criterion is designed to avoid.

---

## BY. Horizontal scrolling components must support keyboard access

If a table/calendar/code region scrolls horizontally, keyboard users must be able to reach and operate its content.

Don’t create pointer-only horizontal scrolling.

---

## BZ. Scrollbars must not be intentionally hidden when they are the only indication of overflow

If a horizontally scrollable region exists, the user needs a discoverable way to know/use it.

Do not remove visible scroll affordances without providing equivalent cues/control.

---

## CA. Fixed overlays must not trap content at high zoom

Examples: chat widget, help button, cookie banner, persistent notification, save bar.

At high zoom they can occupy huge proportions of the viewport. Audit overlays under constrained space.

---

## CB. Banners should wrap and grow naturally

A warning such as **Microsoft sync is paused. Reconnect Microsoft to resume imported appointments.** must grow vertically.

Don’t force one-line banner layouts that clip at small widths.

---

## CC. Status badges should not force horizontal overflow

If status text becomes long: allow wrapping where appropriate, use concise canonical labels, reposition badges.

Do not reduce font size to unreadability.

---

## CD. Breadcrumbs need a responsive strategy

At small widths: truncate intermediate ancestors carefully, collapse with accessible overflow, keep current/nearest useful parent.

Do not allow a five-level breadcrumb to create page-wide horizontal scrolling.

---

## CE. Long page titles should wrap

**Example:** Initial consultation — New customer appointment may become two lines.

That’s preferable to clipping, shrinking to 11px, or pushing primary action offscreen.

---

## CF. Page actions may move below title

**Desktop:** Title + Primary action

**Mobile:** Title → Description → Primary action

Same hierarchy, different geometry.

---

## CG. Responsive content changes must not create unexpected context changes

Changing viewport size should not navigate user, reset wizard, close form unnecessarily, submit, or clear selection.

Responsive adaptation is presentation, not a product action.

---

## CH. Reduced viewport must not turn persistent instructions into hover-only info

When space becomes tight, do not move essential helper text into tooltips merely to save space.

Critical instructions remain available.

---

## CI. Mobile keyboard must not cover active field/action irrecoverably

Forms should scroll active controls into a visible position when software keyboard opens.

Avoid fixed layouts where input is hidden, Save cannot be reached, or modal cannot scroll.

---

## CJ. Virtual keyboard resizing must not corrupt viewport logic

On mobile browsers, opening keyboard changes effective viewport.

Do not close dialogs, reset drawer, or recalculate layout into unusable state. Test real field entry.

---

## CK. Date/time picker mobile behavior can use native platform controls where beneficial

Native mobile controls often provide accessibility, large touch targets, familiar interaction.

Use native controls where they satisfy product requirements.

Don’t replace them with a complex custom desktop picker merely for visual consistency.

---

## CL. Content must remain functional in narrow embedded contexts when intentionally supported

Public booking pages may be embedded inline.

Therefore test not just full browser width but embedded container.

If an inline booking widget is supported, it needs container-aware reflow.

---

## CM. Embeds must not assume parent-page width

Booking embed should work inside narrow website column, full-width page, modal-like container.

If minimum supported embed width exists, document and enforce it appropriately.

---

## CN. Public booking flow should prioritize single-column responsiveness

Customer-facing booking has a different context from admin SaaS.

On narrow devices: one clear decision at a time, large time-slot targets, clear progress, minimal admin-style density.

Same WCAG standards; different responsive optimization.

---

## CO. Email/SMS previews must not force layout overflow

Message preview should wrap/contain content.

Long links or template tokens should not blow out the editor.

---

## CP. Meeting transcript/recap content needs readable line width even on wide screens

Responsive does not only mean small-screen.

On 4K desktop, paragraphs should not stretch across the whole viewport.

Use task-appropriate max widths for text-heavy content.

---

## CQ. Ultra-wide monitors should not stretch forms indefinitely

Business settings form should not become 2200px-wide input.

Use meaningful maximum widths. Tables/calendars can use more width. Forms/prose should remain readable.

---

## CR. Width strategy must follow content type

| Width | Content |
|-------|---------|
| **Full-width** | calendar, workflow canvas, wide table, analytics grid |
| **Medium** | appointment detail, contact detail, booking editor |
| **Narrow/controlled** | settings form, onboarding, text-heavy content |

Responsive design is not one universal container.

---

## CS. Every component must declare overflow behavior

For text, row, table, chart, modal, drawer, tablist — define whether it wraps, truncates, scrolls, collapses, or reflows.

Do not leave overflow to accidental browser behavior.

---

## CT. Avoid overflow: hidden as a general layout fix

It often hides focus rings, enlarged text, dropdowns, errors.

Use it only when clipping is intentional and no essential content becomes inaccessible.

---

## CU. Focus rings must not be clipped by responsive containers

If a control sits at edge of scroll/card region, visible focus must still render sufficiently.

Don’t let overflow rules cut it off.

---

## CV. Testing must include real zoom levels

At minimum QA: 100%, 200%, 400% where relevant to reflow testing.

And text enlargement where test environment supports it.

Do not rely only on device emulation.

---

## CW. Testing must include representative viewport widths

At minimum conceptual coverage: narrow phone, larger phone, tablet/narrow laptop, standard desktop, wide desktop.

Exact breakpoint values belong to implementation/design system.

---

## CX. Test both portrait and landscape

Especially: booking flow, calendar, forms, drawers, modals.

WCAG orientation requirement makes this mandatory unless orientation is genuinely essential.

---

## CY. Test realistic worst-case content

Responsive QA must include: long contact name, long booking type, long email, multiple status badges, long error, long helper text, timezone, translated-length-like strings, many table columns, no data, large data.

Mockup-perfect short labels are insufficient.

---

## CZ. Test dynamic states at narrow widths

For example: Microsoft error banner, SMS eligibility warning, payment failure, workflow validation issues, loading states, modal open, keyboard open, filter sheet open.

Responsive bugs often appear only in exceptional states.

---

## DA. No horizontal page scrolling acceptance rule

For standard pages at required reflow sizes, `document.documentElement.scrollWidth` should not exceed viewport width due to normal content, except intentional isolated essential regions.

This can be automated as a lightweight check where feasible.

---

## DB. No clipped-text acceptance rule

At 200% text resize, critical headings, labels, button text, errors, status, form values must remain fully perceivable or have an appropriate accessible recovery path.

---

## DC. Responsive state must use the same underlying business state

Do not maintain desktop filter state and separately mobile filter state.

One source of truth. Different presentation. Same application data.

---

## DD. Responsive layouts must not duplicate actions with inconsistent runtime behavior

If mobile has a different Save button component than desktop, both must invoke the same canonical action and validation.

Do not fork business behavior per breakpoint.

---

## DE. Server-rendered/hydrated state must not flash the wrong layout materially

Where possible, avoid desktop sidebar briefly appears on phone → disappears in a disruptive way.

Hydration/layout should minimize visible instability.

This is performance/UX best practice rather than a direct WCAG criterion, but materially affects perceived quality.

---

## DF. Responsive transitions should avoid layout shift during ordinary use

When loading appointments, filters, navigation — reserve expected geometry where feasible.

No sudden jumps that move controls under pointer/focus.

---

## DG. Component breakpoints must be documented

For reusable components, document:

```
Table — wide: table; narrow: condensed table/card
Drawer — wide: side panel; narrow: full-screen
Filters — wide: inline; narrow: filter sheet
```

Cursor must not invent the responsive behavior differently on each page.

---

## DH. Responsive behavior belongs in the design system

Any shared component should ship with its responsive rules.

Do not build Button desktop then later special mobile button unless they are genuinely different components.

One system.

---

## DI. Accessibility exceptions must be documented, not assumed

If a region depends on two-dimensional layout under WCAG’s Reflow exception, Cursor should document:

- why 2D layout is essential
- which region gets the exception
- what alternative navigation/view exists if any

**Examples:** calendar, workflow canvas

Do not casually claim **It’s a dashboard, so horizontal scroll is okay.**

---

## DJ. Responsive design should exceed the minimum where practical

WCAG defines minimum conformance.

Premium Transovo behavior should aim higher: good mobile agenda instead of barely scrollable calendar, clean card transformation rather than giant table scroll, contextual full-screen detail rather than cramped drawer.

Compliance is the floor. Usability remains the goal.

---

## Transovo Responsive / Reflow / Zoom Acceptance Checklist

Every applicable page/component should pass:

- [ ] Works in portrait and landscape unless orientation is truly essential
- [ ] Browser zoom is not disabled
- [ ] Text can resize to 200% without loss of content/functionality
- [ ] Normal vertically scrolling content reflows at 320 CSS px equivalent width
- [ ] No page-wide horizontal scrolling for ordinary content
- [ ] Essential two-dimensional regions are isolated and justified
- [ ] Meaningful reading/DOM order survives responsive reflow
- [ ] Global navigation remains fully reachable
- [ ] Mobile uses same conceptual IA and canonical labels
- [ ] Primary page action remains prominent
- [ ] Secondary actions collapse before primary actions
- [ ] No essential function disappears on narrow viewports
- [ ] Text is not shrunk below design-system minimum merely to fit
- [ ] Fixed heights do not clip enlarged text
- [ ] Form controls expand appropriately with text
- [ ] Forms collapse columns before they become cramped
- [ ] Related fields remain grouped after stacking
- [ ] Tables have a documented narrow-screen strategy
- [ ] Horizontal table/calendar scrolling is isolated to the component
- [ ] Mobile row/card transformations preserve field relationships
- [ ] Calendar has a usable narrow-screen presentation
- [ ] Calendar actions remain available without hover/drag
- [ ] Drawers transform appropriately on small screens
- [ ] Modals fit and remain operable at narrow widths/high zoom
- [ ] Tabs have a documented narrow-screen behavior
- [ ] Filters collapse predictably while preserving active-filter state
- [ ] Search remains usable
- [ ] Long labels/URLs/names cannot break page width
- [ ] Important text wraps rather than clips
- [ ] Truncated information has a recovery path
- [ ] Sticky elements do not consume or cover the usable viewport
- [ ] Fixed bottom bars do not cover content
- [ ] Focused content is not hidden beneath sticky UI
- [ ] Touch target usability is preserved
- [ ] Hover-only behavior has touch/keyboard equivalent
- [ ] Breakpoint changes do not reset task state
- [ ] Orientation changes do not reset task state
- [ ] Mobile keyboard does not make active controls unreachable
- [ ] Public booking embeds reflow within supported containers
- [ ] Wide screens do not produce unreadably long prose/form lines
- [ ] Component overflow behavior is explicitly defined
- [ ] Focus indicators are not clipped
- [ ] 100%, 200%, and relevant 400% zoom tested
- [ ] Narrow phone/tablet/desktop widths tested
- [ ] Portrait and landscape tested
- [ ] Long/realistic content tested
- [ ] Loading/error/empty states tested responsively
- [ ] Desktop/mobile variants use one authoritative business state
- [ ] Responsive behavior is documented in reusable components

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom (this file)
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md     → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #6: Responsive, Reflow & Zoom Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*


===== [Formal #7 — Table & Grid Semantics] docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md =====
# Transovo Table & Grid Semantics Standards Guide

**Series:** Implementation standards · **Guide #7 of 12**  
**Status:** Active — mandatory hard standard for structured data tables and interactive data grids  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** WHATWG HTML Living Standard · WCAG 2.2 SC 1.3.1 Info and Relationships · W3C WAI Tables Tutorial · WAI-ARIA Authoring Practices Guide Grid Pattern

---

## Master Cursor rule

> **Transovo must use semantic HTML tables for genuinely tabular information and must preserve row/column/header relationships programmatically in accordance with the HTML Standard, WCAG 2.2 SC 1.3.1, and W3C WAI Tables guidance.** Use `<th>`, `<td>`, `scope`, captions, and explicit header associations as required by the complexity of the data. Never use tables for page layout, and **never use ARIA grid merely because a table contains buttons, sorting, row navigation, or selection.** A true ARIA grid is a composite interactive widget and may be used only when spreadsheet-like keyboard interaction is actually required and the complete WAI-ARIA APG focus/navigation model is implemented and tested. Sorting, filtering, pagination, selection, responsive transformation, virtualization, and real-time updates must preserve the data’s semantic relationships, user context, keyboard focus, and authoritative state.

**This guide controls how Transovo presents structured data in tables and when an interactive data grid is appropriate instead.**

---

## First hard rule

**A table and a grid are not interchangeable.**

- Use **semantic HTML tables** for normal tabular information.
- Use an **ARIA grid** only when the interface genuinely behaves like an interactive spreadsheet/application grid and the complete keyboard/focus model is implemented.

That distinction matters a lot for Transovo.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Use tables only for genuinely tabular information

W3C defines tabular information as information whose relationships exist in two dimensions — rows and columns — and whose meaning depends on those relationships.

**Good table candidates in Transovo:** Appointment list, Contacts list, Transactions, Workflow execution history, Reminder delivery logs, Meeting list, Integration logs, Analytics reports.

**Bad table candidates:** Appointment detail page, Booking Type editor, Settings form, Dashboard card layout, Navigation, General page layout.

**Cursor rule:** Never use `<table>` merely to align content into columns. W3C explicitly says data-table guidance is not for using tables as page-layout mechanisms.

---

## B. Use native HTML table semantics by default

For ordinary tabular data, use:

```html
<table>
  <caption>Upcoming appointments</caption>
  <thead>
    <tr>
      <th scope="col">Customer</th>
      <th scope="col">Date</th>
      <th scope="col">Booking type</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    ...
  </tbody>
</table>
```

The HTML standard defines these native relationships directly.

**Cursor rule:** Prefer native `<table>`, `<th>`, `<td>`, `<thead>`, `<tbody>`, `<caption>` semantics over recreating a visual table using generic `<div>` elements.

---

## C. Header cells must actually be header cells

W3C’s Tables Tutorial requires header cells to use `<th>` and data cells to use `<td>` so assistive technologies can expose their relationship.

**Incorrect:** `<td class="bold">Customer</td>`

**Correct:** `<th scope="col">Customer</th>`

Bold visual appearance is not semantic structure.

---

## D. Use scope when header direction needs to be explicit

For column headers: `<th scope="col">Status</th>`

For row headers: `<th scope="row">Anthony Johnson</th>`

W3C specifically recommends `scope="col"` and `scope="row"` where header relationships could otherwise be ambiguous.

**Cursor rule:** Simple tables with meaningful headers should explicitly associate those headers with their row/column where appropriate.

---

## E. Complex tables require explicit header relationships

If a table has multi-level headings, groups of columns, irregular spanning headers, or row and column groups, then simple top-row `<th>` markup may not be sufficient.

W3C documents `scope="rowgroup"`, `scope="colgroup"`, `id`, and `headers` for more complex relationships.

**Cursor rule:** Do not visually construct multi-level table headers without ensuring every data cell has an understandable programmatic relationship to its applicable headers.

---

## F. Keep table structures as simple as the data permits

A complex table is harder for screen-reader navigation, responsive adaptation, visual scanning, implementation, and maintenance.

If one table needs six header levels, nested groups, and hidden row/column semantics — ask whether the data should be separated into multiple simpler views.

Complex markup is allowed. Unnecessary complexity is not desirable.

---

## G. Use a table caption when the table needs an identity

W3C says a `<caption>` functions like a table heading and helps users identify and navigate tables, especially screen-reader users navigating table-to-table.

**Example:** `<caption>Reminder delivery history</caption>`

But don’t duplicate an immediately adjacent heading unnecessarily if the relationship is already established accessibly.

**Cursor rule:** Each standalone data table must have a programmatically identifiable purpose, using `<caption>` or an appropriate equivalent relationship.

---

## H. Complex tables may need a structural summary

W3C recommends summaries where a complex table’s organization requires explanation.

**Example:** Columns are grouped by reminder channel. Each channel contains Sent, Delivered, and Failed totals.

This can help users understand the data model before navigating many cells. Do not provide redundant summaries for trivial tables.

---

## I. Table structure must survive presentation changes

WCAG 1.3.1 exists specifically so visual relationships remain available when presentation changes, including screen-reader or alternate rendering.

If sighted user can understand **Anthony Johnson → Sep 8 → Confirmed** because columns line up visually, screen-reader users must receive the same row/column relationships programmatically.

---

## J. Visual spacing cannot be the only table structure

Never create pseudo-tables using Anthony / Sep 8 / Confirmed with spaces, tabs, CSS positioning, or `<pre>`.

WCAG specifically identifies failure patterns where whitespace or nonsemantic markup is used to represent tabular information.

---

## K. Use a static table unless interactive-grid behavior is genuinely needed

**This is one of the most important rules.**

WAI APG distinguishes normal tables from grids. A grid is a composite widget:

- it contains focusable cells/items
- usually only one internal element participates in the page Tab sequence
- arrow/Home/End keys navigate within it
- the author must manage focus

Therefore: **Appointment list** with sortable columns, row links, and action menu does **not** automatically need ARIA grid. A semantic table can handle that.

---

## L. Sorting does not automatically make a table a grid

A normal semantic table can have sortable column headers.

**Example:** Customer ↕ · Date ↑ · Status

The sort control can be a button inside the `<th>`.

Do not switch to `role="grid"` just because rows are sortable, there are buttons, or rows have menus. Grid should be used only when the entire data region adopts managed interactive navigation.

---

## M. Row clickability does not automatically make a table a grid

A normal table row may contain contact link, appointment link, action menu without requiring ARIA grid semantics.

Avoid putting a click handler on `<tr>` if that creates inaccessible ambiguous interaction. Prefer explicit focusable elements inside cells where appropriate.

---

## N. ARIA grid creates a full interaction contract

If Cursor uses `role="grid"`, it must implement the complete interaction model.

WAI APG explicitly states that a grid requires author-managed focus and directional keyboard navigation.

That means:

- one appropriate grid entry point in normal Tab order
- arrow-key navigation
- Home/End behavior
- row/column semantics
- focusable cells or child widgets as required
- selected state where applicable
- editing behavior
- assistive-technology testing

**Cursor rule:** Never add `role="grid"` as an accessibility decoration.

---

## O. “No ARIA is better than bad ARIA”

W3C’s APG examples explicitly warn that poor ARIA implementations can reduce accessibility and that semantic HTML should be maximized.

**Cursor rule:** If a semantic table adequately represents the data and interaction, do not replace it with a custom ARIA data grid.

---

## P. A true data grid is appropriate for spreadsheet-like interaction

**Potential examples:** editable cells, cell-by-cell keyboard navigation, keyboard selection, copy/paste, complex row/column selection, large interactive matrix.

**Potential Transovo candidates:** possibly a sophisticated scheduling matrix, possibly a future spreadsheet-style bulk editor.

**Not typical candidates:** Contacts, Payments, Workflow logs, Meetings list.

---

## Q. Every grid cell must fit the grid’s focus model

APG says data-grid cells are themselves focusable or contain focusable elements, with limited exceptions for noninteractive headers.

Do not build a grid where some cells participate in arrow navigation, others require random Tab presses, some cannot receive focus, or focus vanishes inside embedded controls — without explicitly managing those transitions.

---

## R. Composite widgets inside grid cells require special handling

W3C notes that grid arrow keys may conflict with controls inside a cell, such as combobox, slider, editable field, radio group.

The interface needs a clear distinction between **navigating the grid** and **interacting with/editing the cell**.

Cursor must implement this intentionally if using a true grid.

---

## S. Static table focus should remain simple

For ordinary tables, only actually interactive elements should be focusable: links, buttons, checkboxes, form fields.

Plain data cells should not all receive `tabindex="0"`. That would create hundreds of unnecessary Tab stops.

---

## T. Focus order must preserve row/column meaning

WCAG 2.4.3 requires focus order that preserves meaning and operability.

For a normal table row: Customer link → Booking link → Action menu — keyboard order should follow a predictable row sequence.

Do not visually show one order while DOM focus jumps unpredictably between columns.

---

## U. DOM order and visual table order should align

W3C recommends source/DOM order matching visual order where possible because mismatches confuse screen reader users, magnifier users, and keyboard users.

Avoid CSS tricks that visually reorder table columns without corresponding semantic order.

---

## V. Sorting must be operable with keyboard

If a column can be sorted by pointer, keyboard users must be able to perform the same sort.

Use an actual focusable control in the header.

**Example:**

```html
<th scope="col">
  <button>Appointment date</button>
</th>
```

Do not make the `<th>` itself mouse-clickable without appropriate interaction semantics.

---

## W. Sort state must be programmatically conveyed

If **Appointment date ↑** means ascending, assistive technology needs the sort state too.

Use appropriate table/ARIA sort semantics, e.g. `aria-sort` on the relevant column header when applicable.

Do not communicate sort direction only through arrow icon or color.

---

## X. Only the currently sorted header should expose active sort direction

Avoid marking every sortable column as ascending or none in confusing ways.

The active sort state should accurately represent the current data order.

---

## Y. Sorting must not silently change unrelated filters

If user sorts by Date, do not reset staff filter, status filter, search query, or selected date range.

Sorting changes ordering. It should not alter the dataset unless explicitly intended.

---

## Z. Filters belong outside or clearly above the table

Filters are controls over the dataset, not table-column data themselves.

**Typical:**

```
Search   Status ▼   Date ▼   More filters
[table]
```

Column-specific filters can exist when appropriate, but they still require clear interaction and accessible naming.

---

## AA. Table search scope must be clear

If search field above Appointments table searches customer, booking type, and email — that scope should be understandable.

Don’t create a search input whose behavior mysteriously differs by column.

---

## AB. Row selection must use real selection controls

For multi-row selection, use checkbox semantics.

Typical: checkbox in each row, select-all checkbox in header.

Do not make users Ctrl-click random rows unless that is an optional accelerator.

---

## AC. Selection state must not rely on row background alone

Selected row can have checked checkbox and visual highlight.

The checkbox/state carries meaning. Background color reinforces it.

---

## AD. Select-all scope must be explicit

**This is crucial with pagination.**

| Meaning |
|---------|
| Select all 25 rows on this page |
| Select all 2,430 matching appointments |

These are very different.

**Cursor rule:** Never make a select-all checkbox ambiguous across pagination/filter scope.

---

## AE. Bulk action bar must clearly show selected count

**Example:** `12 appointments selected` · Reschedule | Cancel | More

Do not require users to count highlights.

---

## AF. Bulk actions must operate only on explicit selection

Changing filter while rows are selected requires defined behavior.

Possible: selection persists if objects remain in scope, or selection clears with explicit notice.

Do not allow hidden selected rows to remain dangerously selected without the user understanding.

---

## AG. Row action menus need accessible names

Instead of every row exposing a button named **More**, use accessible context such as **More actions for Anthony Johnson’s appointment**.

Visible UI can still show •••. This reduces ambiguity for assistive technology.

---

## AH. Avoid too many per-row actions

A table row should not contain 9 buttons, 5 status controls, and multiple toggles.

That hurts scanability and keyboard efficiency.

Expose primary link/action, one or two frequent actions, overflow for secondary actions — where appropriate.

---

## AI. Row identity should be visually strongest

For Appointment List:

- **Primary:** Anthony Johnson
- **Secondary:** Initial consultation
- **State:** Confirmed
- **Actions:** •••

Do not let metadata visually overpower the object identity.

This part is best practice rather than a normative HTML rule, but it supports effective structured data scanning.

---

## AJ. Numeric columns should align consistently

For amount, counts, percentages — right alignment generally improves comparison.

Text remains left-aligned.

This is a visual/data-density convention rather than WCAG rule, but it should be consistent in Transovo.

---

## AK. Dates must use a consistent format within a table

Do not mix Sep 8, 09/09/2026, Tomorrow, and September 10th within the same comparison column without a clear reason.

Formatting details are governed by the Date/Time standards guide later. The table rule is consistency.

---

## AL. Status labels must be explicit text

Use **Confirmed** — not merely a green dot.

Use **Failed** — not merely red icon.

Tables fall under WCAG’s requirement that visual relationships and meaning not depend solely on presentation.

---

## AM. Status badges should not overwhelm table density

If a row has Confirmed, Paid, Synced, SMS ready, Imported, and Teams all as colored badges, scanning becomes difficult.

Show only the states needed for comparison. Move deeper state to detail view.

---

## AN. Long cell content needs a defined strategy

For fields such as long booking type, long customer name, meeting URL, email — choose wrap, truncate with accessible recovery, or open detail.

Do not let unpredictable text blow out column geometry.

---

## AO. Critical values should not be permanently truncated

If user must distinguish **Consultation — Returning Patient** from **Consultation — New Patient**, both can’t permanently appear as **Consultation — …**

Provide sufficient visible difference or access to full text.

---

## AP. Tooltips are not a substitute for usable table content

A user should not need to hover every row to know what it says.

Tooltips can reveal occasional full values. They should not carry primary table meaning.

---

## AQ. Sticky table headers must preserve semantics

Visually sticky `<thead>` is fine.

Do not duplicate header markup in a second fake layer that creates duplicate screen-reader content or breaks header associations — unless implemented carefully.

Prefer sticky positioning on the real header.

---

## AR. Sticky columns require careful focus/reading-order behavior

If first column remains fixed while table scrolls:

- semantic column order remains correct
- focus doesn’t jump
- duplicated clone cells are avoided or hidden correctly

Visual convenience must not duplicate accessible data.

---

## AS. Table virtualization must preserve accessibility information

Large datasets may virtualize rows.

If using an interactive grid, APG notes ARIA properties such as `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex` may be necessary when rows/columns aren’t all present in DOM.

For semantic tables, virtualization can be challenging.

**Cursor rule:** Do not add aggressive row virtualization without testing keyboard/screen-reader behavior and preserving meaningful row position/context.

---

## AT. Virtualization must not break browser find or assistive navigation unintentionally

If only visible rows exist in DOM:

- browser Find may not locate offscreen data
- screen readers may perceive partial data
- row counts may be misleading

Use virtualization only where dataset/performance justifies the UX tradeoff.

---

## AU. Pagination is often preferable to uncontrolled infinite tables

For large operational datasets, pagination provides clear boundaries, stable location, predictable navigation.

Infinite scrolling may be used, but requires deliberate focus/state handling.

Do not use infinite scrolling solely because it feels modern.

---

## AV. Pagination must expose current position

Users should know **Page 3 of 24** or equivalent record range **51–75 of 592** where practical.

Do not give only Previous | Next if total/range is known and useful.

---

## AW. Pagination controls need accessible names

Examples: Previous page, Next page, Page 3, Go to page 4.

Current page should be programmatically identifiable.

---

## AX. Changing page must preserve active filters and sorting

Page 2 should represent the same query.

Do not reset status, search, or sort when paging.

---

## AY. Returning from detail should restore table context

If user filtered to Unconfirmed, sorted by Date, opened row 38, and returns — preserve filters, sort, page, and reasonable scroll position.

This dramatically improves operational efficiency.

---

## AZ. Empty tables require a proper empty state

Do not render Customer | Date | Status with nothing else.

Show **No appointments match these filters.** with actions such as Clear filters or New appointment depending on context.

---

## BA. “No data” and “no results” are different

| State | Message |
|-------|---------|
| First use | No appointments yet. |
| Search/filter | No appointments match “Anthony”. |
| Error | Appointments couldn’t be loaded. |

Three different states. Do not present all as an empty table.

---

## BB. Loading is not an empty table

While fetching: skeleton rows, loading state.

Do not temporarily show **No appointments** and then replace it with data. That communicates false state.

---

## BC. Partial data needs explicit state

If some pages/results loaded but a provider failed: **184 appointments loaded. Microsoft import is temporarily unavailable.**

Do not silently present incomplete results as complete.

---

## BD. Table errors need recovery

**Example:** Appointments couldn’t be loaded. **Retry**

Do not leave the user staring at blank columns.

---

## BE. Column visibility settings need stable semantics

If users can hide columns: hidden state persists predictably, essential identity/actions cannot become impossible to find, reset defaults available.

Don’t allow a user to accidentally hide every identifying field.

---

## BF. Default columns should match primary task

**Appointments** — likely more useful: Customer, Date/time, Booking type, Confirmation, Reminder — than internal ID, createdAt, provider event ID.

Backend importance is not user importance.

---

## BG. Do not expose internal identifiers as primary table data

Provider IDs, UUIDs, webhook IDs belong in details or developer diagnostics — not ordinary operational tables unless users actually need them.

---

## BH. Column labels must be specific

**Bad:** Type — if unclear whether it means appointment type, payment type, or calendar type.

**Better:** Booking type

Clarity beats extreme brevity.

---

## BI. Avoid icon-only column headers unless universally understood and accessible

A column headed only **$** may be understandable in context but still needs appropriate accessible naming.

A column headed only by bell icon for reminders is likely too ambiguous. Use text where ambiguity exists.

---

## BJ. Column header controls must not obscure the header name

If header includes sort/filter buttons, screen-reader name should remain understandable.

**Example:** Appointment date, sorted ascending — not Button, ascending.

---

## BK. Actions column should have accessible meaning even if visual header is blank

A blank visual heading for trailing ••• actions may be acceptable visually.

Programmatically, the structure should still make sense. Row action controls themselves need contextual names.

---

## BL. Row headers can improve complex tables

If each row is fundamentally identified by one field, use it as row header when appropriate.

**Example:** `<th scope="row">Anthony Johnson</th>`

Then screen-reader users can more readily associate other values in that row with the customer.

W3C explicitly supports row headers through `<th scope="row">`.

---

## BM. Do not make every first cell a row header automatically

Only do so when that value genuinely identifies/describes the row.

For an anonymous raw log table where first column is merely timestamp, row-header semantics may not be meaningful.

Semantics should reflect actual relationships.

---

## BN. Spanning cells should be minimized where not necessary

`rowspan` and `colspan` are valid HTML features. But complex spanning structures increase navigation complexity.

Use only when data model genuinely contains grouped relationships. Do not use spanning just for visual style.

---

## BO. Do not merge cells to create decorative headings

If you need a visual section, use actual section/page structure rather than abusing table cells.

Tables describe data relationships.

---

## BP. Tables should not contain giant forms unless spreadsheet interaction is intentional

If every row contains 8 editable fields, date picker, dropdown, and buttons — you are moving toward data-grid/spreadsheet interaction.

At that point explicitly decide whether inline editing is actually appropriate, edit drawer/detail page would be clearer, or real grid semantics are needed.

Do not drift accidentally into an inaccessible pseudo-grid.

---

## BQ. Inline editing must have a clear mode

If a cell becomes editable, user must understand: which cell is editing, how to save, how to cancel, validation errors, whether moving away saves/discards.

Do not turn plain text cells into controls on hover with no clear state.

---

## BR. Inline editing may not rely on double click

Provide explicit keyboard-accessible action such as Edit button, Enter when cell selected in true grid, or row action.

Double-click may be an accelerator, never the sole path.

---

## BS. Saving one row should not reload the entire table unnecessarily

Preserve focus, sort, filters, selection, scroll. Update the affected row.

Operational tables should feel stable.

---

## BT. Background updates must not reorder focused rows unexpectedly

If appointment status changes in real time, don’t suddenly sort the focused row to another place while user is interacting.

Possible pattern: **Updates available** — or update row without reorder until safe.

Preserve interaction stability.

---

## BU. Real-time updates must reflect truthful state

If reminder becomes **Delivered**, update appropriately.

But don’t fake status before authoritative result.

System state in tables must use the same canonical source as detail pages.

---

## BV. Table and detail state must never disagree

If table says **Confirmed** and Appointment Detail says **Scheduled / not confirmed** — one is stale/broken.

Shared status components/data should derive from one authoritative state model.

---

## BW. Table status terminology must match the rest of Transovo

No Table: Done · Detail: Completed · Analytics: Finished.

Pick **Completed** and use it everywhere.

This follows the consistent-identification standards already established.

---

## BX. Table sorting rules must match data meaning

Dates sort chronologically. Currency sorts numerically. Names sort according to locale-aware text rules where appropriate.

Don’t sort formatted strings lexicographically if that produces incorrect results.

---

## BY. Null/missing values need one consistent representation

Examples: — · Not set · No phone number — choose according to meaning.

Do not mix N/A, None, Null, ●, blank arbitrarily.

Missing values should not be confused with zero or false.

---

## BZ. Zero, false, and missing are different

**Example:** `0 reminders` does not mean **Reminder data unavailable.**

Table representation must preserve semantic differences.

---

## CA. Date/time timezone must be explicit where ambiguity exists

Table may display **Sep 8 · 2:00 PM**.

If users span timezones and context isn’t obvious, include timezone or establish one clearly at page level.

The Date/Time standards guide will define formatting.

---

## CB. Responsive transformation must preserve header relationships

If desktop table becomes mobile cards, column header context may need to become visible labels.

**Desktop:** | Confirmation | Confirmed |

**Mobile:** Confirmation: Confirmed

Do not remove the semantic relationship just because the table visual disappears.

---

## CC. A responsive card version does not need table semantics if it is no longer tabular

If mobile representation becomes a list of self-contained records, semantic list/article structures may be more appropriate.

Do not force `<table>` semantics onto a fundamentally transformed mobile layout unless relationships remain tabular.

But ensure hidden desktop/mobile duplicates aren’t both exposed simultaneously.

---

## CD. Horizontal scrolling is acceptable for genuinely comparative tables

WCAG Reflow allows two-dimensional scrolling where two-dimensional layout is necessary for meaning/use. Complex data tables can qualify. The responsive guide governs this more fully.

**Cursor rule:** If a table must remain wide, isolate horizontal scrolling to the table region rather than the whole page.

---

## CE. Sticky action columns must not cover data

If trailing actions are sticky: no overlapping cells, proper z-index/background, focus visible, accessible order unchanged.

Test at zoom and narrow widths.

---

## CF. Fixed column widths should be used sparingly

**Appropriate:** checkbox, status icon, compact amount

**Flexible:** customer name, booking type

Do not assign every column an arbitrary pixel width that collapses under real content.

---

## CG. Column sizing should reflect comparison importance

**Example Appointment table:** Customer and Date deserve enough width. Internal source metadata can be narrower or hidden in detail.

Column geometry should follow user task importance.

---

## CH. Tables need row and column scanability

Use consistent row height, alignment, spacing, typography.

But don’t use excessive borders or zebra striping automatically.

Visual styling belongs to the design system; semantic hierarchy remains independent.

---

## CI. Row hover is supplemental

Hover may help pointer users identify current row.

But keyboard focus needs its own state, selected row needs its own state, touch users need no hover dependency.

Do not use hover as the only indication that a row can be opened.

---

## CJ. Row focus and selection must be distinguishable

If a table supports selection:

- **focus** = where keyboard is
- **selection** = included in action set

Do not use identical background for both. This aligns with APG interaction principles.

---

## CK. Tables with links must preserve clear link purpose

**Example customer cell:** Anthony Johnson links to contact. Date cell might link to appointment.

Do not make every cell link to the same detail page unless that actually improves usability; repeated redundant links can create excessive keyboard stops.

---

## CL. Whole-row navigation needs careful semantics

If whole row opens appointment, prefer an explicit primary link inside the row while allowing pointer row activation as enhancement if implemented safely.

This gives keyboard/screen-reader users a standard navigation element.

---

## CM. Do not nest interactive controls illegally

Avoid clickable row implemented as `<a>` containing buttons/menu.

Interactive elements nested inside interactive elements create invalid or confusing semantics. Structure row actions separately.

---

## CN. Exported tables must preserve understandable headers

CSV/PDF exports are separate formats, but the exported data should retain meaningful column names, ordering, units, date/time context.

If PDF is accessible, its table structure must also be tagged appropriately.

Do not export internal field names just because backend uses them.

---

## CO. Screen-reader testing is required for representative tables

At minimum test: simple table, table with row actions, sortable table, selectable table, any complex grouped table, any true ARIA grid.

Verify users can understand: table identity, headers, row identity, sort state, selection, actions.

---

## CP. Keyboard testing must include complete table tasks

**Example:** Find Anthony’s appointment, sort by date, open it, return, select two rows, perform bulk action.

Not merely: Can I Tab through the page?

Operational task testing matters.

---

## CQ. Large tables need performance without sacrificing semantics

Optimization cannot justify inaccessible virtualization, broken focus, missing rows, misleading counts.

Performance and accessibility both need to work.

If necessary: paginate, lazy-load predictably, virtualize only with a validated accessibility strategy.

---

## CR. Table semantics must match actual data, not appearance

WCAG 1.3.1 explicitly treats misuse of structural markup as a failure when markup does not represent real content relationships.

Do not use `<th>` merely to make text bold. Do not use table roles for a card layout.

Semantics must be truthful.

---

## CS. The table/grid decision must be documented per reusable component

For every reusable dense data component, Cursor should explicitly classify it as:

- Static/read-oriented semantic table
- Interactive data grid
- List/card collection

Do not leave this ambiguous.

---

## CT. Default Transovo classification

Unless evidence shows otherwise:

**Use semantic tables for:** Appointment list, Contacts, Transactions, Reminder history, Workflow activity/logs, Meeting lists, Integration logs, reports.

**Use list/card layouts for:** mobile transformed records, dashboard queues, contextual activity timelines.

**Use ARIA grid only for:** genuinely spreadsheet-like interactive datasets, specialized scheduling matrices if they implement complete grid behavior.

This should be Cursor’s default assumption.

---

## Transovo Table / Grid Acceptance Checklist

Every applicable table/grid should pass:

- [ ] Data is genuinely tabular before using table semantics
- [ ] Tables are not used for page layout
- [ ] Native HTML table semantics are used by default
- [ ] Header cells use `th`, not styled `td` elements
- [ ] Row/column relationships are programmatically determinable
- [ ] `scope=row/col` used where appropriate
- [ ] Complex headers have explicit correct associations
- [ ] Table has an understandable programmatic identity/caption where needed
- [ ] Complex table has explanatory summary where necessary
- [ ] Visual relationships survive assistive/alternate presentation
- [ ] Table structure is no more complex than necessary
- [ ] ARIA grid is not used merely because table is interactive
- [ ] Sorting alone did not trigger unnecessary grid semantics
- [ ] Row clickability alone did not trigger unnecessary grid semantics
- [ ] Any actual ARIA grid implements complete keyboard/focus behavior
- [ ] Grid cells and embedded controls follow APG interaction model
- [ ] Plain table cells are not added to Tab sequence unnecessarily
- [ ] DOM/reading/focus order matches logical visual order
- [ ] Sort controls are keyboard operable
- [ ] Sort direction is programmatically exposed
- [ ] Search/filter state persists through sorting/pagination
- [ ] Row selection uses explicit accessible selection controls
- [ ] Select-all scope is explicit
- [ ] Selected count is visible for bulk actions
- [ ] Bulk actions operate only on clearly selected rows
- [ ] Row action menus have contextual accessible names
- [ ] Primary row identity is clear
- [ ] Status is not communicated by color alone
- [ ] Long values have an explicit wrap/truncate/recovery strategy
- [ ] Critical values are not permanently obscured
- [ ] Sticky headers use real semantic header structure where possible
- [ ] Sticky columns do not duplicate accessible content
- [ ] Virtualization preserves row/column context or is avoided
- [ ] Pagination exposes position/range where useful
- [ ] Filters/sort/page are preserved when returning from detail
- [ ] First-use/no-results/error/loading states are distinct
- [ ] Partial datasets are labeled as partial
- [ ] Default columns reflect user tasks rather than backend fields
- [ ] Internal IDs are not exposed as primary data without reason
- [ ] Missing/zero/false values are differentiated correctly
- [ ] Table/detail status derives from same authoritative state
- [ ] Responsive representation preserves field relationships
- [ ] Horizontal scrolling is isolated to the table where necessary
- [ ] Inline editing has clear edit/save/cancel semantics
- [ ] Real-time updates do not steal focus or reorder active rows unexpectedly
- [ ] No invalid nested interactive elements
- [ ] Screen-reader QA performed on representative tables
- [ ] Keyboard task QA performed
- [ ] True data grids receive dedicated APG/assistive-technology QA

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids (this file)
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #7: Table & Grid Semantics Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*


===== [Formal #8 — Privacy, Consent & Compliance UX] docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md =====
# Transovo Privacy, Consent & Compliance UX Standards Guide

**Series:** Implementation standards · **Guide #8 of 12**  
**Status:** Active — mandatory hard standard for consent, privacy choices, messaging permissions, opt-outs, data collection, recording notices, compliance registration, and privacy-related user decisions  
**Audience:** Engineers, designers, product owners, compliance stakeholders, and Cursor agents building Transovo  
**Authorities:** FCC (TCPA) · FTC (CAN-SPAM, deceptive practices) · CTIA Messaging Principles & Best Practices · GDPR · CCPA/CPRA · NIST Privacy Framework

---

## Master Cursor rule

> **Transovo privacy, consent, and compliance behavior must be purpose-specific, channel-specific, evidence-based, and enforceable at runtime.** Do not model consent as one generic boolean. Preserve the exact provenance, scope, timestamp, and version of affirmative consent where consent evidence is relied upon, and preserve subsequent withdrawal or opt-out history. Never infer required consent from silence, inactivity, preselected controls, broad Terms acceptance, AI inference, or imported data. Follow applicable FCC/TCPA requirements for regulated calls/texts, FTC CAN-SPAM requirements for covered commercial email, CTIA messaging principles and carrier registration requirements for application messaging, and applicable privacy-law requirements such as GDPR and CCPA/CPRA. **Sender registration and recipient permission are separate concepts; A2P approval alone never constitutes recipient consent.** Every outbound communication path must use one centralized deterministic eligibility and suppression layer and re-check eligibility at delivery time. Privacy choices must be understandable, non-deceptive, free of dark patterns, and backed by actual system behavior. Do not claim blanket legal compliance where the platform can only establish specific factual states such as consent captured, registration approved, or opt-out recorded. Privacy rules must be centralized, versionable, auditable, testable, and updateable as regulations and carrier requirements change.

**This guide controls how Transovo presents consent, privacy choices, messaging permissions, opt-outs, data collection, recording notices, compliance registration, and privacy-related user decisions.**

---

## Important distinction from earlier guides

There is **no single universal privacy law** covering every Transovo user everywhere. Rules depend on:

- jurisdiction
- communication channel
- message purpose
- sender identity
- type of personal data
- whether the user is a consumer, business user, or employee
- whether consent is actually the legal basis being relied upon

**First rule:** Do not treat “consent” as one global boolean. Privacy and communication permissions must be represented according to the specific purpose, channel, sender, legal/compliance context, and evidence supporting that permission.

For Cursor, this guide establishes the **safe architecture and UX rules**. Specific legal applicability should still be determined from the actual jurisdiction/use case rather than guessed in UI code.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Privacy and consent must be purpose-specific

One permission must not silently authorize another purpose.

**Examples:**

- Consent for **Appointment reminder texts** does not automatically mean **Promotional SMS**
- Consent for **Meeting recording** does not automatically mean **Marketing use of the transcript**

GDPR’s purpose-limitation principle requires personal information to be collected for specified, explicit, legitimate purposes and not reused incompatibly.

**Cursor rule:** Every consent or permission record must identify what the person agreed to, not merely that they “consented.”

---

## B. Do not use one generic consent = true

**Bad data model:** `consent = true`

**Better conceptual model:**

```
channel: sms
purpose: appointment_reminders
sender_context: platform
status: granted
source: booking_page
captured_at: ...
language_version: ...
```

Separately for email, meeting recording, and other purposes.

The system needs enough evidence to determine what the permission actually covers.

---

## C. Consent must be distinguishable from other legal bases or business permissions

Not every privacy operation depends on consent. GDPR recognizes multiple lawful bases for processing; consent is only one of them.

Therefore Cursor must never encode **No consent = no personal-data processing** as a universal product assumption.

Instead: the product must identify the applicable permission/legal basis for the specific processing operation.

For Transovo’s UI, avoid telling users **Consent required** unless it actually is required for that specific operation.

---

## D. When consent is used, it must be a genuine affirmative choice

GDPR defines valid consent as freely given, specific, informed, unambiguous, and demonstrated through a statement or clear affirmative action.

Therefore **no:**

- ☑ Receive promotional messages already checked
- By continuing to use this website you agree to everything
- closing this banner means consent

The CCPA likewise states that merely accepting broad terms, interacting with content in passive ways, or agreement obtained through dark patterns does not constitute valid consent under its definition.

**Cursor rule:** Whenever Transovo relies on affirmative consent, require an intentional affirmative action. Never infer it from silence, inactivity, page navigation, or preselected controls.

---

## E. Consent language must be understandable before agreement

Do not make users agree first and discover meaning later.

Consent controls should communicate: who is communicating/processing where relevant, what type of communication/data use, why, what the user is agreeing to, material consequences, and how to withdraw where applicable.

GDPR requires transparency and informed consent; California likewise requires meaningful notice about collection/use.

---

## F. Do not hide material consent terms in Terms of Service

A general Terms checkbox should not be used as a substitute for specific consent where specific consent is required.

California’s CCPA definition explicitly says acceptance of broad terms containing personal-information processing along with unrelated information does not itself constitute consent.

**Cursor rule:** Separate material privacy/communication consent from general Terms acceptance when they represent distinct decisions.

---

## G. Consent controls must use neutral choice architecture

Do not visually manipulate users toward consent.

Avoid: huge bright Accept vs tiny gray Decline, confusing double negatives, hiding rejection behind multiple screens, guilt language, fake urgency, repeated nagging, prechecked choices, disguising consent as a required system action.

The FTC identifies interface techniques that obscure, subvert, or impair consumer choice as dark patterns, and California regulations similarly prohibit dark-pattern consent.

**Cursor rule:** Privacy choice architecture must make acceptance and rejection understandable and must not materially impair autonomous choice.

---

## H. Refusal must not be visually deceptive

If **Allow optional analytics** is optional, the UI should not present **Accept** versus **maybe later** hidden in 10px gray text.

The choices need not always be graphically identical, but users must be able to understand and exercise the alternative without manipulation.

---

## I. Don’t use confusing negative toggles

Avoid: ☑ Do not disable appointment marketing messages

Use: **Promotional messages** On / Off — or clear affirmative choice.

Privacy settings should minimize linguistic traps.

---

## J. Consent should be granular when purposes materially differ

**Example:**

```
Appointment SMS reminders [ ]
Promotional SMS         [ ]
```

is clearer than **Messages and offers [ ]** when those uses have materially different purposes or requirements.

Granularity also allows withdrawal of one permission without destroying unrelated functionality.

---

## K. Required and optional processing must be distinguishable

If information is genuinely required to provide the requested service, say so.

**Example:** Email address — Required to send booking confirmation.

If something is optional: **Product updates — Optional**

Do not make optional processing appear operationally mandatory.

---

## L. Do not condition a service on unnecessary consent where the applicable law requires freely given consent

GDPR specifically instructs that whether a service is conditioned on consent to processing not necessary for the contract is relevant in assessing whether consent was freely given.

**Cursor rule:** Do not require agreement to unrelated optional processing merely to use the core appointment service when the applicable legal regime would prohibit that coupling.

---

## M. Privacy notices must be available at the point of collection

California requires covered businesses collecting personal information to provide a Notice at Collection in accordance with the CCPA and regulations.

For Transovo: when collecting customer information through a public Booking Page, required privacy information should be accessible at or before collection, not only through an obscure footer elsewhere.

---

## N. Collect only what is necessary for the task

GDPR’s data minimization principle requires personal data to be adequate, relevant, and limited to what is necessary for the purpose.

NIST’s Privacy Framework likewise approaches privacy as a data-processing risk-management problem rather than simply a security checkbox.

**Cursor rule:** Every customer-data field should have an identifiable product purpose. Do not collect information merely because it might be useful later.

---

## O. Do not expose unnecessary customer data everywhere

Just because Transovo stores phone, email, payment, meeting transcript, and appointment history does not mean every page needs to display all of it.

Use the minimum information necessary for the current task.

Privacy minimization applies to presentation and access, not merely collection.

---

## P. Sensitive information deserves stronger contextual protection

Where Transovo stores or displays higher-risk information — payment information, recordings, transcripts, personal contact data, potentially sensitive appointment notes — avoid unnecessary duplication, exposure, exports, logging, public URLs.

Cursor must treat sensitive-data surfaces as distinct from normal UI metadata.

---

## Q. Privacy and security are related but not identical

NIST specifically notes that good cybersecurity alone does not resolve every privacy risk.

**Example:** A transcript may be perfectly encrypted yet still create a privacy problem if collected unnecessarily, retained too long, shown to the wrong organizational role, or reused unexpectedly.

**Cursor rule:** Do not treat encryption/authentication as proof that a privacy design is correct.

---

## R. Privacy decisions must be attributable

When Transovo records consent or withdrawal, store enough information to establish what happened.

Depending on context: subject/contact, action, date/time, source, consent language/version, purpose, channel, sender context, collection mechanism, revocation, relevant policy/version.

GDPR Article 7 requires the controller to be able to demonstrate consent where processing is based on consent.

**Cursor rule:** Consent evidence must be auditable. Do not merely overwrite the current boolean and destroy the history.

---

## S. Never mutate historical consent evidence silently

If consent language changes, do not update every old record so that it appears the user agreed to the new wording.

Store `consent_version_3` with the original event. Future consent can use `consent_version_4`. Historical evidence remains historical.

---

## T. Consent withdrawal must also be recorded

A useful consent history is:

```
Sep 1 — SMS appointment reminders granted
Sep 8 — SMS appointment reminders withdrawn
```

not merely `sms_consent = false`.

The current state matters. The history matters too.

---

## U. Withdrawal must be honored operationally

A privacy/consent setting is not merely display state.

If consent is withdrawn or opt-out is received, the sending/runtime layer must enforce that state.

**Cursor rule:** No UI opt-out or consent withdrawal is complete until downstream messaging/processing eligibility changes accordingly.

---

## V. Revocation must not require one magic phrase where law requires reasonable methods

FCC rules protect consumers’ ability to revoke consent for robocalls/robotexts and recognize reasonable revocation methods.

Therefore: do not architect SMS opt-out handling around only exact uppercase STOP counts if applicable rules/provider requirements recognize additional reasonable expressions.

Keyword handling is useful and often required operationally, but free-form revocation intent must be handled according to the applicable FCC/provider rules.

---

## W. Standard opt-out keywords must work where required by the messaging ecosystem

For U.S. application messaging, platform/provider/carrier systems commonly recognize keywords such as STOP, UNSUBSCRIBE, CANCEL, END, QUIT.

Exact supported sets vary by messaging provider/ecosystem implementation.

Cursor should rely on the canonical messaging-compliance layer rather than duplicating keyword logic independently across features.

---

## X. Opt-out status must propagate across the applicable scope

If a contact opts out from a sender/use case, do not allow another workflow under the same prohibited scope to keep sending because it maintains a separate local boolean.

A single authoritative suppression/eligibility service should evaluate contact, sender, purpose, channel, and scope before send.

---

## Y. Opt-out should not erase historical communication records

Stop future sending. Do not rewrite history.

The appointment timeline can still show: **Customer opted out at 10:42 AM.**

That history is useful for support/audit.

---

## Z. Opt-out should be distinguished from missing consent

These are not equivalent.

| State | Meaning |
|-------|---------|
| **No consent evidence** | We don’t have sufficient permission evidence |
| **Opted out** | The person affirmatively withdrew/stopped messages |
| **No phone** | Technical contact information unavailable |
| **Business registration required** | Sender eligibility missing |

The UI must not collapse these into **SMS unavailable.**

---

## AA. Sender registration and recipient consent are different concepts

**This is extremely important for Transovo.**

A2P/10DLC registration does not itself create recipient consent.

A2P registration tells the messaging ecosystem about sender/Brand, Campaign/use case, and opt-in/opt-out mechanisms.

**Cursor rule:** Never use `a2pApproved = true` as equivalent to `recipientCanReceiveSms = true`.

Eligibility must evaluate both sender-side and recipient-side requirements.

---

## AB. A2P registration is sender/compliance infrastructure

For U.S. 10DLC A2P messaging, carriers require registration of application-generated traffic.

For Transovo, A2P status belongs under something like **Settings → Messaging → Business texting** — not inside a customer’s personal consent record.

---

## AC. Brand and Campaign must remain conceptually separate

A2P architecture generally distinguishes:

| Concept | Meaning |
|---------|---------|
| **Brand** | Who is sending |
| **Campaign** | What messaging use case is being sent and how users opt in/out |

Do not flatten both into **SMS approved = yes.** Store/status them separately.

---

## AD. Registration UX must show meaningful lifecycle states

Possible business-messaging states: Not started, Business information required, Brand submitted, Brand approved, Campaign submitted, Under review, Approved, Needs information, Rejected, Suspended.

Use exact provider/runtime states where available.

Do not show **Connected** for all of these. Registration is a process, not a binary connection.

---

## AE. Registration status should explain what it affects

**Example:**

```
Business texting registration required
SMS reminders for manually created and imported appointments are unavailable until registration is approved.
```

Better than: **A2P not configured.**

User-level consequence matters.

---

## AF. A2P registration details must reflect the actual business

Provider/TCR registration requires accurate business identity and campaign information.

**Cursor rule:** Do not pre-populate or fabricate compliance answers simply to maximize approval probability. Assist users. Do not invent facts for them.

---

## AG. User attestations must be explicit when relied upon

If Transovo asks the business to attest **I confirm that my organization has permission to send these messages** — make it explicit.

Do not silently infer that attestation merely because they enabled a channel.

Also store attestation evidence if it is part of the compliance architecture.

---

## AH. Platform-captured SMS consent and business-attested consent are different provenance

For Transovo’s architecture, these should never be conflated.

| Type | Meaning |
|------|---------|
| **Platform-captured** | Transovo directly captured the customer’s affirmative action through a Transovo-controlled Booking Page |
| **Business-attested/external** | The business asserts or maintains its own underlying relationship/permission outside Transovo |

Those can have different sender/compliance implications.

**Cursor rule:** Consent provenance is a first-class field.

---

## AI. Appointment origin and communication eligibility are separate

**Example:**

- **Origin:** Imported from Microsoft — does not itself mean SMS disallowed forever
- **SMS eligibility:** Business sender registration required — separate field

Likewise **Origin: Booked through Transovo** may coexist with **SMS: Eligible through captured appointment-reminder consent**.

Do not encode communication eligibility into appointment origin.

---

## AJ. Channel permissions must remain independent

A person may be SMS: opted out, Email: allowed, Voice: unknown/allowed under separate rules.

Do not implement `contact.canCommunicate` as the authoritative permission.

**Cursor rule:** Maintain channel-specific communication status and purpose where necessary.

---

## AK. Email and SMS rules must not be treated as identical

The FTC’s CAN-SPAM guidance applies specific requirements to commercial email. That is a different regime from TCPA/carrier SMS requirements.

Therefore: email permission must never automatically unlock SMS, and SMS opt-out must not necessarily imply every legally distinct email communication must cease unless scope requires it.

The eligibility engine needs channel semantics.

---

## AL. Commercial email must use accurate identity information

FTC CAN-SPAM guidance requires accurate From, To, Reply-To, routing/originating information and prohibits deceptive subject lines.

**Cursor rule:** Transovo must not permit customer-facing commercial email configuration that disguises the sender or materially misrepresents the subject/content.

---

## AM. Commercial-email opt-out must be available and honored

FTC guidance explains that recipients have the right to stop commercial email and businesses must provide an opt-out mechanism.

For Transovo’s commercial-email features: unsubscribe mechanism must remain functional, suppression must be enforced, workflows cannot override suppression casually.

Appointment transactional email may have different treatment depending on content/context; do not indiscriminately classify every appointment message as marketing.

---

## AN. Do not misclassify messages merely to avoid compliance controls

Do not label promotional content **appointment reminder** if the actual content is primarily marketing.

Likewise **service message** must not become a loophole for unrelated promotions.

Classification should follow actual purpose/content.

---

## AO. CTIA’s guiding principle is consumer consent/control

CTIA’s Messaging Principles & Best Practices are voluntary industry guidance, not legislation, but they are highly relevant to carrier messaging.

**Cursor rule:** Messaging features must be designed so consumers can understand the sender, control whether they receive messages, and stop unwanted messaging.

---

## AP. Messaging identity should be understandable

A recipient should not receive an automated appointment message and have no idea who is texting them.

**Example:** **Bright Dental: Your appointment is tomorrow at 2 PM…** — not **Reminder: tomorrow 2 PM** when recipient cannot reasonably identify the sender.

---

## AQ. Help behavior must be supported where the campaign model requires it

A2P campaign registration includes information about how users opt in, opt out, and get help according to carrier/provider campaign-registration requirements.

Cursor should centralize help/opt-out behavior in the messaging runtime.

Do not configure campaign registration promising HELP behavior that runtime doesn’t actually support.

---

## AR. Compliance registration and runtime must agree

**Critical hard rule.**

If the registered campaign says users opt in through Booking Page checkbox, runtime/product must actually use that method.

If campaign says STOP stops messages, runtime must enforce STOP.

If campaign says messages contain appointment reminders, don’t repurpose the same campaign for unrelated mass promotions.

**Cursor rule:** The product behavior must match the compliance representations submitted to carriers/providers.

---

## AS. Do not create fake opt-in evidence

Never synthesize timestamp, IP, checkbox event, consent wording, or source for imported/manual appointments when the platform did not actually capture it.

Unknown remains **Unknown / external permission** — not **consent captured.**

---

## AT. Imported appointments should carry truthful permission provenance

**Example:**

```
Imported from Microsoft
Transovo SMS consent: Not captured
```

If business-specific messaging setup permits the business to send under its own compliance/consent framework, that can be represented separately.

Do not convert import into platform consent.

---

## AU. Consent evidence should be viewable where operationally useful

Appointment/customer detail can expose:

```
SMS eligibility: Eligible
Source: Booking-page consent
Captured: Sep 7, 10:03 AM
```

or **SMS eligibility: Business texting registration required**

Do not require support staff to query the database to understand why an SMS can/cannot send.

---

## AV. Do not expose unnecessary raw compliance evidence to ordinary users

**Useful:** Consent captured Sep 7 through Booking Page.

Advanced/audit view can expose more.

Do not dump internal IDs, provider payloads, webhook identifiers into normal appointment UI.

---

## AW. Privacy settings should distinguish current state from evidence/history

**Current:** SMS appointment reminders: Allowed

**History:** Consent captured Sep 7 · Opt-out not recorded

Keep operational state simple while maintaining audit evidence underneath.

---

## AX. Consent history must not be editable like a normal note

A user should not be able to rewrite **customer consented yesterday** into **customer consented last month.**

If correction is required: append correction/audit event, preserve original record.

Evidence records need integrity.

---

## AY. Privacy controls should support data-subject requests where applicable

GDPR and CCPA provide various rights relating to personal information.

Cursor should architect data so Transovo can support appropriate access, correction, deletion, export, and opt-out workflows where legally required.

The exact legal scope belongs to compliance/legal configuration, not hard-coded assumptions.

---

## AZ. Deletion is not necessarily the same as erasing every record immediately

Some information may need retention for legal obligations, accounting, fraud prevention, audit, dispute handling.

Therefore UI should not promise **Permanently erases every trace immediately** unless that is actually legally and technically true.

Use accurate language.

---

## BA. Retention periods must be explainable and configurable where required

For Transovo’s recordings/transcripts in particular, provide clear retention policy/settings.

**Examples:** Retain recordings for 30 days. Delete recording after transcript processing.

Exact defaults should be a product/legal decision.

**Cursor rule:** Retention behavior must be explicit and must match backend deletion jobs.

---

## BB. Recording consent requires a separate model

Meeting recording involves different legal regimes than SMS.

Do not reuse `contact.smsConsent` for meeting recording.

Represent recording notice, acknowledgment/consent where applicable, source, time, meeting, participants where relevant.

The product must not falsely claim **Recording is legal because the host enabled it.**

---

## BC. Recording UI must not conceal recording state

When Transovo’s Notetaker records a meeting, recording state should be obvious to the authorized user.

Avoid hidden/unexplained recording behavior.

Configuration should expose auto-join, recording consent/notice, retention, recording status.

---

## BD. Meeting recording rules are jurisdiction-dependent

Some jurisdictions require consent from one party; others impose stricter all-party requirements or other notice rules.

Cursor should not hard-code a universal statement such as **One-party consent is always enough.**

Instead: recording-consent behavior must be configurable according to applicable requirements and deployment policy.

This is an area where legal review should control exact customer-facing language.

---

## BE. Data-processing disclosures must be truthful about AI

If meeting data is recorded, transcribed, summarized by AI, or sent to subprocessors — privacy copy must not imply **data only stays locally** if it does not.

User-facing privacy representations must match actual architecture.

---

## BF. Do not claim “we never store X” unless runtime proves it

Compliance UI cannot be aspirational.

**Cursor rule:** Privacy statements exposed in-product must be derived from verified product behavior/policy, not invented during UI implementation.

---

## BG. Integrations need permission transparency

When connecting Microsoft/Google, explain what access is being requested in user terms: read calendar, create/update events, maintain sync.

Do not request broad permissions solely because they are easier technically.

---

## BH. Permission request scope should be least-privilege where practical

If Transovo only needs calendar access, don’t request unrelated contacts, email, files without product need.

Cursor must not expand OAuth scopes merely to avoid implementing narrower APIs.

---

## BI. Explain additional permission requests at the moment they become necessary

If a future feature requires another permission, ask when enabling that feature.

Don’t front-load unrelated permissions during initial calendar connection.

---

## BJ. Disconnecting an integration must explain data consequences

**Example:**

```
Disconnect Microsoft Calendar?

• sync stops
• existing Transovo appointments remain
• future Microsoft changes stop syncing
• [what happens to already-created Microsoft events, depending on actual behavior]
```

Do not simply say **Are you sure?**

---

## BK. Privacy choices must not be buried under unrelated settings

A consumer/customer opt-out belongs near communication control.

Organization-level privacy/compliance configuration belongs in a clear Settings area.

Do not hide **Delete recordings automatically** under **Appearance.**

---

## BL. Do not overload users with legal language inside operational UI

Legal requirements must be met. But normal UI should translate them into understandable language.

**Good:** Business texting registration is required before SMS can be sent for imported appointments.

**Not:** Pursuant to carrier 10DLC campaign vetting requirements under applicable ecosystem policy…

Provide deeper details via **Learn more** when necessary.

---

## BM. Legal disclosures must remain conspicuous when conspicuousness matters

The FTC has repeatedly emphasized that material disclosures should not be hidden or deceptive.

Therefore don’t bury consequential information behind tiny text, low contrast, obscure tooltip, or multiple clicks when user needs it to make the decision.

---

## BN. Don’t use false urgency around privacy choices

No **ACT NOW or lose your account!** to force optional consent.

If there is a genuine deadline: **Business texting registration must be completed before SMS can be enabled.** — Specificity instead of manipulation.

---

## BO. Declining optional consent must not falsely appear as an error

If a user chooses **No promotional emails**, don’t show **⚠ Action required** unless action truly is required.

Privacy refusal is a legitimate state.

---

## BP. Consent withdrawal should be no harder than necessary

GDPR Article 7 requires it to be as easy to withdraw consent as to give it.

**Cursor rule:** Where Transovo relies on consent under GDPR, do not provide one-click consent and then require support tickets or hidden account settings to withdraw it.

---

## BQ. Withdrawal should explain its actual consequence

**Example:**

```
Turn off appointment reminder SMS?

Future SMS appointment reminders from this sender will stop. Email reminders remain enabled.
```

Clear scope.

---

## BR. Withdrawal must not falsely imply retroactive erasure

Stopping future messaging and deleting historical records are different actions.

Don’t say **Remove consent and delete everything** unless both genuinely happen.

---

## BS. Privacy requests must authenticate appropriately

If someone asks to export, correct, or delete personal data, Transovo may need to verify identity according to applicable requirements.

But don’t demand excessive data unrelated to verification.

---

## BT. Do not expose one tenant’s privacy data to another tenant

**Hard multi-tenant rule:** consent records, contact data, recordings, transcripts, appointment history must be tenant-scoped.

This is both security and privacy architecture. UI filtering alone is not security. Backend authorization must enforce it.

---

## BU. Role-based access should apply to privacy-sensitive information

Not every staff member necessarily needs access to compliance registration details, transcript retention settings, exports, privacy requests, consent evidence.

Use permissions according to organizational need.

---

## BV. Audit sensitive administrative actions

For high-impact privacy/compliance changes, record who, what, when, previous/new state.

**Examples:** changed retention, changed consent language, registered sender, exported customer data, changed opt-out state manually.

---

## BW. Manual override of opt-out should be heavily restricted

Do not provide a casual **Turn SMS back on** button after recipient opt-out.

Restoring eligibility should require a valid new permission event/appropriate process.

Never let staff simply erase a consumer’s opt-out because it is inconvenient.

---

## BX. Compliance status must fail closed where sending requires it

If authoritative eligibility is unknown, do not guess **probably okay to send.**

**Examples:** recipient opt-out state unavailable, sender registration state unknown, compliance provider unavailable.

For regulated messaging actions, fail safely according to the applicable sending policy.

---

## BY. Provider failure must not silently bypass compliance checks

If the compliance service is unavailable, do not fall back to **send anyway.**

**Cursor rule:** Eligibility controls are enforcement controls, not advisory UI.

---

## BZ. Every outbound message should pass through centralized eligibility

Before sending SMS, evaluate:

- Can sender send?
- Can recipient receive for this purpose?
- Is recipient opted out?
- Is channel available?
- Are timing/provider restrictions satisfied?

Then send.

Do not implement one permission check in reminder service and another different one in workflow service.

**One canonical eligibility layer.**

---

## CA. Scheduling a future message requires eligibility again at send time

If recipient consents today and opts out tomorrow, a reminder scheduled for next week must not send merely because it was eligible when originally scheduled.

**Cursor rule:** Re-evaluate communication eligibility immediately before delivery, not only when scheduling.

---

## CB. Cancel future sends after opt-out

When a relevant opt-out occurs, future pending communications within that suppression scope should be canceled, suppressed, or skipped — and timeline should explain why.

Do not let already-queued jobs ignore changed permissions.

---

## CC. Suppression is a valid terminal send state

Reminder status model should include something like **Suppressed — customer opted out.**

Do not categorize that as **Failed** because system behaved correctly.

---

## CD. Compliance blockers should be visible before scheduling

If SMS cannot legally/operationally be used, don’t let user build **SMS reminder tomorrow** and discover failure at delivery.

Show eligibility while configuring the appointment/sequence.

---

## CE. Compliance diagnostics should explain the exact blocker

**Examples:**

- SMS unavailable — customer opted out.
- SMS unavailable — no phone number.
- SMS unavailable — business texting registration required.
- SMS unavailable — platform consent was not captured for this imported appointment.

Avoid **Not eligible.**

---

## CF. Multiple blockers should be handled intelligently

If no phone, opted out, and sender registration missing — the system may prioritize the actionable/most fundamental reason but should retain all authoritative states internally.

Do not return contradictory explanations from different pages.

---

## CG. Privacy status should use canonical terminology

Use consistently: Consent captured, Consent not captured, Opted out, Registration required, Registration pending, Eligible, Suppressed.

Don’t randomly use Approved, Authorized, Allowed, Verified for different concepts unless their definitions are clear.

---

## CH. Don’t show “compliant” as a blanket guarantee

Avoid UI like **✅ TCPA Compliant** based merely on one checkbox or A2P approval.

Compliance depends on facts, jurisdiction, consent, message content/purpose, sender behavior, other requirements.

**Better:** Business texting registration approved. or SMS consent captured through booking page.

Specific factual statements are safer and more useful.

---

## CI. Do not make legal guarantees based on platform configuration alone

Similarly avoid **You are fully compliant.**

Use **Registration requirements for this sender are complete.**

Transovo can enforce platform rules. It cannot universally guarantee the customer’s entire legal conduct.

---

## CJ. Privacy notices should use versioning

If privacy policy / consent disclosure materially changes, store version/date.

Where renewed consent is legally required, product can determine who must be re-prompted according to policy/legal rules.

Do not overwrite historical notices.

---

## CK. Do not re-prompt unnecessarily

Privacy notices/consent prompts should appear when legally required, processing purpose changes materially, user enables related feature, or existing permission is absent/expired where applicable.

Not every login. Excessive prompts train users to ignore meaningful choices.

---

## CL. Privacy notices and preference controls should be accessible

Everything from Guide #1 applies: keyboard, screen reader, contrast, focus, plain labeling.

A consent control that cannot be used by assistive technology is not a valid product implementation.

---

## CM. Consent records should survive UI redesigns

Do not couple evidence to old checkbox component ID.

Store semantic evidence independently: purpose, language, timestamp, actor, source.

Then UI can evolve without destroying auditability.

---

## CN. Privacy state should survive provider migrations

If Transovo switches SMS providers, customer opt-outs, permission evidence, and consent history must not disappear.

Provider state is not the canonical consumer-permission database.

---

## CO. Carrier/provider suppression must be reconciled with application suppression

Messaging providers may enforce opt-outs independently.

Transovo must ingest relevant provider events/status and reconcile them with its canonical suppression state.

Do not display **SMS allowed** when provider has blocked the recipient.

---

## CP. Compliance webhooks are security-sensitive

Provider compliance events must be authenticated/validated appropriately.

Never accept `opt_out=true` from an unauthenticated public request.

---

## CQ. Don’t log sensitive consent/privacy payloads unnecessarily

Application logs should not indiscriminately dump entire contact record, sensitive recording data, raw tokens, full compliance registration data.

Log what engineering actually needs. Privacy minimization applies to operational telemetry too.

---

## CR. Analytics should use the minimum personal detail necessary

Aggregate analytics usually doesn’t need Anthony Johnson’s phone number to calculate appointment confirmation rate.

Avoid spreading identifying data into analytics pipelines without product need.

---

## CS. Export actions deserve privacy consideration

CSV/PDF export can create new copies of customer data.

At minimum: permission check, explicit user action, appropriate content scope.

For sensitive/high-volume exports, logging/admin restrictions may be appropriate.

---

## CT. Public share links need deliberate privacy behavior

For meeting recaps or similar shares, define: authentication required or not, expiration, revoke, password where supported, what data is shown.

Do not assume an unguessable URL alone solves every privacy requirement.

---

## CU. Revocation must actually revoke shared access

If user clicks **Revoke share link**, the server must reject future requests.

Changing a UI badge to **Revoked** without invalidating access is unacceptable.

---

## CV. Privacy-related defaults should be conservative

Where reasonable uncertainty exists: recording off until configured, data sharing limited, optional marketing unchecked, suppress unsupported messaging.

Do not maximize data collection/sending by default merely for engagement.

---

## CW. Privacy UX must accurately distinguish platform and customer responsibilities

**Platform might handle:** capture, storage, suppression enforcement, sender registration tooling, delivery controls.

**Customer may remain responsible for:** truthfulness of supplied business information, lawful basis/permission they claim to possess, message content/use, jurisdiction-specific obligations.

UI should explain these boundaries without pretending Transovo can transfer all legal responsibility in one checkbox.

---

## CX. Do not ask businesses to certify facts Transovo already knows are false

If Transovo knows consent was not captured, don’t display **Check here to confirm Transovo captured consent.**

Likewise, don’t let customers override machine-known evidence with contradictory attestation.

---

## CY. Distinguish evidence from attestation

| Type | Example |
|------|---------|
| **Evidence** | Booking Page checkbox captured Sep 7 at 10:03 AM |
| **Attestation** | Business states it has permission to contact this customer |

These are not equal. Data model and UI should preserve the distinction.

---

## CZ. Compliance UI should explain dependencies in plain language

**Example:**

```
SMS for imported appointments
To send SMS for appointments imported from Google or Microsoft,
your business needs its own registered texting identity.
[Set up business texting]
```

Not: **Campaign Registry Brand/CSP object missing.**

---

## DA. Never surface provider-specific terminology unless the user benefits

A2P/10DLC may need to be named because customers encounter it.

But don’t unnecessarily expose TrustProduct SID, CustomerProfile SID, Messaging Service SID, TCR object IDs.

Normal UX should remain provider-agnostic where possible.

---

## DB. Compliance states need timestamps

Useful: Submitted Sep 5 · Approved Sep 7 · Last updated 12 minutes ago

Especially for registrations, consent, privacy requests, retention/deletion jobs.

---

## DC. Compliance workflow should support “needs information” rather than generic failure

If registration is rejected because website missing privacy policy, show that if provider supplies the reason.

Avoid **Registration failed.** The goal is recovery.

---

## DD. Compliance errors must not fabricate explanations

If provider only says **rejected** and no reason is supplied:

Say **Registration was rejected. No detailed reason was provided.**

Do not let AI/UI invent a likely cause and present it as fact.

---

## DE. Policy changes should be centralized

SMS eligibility rules should not be hard-coded separately in Booking, Appointments, Workflow, Reminder sequences, Messages.

Use centralized policy logic/configuration. Regulatory/provider rules evolve. Architecture must allow one rule update to affect all sending paths.

---

## DF. Compliance logic should be testable independently of UI

Given appointment origin, sender status, contact consent, opt-out, channel, purpose — the policy engine should return deterministic result: eligible / ineligible, reason, scope.

This makes compliance behavior auditable and prevents inconsistent pages.

---

## DG. Store the reason behind eligibility decisions

Instead of only `can_send = false`, return/store where needed:

- `reason = recipient_opted_out`
- `reason = business_sender_registration_required`

That allows consistent diagnostics.

---

## DH. Do not make compliance decisions using AI

AI may explain a policy, help draft registration language, or classify with human review where appropriate.

But final sending eligibility should be determined by deterministic rules and authoritative state.

**Cursor rule:** LLMs must not decide whether regulated communication is legally/operationally eligible to send.

---

## DI. AI should never invent consent

**Hard rule.**

A model may infer **customer seems interested** — that is not consent evidence.

Never transform conversational sentiment into a permission record unless an explicit qualifying consent event occurs under the applicable rules.

---

## DJ. Privacy-related AI summaries must not become authoritative evidence

**Example:** AI says **Customer agreed to texts.**

The authoritative evidence is actual message, checkbox event, consent record — not the model summary.

---

## DK. Data retention must apply to AI-derived artifacts too

Deleting a recording may not automatically delete transcript, summary, embeddings, AI recap unless retention policy is designed that way.

Privacy model must identify each artifact and its retention behavior.

---

## DL. Transcripts and recordings are distinct data objects

Users may choose **Delete recording, retain transcript** if product policy permits.

Do not model `meeting_data_deleted` as one vague boolean if multiple artifacts exist.

---

## DM. Privacy deletion should handle copies and derived artifacts according to policy

When deletion is required, the backend needs known handling for primary record, search index, AI/vector data, cached copies, public shares, provider copies where applicable.

Do not make UI promises that backend architecture cannot fulfill.

---

## DN. NIST Privacy Framework should guide architecture, not be represented as law

NIST expressly states its Privacy Framework is a voluntary tool and not legally binding.

Use it to guide privacy risk identification, governance, data processing awareness, safeguards, communication, risk assessment.

Do not tell customers **NIST requires this** when it does not.

---

## DO. Privacy risk must consider harm to individuals, not only company risk

NIST defines privacy risk around the likelihood and impact of problems individuals experience as a result of data processing.

When adding a feature, ask: **What could happen to the person whose data we process?** — Not merely: What could happen to Transovo?

---

## DP. New personal-data uses should receive a privacy review

Before adding features involving new customer data, call recording, AI processing, new integrations, data sharing, or new analytics — identify:

1. What data?
2. Whose data?
3. Why?
4. Where collected?
5. Who can access it?
6. How long retained?
7. Which providers receive it?
8. What user control exists?
9. What consent/legal basis applies?
10. What happens on deletion/withdrawal?

---

## DQ. Privacy requirements must be captured before implementation

Do not build **Record every appointment call automatically** and decide consent/privacy afterward.

Privacy is an architecture requirement. It affects data model, runtime, storage, permissions, UI, deletion, audit.

---

## DR. Jurisdictional uncertainty should not be hidden by false certainty

If the platform cannot determine whether a particular local requirement applies, do not display **Legally approved.**

Use neutral factual state and configurable policy. Exact legal determinations may require counsel.

---

## DS. Product copy must distinguish law from carrier policy

A2P 10DLC is a U.S. carrier messaging ecosystem requirement. TCPA is federal law/regulation. CTIA principles are industry guidance.

These should not all be described as **Federal law requires A2P registration.**

**Cursor/content rule:** Identify the source and nature of a compliance requirement correctly.

---

## DT. Product copy must distinguish legal requirement from Transovo policy

**Required by Transovo** · **Required by messaging carrier registration** · **Required under applicable law** — are different statements. Don’t blur them.

---

## DU. Compliance guide must be kept updateable

This is critical because FCC rules change, carrier requirements change, state privacy laws change, provider A2P requirements change.

Do not scatter hard-coded explanatory legal text throughout components.

Use centralized policy/content configuration where practical.

---

## DV. Version regulatory rules where runtime behavior depends on them

For significant policy changes: record version, effective date, migration behavior.

This allows debugging: **Why was this appointment eligible on Sep 1 but not Sep 10?**

---

## DW. Compliance behavior must have regression tests

At minimum test scenarios like:

- Platform booking + direct SMS consent → eligible under platform sender policy
- Imported appointment + no platform consent + no business registration → blocked
- Imported appointment + business sender approved + recipient opted out → blocked
- Eligible appointment + recipient opts out after scheduling → future SMS suppressed
- Email allowed + SMS opted out → email state remains independently evaluated
- A2P approved + no recipient permission where permission required → A2P approval alone does not unlock send

These are much more important than testing whether the badge renders green.

---

## DX. Never bypass policy checks through secondary sending paths

All of these must call the same eligibility layer: manual Send SMS, Reminder Sequence, Workflow, AI booking, staff quick action, bulk action, API-triggered send.

No “internal” endpoint should bypass recipient suppression because it isn’t the main UI.

---

## DY. Test mode must never accidentally send regulated live messages

If workflow/AI test mode exists: use test recipient/sandbox mechanism, clearly identify live vs simulation.

Do not have a Test button accidentally send production SMS to a customer.

---

## DZ. Compliance UX should always answer four questions

Where a privacy/compliance state affects the user, they should be able to determine:

1. What is the current state?
2. Why is it in that state?
3. What does that state prevent or permit?
4. What can I do next?

**Example:**

```
SMS unavailable
This appointment was imported from Microsoft and Transovo did not capture SMS consent.
Your business must complete texting registration before Transovo can use your business sender for these appointments.
[Set up business texting]
```

That is much better than **SMS restricted.**

---

## Transovo Privacy / Consent / Compliance Acceptance Checklist

Every applicable feature should pass:

- [ ] Personal-data purpose is explicitly identified
- [ ] Different purposes are not collapsed into one generic consent
- [ ] SMS/email/voice/recording permissions are modeled separately where required
- [ ] Consent provenance is stored
- [ ] Consent language/version is stored where evidence is required
- [ ] Consent timestamp/source is preserved
- [ ] Historical consent evidence is not silently overwritten
- [ ] Withdrawal/revocation is recorded
- [ ] Withdrawal actually affects runtime
- [ ] Consent is not inferred from silence, inactivity, or navigation
- [ ] Required affirmative consent is not preselected
- [ ] Optional consent is not visually manipulated through dark patterns
- [ ] Material consent information appears before agreement
- [ ] General Terms acceptance is not substituted for specific consent where specific consent is required
- [ ] Required vs optional processing is distinguishable
- [ ] Data collection is limited to information needed for the purpose
- [ ] Sensitive information is not exposed outside task/permission need
- [ ] Privacy notices exist at/before collection where required
- [ ] Sender registration and recipient permission remain distinct
- [ ] A2P Brand and Campaign state remain distinct
- [ ] A2P approval does not automatically mark recipients SMS-eligible
- [ ] Appointment origin and SMS eligibility are separate fields
- [ ] Imported/manual appointments do not receive fabricated platform consent
- [ ] Platform-captured evidence and business attestation remain distinguishable
- [ ] SMS opt-out is centrally enforced
- [ ] Scheduled SMS re-checks eligibility at send time
- [ ] Opt-out suppresses applicable future sends
- [ ] Suppressed is not mislabeled as failed
- [ ] Compliance blockers are shown before configuration/send where possible
- [ ] Blocker reason is specific and actionable
- [ ] Email rules are evaluated separately from SMS rules
- [ ] Commercial email identity/subject behavior is truthful
- [ ] Commercial-email suppression is enforced where applicable
- [ ] Runtime matches the messaging use case represented in A2P registration
- [ ] HELP/opt-out behavior promised during registration actually works
- [ ] Registration state is shown as a lifecycle, not a generic Connected boolean
- [ ] Registration rejection/needs-info reason is surfaced when authoritative reason exists
- [ ] The UI never fabricates a reason providers did not supply
- [ ] Recording consent/notice uses its own model
- [ ] Recording state is visible
- [ ] Recording/transcript/summary retention is defined separately
- [ ] Privacy statements match actual technical behavior
- [ ] Integration permissions are no broader than product need where practical
- [ ] Disconnecting an integration explains consequences
- [ ] Data access/export/deletion actions are appropriately permission-controlled
- [ ] Sensitive administrative/privacy actions are auditable
- [ ] One tenant cannot access another tenant's privacy data
- [ ] Manual opt-out overrides cannot casually erase consumer revocation
- [ ] Provider failure does not bypass compliance checks
- [ ] Every outbound channel uses centralized eligibility logic
- [ ] Eligibility decisions have deterministic reason codes
- [ ] AI does not decide regulated communication eligibility
- [ ] AI does not invent consent
- [ ] Privacy/compliance terminology is canonical
- [ ] UI does not claim blanket “compliance” based on one state
- [ ] UI distinguishes law, carrier policy, industry guidance, and Transovo policy
- [ ] Regulatory text/rules are centralized and updateable
- [ ] Compliance rules have regression tests
- [ ] Secondary/internal sending paths cannot bypass policy enforcement

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance (this file)
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #8: Privacy, Consent & Compliance UX Standards. Next: Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`.*


===== [Formal #9 — Security & Authentication UX] docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md =====
# Transovo Security & Authentication UX Standards Guide

**Series:** Implementation standards · **Guide #9 of 12**  
**Status:** Active — mandatory hard standard for login, passwords, MFA, passkeys, sessions, reauthentication, account recovery, and security-sensitive account actions  
**Audience:** Engineers, designers, product owners, security stakeholders, and Cursor agents building Transovo  
**Authorities:** NIST SP 800-63-4 · NIST SP 800-63B-4 · W3C Web Authentication (WebAuthn) · FIDO/passkey architecture

---

## Master Cursor rule

> **Transovo authentication and account-security behavior must follow current NIST SP 800-63-4 and SP 800-63B-4 principles, with WebAuthn used for standards-based passkeys and phishing-resistant authentication.** Security controls must be risk-based, deterministic, server-enforced, and designed so the secure path is also the normal usable path. If passwords are supported, follow current NIST guidance: require appropriate minimum length, permit at least 64 characters, do not impose arbitrary character-composition rules or periodic rotation, screen against common/compromised passwords, support password managers/autofill/paste, and securely salt/hash stored passwords. Do not use security questions or password hints. Offer true MFA with distinct factors and prefer phishing-resistant methods such as passkeys/WebAuthn. Authenticator enrollment, removal, account recovery, role escalation, ownership changes, SSO configuration, and other sensitive actions must receive appropriate reauthentication, notification, authorization, and audit controls. Sessions must use protected server-generated secrets, enforce expiration/revocation, terminate on logout, and preserve user context during legitimate reauthentication. **Authentication never substitutes for authorization;** every tenant and privileged server operation must independently enforce authorization. Tokens, passwords, recovery codes, OTPs, API keys, session credentials, and refresh tokens are secrets and must never be exposed in URLs, UI, logs, analytics, or AI prompts. Security checks fail closed, and no development, support, or alternate route may bypass the canonical authentication and authorization layer.

**This guide controls how Transovo handles login, passwords, MFA, passkeys, sessions, reauthentication, account recovery, authenticator changes, suspicious activity, and security-sensitive account actions.**

---

## Core principle

Security UX must make the **secure path the easiest normal path**. Do not rely on user inconvenience, arbitrary complexity, or hidden security behavior as substitutes for strong authentication architecture.

For Transovo, treat **phishing-resistant authentication, strong session management, safe recovery, and explicit protection of sensitive actions** as the architectural goals.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Authentication assurance should be based on risk

NIST defines three Authentication Assurance Levels:

| Level | Meaning |
|-------|---------|
| **AAL1** | Basic confidence that the claimant controls an authenticator |
| **AAL2** | High confidence; requires proof of two distinct authentication factors |
| **AAL3** | Very high confidence with stricter hardware and phishing-resistant requirements |

**Cursor rule:** Do not apply identical authentication requirements blindly to every action. Authentication strength should reflect account and action risk.

**Higher-risk Transovo actions:** changing authentication methods, disabling MFA, changing owner/admin role, SAML/SCIM configuration, exporting large customer data, deleting organization, changing payment/security settings, viewing/revealing sensitive secrets, changing recovery information.

---

## B. Offer phishing-resistant authentication

Current NIST guidance says that at AAL2, verifiers must offer at least one phishing-resistant authentication option and should encourage its use whenever practical.

For Transovo, the long-term preferred hierarchy should include **Passkeys / WebAuthn** ahead of weaker factors where practical.

**Cursor rule:** Transovo should support a phishing-resistant authentication method for higher-security accounts and should prefer it over OTP-only designs when practical.

---

## C. Passkeys should be treated as a first-class authentication method

WebAuthn defines a public-key credential model in which credentials are scoped to the relying party and authentication uses cryptographic proof instead of transmitting a reusable password secret.

NIST has incorporated syncable authenticators/passkeys into its current digital-identity framework.

**Cursor rule:** Do not treat passkeys as a decorative beta login option. Architect authenticator storage, recovery, account settings, and session flows so passkeys can be a primary authentication mechanism.

---

## D. Passkeys must use real WebAuthn

Do not invent proprietary “Transovo passkey” logic. Use the W3C WebAuthn standard. Server verifies cryptographic assertions. Client/browser interacts with authenticators through WebAuthn.

Never emulate a passkey with emailed codes, device fingerprint, or magic database token and label it a passkey.

---

## E. Authentication factors must actually be distinct

NIST identifies something you know, something you have, and something you are as core factor categories. Two instances of the same category are not two factors.

**Example:** Password + security question = two knowledge secrets ≠ legitimate two-factor authentication.

**Cursor rule:** Never advertise two knowledge factors as MFA.

---

## F. Password + email password is not necessarily meaningful independent MFA

If a user authenticates with a password then receives a code through an account whose access is effectively controlled by the same compromised environment, security may be weaker than the interface suggests.

Prefer authenticator methods with actual factor separation. Do not use misleading **Maximum security** language based solely on two screens appearing.

---

## G. Passwords are not phishing-resistant

NIST explicitly states passwords are not phishing-resistant.

Do not present **Strong 25-character password** as equivalent to phishing-resistant authentication. Password strength and phishing resistance solve different threats.

---

## H. Password minimums should follow current NIST guidance

Current NIST SP 800-63B-4 says:

- password used as a single authentication factor: minimum **15 characters**
- password used only as part of multi-factor authentication: may be shorter, but minimum **8 characters**
- systems should permit a maximum length of at least **64 characters**

**Cursor rule:** If Transovo uses passwords, implement current NIST length requirements appropriate to the authentication model instead of outdated 8-character-only assumptions.

---

## I. Do not require arbitrary password composition rules

NIST explicitly says password systems shall not require rules such as mandatory mixtures of uppercase, lowercase, number, symbol.

**Cursor rule:** Prefer length + compromised/common-password screening + rate limiting over arbitrary composition rules.

---

## J. Do not force periodic password changes

NIST explicitly says verifiers shall not require periodic password changes unless there is evidence the authenticator has been compromised.

No **Your password is 90 days old. Change it.** unless a specific security reason exists.

---

## K. Screen passwords against common and compromised values

NIST requires prospective passwords to be compared against a blocklist containing common, expected, or compromised passwords.

If blocked, tell the user why: **This password is commonly used or has appeared in known compromised-password lists. Choose another password.** — Not **Password does not meet complexity rules.**

---

## L. Do not overdo password blocklists

NIST specifically notes that excessively large blocklists provide limited additional benefit and may frustrate legitimate users.

Block probable/common compromises — not every dictionary phrase merely because it contains an English word.

---

## M. Allow long passphrases

NIST recommends allowing at least 64 characters and supporting long passwords/passphrases.

Do not silently truncate input at 16, 20, or 32 characters.

---

## N. Accept spaces and broad character sets

Current NIST guidance says password systems should accept printable ASCII, space, and Unicode where supported.

**Cursor rule:** Do not reject safe special characters because application code or database handling is poorly designed. Fix storage/encoding.

---

## O. Do not silently truncate passwords

NIST requires verification of the entire submitted password, not a truncated subset.

**Hard rule:** Never accept a 40-character password but store/compare only the first 20 characters.

---

## P. Password managers must be supported

NIST requires verifiers to allow password managers and autofill. It also recommends permitting paste where autofill APIs are unavailable.

**Cursor rule:** Never disable password-manager autofill or clipboard paste in password fields without an extraordinary documented reason. No `onPaste={preventDefault}` for passwords.

---

## Q. Password fields should offer Show password

NIST recommends an option to display the password while entering it so users can verify their input.

Use **Show password** with accessible state.

---

## R. Do not use password hints

NIST prohibits storing password hints accessible to unauthenticated claimants.

No **Hint: dog’s name + birth year.** Security questions/hints create unnecessary attack surface.

---

## S. Do not use security questions / knowledge-based authentication

Current NIST explicitly prohibits prompting users to use knowledge-based authentication such as **What was the name of your first pet?** as part of password/authentication design.

**Cursor rule:** Transovo must not use security questions for login or account recovery.

---

## T. Passwords must be securely stored

NIST requires centrally verified passwords to be salted, hashed, stored using an appropriate password hashing scheme resistant to offline attacks, and configured with an appropriate cost factor.

**Cursor rule:** Never store plaintext passwords, reversible encrypted passwords, or unsalted fast hashes.

---

## U. “Forgot password” must reset, never reveal

Do not email the user’s existing password. The product must create/bind a new authenticator/password after proper recovery. Passwords are never recoverable plaintext.

---

## V. Authentication attempts must be rate-limited

NIST requires effective rate limiting against failed authentication attempts.

**Cursor rule:** Every online authentication endpoint must implement server-side throttling/rate limiting — password login, OTP, recovery codes, authenticator activation where applicable. UI delays alone are not security.

---

## W. Rate limiting must resist brute force without making account-lockout attacks trivial

Do not simply lock account forever after 3 failures. An attacker could deny service to arbitrary users.

Use controlled throttling/backoff/risk controls. UX must clearly explain when retries are temporarily limited.

---

## X. Do not reveal whether an account exists unnecessarily

**Bad:** No account exists for anthony@example.com.

**Safer:** If an account exists for that email, we’ll send recovery instructions.

Authenticated/admin contexts may appropriately reveal account existence where necessary.

---

## Y. Login errors should not reveal excessive authentication detail

**Bad:** Email correct, password wrong.

**Potentially safer:** Email or password is incorrect.

Don’t reveal MFA method details, recovery addresses, or account state to unauthenticated attackers unnecessarily.

---

## Z. Security messaging must still be useful

Enumeration resistance does not mean **Error 403.**

**Good:** We couldn’t sign you in with those credentials.

The user can recover without the system giving an attacker unnecessary account intelligence.

---

## AA. MFA should be encouraged for user accounts

NIST says AAL1 systems should make MFA options available and encourage their use; AAL2 requires two distinct factors.

For a business SaaS storing customer data, messages, calendars, payments, and transcripts — Transovo should strongly support MFA. For organization owners and administrators, consider MFA a strong product/security requirement.

---

## AB. Prefer phishing-resistant MFA over OTP where practical

At AAL2, NIST requires at least one phishing-resistant option to be available and encourages its use.

Hierarchy should lean toward:

1. Passkey/WebAuthn
2. hardware security key/WebAuthn
3. authenticator app/TOTP
4. weaker fallback methods where justified

Do not promote SMS OTP as the strongest method.

---

## AC. SMS/voice OTP should be treated as weaker authentication

Phone-based out-of-band authentication has risks such as SIM swaps, interception, number reassignment.

NIST allows certain PSTN out-of-band mechanisms under defined conditions, but it is not phishing-resistant.

**Cursor rule:** If SMS-based MFA exists as a fallback, do not label it “most secure.”

---

## AD. Push approval must resist authentication fatigue

NIST specifically identifies authentication fatigue as a threat and recommends mechanisms that require transfer/entry of an authentication secret rather than blind approval.

Avoid **Approve? Yes/No** push spam where attackers can repeatedly prompt until user gives in.

---

## AE. MFA prompts need context

Show enough information for a user to decide whether authentication is legitimate.

**Example:** Sign-in to Transovo · Chrome on Windows · Approximate location if safely available · Time

Not merely **Approve login?** with no context.

---

## AF. Do not expose precise location unnecessarily

Security context might display **Woodbridge, Virginia area** rather than an exact coordinate/address.

Session/security telemetry itself has privacy implications; NIST explicitly notes this for session monitoring.

---

## AG. Users should be able to register more than one authenticator

NIST’s identity-proofing guidance recommends encouraging users to bind at least two distinct means of authentication to reduce recovery risk.

Security settings should support passkey on phone, passkey on another device, security key, TOTP backup where offered, recovery codes.

---

## AH. Adding a new authenticator is a high-risk event

Do not let an authenticated session silently add a new passkey without appropriate recent authentication.

Require authentication/reauthentication according to risk. Then notify the user.

---

## AI. Removing an authenticator also deserves protection

Removing passkey, disabling TOTP, or removing security key should require sufficient authentication when necessary.

Do not let someone who stole an unattended browser session remove every legitimate authenticator without challenge.

---

## AJ. Do not let users accidentally remove their last recovery path

If possible: **You’re about to remove your only remaining authentication method.**

Require adding another method first or make consequence extremely clear.

---

## AK. Authenticator changes should generate security notifications

Notify for events such as: new passkey added, recovery performed, MFA disabled, password changed, recovery email/phone changed, potentially significant SSO/security changes.

Notifications should contain what happened, when, and how to respond if unauthorized.

---

## AL. Notifications must not include authentication secrets

**Good:** A new passkey was added to your account.

**Bad:** Here’s your secret recovery token.

Keep notification and authentication channels conceptually separate.

---

## AM. Account recovery is part of the authentication system

NIST explicitly treats account recovery as a defined authenticator-management event, not a random support shortcut.

**Cursor rule:** Account recovery must have a documented threat model and must not become easier to attack than normal login.

---

## AN. Recovery must not rely on security questions

No mother’s maiden name, childhood street, or first pet. Current NIST guidance rejects KBA/security questions in authentication design.

---

## AO. Recovery codes must be high-entropy and single-use where applicable

NIST’s current recovery guidance defines saved recovery-code requirements and says used codes must be invalidated/replaced.

**Cursor rule:** Recovery codes are credentials. Store them securely, rate-limit their verification, and invalidate them after use according to the chosen recovery architecture.

---

## AP. Recovery codes must not be shown casually after enrollment

When initially generated: **Save these recovery codes somewhere safe.**

Thereafter: do not display existing plaintext codes from storage; generate replacements if needed.

---

## AQ. Regenerating recovery codes invalidates previous codes

Make this consequence explicit: **Generate new recovery codes? Your existing recovery codes will stop working.**

---

## AR. Account recovery must generate a notification

**Example:** Your Transovo account was recovered at 2:14 PM. If this wasn’t you, contact support immediately and secure your account.

---

## AS. Recovery notification must explain repudiation

Include **If you didn’t do this…** and a secure recovery response path — not merely **Account recovered.**

---

## AT. Password reset links/codes must expire

Recovery artifacts should be time-limited, single-use, securely random, and rate-limited.

Do not create permanent password-reset URLs.

---

## AU. Do not put reusable authentication secrets in URLs where avoidable

URLs leak through browser history, logs, referrers, screenshots.

Recovery tokens may need URLs operationally, but design them as random, time-limited, single-use, invalidated after redemption.

---

## AV. Changing recovery addresses is a sensitive action

If an attacker controls a session, changing recovery email or recovery phone could give them future account control.

Require recent authentication and notify the previous channels where appropriate.

---

## AW. Existing recovery channels should receive change notifications

**Example:** Your recovery email was changed from a•••@example.com to b•••@example.com.

Do not only notify the newly added address.

---

## AX. Session security is part of authentication

NIST says session management is preferable to continually asking users to resubmit credentials, but authenticated sessions require lifecycle controls.

**Cursor rule:** Authentication does not end when login succeeds. Session creation, storage, renewal, expiration, and termination are security-critical.

---

## AY. Session secrets must be generated after authentication

NIST requires session-binding secrets to be generated by the session host in direct response to successful authentication.

Do not reuse password, OAuth access token, or predictable user ID as the application session identifier.

---

## AZ. Session cookies must be securely configured

For browser sessions, use appropriate protections: Secure, HttpOnly, appropriate SameSite, high-entropy session identifiers, server-side invalidation strategy.

Do not expose session tokens to browser JavaScript unnecessarily.

---

## BA. Session tokens must not appear in URLs

Never put authenticated session credentials in page URLs or query parameters.

Use secure cookie/header mechanisms.

---

## BB. Logout must terminate the relevant session

Logout is not hide dashboard and navigate to login. Server/session state must become unusable.

**Cursor rule:** A logged-out session token must not continue to authorize API requests.

---

## BC. “Log out all devices” must actually invalidate all relevant sessions

If Transovo offers **Log out all other sessions**, backend must revoke/terminate them — not merely remove rows from a UI list.

---

## BD. Users should be able to inspect active sessions where feasible

A premium SaaS security area can show current session, Chrome · Windows, Woodbridge VA area, Active now — with Sign out.

This supports detection and control of account compromise.

---

## BE. Never display raw session tokens

Session management UI may display device/browser, approximate location, created/last used.

Never session secret, bearer token, or cookie content.

---

## BF. Reauthentication is required periodically according to assurance/risk

Current NIST guidance distinguishes overall session timeout, inactivity timeout, and reauthentication.

For AAL2, NIST recommends overall reauthentication timeout no more than 24 hours and inactivity timeout no more than 1 hour.

For AAL1, overall timeout should generally be no more than 30 days; inactivity timeout is optional.

**Cursor rule:** Define and document Transovo’s session assurance level and timeout policy rather than using arbitrary “remember me forever” behavior.

---

## BG. High-risk actions can require recent reauthentication even during an active session

Examples: change password, add passkey, disable MFA, delete organization, export all customer data, change SSO configuration.

Even if session is still valid, request recent proof where risk justifies it.

---

## BH. Reauthentication should preserve user context

If security requires reauthentication during **Change organization owner** flow: authenticate, then return directly to the pending action.

Do not dump the user on Home and make them start over.

---

## BI. Session-expiration warnings should be meaningful

**Good:** Your session will expire soon due to inactivity. **Continue session**

Do not surprise a user filling a long configuration form by silently discarding it.

---

## BJ. Session timeout must not destroy unsaved work unnecessarily

Security requires authentication state to end. It does not require destroy every unsaved field.

Where feasible: preserve safe local draft, reauthenticate, restore task.

---

## BK. “Remember this device” must not mean bypass authentication indefinitely

NIST explicitly says remember-browser mechanisms must not substitute for required authentication outside defined reauthentication allowances.

---

## BL. Session monitoring must be risk-based and privacy-aware

NIST allows session monitoring based on timing, device/browser characteristics, geolocation, IP reputation, usage patterns — but explicitly notes privacy implications.

**Cursor rule:** Do not silently collect extensive behavioral/security telemetry merely because it might detect fraud. Apply privacy minimization.

---

## BM. Suspicious sessions should trigger proportionate action

Possible responses: require reauthentication, terminate session, notify user, flag for review.

Do not automatically delete account or block legitimate user based on one weak signal.

---

## BN. Never use IP address alone as identity

IP addresses can change, be shared, route through VPNs, represent mobile carriers.

Use as a risk signal, not proof of user identity.

---

## BO. Device fingerprinting must not become invisible authentication

Device/browser characteristics can aid risk detection. They should not silently become the sole authenticator for high-risk access.

---

## BP. SSO does not eliminate local session responsibility

NIST notes that IdP and relying-party sessions are separate; expiration at one does not automatically terminate the other.

Transovo must still enforce its own session lifetime, logout, reauthentication, and authorization.

---

## BQ. OAuth login and OAuth integration authorization are different

**Sign in with Microsoft** authenticates the user.

**Connect Microsoft Calendar** authorizes access to calendar resources.

Those should not be conflated.

**Cursor rule:** Identity authentication and integration authorization are separate security domains.

---

## BR. OAuth state and PKCE protections must be used where applicable

Authorization flows must protect against CSRF, code interception, response mix-up.

Use standard OAuth/OIDC security mechanisms: state, PKCE where applicable, exact redirect URI validation, nonce for OIDC where appropriate.

---

## BS. OAuth tokens must not be exposed to client UI unnecessarily

Access/refresh tokens are credentials. Do not put them in DOM, query string, localStorage unnecessarily, logs, or error messages.

Store according to secure server-side architecture whenever possible.

---

## BT. Refresh tokens require stronger protection than ordinary UI state

A refresh token can permit long-lived access to external resources.

Encrypt/protect stored refresh tokens and restrict access.

Do not expose **View Microsoft refresh token** to normal admin users.

---

## BU. Integration disconnect must revoke/clear credentials appropriately

Clicking **Disconnect Microsoft** must stop Transovo from using that authorization.

Remove/revoke credentials according to provider capability and product behavior.

---

## BV. Authentication state and authorization state are different

Authentication answers **Who are you?** Authorization answers **What are you permitted to do?**

**Cursor rule:** Never use successful login as sufficient authorization for tenant/admin actions.

---

## BW. Authorization must be enforced server-side

Hiding **Delete organization** button from staff is not security. Backend must reject the operation.

UI role visibility improves UX. Server authorization provides security.

---

## BX. Every tenant-scoped operation must enforce tenant ownership/access

Contacts, appointments, calendars, meetings, recordings, payments, workflows, credentials must be authorization-scoped.

Never trust `tenantId` supplied by client without verifying membership/permission server-side.

---

## BY. Never expose sensitive administrative actions based solely on frontend role state

Frontend `user.role === "admin"` can improve display. But API must independently verify role.

---

## BZ. Principle of least privilege should guide roles

Users should receive only access needed for their work.

Staff may need appointments, contacts, messages — but not necessarily billing, SAML, compliance registration, organization deletion.

---

## CA. Permission changes are security-sensitive

Changing Staff → Admin should require authorized actor, clear scope, audit event, perhaps recent authentication depending on risk.

---

## CB. Ownership transfer needs extra safeguards

Transferring organization ownership can affect billing, data, security, integrations, team management.

Require explicit confirmation and strong authentication.

Display **Transfer ownership to Sarah Smith?** — not **Change role?**

---

## CC. Security settings must state effective scope

**Example:** Require MFA for administrators — should clearly mean which roles, when enforcement begins, what happens to admins not yet enrolled.

---

## CD. Enforcing MFA should include an enrollment path

If admin enables **Require MFA for all staff**, do not instantly lock everyone out without warning/transition unless intended.

Show users affected, enforcement date/state, enrollment requirement.

---

## CE. SAML/SSO enablement must include safe fallback planning

Misconfigured SAML can lock the entire organization out.

Before enforcing SSO: verify configuration, test login, preserve emergency recovery/owner path according to policy, warn before enforcement.

---

## CF. SSO domain verification must not trust arbitrary domain text

If Transovo supports domain-based SSO, verify ownership appropriately.

Do not let an organization claim `microsoft.com` and intercept logins.

---

## CG. SCIM provisioning actions must be authenticated and authorized

SCIM tokens are security-sensitive credentials. They must be high entropy, scoped, revocable, not exposed after initial creation where avoidable.

Never display a saved SCIM bearer token forever in plaintext.

---

## CH. API keys/secrets should use reveal-once patterns where appropriate

Preferred pattern: **Created successfully. Copy this secret now; it will not be shown again.**

Store hashed or otherwise appropriately protected depending on verification requirements.

---

## CI. Secret rotation must be supported

For API/webhook credentials: allow generate new, overlap briefly if architecture needs zero-downtime transition, revoke old.

---

## CJ. Security-sensitive credentials should never appear in application logs

Do not log passwords, passkey private material, access tokens, refresh tokens, session IDs, recovery codes, API keys.

---

## CK. Secrets should not appear in analytics/telemetry

Don’t accidentally send auth tokens, email magic links, or password fields to client analytics, error reporting, replay tools, or session-recording products.

---

## CL. CSRF protections must exist for cookie-authenticated state-changing actions

If auth uses cookies, state-changing requests must be protected using appropriate SameSite strategy and CSRF token/origin checks as required by architecture.

---

## CM. Sensitive actions should not be available through GET requests

Never `/delete-account?id=123` where merely visiting the URL performs deletion.

Use proper authenticated state-changing methods with CSRF protection.

---

## CN. XSS can defeat authentication UX

Even excellent sessions/passkeys are compromised if hostile scripts can steal or act within authenticated context.

Use output encoding, safe frameworks, CSP where appropriate, avoid unsafe HTML injection.

---

## CO. Do not put secrets into client-visible environment variables

Any client-bundled environment variable is visible to users. Provider/server secrets remain server-side.

---

## CP. Login form must support password managers and accessibility

Security cannot come at the cost of disabling paste, blocking autofill, inaccessible CAPTCHA, or keyboard-hostile MFA.

NIST explicitly emphasizes password-manager support; WCAG accessible-authentication rules cover cognitive barriers.

---

## CQ. Do not use puzzle-based security that harms accessibility

Avoid authentication requiring remembering arbitrary strings, solving visual puzzles, or transcribing distorted images unless accessible alternatives satisfy requirements.

---

## CR. Magic links are credentials

If Transovo uses email magic links: high entropy, expire, single-use or appropriately constrained, bound to intended action/context, invalidate safely.

---

## CS. OTP codes must expire and be rate-limited

One-time codes should have finite lifetime, reject excessive guesses, be invalidated after successful use, not be indefinitely reusable.

---

## CT. Do not reset OTP validity indefinitely on every resend without design

Define latest code behavior, resend throttling, expiry.

Clearly tell users: **We sent a new code.**

---

## CU. Never display OTP/recovery secrets in logs or error messages

No **OTP validation failed for code 483921.** Sensitive values must be redacted.

---

## CV. Biometric data should not be collected by Transovo for passkey authentication

With WebAuthn/passkeys, biometric verification normally occurs locally through the authenticator/device.

Transovo should receive cryptographic authentication results, not fingerprints, Face ID image, or raw biometric template.

**Cursor rule:** Do not describe passkey authentication as Transovo storing a user’s fingerprint or face.

---

## CW. Passkey labels should be user-understandable

Security settings might say **Passkeys** and explain: Sign in using Face ID, Touch ID, Windows Hello, your device PIN, or a security key depending on your device.

Do not lead with **FIDO2 discoverable public-key credential.**

---

## CX. Users should be able to identify registered passkeys

Show useful metadata: iPhone passkey · Added Sep 5 · Windows laptop · Added Aug 21.

Allow Rename and Remove where appropriate. Do not display raw credential IDs as primary labels.

---

## CY. Authenticator names should not be trusted security evidence

If user renames passkey **My secure laptop**, that’s display text. It does not prove device security.

---

## CZ. Security event history should be available where useful

Potential events: sign-in, new authenticator, password change, recovery, security setting change, admin role change, SSO enforcement.

Don’t expose secrets.

---

## DA. Security event timestamps should be accurate and timezone-aware

Display **Sep 8, 2026 · 2:14 PM EDT** or workspace/user timezone with context.

---

## DB. Security alerts must avoid phishing themselves

Prefer directing users to **Open Transovo and review Security** when possible.

If links are used, make destination and purpose clear.

---

## DC. Never ask users to send credentials to support

Support should never ask for password, OTP, recovery code, passkey secret, or API token.

Reinforce: **Transovo support will never ask for your password or authentication code.**

---

## DD. Support-assisted recovery needs strong controls

If human support can reset access, the support process becomes an authenticator.

It requires documented identity verification, audit trail, limited permissions, notifications, strong operator authentication.

---

## DE. Admin impersonation needs explicit safeguards if ever supported

If support/admin can **View as user**: permission restricted, clearly labeled impersonation state, audit logged, sensitive actions restricted where appropriate, obvious exit.

Do not silently log employees into customer accounts.

---

## DF. Security controls should fail closed

If authorization service is unavailable, do not assume allow.

If session validation fails, do not assume valid.

If tenant membership cannot be verified, block sensitive access.

**Cursor rule:** Security checks default to denial on uncertainty unless an explicitly designed safe-degraded behavior exists.

---

## DG. Authentication-provider failure must not create a bypass

If Google login is down, do not create temporary password = user’s email to let people in.

Fallback authentication methods must already be secure and bound to the account.

---

## DH. Do not create hidden universal backdoors

No hard-coded admin password, magic support login, secret query parameter, or shared master OTP.

Every privileged access path must have normal authentication, authorization, and audit controls.

---

## DI. Test environments must not silently trust production identity

Test mode should be isolated.

Never implement `if NODE_ENV !== production: skipAuth()` in a manner that can be accidentally deployed.

---

## DJ. Production auth behavior must not be weakened to facilitate UI development

Cursor must never disable authentication, permission checks, CSRF, or token validation just to make a page easier to preview.

---

## DK. Authentication state must not rely solely on client state

Never trust `localStorage.isAdmin = true` or `isLoggedIn = true` as security evidence.

Server-side session/token verification remains authoritative.

---

## DL. JWT validation must be complete if JWTs are used

Validate signature, issuer, audience, expiration, relevant claims.

Do not merely Base64-decode JWT contents and trust them.

---

## DM. Algorithm choices must not be accepted from untrusted tokens blindly

JWT verification must use configured expected algorithms.

Do not permit `alg = none` or algorithm confusion.

---

## DN. Token expiration must be enforced server-side

UI countdown is not security. Expired token/session must fail authorization even if the page still visually appears logged in.

---

## DO. Token refresh must be controlled

Refresh mechanisms should validate refresh credential, rotate where architecture requires, invalidate compromised/revoked credentials, not create unlimited immortal sessions.

---

## DP. Changing password should invalidate appropriate sessions according to policy

If password compromise is suspected and user changes password, consider terminating other sessions/credentials as policy dictates.

At minimum offer **Sign out other devices.**

---

## DQ. Compromised authenticator should trigger replacement, not routine rotation

Do not rotate passwords arbitrarily. Force replacement/change when evidence indicates compromise.

Security action should be event/risk driven.

---

## DR. Users should be able to report “This wasn’t me”

For security notifications include recovery path: **This wasn’t me** leading into revoke session/authenticator, secure account, review activity.

---

## DS. Security controls should show current state truthfully

Examples: MFA enabled · 3 passkeys registered · SSO required for staff · Last password change Sep 1

Don’t show **Secure** as a vague green badge.

---

## DT. Avoid fake security scores unless rigorously defined

No **Security score: 93%** unless there is a transparent, meaningful methodology.

Prefer actionable controls: Add a passkey · Enable MFA for admins · Review active sessions.

---

## DU. Security setup should prioritize highest-value improvements

1. Add passkey
2. Add backup authenticator
3. Save recovery codes
4. Review active sessions

Not a 25-item checklist of cosmetic settings.

---

## DV. Sensitive action dialogs should state exactly what is happening

**Good:** Disable MFA for Anthony Johnson? Anthony will be able to sign in using only their remaining single-factor method until MFA is configured again.

Better than **Are you sure?**

---

## DW. Never ask a user to authenticate inside an untrusted embedded frame

Login/recovery/password flows should occur in controlled trusted Transovo/provider contexts.

Public Booking embeds should not become admin-login surfaces.

---

## DX. Clickjacking protections should exist on sensitive account/admin pages

Use appropriate CSP frame-ancestors / frame restrictions for administrative/authentication surfaces.

Public booking pages can have deliberately different embed policy.

---

## DY. External links from security screens should be treated carefully

If sending users to Microsoft security or Google security, make destination clear.

Do not present third-party domain as if still inside Transovo.

---

## DZ. Authentication UX must not expose whether internal staff/admin accounts exist

Public recovery/login endpoints should resist enumeration consistently.

---

## EA. Invite links are security credentials until accepted

Team invitation link can grant organization access.

Therefore: high entropy, expiration, intended recipient/context binding where appropriate, single-use, revocation.

---

## EB. Accepting a team invite must not bypass identity verification completely

Bind invite acceptance to the intended account/email/authentication policy.

---

## EC. Role granted by invite must be explicit

Invitation should state **You’ve been invited as Staff.** If invite is Admin, show that clearly.

---

## ED. Invitation revocation must actually invalidate the link

If admin clicks **Revoke invitation**, future use must fail server-side.

---

## EE. SSO and local-auth account linking must avoid account takeover

Do not automatically merge identities solely based on unverified email coincidence.

Use provider-verified identifiers and safe account-linking rules.

---

## EF. External identity identifiers should be immutable provider IDs, not display email alone

Use issuer and provider subject identifier as canonical identity mapping where protocols provide them.

Emails can change. Identity mappings should not.

---

## EG. MFA reset by administrators should be logged and notified

If organization administrator can reset staff MFA, record actor, target, time. Notify target where appropriate.

---

## EH. Audit logs must be protected from ordinary modification

A staff user should not be able to delete **Anthony made himself admin** from audit history.

---

## EI. Security event logging must not become secret logging

Record event type, actor, target, timestamp, outcome, relevant non-secret metadata. Do not record credentials.

---

## EJ. Authorization failures should be logged appropriately

Repeated attempts to access other tenant may be security-relevant.

---

## EK. Do not expose internal authorization details in user errors

**Bad:** RBAC policy deny tenant 47 scope workflow.write.

**Good:** You don’t have permission to edit this workflow.

---

## EL. Security UX must work with accessibility

Security controls must remain keyboard operable, screen-reader accessible, compatible with password managers, not dependent on memory puzzles.

Use Guide #1 and WCAG authentication rules together with NIST.

---

## EM. Security UX should reduce social engineering opportunities

For sensitive actions: clearly identify Transovo domain, don’t encourage copying OTPs into support chat, don’t teach users to approve unexplained prompts.

---

## EN. Do not normalize “share your code with us”

Never write support copy such as **Tell our agent the six-digit code we sent you.**

---

## EO. User-visible device/location security information must be qualified

Don’t claim **Login came from your iPhone** if it is only inferred from user-agent.

Use **Safari on iPhone** or **Device reported as iPhone** where appropriate.

Likewise location: **Approximate area based on IP.**

---

## EP. Suspicious login alerts should minimize false certainty

**Example:** New sign-in detected from a browser we haven’t seen before.

Better than **Hacker attempted access.**

---

## EQ. WebAuthn private keys must never be sent to Transovo

WebAuthn uses public-key credentials. The server receives public credential material/assertions; private credential keys remain with authenticator infrastructure.

**Cursor rule:** Never design or document WebAuthn as exporting/storing the user’s passkey private key on Transovo servers.

---

## ER. User verification and biometric identity are not the same thing

Transovo generally learns that the authenticator performed user verification, not which biometric trait was used.

Do not display **Face ID verified this user’s identity** unless the actual protocol/provider supports that specific assertion.

---

## ES. Passkey recovery depends on authenticator ecosystem, not Transovo knowing the secret

Syncable passkeys may be recovered/synced by platform credential providers; device-bound security keys may require another registered authenticator.

No fake **Email us your passkey.**

---

## ET. Account deletion must require strong authentication

Organization/account deletion is high consequence.

Require recent authentication, clear scope, explicit confirmation, appropriate ownership/authorization.

---

## EU. Billing/payment configuration changes may require reauthentication

Changing payout/payment provider connection, billing identity, or refund controls can have financial consequence.

Use step-up authentication based on actual risk.

---

## EV. Security policy should be centralized

Do not independently define session timeout in middleware, another timeout in frontend, MFA rules in one API, different MFA logic in Settings.

**Cursor rule:** Authentication, session, and authorization policy must have one authoritative implementation path.

---

## EW. Security decisions must be deterministic

LLMs must not decide **Is this user probably an admin?** or **Does this login look legitimate enough?**

Authentication/authorization outcomes must come from deterministic policies and authoritative signals.

---

## EX. AI must never receive secrets unnecessarily

Do not send to an LLM: passwords, refresh tokens, session cookies, recovery codes, API keys, OTPs for debugging or explanation.

---

## EY. Error reports must redact authentication secrets

Diagnostic bundle must not contain raw authorization code, access token, or refresh token.

---

## EZ. Security testing must cover bypass paths

Test: expired session, revoked session, invalid MFA, reused OTP, reused recovery code, removed user, downgraded role, cross-tenant ID substitution, forged client role, revoked invitation, stale OAuth callback, CSRF, session fixation, logout token reuse.

---

## FA. Every privileged server endpoint requires authorization tests

Test authorized role succeeds and unauthorized role fails. UI hiding is not enough.

---

## FB. Authentication changes require regression testing

Password-policy change, MFA change, passkey change — each needs enrollment, login, recovery, removal, notification test coverage.

---

## FC. Security controls must have safe migration paths

If moving users from password only to MFA required, plan enrollment, grace period if applicable, enforcement, recovery, admin/support path.

---

## FD. Never weaken existing security silently during migration

If passkey migration fails, do not quietly disable MFA for everyone.

---

## FE. Security-critical dependencies must fail predictably

If Redis/session store is unavailable, do not accidentally authenticate everyone.

**Hard rule:** Unknown authentication state = unauthenticated/denied until resolved.

---

## FF. “Connection healthy” and “authentication secure” are not interchangeable

Microsoft Calendar may be **Connected** but that says nothing about the user’s Transovo MFA.

Do not conflate integration authorization, user authentication, and account security.

---

## FG. Security state should be inspectable, not scary

Settings → Security should answer: What methods can I use to sign in? Is MFA enabled? What passkeys exist? What sessions are active? What recovery options exist? Is SSO enforced? What changed recently?

---

## FH. Security copy must distinguish requirement from recommendation

**Required:** Administrators must use MFA.

**Recommended:** Add another passkey as backup.

---

## FI. Security severity should be proportional

Critical: MFA was removed from your account.

Warning: You only have one authentication method.

Info: A new browser signed in successfully.

---

## FJ. Authentication should minimize user burden while preserving assurance

NIST’s modern guidance intentionally removes arbitrary password complexity and encourages password managers/passkeys because security and usability reinforce each other.

**Cursor rule:** Never introduce user friction unless it addresses a defined threat or assurance requirement. No security theater.

---

## Transovo Security & Authentication Acceptance Checklist

Every applicable authentication/security feature should pass:

- [ ] Current NIST SP 800-63-4 / 800-63B-4 guidance used, not superseded 2017 assumptions
- [ ] Authentication assurance/risk level explicitly considered
- [ ] Phishing-resistant authentication option supported/planned where appropriate
- [ ] Passkeys implemented through WebAuthn, not proprietary imitation
- [ ] MFA factors are genuinely distinct factors
- [ ] Passwords are not represented as phishing-resistant
- [ ] Single-factor password minimum is at least 15 characters where following NIST AAL guidance
- [ ] MFA-component passwords are at least 8 characters
- [ ] At least 64-character passwords/passphrases supported
- [ ] No mandatory uppercase/lowercase/number/symbol composition rules
- [ ] No arbitrary periodic password expiration
- [ ] Passwords checked against common/compromised blocklist
- [ ] Blocklist rejection explains the reason
- [ ] Spaces and supported character sets work correctly
- [ ] Passwords are never silently truncated
- [ ] Password managers/autofill work
- [ ] Password paste is allowed
- [ ] Show-password option exists where appropriate
- [ ] Security questions/password hints are not used
- [ ] Passwords are salted and securely hashed
- [ ] Authentication endpoints are rate-limited
- [ ] Login/recovery errors avoid unnecessary account enumeration
- [ ] MFA enrollment provides at least one strong method
- [ ] Passkey/WebAuthn is preferred over weaker OTP where appropriate
- [ ] SMS/voice OTP is not presented as phishing-resistant
- [ ] Push approval design mitigates authentication fatigue
- [ ] Authentication prompts provide enough context
- [ ] Users can maintain more than one authenticator
- [ ] Adding/removing authenticators requires appropriate reauthentication
- [ ] Users cannot casually remove their final recovery path
- [ ] Security-sensitive authenticator changes generate notifications
- [ ] Recovery uses defined secure mechanisms, not KBA
- [ ] Recovery codes are high entropy, protected, rate-limited, and single-use as applicable
- [ ] Existing recovery codes are invalidated when regenerated
- [ ] Account recovery generates security notification
- [ ] Recovery notifications include repudiation instructions
- [ ] Recovery links/codes expire
- [ ] Recovery/contact changes are protected and notified
- [ ] Sessions use strong server-generated secrets
- [ ] Session secrets are not exposed in URLs
- [ ] Cookies use appropriate Secure/HttpOnly/SameSite protections
- [ ] Logout invalidates the server-side session
- [ ] Log-out-all-devices actually revokes applicable sessions
- [ ] Session/re-authentication timeouts are documented and risk-based
- [ ] Sensitive actions can require recent step-up authentication
- [ ] Reauthentication preserves user task context
- [ ] Session-expiration UX does not unnecessarily destroy work
- [ ] Remember-device behavior does not create immortal sessions
- [ ] Session monitoring has a privacy assessment
- [ ] SSO does not bypass Transovo session/authorization policy
- [ ] Login OAuth and calendar OAuth are modeled separately
- [ ] OAuth uses state/PKCE/nonce protections where applicable
- [ ] OAuth tokens are never exposed unnecessarily to the client/logs
- [ ] Refresh tokens are strongly protected
- [ ] Disconnecting integrations actually removes/revokes usable authorization
- [ ] Authentication and authorization are separate
- [ ] Authorization enforced server-side
- [ ] Every tenant resource is tenant-authorized server-side
- [ ] Client role state is never trusted as security authority
- [ ] Least privilege used for roles
- [ ] Privilege changes are authenticated/audited
- [ ] Ownership transfer has strong safeguards
- [ ] MFA/SSO enforcement has safe enrollment/recovery path
- [ ] SAML is tested before organization-wide enforcement
- [ ] API/SCIM/webhook secrets are protected and revocable
- [ ] Secrets are never stored in frontend/public environment variables
- [ ] Secrets are redacted from logs/analytics/error reports
- [ ] CSRF protections exist for cookie-authenticated state changes
- [ ] Sensitive mutations do not use unsafe GET endpoints
- [ ] Magic links/OTPs are expiring and appropriately single-use
- [ ] Biometric data is not collected by Transovo merely to support passkeys
- [ ] Passkeys can be identified and managed by users
- [ ] Security event history is available where appropriate
- [ ] Security alerts provide actionable “this wasn't me” recovery
- [ ] Support never asks users for passwords/OTP/recovery codes
- [ ] Support-assisted recovery has strong verification/audit controls
- [ ] Security checks fail closed
- [ ] No hidden master passwords/backdoors exist
- [ ] Production authentication cannot be bypassed for UI testing
- [ ] Authentication does not rely solely on client state
- [ ] JWTs/tokens are fully validated when used
- [ ] Expiration and revocation are enforced server-side
- [ ] LLMs never make authentication/authorization decisions
- [ ] Authentication secrets are never sent to AI systems unnecessarily
- [ ] Security bypass/regression tests exist

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & auth (this file)
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #9: Security & Authentication UX Standards. Next: Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*


===== [Formal #10 — Date, Time, Timezone & Locale] docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md =====
# Transovo Date, Time, Timezone & Locale Standards Guide

**Series:** Implementation standards · **Guide #10 of 12**  
**Status:** Active — mandatory hard standard for how Transovo stores, transmits, interprets, formats, compares, schedules, and displays dates, times, timezones, recurrence, locale-specific formats, and human-readable temporal information  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** ISO 8601 · RFC 3339 · IANA Time Zone Database · Unicode CLDR / LDML · BCP 47 / RFC 5646

---

## Master Cursor rule

> **Transovo date/time behavior must follow ISO 8601 and RFC 3339 for unambiguous machine interchange, the IANA Time Zone Database for civil-time and daylight-saving rules, Unicode CLDR for locale-sensitive human formatting, and BCP 47 for language/locale identifiers. Never conflate an instant, local date/time, UTC offset, or IANA timezone. Store authoritative event timestamps as instants, but preserve IANA timezone and local civil-time intent for future appointments, recurring events, business hours, reminder schedules, and other timezone-dependent rules. UTC alone does not solve future scheduling. Never hard-code UTC offsets or DST rules, never use timezone abbreviations as canonical identifiers, and never allow the server's machine timezone to influence business logic. Date-only, time-only, duration, local datetime, zoned datetime, and instant values must remain distinct domain concepts. Calendar arithmetic must be distinguished from elapsed-duration arithmetic; one day is not always 24 hours, and one month is not 30 days. All timezone conversion, recurrence, availability, reporting boundaries, reminder timing, provider synchronization, and locale formatting must use centralized standards-based utilities and be tested across DST transitions, different IANA zones, leap/calendar boundaries, and provider round trips.**

**This guide controls how Transovo stores, transmits, interprets, formats, compares, schedules, and displays dates, times, timezones, recurrence, locale-specific formats, and human-readable temporal information.**

For Transovo, this is a critical standards document because appointment software can fail catastrophically if it gets timezone conversion, daylight saving transitions, recurrence, imported calendar timezones, customer timezone, workspace timezone, timestamps, or locale formatting wrong.

---

## Core principle

**Store and exchange time unambiguously. Preserve the actual timezone when future civil time matters. Format dates/times for humans according to their locale and context. Never confuse an instant, a local wall-clock time, a UTC offset, and an IANA timezone.**

That last sentence is the most important rule Cursor receives.

**Primary authorities**

| Authority | Role |
|-----------|------|
| **ISO 8601** | International standard for unambiguous date/time representation; ordered `YYYY-MM-DD` avoids regional ambiguity |
| **RFC 3339** | Internet standards-track profile of ISO 8601 for timestamps; requires four-digit years |
| **IANA Time Zone Database** | Authoritative software database for civil-time rules, UTC offsets, and DST changes |
| **Unicode CLDR / LDML** | Locale data for dates, times, numbers, calendars, relative dates, week conventions |
| **BCP 47 / RFC 5646** | Standard language-tag system (`en-US`, `en-GB`, `es-MX`) |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Distinguish four different temporal concepts

These must never be treated as interchangeable.

| Concept | Meaning | Example |
|---------|---------|---------|
| **1. Instant** | A specific point on the global timeline | `2026-09-08T18:00:00Z` |
| **2. Local date/time** | A civil wall-clock value; alone does not uniquely identify an instant | `2026-09-08 14:00` |
| **3. UTC offset** | Difference from UTC at that moment; not a complete timezone policy | `-04:00` |
| **4. Timezone** | Civil-time rules including historical/future DST changes | `America/New_York` |

**Cursor rule:** Never model instant, local date/time, UTC offset, and IANA timezone as the same type or assume they are interchangeable.

---

## B. Use ISO 8601/RFC 3339 for machine interchange

ISO 8601 exists specifically to eliminate ambiguity from regional date conventions. RFC 3339 defines a profile of ISO 8601 specifically for Internet timestamps.

For API/event timestamp exchange, use forms like:

- `2026-09-08T18:00:00Z`
- `2026-09-08T14:00:00-04:00`

Do not transmit ambiguous strings like `09/08/26 2:00`.

**Cursor rule:** Machine-readable timestamps must use an unambiguous standardized representation such as RFC 3339.

---

## C. Always use four-digit years

RFC 3339 says Internet protocols must generate four-digit years and deprecates two-digit years because of ambiguity.

- **Good:** `2026-09-08`
- **Bad:** `26-09-08`
- **Never store** `9/8/26` as an authoritative date representation.

---

## D. Do not use ambiguous numeric date formats in user-critical contexts

ISO specifically highlights ambiguity like `01/05/22`, which can mean January 5 or May 1 depending on culture.

For customer-facing display, either use locale-aware formatting or use month names when ambiguity would be costly.

- Example U.S.: Sep 8, 2026
- Example British locale: 8 Sep 2026

**Cursor rule:** Never assume MM/DD/YYYY is globally understood.

---

## E. Store timestamps in UTC when they represent completed instants

For things that already happened — `created_at`, `received_at`, `sent_at`, `captured_at`, `delivered_at`, `executed_at`, audit events — store a canonical instant, typically UTC.

Example: `2026-09-08T18:03:17Z`

Then format it into the user's appropriate timezone for display. RFC 3339 notes that interoperability is best achieved with UTC when representing instants and defines `Z` as UTC offset `00:00`.

---

## F. Future appointments need the timezone, not merely UTC

This is one of the most important scheduling rules.

Suppose a dental appointment is March 15, 2027 at 9:00 AM `America/New_York`. If you store only the current computed UTC instant without preserving the intended timezone, future timezone-law changes can create incorrect civil time.

IANA explicitly says timezone rules are changed by political authorities and its database is periodically updated to reflect those changes.

**Cursor rule:** For future scheduled civil-time events, preserve the intended IANA timezone in addition to any computed instant.

Conceptually:

```
local_start = 2027-03-15T09:00:00
timezone = America/New_York
instant = computed UTC instant
```

---

## G. Do not use a fixed offset as a timezone

**Bad:** `timezone = -05:00` for New York.

New York can be UTC−05 or UTC−04 depending on DST. IANA exists specifically to encode those changing rules.

Use `America/New_York`, not `EST` or `-05:00`, as the canonical timezone.

---

## H. Do not use abbreviations as canonical timezone identifiers

Examples like EST, CST, and IST are ambiguous or incomplete. CST can refer to different regions.

Use IANA identifiers internally: `America/New_York`, `America/Chicago`, `Europe/London`, `Asia/Kolkata`, `Australia/Sydney`.

Human UI can show friendly names. Canonical storage remains IANA.

---

## I. Use the IANA Time Zone Database as the authority for timezone rules

IANA's database contains the rules/software data needed to calculate local time and UTC offsets and is updated when governments change DST or timezone rules.

**Cursor rule:** Do not maintain a custom hard-coded list of DST rules. Use runtime/library timezone data based on IANA tzdb.

---

## J. Keep timezone data current

IANA can publish timezone-rule changes with relatively little lead time.

Therefore:

- runtime/container dependencies must receive tzdb updates
- timezone libraries should not remain frozen indefinitely
- tests should not assume DST rules never change

As of September 2026, IANA's timezone page lists 2026c as the latest release and notes recent changes to Alberta and Morocco, illustrating that these rules really do change.

---

## K. Store the canonical IANA identifier, not only the display name

**Good storage:** `America/New_York`

**Display:** Eastern Time (potentially Eastern Time (New York))

Never store only `Eastern Time` because the display label may change or be localized.

---

## L. Preserve provider timezone IDs carefully

Microsoft, Google, and other providers may expose timezone identifiers in different forms.

Transovo should:

1. retain provider/source value where useful for round-trip fidelity
2. map it into the canonical timezone model
3. preserve the authoritative IANA zone when possible

Do not repeatedly convert Microsoft → display label → guessed IANA and lose information.

---

## M. Never guess a timezone silently when ambiguity matters

If location/context does not make timezone reliable: ask or use workspace/user default with clear visibility.

- **Bad:** User entered 2 PM → assume server timezone.
- **Good:** 2:00 PM Eastern Time, or clearly established workspace timezone.

**Cursor rule:** A missing timezone must never silently become the server's local timezone.

---

## N. Server timezone must not affect business logic

Production may run in UTC, Germany, Virginia, or container environments. Business logic should give the same result regardless.

Do not use `serverLocalTime()` as appointment interpretation. Server timezone is infrastructure. User/workspace timezone is product state.

---

## O. Database timezone and presentation timezone are separate

**Database:** UTC instant + timezone identifier

**UI:** localized civil time

Do not store a formatted display string as authoritative state.

- **Bad database field:** `"Tuesday at 2 PM EST"`
- **Good structured data:** instant, timezone, locale-independent date/time components where needed

---

## P. Workspace timezone must be explicit

Every Transovo workspace should have a canonical default timezone. Use it for business hours, reporting defaults, manual appointment creation where no other timezone applies, reminder policies, and schedule interpretation.

Display current timezone in settings. Don't hide this as an invisible backend default.

---

## Q. User timezone and workspace timezone may differ

Example: Business `America/New_York`, staff traveling `America/Los_Angeles`, customer `America/Chicago`. Those are distinct.

**Cursor rule:** Do not use one timezone field to represent organization, staff, contact, appointment, and viewer timezone simultaneously.

---

## R. Appointment timezone must remain authoritative to the appointment

An appointment should know the timezone in which its scheduled civil time is defined.

Example: `appointment.timezone = America/New_York`

That remains true even if staff travels, browser timezone changes, or customer views from another region. Viewer can receive converted display. Appointment's scheduling context remains stable.

---

## S. Booking pages need explicit timezone behavior

Customer-facing booking should establish whether available times are shown in customer's detected/selected timezone, business timezone, or booking-type timezone.

If showing converted customer times, display that timezone clearly.

Example: "Times shown in Central Time" or "Your timezone: America/Chicago"

Do not let a customer book 2 PM without knowing whose 2 PM it is.

---

## T. Timezone detection is a convenience, not authority

Browser detection can provide a useful default. But VPN, travel, device configuration, and remote booking can make it wrong. Allow correction where timezone matters.

**Cursor rule:** Never lock timezone solely from browser detection.

---

## U. Customer timezone should be persisted when useful

For recurring/customer communications, a contact timezone may help with localized booking links, appropriate message scheduling, and displaying appointment times.

But don't overwrite confirmed appointment timezone merely because contact profile changes later. Appointment state is historical/scheduled state.

---

## V. "Today" and "tomorrow" require an explicit timezone context

At 11:30 PM New York time, "tomorrow" may already be "today" in London.

Therefore code must never calculate `isTomorrow` without knowing whose timezone.

**Cursor rule:** Relative-day logic must always specify the relevant timezone.

---

## W. Reporting dates also require timezone context

Suppose reminder sent at `2026-09-09T02:30Z`. That's Sep 8 at 10:30 PM Eastern.

A daily report for the New York workspace should count it on Sep 8, not Sep 9. Analytics must group temporal data using the intended reporting timezone.

---

## X. Daylight Saving Time transitions must be explicitly handled

DST creates two major classes of problems:

**Spring-forward gap:** Some local times do not exist (e.g., 2:30 AM may be skipped).

**Fall-back overlap:** Some local times occur twice (e.g., 1:30 AM may have two possible UTC instants).

**Cursor rule:** Scheduling code must explicitly detect nonexistent and ambiguous local times around timezone transitions. Never let a library silently choose an arbitrary interpretation without defined policy.

---

## Y. Nonexistent times must not be scheduled silently

If user chooses a time that does not exist because clocks jump forward, do not silently transform 2:30 AM into 3:30 AM unless product explicitly explains/asks.

Prefer: "2:30 AM does not occur on this date because of the daylight-saving transition. Choose another time." 

---

## Z. Ambiguous times require deterministic policy

During a fall-back transition, local 1:30 AM can happen twice. If users can schedule such times:

- disambiguate using offset/occurrence
- or establish a documented deterministic rule

If ambiguity is relevant, show `1:30 AM EDT` and `1:30 AM EST` or equivalent localized representation. Never map arbitrarily with no audit trail.

---

## AA. Adding "24 hours" is not the same as "same time tomorrow"

This is a classic DST bug. Suppose appointment 9:00 AM Monday. A reminder 1 day before at 9:00 AM should generally use calendar/civil-time semantics.

Subtracting exactly `24 * 60 * 60` seconds can shift local time across DST transitions.

**Cursor rule:** Distinguish elapsed duration arithmetic from calendar/civil-time arithmetic.

---

## AB. "1 day before" and "24 hours before" are different concepts

The UI must preserve the user's intended semantics.

- **1 day before** — calendar-relative
- **24 hours before** — elapsed duration

For appointment reminders, product typically wants civil scheduling semantics. Do not accidentally convert one into the other.

---

## AC. "At 9 AM the day before" must be calculated in the intended appointment/business timezone

Example appointment: Tue 2 PM Eastern. Reminder: day before at 9 AM.

**Correct:** Monday 9 AM Eastern.

**Not:** appointment instant minus 29 hours in whatever server timezone happens to be active.

---

## AD. Specific reminder times should persist as semantic schedules

Instead of only storing computed `send_at_utc`, also preserve rules where needed:

```
1 day before
at 09:00
timezone_basis = appointment
```

Then future changes/reschedules can correctly recalculate.

---

## AE. Rescheduling must recalculate future temporal dependents

If appointment moves Sep 8 → Sep 10, recalculate reminder times, workflow delays, meeting bot join, calendar events, and payment deadlines where appointment-relative.

Do not leave previous UTC timestamps active.

---

## AF. Past-due reminder calculations must be deterministic

If reminder rule is 1 day before at 9 AM but appointment is created same day at noon, product needs documented behavior: skip, send immediately, or move to next valid step.

The temporal engine must evaluate it consistently.

---

## AG. Weekend/closed-day behavior needs calendar semantics

Example: send one business day before must not mean subtract 24 hours.

It requires working-day calendar, holidays, business timezone, and closed days. Keep this separate from elapsed duration.

---

## AH. Holidays need a defined calendar and locale/jurisdiction

Don't code "Dec 25 is the entire holiday system."

Business holidays may depend on country, locale, workspace, and custom closures. Store workspace holiday policies separately from timezone. Timezone tells you when. Holiday calendar tells you whether the business operates.

---

## AI. Business hours need timezone identity

**Bad:** Monday 9:00–17:00 with no timezone.

**Good:** Workspace hours · `America/New_York` · Monday 09:00–17:00

If staff schedules differ, each schedule needs its relevant timezone basis.

---

## AJ. Availability calculations must occur in a consistent temporal model

For each potential slot:

1. interpret requested local slot in scheduling timezone
2. convert provider events to instants
3. determine overlap
4. apply buffers/limits
5. present result in viewer/customer timezone

Do not compare naive local timestamps from different calendars.

---

## AK. Calendar-event overlap must compare instants, not display strings

Do not compare `"2:00 PM"` to `"14:00"`. Normalize underlying event intervals to instants for overlap. Presentation format is irrelevant to conflict calculation.

---

## AL. Preserve original timezone for imported events

Microsoft/Google event 10:00 AM Pacific should not become permanently 1:00 PM Eastern simply because Transovo workspace is Eastern.

You may display converted form, but preserve source timezone/context necessary for round-trip sync.

---

## AM. All-day events are not ordinary midnight-to-midnight appointments

Calendar providers often treat all-day events using date semantics rather than timestamp semantics.

**Cursor rule:** Model all-day events as date-based intervals, not blindly as 00:00 → 23:59:59 instants. Otherwise timezone conversion can shift them into adjacent dates.

---

## AN. Date-only values must remain date-only

Examples: birthday, holiday, all-day event date, reporting date selection.

Do not serialize `2026-09-08` as `2026-09-08T00:00Z` unless the domain actually represents an instant. Midnight UTC may display as the previous day elsewhere.

---

## AO. Time-only values are also distinct

Business opening time `09:00` is not an instant. It belongs to a local schedule plus timezone/date context when evaluated.

Do not attach today's UTC date just to store it.

---

## AP. Recurrence must preserve the recurrence's civil-time intent

Example: Every Monday at 9 AM Eastern. Across DST it should generally remain Monday at 9 AM Eastern, not always 14:00 UTC.

**Cursor rule:** Recurring schedules defined in local civil time must preserve the local time + timezone + recurrence rule.

---

## AQ. Recurrence cannot be modeled as repeated fixed-second intervals

Weekly appointment: do not simply `previous_instant + 604800` forever. DST can shift the displayed local hour. Use recurrence semantics + timezone.

---

## AR. Exceptions to recurrence must be first-class

Recurring series may need one occurrence canceled, one occurrence rescheduled, or series end changed.

Do not rewrite entire series destructively when editing one occurrence. Temporal model should preserve master recurrence, exception, and overridden occurrence.

---

## AS. Editing recurrence scope must be explicit

When user changes one occurrence, support explicit scopes where the product allows:

- This appointment only
- This and following
- Entire series

Never infer the scope silently.

---

## AT. End dates in recurrence should be inclusive/exclusive by specification, not assumption

A recurrence engine needs explicit rules. Don't let one component treat "until Sep 30" as inclusive while another excludes Sep 30. Use the underlying recurrence specification consistently.

---

## AU. Interval boundaries must use a documented convention

For event overlap, prefer half-open intervals conceptually: `[start, end)` — start included, end excluded.

Then 9:00–10:00 and 10:00–11:00 do not conflict.

**Cursor rule:** Define interval-boundary semantics centrally and use them consistently.

---

## AV. Do not subtract arbitrary seconds from end times

Avoid event ends at 9:59:59 so next event can start at 10. Use proper interval semantics instead. Artificial "minus one second" logic creates edge bugs.

---

## AW. Duration must be a duration, not a formatted clock string

Store 30 minutes as duration representation. Not `"00:30"` if that string could be misinterpreted as a clock time. Use domain-appropriate duration types.

---

## AX. Zero-duration and negative-duration events require explicit rules

Appointment end must normally be > start. Zero-duration event probably invalid unless domain allows it. Don't rely on database accident. Validate temporal invariants.

---

## AY. API timestamps should include timezone/offset information

RFC 3339 timestamps represent instants with UTC/offset relationship.

- **Good:** `2026-09-08T14:00:00-04:00` or `2026-09-08T18:00:00Z`
- **Bad:** `2026-09-08T14:00:00` for an instant unless API explicitly defines accompanying timezone.

---

## AZ. Do not confuse RFC 3339 offset with future timezone identity

`2026-09-08T14:00:00-04:00` fully identifies that instant. But it does not tell us future DST rules for recurring 2 PM meetings.

For future scheduling, preserve `America/New_York` as well. RFC 3339 itself notes that its timestamp format focuses on instants and does not encode local timezone-rule behavior.

---

## BA. Avoid floating local timestamps unless domain explicitly needs them

A floating time means something like 9 AM regardless of timezone. This can be appropriate for daily office hours before attaching schedule timezone or generic time-of-day templates, but dangerous for appointments.

If floating values are used, name/type them explicitly. Never accidentally create floating timestamps by forgetting timezone.

---

## BB. Locale and timezone are different

`en-US` does not mean `America/New_York`. A U.S.-English user may live in California, Virginia, or London.

Language/locale governs formatting. Timezone governs civil-time conversion. Store separately.

---

## BC. Language and locale are also not necessarily identical

BCP 47 language tags can represent language/region/script combinations such as `en-US`, `en-GB`, `es-MX`, `fr-CA`. RFC 5646 defines the standard tag system.

Use standardized tags. Don't invent `english_usa`.

---

## BD. Use Unicode CLDR data for locale-specific formatting

Unicode CLDR provides standardized locale data used by software systems to format/display dates, times, relative dates, calendars, numbers, timezones, and week information.

Use platform libraries based on CLDR, such as Intl, rather than writing custom formatting tables.

**Cursor rule:** Do not hard-code month names, weekday names, AM/PM formats, or locale date ordering.

---

## BE. Use Intl/CLDR-aware formatting for user-facing dates

For web: `Intl.DateTimeFormat(...)` or equivalent trusted library.

Do not manually concatenate `month + "/" + day + "/" + year` for all users. Formatting belongs to locale machinery.

---

## BF. Respect 12-hour vs 24-hour preferences

U.S. user: 2:30 PM. Many European locales: 14:30.

Use locale/user setting. Do not hard-code AM/PM globally.

---

## BG. Do not assume week starts Sunday

Locales differ. Some commonly use Sunday, Monday, or other conventions. CLDR carries locale week data. Calendar UI should use locale/workspace conventions where applicable.

---

## BH. Week-number calculations need an explicit standard

If Transovo ever exposes week numbers, specify whether using ISO week date or locale-specific week rules. Don't calculate "week 1" ad hoc. ISO week numbering has specific rules.

---

## BI. Relative dates are context-sensitive

Examples: Today, Tomorrow, Yesterday, 3 hours ago.

Use them only where context benefits (immediate dashboard, recent activity). For invoices, audit records, and compliance evidence, absolute date/time is more appropriate.

---

## BJ. Relative timestamps should expose exact time when consequential

Example: "3 hours ago" could have tooltip/detail "Sep 8, 2026 · 2:13 PM EDT".

For audit/security/history, prefer exact value directly.

---

## BK. Don't use "today" for dates in a different timezone without saying which day model applies

Dashboard for Eastern workspace should calculate "Today" in workspace timezone unless product specifies viewer timezone. Consistency matters more than browser-local convenience.

---

## BL. Appointment customer-facing communication should prefer clear natural language

Good reminder: "Tuesday, September 8 at 2:00 PM" is often clearer than `09/08/2026 14:00` unless locale expects that.

Machine standards and human formats are different layers.

---

## BM. Do not expose ISO timestamps to normal users unnecessarily

ISO/RFC representations are excellent for APIs, logs, exports, and debugging. Normal UI should be localized. Don't show `2026-09-08T18:00:00.000Z` inside an Appointment Detail unless user is in technical diagnostics.

---

## BN. Timezone abbreviations should be used cautiously in UI

Even friendly labels like EST or EDT can be confusing. Often better: "2:00 PM Eastern Time" or "2:00 PM EDT" if date makes DST clear.

When multiple zones appear on the same screen, make them unmistakable.

---

## BO. Prefer location-based timezone names in settings

Timezone selector: "Eastern Time — New York" with canonical `America/New_York` is better than a list of raw offsets. Offsets change seasonally.

---

## BP. Timezone selector should be searchable

There are many IANA zones. Support search by city, region, friendly name, and canonical identifier.

Example: Search "New York" → "Eastern Time — New York (America/New_York)". Don't make user scroll hundreds of items.

---

## BQ. Don't infer timezone from ZIP or country alone without confirmation

Country can contain multiple timezones. U.S. ZIP mapping may be possible but can have edge cases. Use location-derived timezone as suggestion, not unquestionable authority where ambiguity matters.

---

## BR. Contact timezone can be unknown

Do not fabricate `America/New_York` merely because the workspace is there. Represent "Timezone not set" and use documented fallback when needed.

---

## BS. Fallback hierarchy must be centralized

For example, if contact timezone absent: (1) appointment timezone, (2) booking type/workspace timezone, (3) explicitly documented fallback.

Do not let each feature invent a different fallback.

**Cursor rule:** Temporal fallback rules must live in one canonical service/configuration.

---

## BT. User-facing timezone changes need impact analysis

Changing workspace timezone can affect business hours, availability, reminder rules, report grouping, and scheduling defaults.

Before applying, explain what changes and what remains fixed. Do not silently reinterpret existing appointments unless explicitly intended.

---

## BU. Changing display timezone should not change the underlying instant

If viewer changes Eastern → Pacific, appointment 2 PM Eastern may display 11 AM Pacific but must represent the same instant. Display conversion ≠ rescheduling.

---

## BV. Changing appointment timezone can mean two different actions

Suppose 2 PM Eastern changes to Pacific. Does user mean:

- **Preserve instant** → 11 AM Pacific
- **Preserve wall-clock time** → 2 PM Pacific, a different instant

This is a major semantic difference.

**Cursor rule:** When changing an appointment's timezone, explicitly define whether the operation preserves the instant or preserves the local wall-clock time.

---

## BW. Never silently choose between preserve-instant and preserve-wall-time when consequence matters

UI should communicate "Keep the same moment (11 AM Pacific)" or "Keep 2 PM in the new timezone" if such editing is exposed.

---

## BX. Calendar sync must respect provider timezone semantics

When creating/updating Microsoft/Google events, send correct local date/time, correct timezone, correct recurrence, and correct all-day semantics.

Do not create everything in UTC merely because backend prefers UTC if provider expects timezone-aware civil scheduling fields.

---

## BY. Round-trip calendar sync must avoid timezone drift

Test: Transovo 2 PM Eastern → Microsoft → imported back into Transovo must remain 2 PM Eastern, not 1 PM, 3 PM, or UTC after repeated cycles.

This is a high-priority integration invariant.

---

## BZ. Recurring provider events need timezone/recurrence round-trip tests

Especially across spring DST, fall DST, timezone-law changes, and series exceptions. One successful one-off event does not certify recurring scheduling.

---

## CA. Webhook timestamps and event scheduled times are different fields

Webhook metadata `event received_at` is server instant. Appointment `scheduled_start` is business domain time.

Never overwrite `scheduled_start` with webhook delivery timestamp.

---

## CB. Audit logs should record instants plus display timezone context

Canonical: `2026-09-08T18:14:03Z`. Display: Sep 8, 2026 · 2:14 PM EDT.

This allows accurate ordering and understandable presentation.

---

## CC. Sorting temporal data should use underlying temporal values

Don't sort formatted strings. Lexicographic sort of `9/10/2026` and `10/1/2025` can be wrong.

Sort by instant, date, or duration — then format for display.

---

## CD. Filtering date ranges must define boundary timezone

User selects Sep 1 – Sep 30. What exactly is included?

For workspace report: interpret boundaries in workspace timezone, then convert to instants for query. Don't query Sep 1 00:00 UTC unless UTC is actually the report timezone.

---

## CE. Date-range end should use interval semantics, not 23:59:59.999

Prefer `[start_of_sep_1, start_of_oct_1)` not Sep 30 23:59:59.999. This avoids precision bugs, database differences, and DST-day-length assumptions.

---

## CF. A local day is not always exactly 24 hours

DST days may be 23 or 25 hours. Therefore start of day → end of day must use civil-time timezone boundaries.

Never define a day as exactly 86,400 seconds for local scheduling/reporting.

---

## CG. A month is not a fixed duration

Do not represent 1 month as 30 days when user means calendar month. Likewise year ≠ 365 days universally; week ≠ always a duration if civil scheduling semantics matter across timezone changes. Use calendar arithmetic.

---

## CH. Billing duration and appointment duration may use different semantics

Example: subscription renews monthly is calendar period. Appointment lasts 60 minutes is elapsed duration.

Do not use one generic duration implementation blindly.

---

## CI. Leap years must be handled by standard libraries

Do not custom-code `if year % 4` and forget century rules. RFC 3339 explicitly documents Gregorian leap-year behavior. Use standard date libraries.

---

## CJ. Leap seconds should not be hand-implemented

RFC 3339 recognizes leap seconds in timestamp representations. Application scheduling usually should delegate leap-second handling to platform/runtime standards rather than inventing custom logic.

---

## CK. System clocks are not guaranteed perfectly synchronized

For distributed services (database, app server, queues, providers), timestamps can have small skew.

Use trusted time synchronization infrastructure and avoid business logic requiring impossibly perfect simultaneous clock values. For security tokens, use controlled clock-skew tolerances according to relevant protocol.

---

## CL. Ordering by timestamps may need tie-breakers

Two events can share same millisecond timestamp. Audit timelines may need timestamp + sequence/id for deterministic order. Don't assume timestamp alone always creates unique total ordering.

---

## CM. Idempotency cannot rely only on timestamp equality

Two requests can legitimately occur at the same time. Use real idempotency keys/identifiers. Temporal proximity is not identity.

---

## CN. Clock time and monotonic elapsed time are different

For measuring operation took 2.4 seconds, use monotonic clocks where available. Don't subtract wall clocks that can jump due to synchronization/adjustment. This is implementation-level temporal correctness.

---

## CO. API duration units must be explicit

**Bad:** `"duration": 30` — what is 30?

**Good:** `duration_minutes: 30` or standardized duration representation. Avoid unit ambiguity.

---

## CP. Internal temporal types should communicate semantics

Prefer domain names like `appointmentStartInstant`, `appointmentTimezone`, `localStartTime`, `durationMinutes`, `businessDate` over `time1`, `time2`, `timestamp`. Naming prevents semantic mistakes.

---

## CQ. Avoid JavaScript Date misuse with naive dates

JavaScript's legacy Date represents an instant-like value and can cause timezone conversions that corrupt date-only values.

Be careful with `new Date("2026-09-08")` for domain concepts like holiday Sep 8. Use date/time types/libraries that preserve date-only, local datetime, zoned datetime, and instant semantics explicitly.

---

## CR. Use modern temporal libraries/APIs with explicit timezone semantics

Do not manually perform offset math, DST math, or timezone lookup with string arithmetic.

Use reliable timezone-aware libraries/platform APIs backed by IANA data. Centralize those utilities.

---

## CS. Never parse locale-formatted display strings as authoritative data

**Bad:** UI displays `9/8/26, 2:00 PM` then backend/parser tries to understand that string.

Pass structured machine values instead. Display is one-way formatting. Not storage protocol.

---

## CT. Locale parsing must be deliberate

If user manually types a date `09/10/2026`, interpret according to the selected locale or use controls that eliminate ambiguity. Don't guess based on server locale.

---

## CU. Public API documentation must define temporal semantics precisely

For every temporal field specify: type, timezone requirements, format, whether date-only or instant, inclusive/exclusive range behavior, recurrence semantics if relevant.

Example: `start_at`: RFC 3339 timestamp identifying appointment start instant. `timezone`: IANA timezone identifier describing appointment civil-time zone.

---

## CV. Exports should use unambiguous temporal data

CSV may include Start Date, Start Time, Timezone, Start UTC depending on user/report need.

At minimum, avoid exports where `09/08/26 02:00` cannot be interpreted reliably.

---

## CW. ICS calendar files must preserve calendar semantics

When generating .ics: use standards-compliant datetime/timezone representation, correct all-day handling, UID stability, recurrence semantics where applicable.

Don't serialize an appointment email's display string into an ICS field.

---

## CX. Reminder templates must use localized display formatting

Template variable `{{appointment_time}}` should render according to recipient/product rules. Do not expose raw UTC `2026-09-08T18:00:00Z` to the customer.

---

## CY. Template preview and actual send must use same temporal formatter

If preview shows "Tuesday at 2 PM" but send shows `18:00 UTC`, the system is broken.

One canonical formatting layer should power preview, runtime send, and UI.

---

## CZ. AI must receive explicit timezone context

If AI Booking interprets "tomorrow afternoon", the prompt/tool call must include current date, customer/user timezone, business/booking timezone, and availability constraints.

Never ask an LLM to infer timezone from vague context when system knows it.

---

## DA. AI must not calculate authoritative availability by itself

LLM can interpret "next Tuesday around 2" into structured intent. Then deterministic scheduling engine determines date, timezone, available slot, and conflict.

AI does not perform timezone arithmetic as authority.

---

## DB. AI booking must resolve ambiguous dates

Example customer says "Book me Friday at 2." If customer timezone differs, multiple Fridays are plausible, or conversation crosses midnight, system must resolve/confirm.

Do not silently book based on model guess.

---

## DC. AI should confirm important localized result

Example: "I can book Tuesday, September 8 at 2:00 PM Eastern Time."

This gives customer the final interpreted time before commitment when appropriate.

---

## DD. SMS/email scheduled sending windows need timezone semantics

If business says "Don't send before 8 AM", which timezone?

Define contact timezone, appointment timezone, or business timezone according to product/compliance policy. Store this in one rules service.

---

## DE. International messaging scheduling must not assume U.S. timezones

Contacts can span regions. Avoid Eastern Time is global default forever. Use workspace/contact/appointment policy explicitly.

---

## DF. Date/time formatting must remain consistent across connected objects

Appointment row: Sep 8 · 2:00 PM. Appointment detail: Tuesday, Sep 8 · 2:00–2:30 PM. Contact timeline: Sep 8, 2:00 PM.

Different granularity is fine. Contradictory timezone/format rules are not.

---

## DG. Canonical formatting roles should be defined

For example:

| Role | Example |
|------|---------|
| **Compact** | Sep 8 · 2:00 PM |
| **Full** | Tuesday, September 8, 2026 · 2:00 PM |
| **Time only** | 2:00 PM |
| **Audit** | Sep 8, 2026 · 2:14:03 PM EDT |
| **Relative** | 3 minutes ago |

**Cursor rule:** Use named formatting roles instead of ad hoc date formatting on each page.

---

## DH. Do not hard-code ordinal suffixes

Don't manually create 1st / 2nd / 3rd for all languages. Locale rules vary. Use localization libraries.

---

## DI. Month/day names must come from localization data

Do not hardcode arrays `["January", "February", ...]` in user-facing global components. Use CLDR-based platform APIs.

---

## DJ. Relative-time strings should come from localization infrastructure

Use "in 3 hours" / "2 days ago" through locale-aware APIs, not string concatenation `value + " days ago"` because grammar/order varies by language.

---

## DK. Pluralization must be locale-aware

Not "1 days" or manually `if n === 1` for every language. CLDR provides plural rules as part of internationalization data.

---

## DL. Date/time controls must be accessible

All requirements from previous guides still apply: persistent label, keyboard operability, correct focus, zoom/reflow, screen-reader name, no hover-only calendar action.

A perfectly timezone-correct date picker can still be unusable.

---

## DM. Time validation errors must use human language

**Bad:** Invalid ZonedDateTime.

**Good:** This time doesn't exist because daylight saving time begins that morning. Choose another time.

Translate technical temporal problems into user-level explanation.

---

## DN. "Invalid date" is often insufficient

Better: "February has 28 days in 2027." or "End time must be later than start time." or "This time occurs twice because daylight saving time ends; choose which occurrence you mean."

Specific recovery.

---

## DO. Existing appointment displays need source truth after timezone rule updates

If IANA changes future timezone rules, future appointments may need their UTC instants recalculated from intended local date/time + timezone depending on domain design.

This is exactly why preserving civil-time intent matters. Do not treat previously computed future UTC as unquestionably immutable if timezone law changed before the event.

---

## DP. Past events should normally remain historical instants

If timezone rules database is later revised, audit history remains based on the actual recorded instant.

Displaying historical local time can use updated historical tzdb rules, but do not rewrite event chronology casually.

---

## DQ. Future timezone-rule change handling must be centralized

If IANA updates rules: identify affected future appointments/schedules, recalculate where semantics require, update provider events if needed, log changes if materially relevant.

Do not rely on random page reloads to discover shifts.

---

## DR. Calendar subscription renewal timestamps must use instants

Provider subscription expiration expires at a specific instant. Store UTC/RFC timestamp.

Do not interpret it as workspace-local appointment time. Different temporal domains need different types.

---

## DS. OAuth token expiration also uses instant/duration semantics

Token expiration `expires_in 3600 seconds` means elapsed duration from issuance.

Do not apply DST/civil-day rules to authentication expiration. This is why duration semantics matter.

---

## DT. Payments use instant semantics for transaction timestamps

Payment occurred at exact global instant. Display localized.

Do not store payment timestamp as Sep 8 at 2 PM with no timezone.

---

## DU. Customer birthdays/anniversaries use date semantics, not instant semantics

If future product uses birthday, store month/day/date, not UTC midnight. Again: domain type matters.

---

## DV. Do not let database ORM defaults decide temporal semantics

An ORM may map everything to DateTime. That does not mean every domain concept is an instant.

Define date, time, local datetime, instant, and timezone at domain level even if storage implementation requires mapping.

---

## DW. UTC is not a replacement for timezone-aware domain modeling

This is the major anti-pattern: "We store everything in UTC, so timezone problems are solved." No.

UTC solves unique instant storage. It does not encode recurring civil time, business hours, future DST rules, local holidays, or date-only values.

**Cursor rule:** Use UTC for instants; use IANA timezone + local civil semantics for scheduling rules and future civil-time intent.

---

## DX. Timezone conversion should happen at defined system boundaries

Centralize transformations: provider → canonical model, canonical model → user display, user input → canonical model, canonical model → provider.

Do not scatter `addHours(-4)` through components.

---

## DY. Never hard-code timezone offsets

Absolutely no `if (eastern) addHours(-5)`. DST alone makes this wrong. Use IANA timezone data.

---

## DZ. Temporal calculations require unit tests around boundaries

At minimum test: DST spring transition, DST fall transition, leap day, year boundary, month boundary, midnight, different viewer timezone, date-only all-day events, recurring event across DST, reminder before/after DST, timezone conversion, timezone-rule data updates where feasible.

Normal Tuesday at 2 PM is the easiest case. Boundary cases certify the implementation.

---

## EA. Use real representative zones in tests

At least include examples such as `America/New_York`, `America/Los_Angeles`, `Europe/London`, `Asia/Kolkata`, `Australia/Sydney`, and UTC because they cover DST, non-DST, non-whole-hour offsets in some regions, and opposite-season DST patterns.

Do not test only UTC.

---

## EB. Avoid assumptions that offsets are whole hours

Timezones can use offsets such as UTC+05:30 and other non-hour increments. RFC 3339 supports minute-level numeric offsets.

**Cursor rule:** Never store timezone offset as integer hours.

---

## EC. Don't assume every country has one timezone

The U.S., Canada, Australia, Russia and others span multiple zones. Country alone is insufficient.

---

## ED. Don't assume DST always changes by one hour

Timezone rules are political and historical. Use tzdb. Don't encode DST = +1 hour as universal business logic.

---

## EE. Don't assume DST dates are stable forever

IANA explicitly updates the database when political bodies change rules. Never hard-code "DST starts second Sunday in March globally." 

---

## EF. Locale data also changes

Unicode CLDR evolves as locale conventions/data change. Use maintained platform libraries. Don't fork locale conventions into static project code unless necessary.

---

## EG. Language tags must use BCP 47

Use `en-US`, `es-MX`, `fr-CA` — not `EN_USA` or `spanish-mexico`. RFC 5646 defines BCP 47 language tags.

---

## EH. Locale fallback should be deterministic

Example: `es-MX`. If a translation unavailable: `es`, then product default according to localization architecture.

Do not randomly mix English date format with Spanish month names.

---

## EI. Timezone and locale settings should not overwrite each other

User changes language English → Spanish: do not change timezone. User changes timezone New York → Los Angeles: do not change language. Independent preferences.

---

## EJ. Stored timestamps must remain language-neutral

Never store `September 8, 2026` as canonical data. Store `2026-09-08` or appropriate structured temporal type. Formatting happens at presentation boundary.

---

## EK. Database queries should use canonical temporal boundaries

For appointments tomorrow, calculate tomorrow's start/end in target timezone, convert to instants, query using canonical range.

Do not use database server's CURRENT_DATE unless target timezone is intentionally that same timezone.

---

## EL. Background jobs must not depend on machine-local timezone

Scheduler: send reminder at 9 AM Eastern. Job runner could be in Germany/UTC. Convert rules centrally.

Never cron `0 9 * * *` and assume Eastern unless infrastructure explicitly handles timezone and DST correctly.

---

## EM. Long-term schedules should not be precomputed indefinitely when timezone rules can change

You can precompute near-term send jobs. But for schedules months/years ahead, consider preserving semantic rule and recalculating as execution approaches.

The key is: don't throw away the rule and keep only a stale future UTC calculation.

---

## EN. Recompute future reminders when timezone changes materially

If appointment's timezone changes, all future appointment-relative communication needs review/recalculation. Do not leave original UTC `send_at` without checking semantics.

---

## EO. Queue retry timestamps are elapsed/system time

Retry in 5 minutes typically means elapsed duration. This is different from tomorrow at 9 AM. Use the right temporal type.

---

## EP. Rate limits use elapsed windows, not civil scheduling arithmetic

Example: max 5 attempts per hour should not depend on daylight-saving transitions. Use elapsed/system-time semantics.

Again, one generic date library call does not fit every domain.

---

## EQ. Customer-visible time should always be traceable back to authoritative data

If user asks "Why did this reminder send at 8 AM?", support should be able to reconstruct appointment time, timezone, reminder rule, business hours, relevant DST rule, and actual send instant.

Temporal decisions should be auditable.

---

## ER. Timeline events need exact authoritative timestamps

Appointment timeline "Reminder sent · 9:00 AM" should derive from actual send event timestamp.

- **Planned:** Scheduled for 9:00 AM
- **Actual:** Sent at 9:00:03 AM

Keep these distinct.

---

## ES. Planned and actual times are different fields

For reminders: `scheduled_at`, `attempted_at`, `sent_at`, `delivered_at` may all differ. Do not overwrite one timestamp. This supports reliable diagnostics.

---

## ET. Calendar modification timestamps are not appointment start times

Provider APIs often expose created, lastModified, start, end. Preserve semantics. Never use latest modified timestamp as event start accidentally.

---

## EU. User-entered timezone must be validated against supported IANA identifiers

Don't accept arbitrary "Eastern USA Time Zone" as canonical storage. Resolve to valid supported zone. If alias accepted, normalize appropriately.

---

## EV. Timezone aliases need deliberate canonicalization

Timezone databases can contain aliases. Use library/IANA normalization where appropriate.

Don't create duplicate preference records merely because `US/Eastern` and `America/New_York` refer to equivalent zone data.

---

## EW. Preserve unknown provider timezone where mapping fails

If provider returns a timezone Transovo doesn't recognize, do not silently map it to UTC. Flag "Unsupported timezone mapping" and preserve raw source for diagnostics.

Wrong confident conversion is worse than explicit degraded state.

---

## EX. Temporal errors must fail safely

If timezone data unavailable, do not schedule "probably 2 PM." Block consequential scheduling or fall back only if product policy defines a safe explicit fallback.

For appointment systems, uncertain time should not become a silent booking.

---

## EY. Do not use AI to repair timezone corruption automatically

AI should not see "Unknown zone FooTime" and decide "probably New York." Use deterministic mappings or require clarification.

---

## EZ. Temporal normalization belongs in a shared library/service

**Cursor rule:** All appointment/calendar/reminder/workflow/payment/reporting modules must reuse canonical temporal utilities rather than implementing timezone/date arithmetic independently.

This should include parse, format, convert, interval, recurrence, DST validation, range calculation, and locale formatting.

---

## FA. Temporal logic should never be duplicated between client and server without shared contract

Frontend can preview. Server is authoritative.

If frontend calculates reminder = Monday 9 AM and backend calculates Monday 10 AM, the product is broken. Use shared logic/contracts or authoritative server evaluation.

---

## FB. Server should return canonical computed temporal state where helpful

Example Appointment Detail: `appointment.start`, `appointment.end`, `appointment.timezone`, `reminders[].scheduled_at`. UI formats.

Don't make every page recompute domain rules differently.

---

## FC. Temporal formatting and temporal computation must be separated

Formatting function: instant → "Sep 8 · 2:00 PM". Computation function: appointment + reminder rule → send instant.

Do not mix. Localization cannot alter business scheduling semantics.

---

## FD. Test the same instant under multiple locales/timezones

Example instant `2026-09-08T18:00:00Z` should display correctly for en-US + America/New_York, en-GB + Europe/London, es-MX + America/Mexico_City.

This certifies separation of storage and presentation.

---

## FE. Temporal test fixtures should include DST-rule dates, not only current month

Hard-code representative known transition scenarios through supported timezone library/tzdb version. When tzdb rules update, verify affected tests intentionally.

---

## FF. Don't hard-code expected future political timezone rules beyond authoritative tzdb

Tests far into future should account for the fact rules can change. Use current authoritative data, not assumptions.

---

## FG. Timezone database version should be discoverable operationally

For debugging difficult scheduling bugs, it is useful to know tzdb version used by runtime. No need to expose to ordinary customer. Log/diagnostics should allow engineering to identify it.

---

## FH. Calendar sync logs should include timezone context for failures

Developer diagnostics can include provider zone, mapped IANA zone, local start, computed instant without exposing unrelated sensitive data. This makes DST bugs diagnosable.

---

## FI. Timezone bugs are data-integrity bugs

Cursor should treat a booking at the wrong time as serious, not cosmetic.

Temporal correctness affects missed appointments, reminders, calendar conflicts, payments, and customer trust. Time correctness belongs in core domain invariants.

---

## Transovo Date / Time / Timezone / Locale Acceptance Checklist

Every applicable scheduling/time feature should pass:

- [ ] Instant, local date/time, UTC offset, and IANA timezone are modeled separately
- [ ] Machine timestamps use unambiguous ISO 8601/RFC 3339-compatible representation
- [ ] Four-digit years are used
- [ ] Ambiguous locale numeric dates are not used as canonical data
- [ ] Historical/event timestamps are stored as authoritative instants
- [ ] Future civil-time appointments preserve their IANA timezone
- [ ] UTC offset is never substituted for timezone identity
- [ ] Timezone abbreviations are not canonical identifiers
- [ ] IANA tz database is used for timezone/DST rules
- [ ] Runtime timezone data has an update strategy
- [ ] Server machine timezone cannot alter product logic
- [ ] Workspace, user, contact, appointment, and viewer timezone are not conflated
- [ ] Appointment timezone remains authoritative to the scheduled event
- [ ] Booking page clearly identifies timezone
- [ ] Browser timezone detection can be corrected
- [ ] Today/tomorrow logic specifies timezone context
- [ ] Analytics/reporting date boundaries specify timezone
- [ ] DST nonexistent times are detected
- [ ] DST ambiguous times are handled deterministically
- [ ] Calendar-day arithmetic is not replaced with fixed-second arithmetic
- [ ] 1 day and 24 hours are treated as different semantics
- [ ] Reminder scheduling uses intended civil timezone
- [ ] Rescheduling recalculates dependent future times
- [ ] Past-due reminder policy is deterministic
- [ ] Business-day/weekend/holiday handling uses civil calendar semantics
- [ ] Business hours have an explicit timezone basis
- [ ] Availability conflicts compare authoritative instants
- [ ] Imported events preserve original timezone context
- [ ] All-day events use date semantics
- [ ] Date-only values are not converted into arbitrary UTC midnights
- [ ] Time-only values are not treated as instants
- [ ] Recurring schedules preserve local time + timezone + recurrence
- [ ] Recurrence is not implemented as fixed seconds between occurrences
- [ ] Recurrence exceptions are preserved
- [ ] Recurring edit scope is explicit
- [ ] Interval boundaries use one documented convention
- [ ] Adjacent appointments do not require fake one-second gaps
- [ ] Duration has explicit units/type
- [ ] APIs include offset/timezone semantics where required
- [ ] Future recurrence preserves IANA zone in addition to RFC timestamp
- [ ] Locale and timezone are stored separately
- [ ] Language tags follow BCP 47
- [ ] Human formatting uses Unicode CLDR/platform Intl data
- [ ] 12/24-hour format follows locale/user settings
- [ ] Week-start rules are locale-aware where appropriate
- [ ] Relative dates are used only in appropriate contexts
- [ ] Exact time remains available for consequential/audit states
- [ ] Timezone selector uses/searches canonical IANA zones
- [ ] Missing timezone is represented honestly
- [ ] Temporal fallback hierarchy is centralized
- [ ] Timezone changes explain impact
- [ ] Display timezone changes preserve the underlying instant
- [ ] Appointment timezone changes distinguish preserve-instant vs preserve-wall-time
- [ ] Microsoft/Google sync preserves correct timezone semantics
- [ ] Calendar round-trip does not drift event times
- [ ] Recurrence round-trip is tested across DST
- [ ] Audit logs record authoritative instants
- [ ] Sorting uses temporal values rather than formatted strings
- [ ] Date-range queries use timezone-aware half-open boundaries
- [ ] Local day is not assumed to equal exactly 24 hours
- [ ] Calendar month/year arithmetic is not replaced by fixed durations
- [ ] Standard libraries handle leap-year/calendar rules
- [ ] Non-whole-hour timezone offsets are supported
- [ ] No hard-coded DST/offset math exists
- [ ] Canonical temporal types have descriptive names
- [ ] Locale-formatted strings are never parsed as authoritative stored values
- [ ] APIs document each temporal field's semantics
- [ ] CSV/ICS exports preserve unambiguous timezone/date meaning
- [ ] Template preview and runtime use the same temporal formatter
- [ ] AI receives explicit date/time/timezone context
- [ ] AI does not authoritatively calculate availability/timezone conversion
- [ ] Messaging windows specify timezone basis
- [ ] Planned, attempted, sent, and delivered times remain distinct
- [ ] Unknown timezone mappings fail explicitly rather than silently becoming UTC
- [ ] Temporal computation is centralized
- [ ] Client/server temporal logic cannot diverge
- [ ] DST/month/year/timezone boundary tests exist
- [ ] Multiple representative IANA zones are covered in tests

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & auth
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale (this file)
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #10: Date, Time, Timezone & Locale Standards. Next: Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*


===== [Formal #11 — Internationalization & Localization] docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md =====
# Transovo Internationalization & Localization Standards Guide

**Series:** Implementation standards · **Guide #11 of 12**  
**Status:** Active — mandatory hard standard for how Transovo supports different languages, regions, scripts, number/date formats, plurals, text direction, locale fallbacks, translated UI copy, and international user input without breaking layout or meaning  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** Unicode Standard · Unicode CLDR / UTS #35 (LDML) · BCP 47 / RFC 5646 · W3C Internationalization (I18N) · HTML Standard

---

## Master Cursor rule

> **Transovo internationalization must follow Unicode standards, Unicode CLDR/UTS #35 locale data, BCP 47 language tags, W3C internationalization guidance, and standards-based HTML direction/language semantics. Treat language, locale, region, script, timezone, currency, and text direction as separate concepts. All text handling must be Unicode-safe and normal web/API interchange must use UTF-8. User-facing formatting of dates, times, numbers, currencies, percentages, lists, plurals, display names, and collation must use CLDR-backed internationalization APIs rather than hard-coded English/U.S. rules. UI strings must be externalized into stable semantic translation resources; do not concatenate English fragments, store localized enum values, or use live LLM translation as the authoritative production localization layer. Layouts and components must tolerate translation expansion and non-Latin scripts. RTL must be implemented using proper HTML directionality, Unicode bidirectional behavior, CSS logical properties, and semantically appropriate mirroring—not duplicated or manually reversed interfaces. Customer/user-entered content must preserve its original Unicode text. Localization changes presentation only and must never mutate canonical business, security, payment, consent, scheduling, or authorization state. Pseudolocalization, RTL testing, real target-language review, and end-to-end non-Latin data testing are required before claiming production support for a locale.**

**This final standards guide controls how Transovo supports different languages, regions, scripts, number/date formats, plurals, text direction, locale fallbacks, translated UI copy, and international user input without breaking layout or meaning.**

---

## Core principle

**Language, locale, region, script, timezone, currency, and text direction are separate concepts. The product must never assume English, U.S. formatting, left-to-right text, Latin characters, or one global layout model.**

This is not just translation. **Internationalization is the architecture that makes localization possible.**

**Primary authorities**

| Authority | Role |
|-----------|------|
| **Unicode Standard** | Universal character encoding and text processing |
| **Unicode CLDR / UTS #35 (LDML)** | Standardized locale data for dates, numbers, plural rules, display names, calendars, timezones, collation, and related locale behavior |
| **BCP 47 / RFC 5646** | Standard language tags such as `en-US`, `fr-CA`, `es-MX` |
| **W3C Internationalization (I18N)** | Web internationalization guidance including language declaration and bidirectional text |
| **HTML Standard** | `lang`, `dir`, Unicode text handling, forms, document semantics |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Internationalization and localization are different

**Internationalization (i18n)** — engineering/design work that makes the product capable of supporting multiple languages and locales.

Examples: externalized strings, locale-aware formatting, RTL layout support, Unicode-safe input, flexible layout, pluralization system.

**Localization (l10n)** — adapting the product for a specific locale.

Examples: Spanish translation, Mexican currency formatting, French date format, Arabic RTL interface.

**Cursor rule:** Build internationalization into the architecture. Do not confuse adding translated strings with making the application internationalized.

---

## B. Use Unicode throughout the system

Transovo must safely support names/content such as José, Nguyễn, 李小明, محمد, Олександр, Māori names, emoji where allowed, and combining characters.

**Cursor rule:** All user-facing text storage, APIs, database fields, search, validation, import/export, rendering, and message processing must preserve Unicode correctly. Do not assume ASCII.

---

## C. UTF-8 should be the standard interchange encoding

For web/API/text files, use UTF-8 unless an external standard explicitly requires something else.

Do not maintain Latin-1 assumptions, ASCII-only string handling, or custom transcoding without a real reason.

This protects names, addresses, messages, translated copy, and calendar data.

---

## D. Never validate names using ASCII-only rules

**Bad:** `^[A-Za-z ]+$` — this would reject legitimate users.

Names can contain accents, apostrophes, hyphens, non-Latin scripts, spaces, and culturally specific structures.

**Cursor rule:** Do not implement "real name" validation using English alphabet assumptions.

---

## E. Do not assume first name + last name fits every culture

Some people have one name, multiple family names, patronymics, family name first, or scripts that do not map cleanly to Western name structures.

If product needs First name / Last name for operational reasons, keep it flexible. Where a display name is sufficient, consider Full name.

Do not attempt to infer culture or identity from name structure.

---

## F. Language and locale are separate concepts

Examples: Language English, Locale `en-US` versus Language English, Locale `en-GB`. Both use English but may differ in date format, punctuation, measurement, week conventions, and number formatting.

**Cursor rule:** Do not use a single language = English value as the complete localization setting.

---

## G. Use BCP 47 language tags

Canonical examples: `en`, `en-US`, `en-GB`, `es`, `es-MX`, `fr-CA`, `zh-Hans`, `zh-Hant`, `pt-BR`, `ar`.

BCP 47/RFC 5646 defines the standard language-tag model. Do not invent `english-us`, `Spanish_Mexico`, or `FR_CANADA`.

**Cursor rule:** Store and exchange language/locale identifiers using valid BCP 47 tags.

---

## H. Do not assume country determines language

Canada may use English, French, or other languages. United States users may prefer Spanish, English, Chinese, etc. Country and language remain distinct.

---

## I. Do not assume language determines country

Spanish does not mean Spain. It could be Mexico, Argentina, Colombia, or the United States. Regional conventions differ. Use locale.

---

## J. Script may need explicit representation

Some languages can use different scripts. Examples include `zh-Hans`, `zh-Hant`, `sr-Latn`, `sr-Cyrl`.

Do not assume language always implies one script. BCP 47 supports script subtags for this purpose.

---

## K. Declare document language

HTML should expose the primary language: `<html lang="en">` or `<html lang="es-MX">`.

This helps screen readers, pronunciation, browser language handling, and accessibility tools.

**Cursor rule:** Every rendered document/application shell must expose the correct primary language programmatically.

---

## L. Mark language changes inside content where necessary

If primarily English page includes meaningful French content: `<span lang="fr">...</span>` where appropriate.

This helps assistive technologies pronounce it correctly. Do not mark every product name. Use for real language changes.

---

## M. Never infer language from script alone

A Latin-script sentence could be English, French, Spanish, Vietnamese, or many others. Script and language are distinct metadata.

---

## N. Use Unicode CLDR for locale behavior

CLDR/LDML provides standardized locale data used across modern software platforms for dates, times, numbers, currencies, plurals, calendars, timezone display names, relative time, display names, collation, and week conventions.

**Cursor rule:** Do not manually maintain locale conventions when CLDR-backed platform APIs already provide them.

---

## O. Use platform internationalization APIs

In modern web JavaScript, prefer `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, `Intl.PluralRules`, `Intl.ListFormat`, and `Intl.DisplayNames` where appropriate.

These use standardized locale data. Do not create hand-written localization logic such as `if (locale === "fr") ...` all over the application.

---

## P. Locale formatting must occur at presentation boundaries

Canonical application data remains structured.

Example: `amount = 1234.5`, `currency = USD`. UI in U.S. locale: `$1,234.50`. German locale: `1.234,50 $` depending on locale conventions.

Never store the formatted display string as the monetary value.

---

## Q. Decimal separators vary

U.S.: `1,234.56`. Many locales: `1.234,56`.

Do not parse localized numbers using remove commas + `parseFloat` without locale-aware handling. That can change `1,5` into `15` or fail incorrectly.

---

## R. Grouping separators vary

They may be comma, period, space, or narrow no-break space. Do not assume `,` always means thousands separator. Use locale-aware formatting/parsing strategies.

---

## S. Digits may not always be Latin digits

Some locales may present different numeral systems. Do not hard-code UI assumptions that digits must visually be `0 1 2 3 4 5 6 7 8 9` unless the specific data format requires ASCII digits.

Machine protocols may require Latin digits. Human presentation can be locale-aware.

---

## T. Currency and locale are separate

A user with `locale = en-US` may transact in USD, CAD, or EUR. Currency must be explicit. Do not infer currency solely from locale.

---

## U. Currency formatting must use currency metadata

Store `amount_minor_units` and `currency = USD` or another precise monetary representation. Then format using locale-aware rules.

Do not build `"$" + amount` because `$` can represent multiple currencies and placement varies.

---

## V. Currency minor units differ

Not every currency uses exactly two decimal places. Do not assume all money = cents for an international architecture. Use authoritative currency metadata/library behavior.

---

## W. Percent formatting is locale-sensitive

Don't build `value + "%"` for every locale. Spacing and representation can differ. Use `Intl.NumberFormat(locale, { style: "percent" })` or equivalent.

---

## X. Lists are locale-sensitive

English: "SMS, email, and voice". Other languages have different conjunctions/punctuation.

Use locale-aware list formatting when generating natural-language lists. Do not concatenate `A + ", " + B + " and " + C` globally.

---

## Y. Pluralization is not just singular vs plural

English often uses 1 appointment / 2 appointments. Other languages can have multiple plural categories. Unicode CLDR includes plural rules precisely because plural systems differ.

**Cursor rule:** Never implement global pluralization with only `count === 1 ? singular : plural`. Use a real pluralization/message-format system.

---

## Z. Grammar may change based on numbers

Example: 1 reminder / 2 reminders. Translated phrase may require different noun form, different word order, or multiple categories.

The entire message should be localizable as a unit. Do not translate word fragments independently.

---

## AA. Do not concatenate UI sentences from translated fragments

**Bad architecture:** `"Send " + count + " reminders " + "before appointment"`. Translation may require different word order.

Use message template: `Send {count} reminders before the appointment` through a proper localization system.

**Cursor rule:** Full semantic messages must be translation units, not assembled from English-specific fragments.

---

## AB. Variables must remain semantically named

**Good:** `{customerName}`, `{appointmentTime}`, `{count}`. **Bad:** `{x}`, `{value1}`, `{str2}`. Translators/localization tooling need context.

---

## AC. Placeholder order cannot be assumed

English: "Anthony has an appointment on Tuesday." Another language may naturally order: "On Tuesday, Anthony has an appointment."

Therefore translations must be able to reorder variables. Do not interpolate in fixed English sentence order.

---

## AD. Translation strings need context

A word like "Book" could mean reserve an appointment or physical book. Translation systems should provide contextual identifiers/descriptions.

Example key: `booking.create_button` — not `book` when ambiguous.

---

## AE. UI copy should not use the same translation key for semantically different English words

English can reuse "Cancel" for cancel appointment and close dialog without saving. These may translate differently. Use separate semantic keys.

---

## AF. Do not use English source string itself as the only durable key

Prefer `appointments.create.title` over `"Create appointment"` as the identifier where localization architecture supports stable semantic keys. Copy can change without invalidating translation mapping.

---

## AG. Translation keys must be stable

Do not rename localization keys every time visual copy changes slightly. Stable keys help translation memory, review, and release management.

---

## AH. Missing translations need a deterministic fallback

Example: `es-MX` → `es` → `en-US` or whatever canonical hierarchy is chosen.

Do not display `undefined` or `booking.create.cta` to users.

**Cursor rule:** Localization fallback policy must be centralized and deterministic.

---

## AI. Missing translations must be visible in development/QA

Production can safely fall back. Development should make missing translations easy to detect.

Do not silently ship half-localized pages because fallback hid every missing string during QA.

---

## AJ. Locale selection should follow a defined priority

Possible hierarchy: (1) explicit user preference, (2) workspace preference where applicable, (3) browser/Accept-Language, (4) product default.

Do not let each page choose differently.

**Cursor rule:** Locale resolution must be centralized.

---

## AK. User preference should generally override automatic detection

If user explicitly chooses Spanish, do not switch back to English next login because browser says `en-US`. Automatic detection initializes preference. It should not override explicit user choice.

---

## AL. Workspace language and individual user language can differ

An organization may operate in English while one staff user prefers Spanish.

Separate workspace-facing defaults, staff interface preference, and customer-facing booking/message language. Do not collapse them.

---

## AM. Customer communication language needs its own policy

Appointment reminder language might derive from contact preference, booking page language, workspace default, or explicit appointment language. Define hierarchy.

Do not simply use the staff member's current UI language.

---

## AN. Booking-page language and admin language are independent

A business owner can use admin in English while customers book through a Spanish booking page. Do not tie customer-facing localization to admin session locale.

---

## AO. Translated customer messages need template-level locale support

Reminder template should support locale-specific versions, fallback version, and localized date/time variables.

Do not translate only the surrounding app while sending all customers English reminders.

---

## AP. Locale must travel with async work when necessary

If a reminder scheduled now will send tomorrow, store/resolvable locale context.

Do not rely on whichever admin happens to be logged in when the worker executes. Background jobs don't have browser locale.

---

## AQ. Locale must be explicit in server-rendered/generated output

Examples: PDF reports, email, SMS, ICS descriptions, exported documents. Server generation must receive locale.

Do not use server OS locale as fallback silently.

---

## AR. Layout must tolerate translated text expansion

English often produces shorter labels than other languages. Test strings roughly 30% longer, 50% longer, sometimes much longer.

No hard-coded `width: 80px;` just because "Save" fits in English.

**Cursor rule:** Components must tolerate realistic text expansion without overlap, clipping, or functional loss.

---

## AS. Buttons should expand before text truncates

Primary button "Create appointment" may become significantly longer in another language. Prefer flexible width or wrap in rare contexts over clipping essential action text.

---

## AT. Navigation labels must tolerate expansion

Sidebar "Appointments" could translate longer. Navigation component should provide enough width, sensible truncation only with recovery, and responsive behavior. Do not tune sidebar width only to English.

---

## AU. Form labels must wrap

Translated label may be two lines. Field geometry must survive. Never force label `nowrap` if it causes clipping.

---

## AV. Error messages must tolerate expansion

Error "This appointment cannot be scheduled because the selected host is unavailable." could become much longer in translation. Error containers must grow. Do not set fixed heights.

---

## AW. Tables need internationalized column strategies

Translated "Confirmation status" could be longer than English. Columns should flex, wrap where appropriate, and support accessible truncation. Do not assume short column labels.

---

## AX. Avoid text embedded in icons or images

Image-based English text cannot be translated/reflowed/accessibly exposed easily. UI labels should be real text.

If an illustration contains necessary text, provide localized assets or avoid embedding text.

---

## AY. Icon meaning must not depend on culture-specific interpretation alone

Some symbols vary culturally. Use icon + label for unfamiliar or consequential actions. Do not assume every market interprets ambiguous iconography identically.

---

## AZ. Color symbolism is culture-dependent

Do not use cultural interpretations of red, green, or white as the only meaning. Our accessibility rules already require text/state communication. This also improves international usability.

---

## BA. Do not localize brand names accidentally

Product names like Transovo normally remain stable unless branding policy says otherwise. Separate translatable content from protected product/provider names.

---

## BB. Provider names should retain canonical identity

Keep Microsoft, Google, Stripe, Square, Zoom, Webex according to their branding/localization rules. Do not machine-translate proper service names.

---

## BC. Right-to-left support must be architectural

Languages such as Arabic and Hebrew require more than translating strings. The interface may need RTL reading direction, mirrored layout relationships, adjusted icons, reordered navigation, correct text alignment, and bidi-safe mixed content.

**Cursor rule:** RTL must be supported through direction-aware layout primitives, not by creating a separate manually mirrored application.

---

## BD. Use HTML dir

For a whole RTL page: `<html dir="rtl">`. For local directional content: `dir="rtl"`, `dir="ltr"`, `dir="auto"` as appropriate.

Do not implement RTL by `transform: scaleX(-1);` — that mirrors content incorrectly.

---

## BE. Prefer CSS logical properties

Instead of `margin-left`, `padding-right`, `border-left`, `left`, `right` for directional layout where appropriate, prefer `margin-inline-start`, `margin-inline-end`, `padding-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-start`.

**Cursor rule:** Use logical layout properties for new reusable UI wherever directionality matters. This makes LTR/RTL support dramatically safer.

---

## BF. "Start" and "end" are better than "left" and "right" in UI logic

For text/alignment logic use start/end rather than assuming left = beginning and right = end. In RTL, those reverse.

---

## BG. Not every icon should mirror in RTL

Usually directional icons may need mirroring: back, forward, next, previous, indent. But non-directional icons generally do not: search, calendar, camera, plus, trash.

**Cursor rule:** Mirror icons based on semantic direction, not a blanket CSS flip.

---

## BH. Brand logos should generally not mirror

Transovo logo should not become backwards in RTL. Exclude non-directional graphical assets from mirroring.

---

## BI. Numbers inside RTL text require bidi-safe handling

Examples: phone numbers, dates, times, order IDs, URLs can render confusingly inside RTL context if bidirectional text isn't handled correctly. Use Unicode/HTML bidi isolation where necessary.

---

## BJ. User-generated text direction may be unknown

Contact notes/messages may be English, Arabic, or mixed. Use appropriate automatic direction behavior (`dir="auto"` where suitable) instead of forcing entire content body based solely on app language.

---

## BK. Mixed-direction text must not corrupt surrounding UI

A customer may paste "محمد - john@example.com". The email/address must not cause punctuation/buttons to jump unpredictably. Use proper bidi isolation.

---

## BL. Never manually reverse strings for RTL

No `text.split("").reverse()`. Directionality is handled by Unicode bidi algorithms and layout systems. Manual reversal corrupts numbers, punctuation, and combining characters.

---

## BM. Unicode normalization must be considered for comparison/search

Visually identical text may have different Unicode code-point sequences. For appropriate matching/search/uniqueness operations, use Unicode-normalization-aware logic.

Do not assume byte equality always means human text inequality.

---

## BN. Do not normalize destructively without understanding the field

Canonical normalization can help matching. But preserve user-facing intended text where appropriate.

Example: Customer's name should display as entered, while search may use normalized representation internally.

---

## BO. Case conversion is locale-sensitive

Do not assume `string.toLowerCase()` is universally sufficient for language-sensitive matching/display. Certain languages have special casing rules. Use locale-aware case operations where required.

---

## BP. Case-insensitive identifiers should ideally avoid human-language case complexity

For machine identifiers (UUID, stable slug rules, normalized email handling according to specification), do not depend on arbitrary locale casing. Separate user-facing text from machine identity.

---

## BQ. Sorting/collation is locale-sensitive

Alphabetical sorting is not one universal code-point ordering. CLDR provides collation data. Use locale-aware collation for human-facing lists where alphabetical order matters.

Example: Contacts A–Z. Do not sort by raw Unicode code point if it produces unnatural order.

---

## BR. Search should support accents appropriately

Depending on search mode, "Jose" may reasonably find "José". Do not require users to type exact diacritics for ordinary contact search unless precision demands it. Search normalization must preserve correct display values.

---

## BS. Search must still support exact distinctions when necessary

Accent-insensitive matching is useful for discovery. But identifiers or legally significant data may need exact representation. Search flexibility and canonical data integrity are separate.

---

## BT. Do not strip non-Latin characters to "sanitize" text

Security sanitization must target executable markup and dangerous syntax — not foreign characters. No "remove everything except A-Z" for notes/names.

---

## BU. URLs and emails have internationalization considerations

Internationalized domains and Unicode emails can exist. Exact support depends on product/provider compatibility.

Do not reject international domains solely because they contain non-ASCII display forms. Use standards-aware URL/email libraries.

---

## BV. Phone numbers must use international numbering rules

Since Transovo supports international SMS, store canonical phone numbers where practical in E.164-like normalized form (`+15714073615`) while displaying localized formatting.

Do not assume 10 digits, U.S. area codes, or North American formatting for every contact.

---

## BW. Country calling code and locale are independent

A Spanish-speaking user might have +1 U.S. phone number. Do not infer language from phone country code.

---

## BX. Postal addresses must not assume U.S. field ordering globally

U.S.: Street, City, State, ZIP. Other countries differ.

If Transovo later collects international business addresses, use country-aware address schemas. Do not hard-code State as universally required.

---

## BY. Postal code must not be numeric-only

Examples outside U.S. can contain letters. Do not define `zipCode: number`. Use string.

---

## BZ. Country names should use standardized data/codes

For internal identity, prefer standards such as ISO country codes where appropriate. Display localized country names via CLDR.

Do not store translated display name as country identity. Example: `US` → display "United States" or localized equivalent.

---

## CA. Region/state/province values should not be globally hard-coded

Jurisdictions vary. Do not assume all countries have states or two-letter codes. Use country-aware data/provider models.

---

## CB. Measurement units may be locale-dependent

If Transovo ever displays distances, sizes, etc., do not assume miles, feet, or Fahrenheit globally. Use explicit units and locale/product policy.

For current appointment product this may matter less but architecture should not hard-code American units into generic components.

---

## CC. Paper/report formats vary

U.S. often uses Letter. Many regions use A4. If PDF/report printing supports international users, choose/report configuration deliberately. Do not assume U.S. Letter is universal.

---

## CD. Weekends differ by locale/business

Internationalization data can include week conventions, but business scheduling must use actual business configuration.

Do not assume Saturday/Sunday are always non-working days globally. The Date/Timezone guide already covers operational schedule semantics.

---

## CE. Calendars can differ from Gregorian in user cultures

Unicode CLDR supports multiple calendars. Transovo can initially choose Gregorian as its product calendar if that's the supported scope.

But do not present that choice as all locales inherently use Gregorian formatting.

**Cursor rule:** Product-supported calendar systems must be explicitly documented rather than accidentally inferred from locale.

---

## CF. If only Gregorian is supported initially, fail clearly

Do not half-render another calendar system. It's acceptable to say product scheduling uses Gregorian calendar while still localizing month names, date order, and language. Support can expand later.

---

## CG. Time formatting belongs to locale; scheduling semantics belong to timezone

From Guide #10: `en-US` doesn't mean Eastern Time. Likewise `ar` doesn't dictate one timezone. Keep locale and timezone separate throughout localization.

---

## CH. Translation must not alter machine data

Translated UI label "Confirmed" may become another language. Backend status remains `confirmed`. Do not persist localized display labels as enum values.

---

## CI. Enum values must be stable and language-neutral

Store `status = confirmed`. Not `status = "Confirmado"`. Presentation layer translates. Otherwise changing locale breaks queries/business logic.

---

## CJ. Routes and API field names should generally remain locale-neutral

Do not require `/es/citas` / `/en/appointments` for internal admin routes unless localized routing is deliberately a product requirement.

UI can translate while canonical route/API structure remains stable. Public SEO pages may be different.

---

## CK. Do not translate database keys or provider identifiers

Never localize webhook event names, enum constants, API scopes, provider field names, or database columns. Only user-facing presentation.

---

## CL. Templates need translation-safe variable syntax

For SMS/email templates: `Your appointment is {appointmentTime}.` must keep variables stable across translations.

Translation should not alter `{appointmentTime}` into arbitrary text that runtime cannot resolve.

---

## CM. Template validation must detect missing variables

If English template contains `{appointmentTime}` and `{businessName}` and translated template accidentally drops required `businessName`, validation should catch it where needed. Do not discover at runtime send.

---

## CN. Message length can change materially by language

SMS character encoding/segment count can change based on language/script and Unicode characters. This can affect number of SMS segments, cost, and truncation.

**Cursor rule:** Message preview and cost/segment logic must use the actual localized message encoding/content, not English estimates. This is especially relevant for Transovo's SMS reminders.

---

## CO. Never truncate translated customer messages at arbitrary character counts

If channel limit exists: show validation, segment correctly, shorten intentionally. Don't cut Unicode strings mid-grapheme or mid-sentence.

---

## CP. Unicode string length is not the same as visual character count

Emoji and combining characters can contain multiple code points. Do not use raw `.length` as a universal "character" measure for UI or messaging limits without understanding encoding/graphemes.

---

## CQ. Truncation must respect grapheme clusters

Don't split emoji sequences or accented combining characters in the middle. Use Unicode-aware segmentation where truncation is necessary.

---

## CR. Cursor movement/editing should rely on browser/platform Unicode behavior

Do not implement custom text editing that treats every code unit as one human character. This can break emoji, combining marks, and certain scripts. Use native input behavior whenever possible.

---

## CS. Font system must support required scripts

A beautiful Latin-only font is not sufficient if Transovo supports Arabic, Chinese, Cyrillic, or Devanagari. Define fallback font stacks with broad Unicode coverage.

**Cursor rule:** Never display unsupported script as tofu/missing-glyph boxes because the brand font lacks coverage.

---

## CT. Font fallback should preserve readability

If primary font lacks a script, fallback should support script fully, remain legible, and maintain reasonable metrics. Don't force a decorative fallback merely to imitate the Latin font.

---

## CU. Font weight availability may differ by script

Not every script/font family provides 400, 500, 600, 700. Design should degrade gracefully. Do not depend on ultra-specific weight distinctions to convey semantic meaning.

---

## CV. Line height may need to accommodate script differences

Some scripts require more vertical space for diacritics, marks, or glyph shapes. Avoid fixed-height text containers. Let typography system support script-safe line boxes.

---

## CW. Uppercase transformations are not universal design tools

Avoid globally `text-transform: uppercase;` for navigation/labels. Some scripts have no case. Some languages have special case behavior. Sentence case is safer and aligns with the visual rules we already chose.

---

## CX. Letter spacing should not be globally applied to all scripts

Tracking designed for Latin uppercase may look wrong or break other scripts. Use script-aware typography.

---

## CY. Translation should not be generated blindly in production by AI

AI may assist translation workflows. But customer-facing localization should be reviewed, versioned, testable, and deterministic.

Do not let the same button translate differently on every request.

**Cursor rule:** Production UI localization must use managed translation resources, not live LLM generation as the authoritative translation layer.

---

## CZ. AI translation must preserve variables and protected terminology

If AI assists translation: freeze template variables, preserve provider/product names, validate placeholders, review high-risk copy — especially consent, payment, security, and compliance. Machine translation errors here can have serious consequences.

---

## DA. Legal/compliance translations need heightened review

Do not trust general automated translation alone for consent language, privacy disclosures, recording notices, A2P instructions, or payment terms. Where legal meaning matters, use approved reviewed translations.

---

## DB. Error messages must be localized too

Do not create Spanish page "Crear cita" then error "Invalid date range." All customer-facing/system UI copy needs localization coverage.

---

## DC. Backend validation must return localization-friendly error codes

Prefer backend `error_code = appointment_time_unavailable` plus structured context. Frontend translates "This time is no longer available."

Do not make backend return only an English sentence that the UI has to parse/translate.

---

## DD. Never branch business logic on translated error text

No `if (error.message === "Appointment not found")`. Use stable codes. Localization must not affect logic.

---

## DE. Notifications must preserve recipient locale

Email notification to Spanish-speaking customer should not become English because job worker default locale is English. Store/resolvably determine intended locale at send time.

---

## DF. System-generated PDF/CSV reports need locale rules

For human-readable exports consider date format, number format, translated headings, timezone, and decimal separator.

Machine-oriented CSV may intentionally use standardized values; define that contract. Do not mix conventions unpredictably.

---

## DG. CSV separators can conflict with locale number formatting

If locale uses comma decimals (`1,50`), comma-separated CSV can be confusing. Use standards-compliant CSV quoting or configured delimiter. Do not hand-build CSV by joining strings with commas.

---

## DH. CSV encoding should support Unicode

Use UTF-8. If supporting spreadsheet consumers with BOM/other compatibility behavior, do so deliberately. Do not corrupt non-English names during export.

---

## DI. Sorting should use locale-aware collation when user-facing

Example Contacts: English alphabetical rules differ from Swedish, German, or Spanish. Use `Intl.Collator` or equivalent CLDR-aware implementation.

---

## DJ. Filtering/search behavior should be documented per locale

Decide whether search is case insensitive, accent insensitive, width insensitive, kana-sensitive, etc. Use appropriate locale-aware search primitives. Do not assume English search semantics apply everywhere.

---

## DK. Keyboard shortcuts cannot depend solely on English letters without consideration

Example: N = New appointment may be less intuitive in another language. Shortcuts can remain standardized but must be optional accelerators, discoverable, and not required to operate.

Don't require translated users to know English mnemonic keys.

---

## DL. Access keys need extreme caution

Browser/OS/assistive technologies use many combinations. Do not assign language-dependent access keys casually. The Keyboard guide still governs shortcut safety.

---

## DM. Voice/AI language detection must not silently override user settings

If customer sends Spanish email, AI may detect Spanish and respond in Spanish according to product policy.

But do not globally change `contact locale = Spanish` based on one ambiguous sentence unless product explicitly supports that inference. Detection is evidence, not always authoritative preference.

---

## DN. AI Booking should preserve language across turns

If conversation begins in Spanish, AI should not suddenly reply in English because a tool result returned English text. Tool outputs should be normalized into the conversation language. Business data stays language-neutral internally.

---

## DO. AI tool parameters must remain canonical even when conversation is localized

Customer: "mañana a las dos". LLM produces structured date/time intent and timezone. Tool call should not pass translated enum values like `status = "confirmado"`. Canonical backend values remain stable.

---

## DP. AI-generated dates/times must use the Date/Timezone standards

Localization does not change temporal authority. AI says "martes a las 2". System resolves with explicit timezone, authoritative availability, and locale-aware output.

Do not let translation layer perform scheduling arithmetic.

---

## DQ. Customer locale must not affect security or permission decisions

A user switching language English → Spanish must not change role, consent status, sender eligibility, payment access, or security requirements. Localization is presentation. Business/security state is canonical.

---

## DR. Locale identifiers from the client must be validated

Do not accept arbitrary strings and load arbitrary resource paths. Validate against supported locale list/BCP 47 processing. Avoid path injection through locale parameters.

---

## DS. Unsupported locales need a clean fallback

If browser requests `fr-CH` and Transovo supports only `fr` and `en`, use defined fallback. Do not crash the shell.

---

## DT. Partial localization must be intentional

If only public Booking Page supports Spanish initially but admin does not, make that a documented scope.

Do not accidentally show half Spanish / half English because some translation files exist.

---

## DU. Locale rollout needs feature completeness criteria

Before claiming "Transovo supports Spanish", verify the supported product surface: navigation, forms, errors, validation, empty states, onboarding, public booking, notifications, reminders, dates/numbers, PDFs if included, and legal/compliance copy within that scope.

"Some strings translated" is not language support.

---

## DV. Translation coverage should be measurable

Localization pipeline should track total strings, translated, missing, outdated, and needs review. Do not rely on manual visual inspection alone.

---

## DW. Source-string changes should invalidate/review translations

If English changes "Delete contact" to "Permanently delete contact and history", existing translation may no longer be adequate. Translation system should mark it for review.

---

## DX. Dynamic content must not bypass localization

Common bug: static button translated, runtime toast remains English. Every customer-facing dynamic message should use the same localization layer.

---

## DY. Server and client should use the same canonical message keys where practical

This prevents server English error + client localized UI. Define stable error/status codes and localization ownership.

---

## DZ. Do not localize internal logs unnecessarily

Engineering logs should generally use canonical technical terms. User-facing logs/timelines can localize labels. Keep debugging stable across languages.

---

## EA. Audit data and audit presentation are different

Store `event_type = appointment_cancelled`. Display "Appointment canceled" or localized equivalent. Changing locale must not rewrite audit records.

---

## EB. Historical customer messages remain as actually sent

If customer received English SMS in August and later switches preference to Spanish, message history should show the actual English content sent.

Do not dynamically translate historical communications and pretend that's what was delivered.

---

## EC. Historical UI event labels may localize dynamically

Timeline event `type = reminder_sent` can display in current user's locale. Actual message body remains original. Distinguish event metadata from immutable communication content.

---

## ED. User-entered content should not be automatically translated unless explicitly requested

Notes "Customer prefers side entrance." should remain what user wrote. Do not silently translate/stomp user content when UI locale changes.

---

## EE. Customer-generated content must preserve original language

Messages/emails/transcripts should retain original. Optional translation can be a derived view ("Translate") but never replace authoritative source.

---

## EF. AI translation of customer messages must be labeled

If Transovo offers "View translation", make it clear translation is generated. Original remains accessible. Especially important for disputes, consent, and instructions.

---

## EG. Export should preserve originals where source fidelity matters

Conversation export should include original content. If translated views are exported, label them as translations. Do not substitute AI translation for source evidence.

---

## EH. RTL public Booking Pages must preserve workflow order semantically

The layout may mirror. But logical sequence remains: choose booking type → choose time → enter information → confirm.

Don't reverse workflow merely because reading direction changes.

---

## EI. Horizontal progress indicators may mirror visually for RTL

The semantic step progression stays the same. Use direction-aware components. Do not manually reorder business step arrays unless required by component semantics.

---

## EJ. Calendars must support locale-dependent week presentation

Day names, month names, week start should adapt according to supported locale policy. Appointment instants do not change. Presentation changes.

---

## EK. Numeric time grid labels should remain readable in RTL

Calendar "9:00 AM" must align correctly and not reorder punctuation/digits. Test real RTL layouts.

---

## EL. Charts need localized axes/legends

Analytics should localize dates, percentages, numbers, and series labels. But data values remain canonical. Charts must also survive translated label expansion.

---

## EM. Chart color/shape semantics must not rely on language

Status series Confirmed/Canceled — translations change labels, not underlying series ID/color mapping. Keep semantic identifiers stable.

---

## EN. Localization must not break analytics comparisons

If decimal/date formatting changes, sorting/filtering calculations still use canonical values. Never calculate from rendered localized strings.

---

## EO. Public URLs/slugs need deliberate internationalization policy

If Booking Page slug is user-generated, decide whether to support Unicode slugs, ASCII transliteration, or percent encoding.

Do not accidentally break non-Latin business names. Canonical ID should remain independent of display slug.

---

## EP. Slug uniqueness must not rely solely on locale-sensitive casing

Use stable normalization rules. Do not let changing locale make two slugs become the same or different unpredictably.

---

## EQ. Search indexing should retain original Unicode text

Do not transliterate everything to ASCII and throw away the source. You may maintain normalized search forms. Original display data remains intact.

---

## ER. Localization resources must be separated from code

Do not scatter `if Spanish...` through JSX. Use centralized message catalogs/resources. This makes translation, review, QA, and fallback manageable.

---

## ES. Common terminology needs a localization glossary

For Transovo, define canonical concepts: Appointment, Booking type, Booking page, Contact, Reminder sequence, Workflow, Meeting, Payment, Availability, Waitlist, Recall.

Each supported language should have approved translations. Do not let every screen translate the same domain object differently.

---

## ET. Product terminology must stay consistent within each language

If Spanish translation for Appointment is chosen as one canonical term, don't use three synonyms across Calendar, Contacts, and Analytics unless the concepts genuinely differ. This mirrors the IA consistency rule.

---

## EU. Translator notes should exist for specialized terms

Terms such as round robin, collective scheduling, reminder sequence, no-show, and waitlist may require context. Provide explanations so localization is semantic, not literal.

---

## EV. Do not expose English implementation terms because no translation exists

Bad fallback: `Flujo de trabajo webhook_action`. User-facing technical labels need approved localized copy or deliberate English product term. Internal enums remain internal.

---

## EW. Accessibility labels need localization too

`aria-label="Close"` must become localized appropriately. Common bug: visible Spanish UI with `aria-label="Close modal"`. Accessibility experience must match language.

---

## EX. Screen-reader-only text must be localized

Anything meaningful to assistive technology counts as UI copy. Do not leave hidden instructions, status announcements, or error summaries in English.

---

## EY. Alt text must be localized where meaningful

If image conveys content, use localized alt text. Decorative image remains decorative. No need to translate meaningless asset filenames.

---

## EZ. Status announcements must use current user language

Async "Saved", "Appointment created", "Sync failed" must follow locale just like visible statuses.

---

## FA. Directionality must include accessibility-hidden content too

Invisible labels and live-region text need correct language/direction metadata. Do not make screen-reader content independent from locale system.

---

## FB. Localized UI still must meet WCAG contrast/reflow requirements

Translated text cannot justify smaller font, clipping, reduced contrast, or inaccessible controls. All previous guides still apply.

---

## FC. Translation expansion must be included in responsive QA

At minimum test pseudo-localized strings that expand substantially, contain accents, and use long labels. This reveals fixed-width problems before real translations.

---

## FD. Pseudolocalization should be part of QA

Use a pseudo-locale that transforms strings to expose hard-coded English, truncation, concatenation, and layout assumptions.

Example conceptually: `[!! Crëåtë åppøïntmënt ——— !!]`

Do not ship it publicly, but use it to test i18n readiness.

---

## FE. RTL pseudo-testing should be separate

Run interface under RTL direction even before full Arabic/Hebrew translation exists. Check sidebar, drawers, tabs, forms, back arrows, calendars, tables, and modals. This catches physical-left/right assumptions.

---

## FF. Localization QA must use real target-language reviewers for important markets

Automated screenshot/string checks are useful. They cannot verify natural wording, cultural correctness, specialized scheduling terminology, or legal meaning. Use qualified review for production language launches.

---

## FG. Machine translation is not acceptance testing

A translated string existing is not evidence it is correct. Evaluate meaning, tone, terminology, truncation, and task completion.

---

## FH. Locale-sensitive tests should cover multiple categories

At least test: English U.S. (`en-US`), English non-U.S. (`en-GB`), Romance language (`es-MX` or `fr-FR`), RTL (`ar`), and CJK (e.g. `ja-JP` or `zh-Hans`). This exposes very different assumptions.

---

## FI. Test non-Latin user input end to end

Create contact, appointment, note, message, and export using non-Latin names/content. Verify database, search, UI, API, export, and message runtime all preserve it.

---

## FJ. Test combining characters and emoji where allowed

Especially names, messages, and notes. Verify rendering, truncation, search, and storage. No corruption.

---

## FK. Test long translations in compact components

Highest risk: sidebar, tabs, table headers, buttons, badges, modal actions, filter chips. Do not test only paragraphs.

---

## FL. Test mixed LTR/RTL data

Example: Arabic customer name + English email + phone number. Verify row alignment, copying, reading order, detail page, and messages. This is real-world bidi behavior.

---

## FM. Test browser locale independent of timezone

Examples: Locale `es-MX`, Timezone `America/New_York` and Locale `en-US`, Timezone `Europe/London` to ensure locale and timezone aren't accidentally tied.

---

## FN. Test explicit user locale overrides

Browser English, user setting Spanish — app should remain Spanish. Do not re-detect on every load and overwrite preference.

---

## FO. Test fallback behavior deliberately

Remove one translation key. Ensure approved fallback appears, no raw key, no crash — and development diagnostics identify missing translation.

---

## FP. Test server-generated content independently of browser

Background worker should produce correct localized SMS, email, and report without a browser/user session supplying locale.

---

## FQ. Localized runtime must remain deterministic

Same locale + message key + variables should yield predictable output for the deployed translation version. Do not depend on live external AI translation.

---

## FR. Translation versions should be deployable/auditable

For high-risk copy, especially consent, security, and payments, know which translation/version was active. This matters when exact wording has consequences.

---

## FS. Internationalization must be centralized

**Cursor rule:** All locale resolution, message lookup, pluralization, date/number formatting, directionality, and fallback behavior must flow through shared infrastructure. Do not implement page-specific localization systems. One architecture.

---

## FT. Localization must not duplicate business logic

Do not create English booking flow and Spanish booking flow as separate code paths. Use one booking engine + localized presentation. Otherwise logic will diverge.

---

## FU. Same canonical object model across languages

English "Appointment" and Spanish translated equivalent share the same `appointment_id`, `appointment.status`, and `appointment.start`. No duplicate localized domain models.

---

## FV. Locale change should not mutate underlying data

Switching English → Arabic changes labels, direction, and formatting. It must not change appointment instant, payment amount, contact phone, consent state, or workflow. Presentation only.

---

## FW. Internationalization errors are production defects

Examples: untranslated raw key, clipped translated button, corrupted customer name, wrong RTL order, wrong decimal parsing, broken Unicode SMS, English-only screen-reader label.

These should be treated as defects, not cosmetic polish.

---

## Transovo Internationalization & Localization Acceptance Checklist

Every applicable feature should pass:

- [ ] All user-facing text is Unicode-safe
- [ ] UTF-8 used for normal web/API/text interchange
- [ ] Names are not restricted to ASCII/English alphabet
- [ ] Name model does not assume one universal Western naming structure
- [ ] Language, locale, region, script, timezone, and currency are modeled separately
- [ ] Locale/language identifiers use valid BCP 47 tags
- [ ] Primary page language is declared programmatically
- [ ] Meaningful language changes are marked where appropriate
- [ ] Locale behavior uses CLDR-backed platform APIs
- [ ] Dates/times use locale-aware formatting
- [ ] Numbers use locale-aware formatting
- [ ] Currency uses explicit currency metadata
- [ ] Decimal/group separators are not assumed to be U.S.-style
- [ ] Percent/list formatting is locale-aware
- [ ] Pluralization uses real plural rules, not count===1 logic
- [ ] Full messages are translation units rather than concatenated English fragments
- [ ] Variables can be reordered by translations
- [ ] Translation keys are semantic and stable
- [ ] Ambiguous terms include translator context
- [ ] Missing-translation fallback is centralized
- [ ] Missing translations are detectable in development/QA
- [ ] Explicit user locale overrides auto-detection
- [ ] Workspace/user/customer-facing language preferences are not conflated
- [ ] Background jobs receive explicit locale context
- [ ] Server-generated email/SMS/PDF content is localized independently of browser state
- [ ] Layout survives significant text expansion
- [ ] Buttons/navigation/form labels/error messages can wrap or expand safely
- [ ] UI text is not embedded in images without localization strategy
- [ ] RTL is supported using standards-based directionality
- [ ] HTML dir is used appropriately
- [ ] CSS logical properties are preferred for directional reusable UI
- [ ] Directional icons mirror only when semantically appropriate
- [ ] Logos/non-directional assets do not mirror
- [ ] Mixed RTL/LTR content is isolated correctly
- [ ] Strings are never manually reversed
- [ ] Unicode normalization is considered for search/comparison
- [ ] Locale-aware casing/collation used where human-facing behavior requires it
- [ ] Search can handle diacritics appropriately
- [ ] Security sanitization does not strip legitimate foreign characters
- [ ] International phone numbers are not restricted to U.S. patterns
- [ ] Postal/address schemas do not assume U.S. structure globally
- [ ] Country identity uses standardized codes/data where applicable
- [ ] Translated enum labels remain separate from canonical backend values
- [ ] Internal routes/IDs/API keys are not localized accidentally
- [ ] Template variables remain stable across translations
- [ ] Translation validation detects missing required variables
- [ ] SMS segment/encoding calculations use actual localized text
- [ ] Unicode truncation respects grapheme clusters
- [ ] Font fallbacks support intended scripts
- [ ] Fixed-height typography does not clip non-Latin scripts
- [ ] Global uppercase/letter-spacing assumptions do not break scripts
- [ ] Production translation is managed/versioned, not generated live by an LLM
- [ ] High-risk legal/security/payment copy receives reviewed translations
- [ ] Backend errors use stable codes rather than English-only logic
- [ ] Accessibility labels, live regions, alt text, and hidden text are localized
- [ ] Pseudolocalization testing exists
- [ ] RTL testing exists
- [ ] Real target-language QA exists for supported production languages
- [ ] Non-Latin data survives create/search/display/export/send workflows
- [ ] Mixed LTR/RTL records are tested
- [ ] Locale and timezone independence is tested
- [ ] Fallback behavior is tested
- [ ] Server/background localization is tested
- [ ] One localization infrastructure serves the whole product
- [ ] Localized experiences use the same underlying business logic and object model

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → i18n/l10n (this file)
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #11: Internationalization & Localization Standards. All 12 implementation standards guides in the Transovo series are now complete.*


===== [Mode 4 orchestration & Cursor/Kimi role split] docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md =====
# Transovo Full UI Rebuild — Kimi Mode 4 Orchestration

**Status:** Active — master implementation instruction for Cursor  
**Audience:** Cursor (orchestrator), Kimi (UI implementer)  
**Allowlist:** `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`  
**Governance:** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`

---

## Mission

Transovo's existing customer-facing application UI is being **fully rebuilt from scratch** using Kimi Mode 4.

This is **not** an incremental cleanup of the current UI.  
This is **not** a general repo-wide redesign.  
This is a **controlled replacement** of the exact approved Transovo customer-facing pages, subpages, screens, tabs, drawers, wizards, configuration flows, and reachable product surfaces in the **approved page inventory**.

The rebuilt Kimi pages become the **actual production application UI**.

The existing application remains authoritative for:

- functionality, routes, backend contracts, data, feature inventory, states
- API wiring, domain behavior, permissions, runtime requirements

Its **current visual design is not authoritative**.

---

## 1. Cursor's role

Cursor is the **orchestrator and backend/integration authority**.  
Cursor is **NOT** the UI designer for this operation.

**Cursor must:**

- locate and load the complete approved Transovo UX/design standards
- locate the approved page inventory (`TRANSOVO-MODE-4-REBUILD-MANIFEST.md`)
- locate existing implementation for each approved page
- identify functionality that must survive
- prepare context Kimi needs (Page Contract + standards pack)
- invoke Kimi Mode 4 (`npm run ui:kimi-mode4`)
- dispatch pages in concurrent batches (max 10, 5s stagger)
- preserve route/backend/domain contracts
- statically review Kimi output structurally
- ensure required features were not omitted / no out-of-scope features added
- ensure resulting pages are actually used by the application
- wire/fix backend behavior where needed **after** UI rebuild

**Cursor must not manually redesign these pages itself.**

---

## 2. Hard Cursor execution restriction

**Cursor must NEVER run:**

- production builds, dev servers, local servers, browsers, screenshots
- Playwright, Puppeteer, Cypress, Docker builds
- memory-heavy tests, visual verification, production compilation

**Cursor may only:**

- code/file inspection, static reasoning, lightweight type checks when safe
- wiring/route/dependency/diff inspection

Cursor must **not** launch the app merely to see whether Kimi's UI looks right. **Kimi performs UI generation.** Cursor coordinates it.

---

## 3. Kimi must receive ALL Transovo rules

Kimi Mode 4 must receive the **complete governing Transovo system** — not summaries.

**Preflight (mandatory):** `npm run ui:kimi-mode4-preflight -- --write-report`  
Must return **OVERALL: PASS** before any Kimi generation. Verifies:
- full document bytes (no truncation)
- manifest + feature coverage
- **scope consistency** (no stale MCTB/mass-SMS instructions in active payload)

**Minimum bundle** (see `scripts/ui-agent/mode4-standards-pack.ts` — 23 document slots, ~712K chars full content):

| Layer | Document |
|-------|----------|
| Layer | Document |
|-------|----------|
| **Mode 4 active scope** | `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md` |
| Product scope / domain | `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` (appointments sections; ignore OUT OF MODE 4) · `docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md` |
| Page inventory | `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md` |
| Governance | `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` |
| IA & terminology | `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` |
| HCD | `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` |
| Page architecture | `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` |
| Visual system | `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md` |
| Product experience | `docs/TRANSOVO-UI-DESIGN-GUIDE.md` |
| Standards #1–#11 | All `docs/TRANSOVO-*-STANDARDS.md` formal guides |

Do not summarize these away before giving them to Kimi.

---

## 4. Standards are the Bible

**Kimi authority order:**

1. Approved Transovo product scope and domain architecture  
2. Approved feature/page inventory  
3. Transovo Product Design & UX Governance  
4. Canonical IA and terminology  
5. Human-Centered Design principles  
6. Page Architecture  
7. Visual Design System  
8. Shared Component System  
9. All applicable formal standards guides  
10. Existing Transovo runtime/functionality requirements  
11. Campaign and Inbox visual-reference videos  
12. Existing page appearance  

Lower authority **never** overrides higher authority.

---

## 5. Campaign and Inbox videos — visual art direction

Reference videos in `.ui-agent/references.json`:

| Video | Route key | Use |
|-------|-----------|-----|
| `Sending Mass Texts in SlickText...` | `/campaigns` | Default polish / density / hierarchy |
| `Navigating the SlickText Inbox...` | `/conversations` | Messages polish |

They establish: polish, rhythm, typography, spacing, density, navigation refinement, surfaces, borders, component finish, table/list treatment, premium SaaS feel.

**Art direction only** — never copy unrelated features, competitor terminology/navigation, or conflicting architecture.

> Achieve this visual quality while designing Transovo according to Transovo's own product architecture and standards.

---

## 6. Mode 4 derives from Mode 1

Mode 4 = Mode 1's full-page recreation (`npm run ui:kimi` / `runKimiCommand`) **plus** complete standards + art direction + strict product constraints.

Preserve Mode 1 strengths: page ingestion, code awareness, reconstruction, file editing, asset handling, route awareness, completion passes.

Implementation: `scripts/ui-agent/kimi-mode4-batch.ts` calls `runKimiCommand` with `KIMI_MODE4_SYSTEM_PREFIX` + Page Contract + standards pack.

---

## 7. Kimi Mode 4 permanent instruction

```
MODE 4 — TRANSOVO PREMIUM PRODUCTION REBUILD

Rebuild an actual production Transovo SaaS screen — not a mockup or polish pass.
Result replaces the current customer-facing screen as canonical UI.

Preserve: functionality, backend contracts, domain behavior, data, permissions, states, actions, feature coverage.
Standards library is mandatory. Existing visuals are not authoritative.
Campaign/Inbox videos = art direction only.

Professional, calm, precise, modern, premium, medium-density operational SaaS.
Do not simplify to sparse cards or landing-page layouts.
Design at macro, component, and micro levels.
```

Full text: `KIMI_MODE4_SYSTEM_PREFIX` in `scripts/ui-agent/config.ts`.

---

## 8. Kimi works on actual production pages

Mode 4 output is **not** left in `/concepts`, `/mockups`, or disconnected prototypes.

Flow:

1. Kimi generates in `.ui-agent/generated/<session>/` (Mode 1 pipeline)  
2. Cursor integrates into **actual route components** (`src/app/`, `src/components/`)  
3. Kimi version becomes **canonical** — no unused pretty copy  

---

## 9. Only approved inventory may be rebuilt

**Hard rule:** If a page is not in `TRANSOVO-MODE-4-REBUILD-MANIFEST.md`, Mode 4 must not redesign it because code exists.

---

## 10. Inventory must be exhaustive

Include every customer-facing reachable surface: tabs, detail views, create/edit, drawers, wizards, setup flows, empty states, public booking, meaningful dialogs.

---

## 11. Approved global IA

Home · Appointments · Booking · Contacts · Messages · Automations · Meetings · Payments · Analytics · Integrations · Settings

(`src/lib/products/appointments-nav.ts`)

---

## 12. Page Contract (required before each Kimi job)

Cursor derives a **Page Contract** from existing code + feature inventory:

```bash
npm run ui:kimi-mode4-contract -- --id appointments-calendar
```

Output: `.ui-agent/mode4/contracts/<id>.md`

Includes: primary job, required features, states, backend contracts, actions, terminology, standards, file ownership.

---

## 13–15. Feature preservation rules

- **Preserve** approved functionality — compare feature inventory vs Mode 4 output  
- **Reposition** features per governance when old placement was wrong  
- **Do not preserve** obsolete UI not in approved inventory  

---

## 16. Feature-to-page matrix

See `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md` § Feature matrix.

Build this **before** dispatching Kimi.

---

## 17. Rebuild manifest

Machine-readable: `.ui-agent/mode4/rebuild-manifest.json`  
Human-readable: `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`

Do **not** use route discovery alone as the manifest.

---

## 18–21. Foundations & golden screens

**Stage D — Foundations (serial):** tokens, shell, sidebar, header, shared components.  
Run `npm run ui:kimi-sidebar` before bulk jobs. **No concurrent writes** to shared files.

**Stage E — Golden screens:**

1. Home  
2. Appointments → Calendar  
3. Appointments → List  
4. Appointment Detail  
5. Booking Type editor  
6. Workflow Builder  

Golden screens establish Transovo visual language for subsequent jobs. **Standards remain higher authority** than golden screens.

---

## 22–26. Concurrency

```
MAX_CONCURRENT_KIMI_MODE4_JOBS = 10
KIMI_MODE4_STAGGER_MS = 5000
```

- Queue with replenishment as slots free  
- Do not terminate jobs for exceeding ~2 minutes  
- **Never** run concurrent jobs that modify the same shared file  

```bash
npm run ui:kimi-mode4 -- --stage bulk --concurrency 10 --stagger-ms 5000
```

---

## 27–29. File ownership & shared components

Each job lists: primary files, shared consume, shared forbidden.

If shared components need improvement → controlled foundation task → then page jobs consume updates.

**Reuse** canonical components — no private imitations.

---

## 30–32. Backend integration

Preserve: API hooks, route params, mutations, subscriptions, handlers, permissions, domain IDs, loading/error sources.

Kimi may refactor front-end structure but must maintain behavior mapping. **No fake functionality.**

---

## 33–36. States & premium definition

Implement: normal, loading, empty, no-results, error, degraded, success, permission/read-only.

Premium ≠ empty. Premium ≠ decorative gradients/glass/clutter.

---

## 37–42. One visual system

No unrelated product aesthetics per page. Shared shell on all authenticated pages. Shared state appearance (badges, empty tables, errors).

---

## 43–46. Permissions, compliance, datetime, accessibility

Use real authorization and SMS eligibility states. Use canonical temporal utilities. Accessibility is non-negotiable.

---

## 47–49. Acceptance & retries

After each batch, Cursor **statically** verifies: correct route changed, features preserved, no out-of-scope additions, hooks preserved, no placeholders.

Per-page completion record in `.ui-agent/mode4/batch-state.json`.

Failed jobs: retry individually with original contract + failure reason.

---

## 50–52. Refinement passes

Use controlled Mode 4 refinement (Mode 2 concept) for polish-only second pass — spacing, typography, hierarchy — **not** behavior changes.

Mode 3 (generic polish) remains optional. **Mode 4 is default** for this rebuild.

---

## 53. Rebuild order

| Stage | Action |
|-------|--------|
| A | Load approved page inventory |
| B | Load all governing docs |
| C | Map features → canonical pages |
| D | Foundations (serial) |
| E | Golden screens |
| F | Golden consistency pass |
| G | Bulk Mode 4 (≤10 concurrent) |
| H | Static completeness review |
| I | Targeted Mode 4 refinement |
| J | Cursor backend integration review |

---

## 54–58. Implementation principles

- Feature mapping **before** Kimi touches pages  
- Do not progressively polish old UI — rebuild directly  
- Preserve backend/domain engines — no parallel frontend recreation  
- Same features, better architecture  

---

## 59–62. Final audits

- **Route coverage:** manifest vs completed pages  
- **Feature coverage:** inventory vs canonical pages  
- **Duplicate-pattern audit:** consolidate duplicate Sidebars, Buttons, modals  
- **Legacy routing check:** nav must point to new Mode 4 UI  

---

## 63. Final outcome

One canonical shell, visual language, page architecture, component system, terminology, IA, domain engines — every approved page rebuilt, every approved feature represented, every real action connected.

---

## Tooling reference

| Command | Purpose |
|---------|---------|
| **`npm run ui:kimi-mode4-preflight`** | **Mandatory preflight audit — must PASS before Stage D/E/G** |
| `npm run ui:kimi-mode4-sync-manifest` | Sync JSON manifest |
| `npm run ui:kimi-mode4-contract -- --id <id>` | Generate Page Contract |
| `npm run ui:kimi-mode4-standards` | Print standards pack |
| `npm run ui:kimi-mode4 -- --stage golden` | Golden screen batch |
| `npm run ui:kimi-mode4 -- --stage bulk` | Bulk concurrent rebuild |
| `npm run ui:kimi-mode4 -- --status` | Completion records |
| `npm run ui:kimi -- --target <route> --video <name>` | Single Mode 1/4 page (manual) |
| `npm run ui:approve` / `ui:integrate` | Promote sandbox → production |

Art direction video names: `scripts/ui-agent/mode4-standards-pack.ts` → `MODE4_ART_DIRECTION_VIDEOS`.

---

## MASTER EXECUTION COMMAND (give Cursor this)

> Implement this orchestration now. Do not redesign any Transovo production UI yourself. First locate and load the complete approved Transovo standards/design-document set and the exact approved customer-facing page inventory (`docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`). Create Kimi Mode 4 by extending the existing Mode 1 full-page recreation workflow (`runKimiCommand`) with the standards hierarchy and rules in this document. Ensure every Mode 4 job receives the complete relevant standards, its Page Contract, the approved feature requirements, and access to the Campaign and Inbox reference videos as visual art direction. Build a complete allowlisted rebuild manifest covering every approved page, subpage, detail view, local view, wizard, setup flow, and meaningful customer-facing screen—but do not include legacy/out-of-scope repo routes merely because they exist. Map every approved feature to its canonical page before generation. Establish shared design foundations and the six representative golden screens first. Then dispatch the remaining eligible page rebuilds through Kimi Mode 4 with up to 10 concurrent jobs, staggering starts by approximately five seconds, while preventing concurrent writes to the same shared files. The Kimi-generated implementation must replace/become the actual canonical UI for each approved route. Preserve existing backend/domain/API behavior and integration contracts. Kimi owns the UI implementation; Cursor owns orchestration, static verification, integration mapping, and later backend wiring. Cursor must not run a build, dev server, browser, screenshots, Playwright, Puppeteer, Cypress, Docker build, memory-heavy tests, or visual verification. Use only safe inspection/static checks. Track completion and required feature coverage for every page. Retry or Mode-4-refine only the pages that fail the Page Contract or established Transovo visual language. At the end, verify full approved-page coverage, full approved-feature coverage, canonical routing to the new UI, and absence of accidental legacy/out-of-scope features. Summarize what was configured, the manifest, Kimi execution results, any failed/retried jobs, and any backend wiring Cursor still needs to complete.

