# Transovo V1 Refocus — Appointments + Missed-Call Text Back

**Status:** Active product/UI rebuild directive  
**Audience:** Cursor agents and engineers  
**Principle:** Audit and reuse before building. **Do not delete** mass-SMS infrastructure — hide from launch nav.

**Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`  
**Mode 4 rebuild:** `docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md` · `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`

Related: `src/lib/products/v1-launch-nav.ts` (nav flags) · Appendix A (reuse map)

---

## Launch products (V1)

1. **Appointments / Scheduling**
2. **Appointment SMS reminders**
3. **Missed-Call Text Back**
4. **Conversations**
5. **Contacts**
6. **Basic Analytics / Overview**
7. **Numbers / Compliance / Billing / Settings**

Mass SMS (Campaigns, Drips, Keywords, bulk send, list/segment marketing) is **preserved but hidden** from primary navigation until reactivation.

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

## 3. New primary navigation (V1)

| Section | Items |
|---------|--------|
| **Overview** | Operations dashboard |
| **Appointments** | Calendar · Scheduled Appointments · Appointment Types · Reminder Settings |
| **Conversations** | Shared inbox |
| **Contacts** | Shared contacts |
| **Missed Calls** | MCTB list + setup entry |
| **Analytics** | Operational metrics |
| **Setup / Numbers** | Forwarding, sender, provider status |
| **Compliance** | Appointment + MCTB consent audit |
| **Settings** | Business, billing, team, integrations |

Billing under Settings or top-level — match existing app structure.

Nav flags: `src/lib/products/v1-launch-nav.ts`

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
- Do not create separate-looking mini-apps for Appointments, Conversations, MCTB

---

## 6. Overview page

**Job:** *What is happening with my appointments and customer conversations today?*

**Summary cards:** Appointments Today · Confirmed · Awaiting Confirmation · Reschedule Requests · Missed Calls Recovered · Unread Conversations

**Sections:**

- **Today's Appointments** — time, customer, service, confirmation, reminder state → click opens detail
- **Needs Attention** — awaiting confirmation, reschedule requests, unread MCTB conversations, failed reminders → each links to proper screen
- **Recent Conversations** — reuse existing components
- **Recent Missed Calls** — reuse MCTB data

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
- *Missed Call:* Missed call — Sept 8 at 11:42 AM  

Filters: All · Unread · Appointments · Missed Calls (hide campaign filters for launch if needed)

---

## 17. Contacts

Keep existing Contacts. Extend profile with:

- Upcoming appointment  
- Appointment history (upcoming · completed · canceled · no-show)  
- Conversations (reuse)  
- Consent (SMS)

**Same contact records** — no separate customer DB.

---

## 18. Missed Call Text Back

**Do not rebuild.** Audit and tighten UI to match Appointments shell.

Pages: Missed Calls · Setup · Numbers/Forwarding

**Missed Calls list:** caller · context · date/time · disposition · consent · text started? · conversation status

Statuses: Missed · Waiting for consent · Opted in · Conversation started · Voicemail · Opted out

Click → detail or Conversation.

**Setup onboarding:** forwarding → business name → greeting → test forward → test IVR → test text-back → ready

Separate: submitted compliance script vs production live IVR prompt.

Preserve **both** MCTB modes: `press_1` and `existing_consent`.

---

## 19. Numbers

Shared toll-free messaging infrastructure — UI must clarify:

- Business phone vs forwarding setup vs messaging sender vs provider status

Do not show mass-SMS dedicated-number registration to Appointments/MCTB-only users.

---

## 20. Compliance

Reuse Compliance page. Sections:

- **Appointment consent** — wording · captured? · timestamp · source · terms version  
- **MCTB consent** — Press-1 · timestamp · call ID · sender · opt-out state  
- **Messaging status** — active · STOP · UNSTOP  

---

## 21. Analytics (operational)

**Appointments:** Booked · Confirmed · Canceled · No-Shows · Confirmation Rate · Reminder Delivery · Reschedule Requests

**MCTB:** Missed Calls · Press-1 Opt-Ins · Conversations Started · Recovered · Voicemails

**Conversations:** unread · response rate (if reliable)

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

**MCTB:** forwarding · test call · Press-1 flow  

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

**MCTB:** turn missed calls into conversations → show missed calls, consent, recovery, unread

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
4. **Consolidate** global sidebar/header first (`v1-launch-nav.ts` + nav builders)  
5. **Build Appointments** on Contacts, Conversations, SMS, scheduler, compliance, billing  
6. **Tighten MCTB UI** — match new shell  
7. **Hide** mass-SMS from launch nav  
8. Browser tests on every launch-visible page  
9. Real SMS/reminder/MCTB E2E before declaring V1 ready  

---

## Appendix A — Reuse map (audit snapshot)

| Area | Path(s) | Action | Notes |
|------|---------|--------|-------|
| MCTB Missed Calls | `/voice/missed-calls`, `components/mctb/*` | keep-as-is | Wire to new nav |
| MCTB Setup | `/voice/setup` | keep-as-is | Press-1 + existing_consent |
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

**Current gap:** `SMS_ONLY_APP_NAV = true` shows mass-SMS items in sidebar — opposite of V1 intent. Flip to appointments+MCTB nav builder.

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
