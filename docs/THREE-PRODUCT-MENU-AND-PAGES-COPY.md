# Three products — sidebar menus & page routes (copy sheet)

**Generated from repo code:** `src/lib/products/mctb-nav.ts`, `appointment-reminders-nav.ts`, `sms-nav.ts`, `sms-platform-nav.ts`, `src/lib/mctb/routes.ts`, `src/lib/appointment-reminders/routes.ts`, `src/lib/products/sms-routes.ts`.

**Use:** Planning how Missed Call Text Back, Appointment Reminders (original), and Business SMS / mass texting coexist — e.g. shared platform sender, shared inbox, unified nav.

**Excluded per your request:** AI Receptionist, `/voice/agents`, generic voice-agent products.

---

## 1. Missed Call Text Back (MCTB)

**Sidebar source:** `buildMctbV1Nav()` in `src/lib/products/mctb-nav.ts`  
**Product prefix:** `/mctb/*` (legacy mirrors under `/voice/*` where noted)

### A. Current MCTB product menu (desktop sidebar)

| # | Menu label | Route | Notes |
|---|------------|-------|--------|
| 1 | Overview | `/mctb` | Product home |
| 2 | Getting Started | `/getting-started` | Shared workspace onboarding (not under `/mctb`) |
| | **Activity** | | section |
| 3 | Missed Calls | `/mctb/missed-calls` | List |
| 4 | Conversations | `/mctb/conversations` | MCTB-filtered shared inbox |
| 5 | Voicemail | `/mctb/voicemail` | Operational inbox (+ greeting tab in UI) |
| 6 | Analytics | `/mctb/analytics` | Also reachable: `/analytics/mctb` |
| | **Configure** | | section |
| 7 | Missed-Call Recovery | `/mctb/missed-call-recovery` | Tabbed setup (rules, consent, exclusions, etc.) |
| 8 | Text Back | `/mctb/text-back` | Recovery message / opener editor |
| 9 | AI Recovery | `/mctb/ai-recovery` | Legacy alias redirect: `/mctb/ai-lead-recovery` |
| 10 | Notifications | `/mctb/notifications` | Team / alert routing |
| 11 | Phone & Forwarding | `/mctb/phone` | Business line + forwarding |
| 12 | Consent Log | `/mctb/compliance/consent` | Audit / compliance |
| 13 | Setup | `/mctb/setup` | Setup overview + wizard entry |

**Omitted from this list (you asked to leave out):**

| Menu label | Route | Reason |
|------------|-------|--------|
| AI Voice Agent | `/mctb/voice-agent` | Redirects to voice receptionist wizard — not part of MCTB text-back IA |

### B. MCTB mobile bottom nav (`buildMctbV1MobileNav`)

| Label | Route |
|-------|-------|
| Home | `/mctb` |
| Missed | `/mctb/missed-calls` |
| Chats | `/mctb/conversations` |
| Configure | `/mctb/missed-call-recovery` |

### C. MCTB pages linked from Setup / IA (not always in sidebar)

| Page | Route |
|------|-------|
| Guided onboarding | `/onboarding/mctb` |
| Wizard start (redirect) | `/mctb/setup/start` → onboarding |
| Setup — Phone | `/mctb/setup/phone` |
| Setup — Missed-call rules | `/mctb/setup/missed-call-rules` |
| Setup — Text back | `/mctb/setup/text-back` |
| Setup — Consent | `/mctb/setup/consent` |
| Setup — Recovery controls | `/mctb/setup/recovery` |
| Setup — Voicemail config | `/mctb/setup/voicemail` |
| Setup — Links | `/mctb/setup/links` |
| Setup — Exclusions | `/mctb/setup/exclusions` |
| Setup — Notifications | `/mctb/setup/notifications` |
| Setup — Test | `/mctb/setup/test` |
| Legacy redirects | `/mctb/setup/business-hours` → recovery |
| Legacy redirects | `/mctb/setup/follow-up` → recovery |
| Numbers (MCTB context) | `/mctb/numbers` |
| Missed call detail | `/mctb/missed-calls/[id]` |
| Conversation thread | `/mctb/conversations` + `?conversation=` or shared `/conversations` |
| Voicemail detail | `/mctb/voicemail/[id]` (if implemented) / tabs on `/mctb/voicemail` |
| Billing checkout (MCTB) | `/mctb/billing/checkout` |
| Shared from overview/shell | `/payments` |
| Shared from overview/shell | `/integrations` |
| Shared account | `/settings`, `/settings/business`, `/settings/billing` |
| Help | `/help` |

### D. MCTB-adjacent routes in repo (usually hidden or cross-product)

| Page | Route | Notes |
|------|-------|--------|
| MCTB calendar (stub/legacy) | `/mctb/calendar` | Not canonical IA |
| MCTB appointments | `/mctb/appointments`, `/mctb/appointments/new`, `/mctb/appointments/[id]` | Cross-link experiments |
| MCTB booking | `/mctb/booking`, `/mctb/booking/[id]` | Cross-link |
| MCTB reminders | `/mctb/reminders` | Cross-link |

### E. Legacy Voice-era MCTB menu (pre-`/mctb` rebuild) — routes preserved

| Legacy label | Route | Typical redirect target |
|--------------|-------|-------------------------|
| Missed Calls | `/voice/missed-calls` | `/mctb/missed-calls` |
| Voicemail | `/voice/voicemail` | `/mctb/voicemail` |
| Consent Log | `/voice/consent-log` | `/mctb/compliance/consent` |
| Text Back Setup | `/voice/setup` | `/mctb/setup` |
| Schedule | `/voice/schedule` | `/mctb/setup/recovery` |
| Try It | `/voice/try-it` | `/mctb/setup/test` |
| Analytics | `/voice/analytics` | `/mctb/analytics` |
| Numbers | `/voice/numbers` | numbers product |

---

## 2. Appointment Reminders (original product — before Scheduling / Booking submodule)

**Sidebar source:** `buildAppointmentRemindersNav()` when **booking nav is hidden** (`appointmentRemindersHideBookingNav()` — default when AR is primary and unified appointments is off).

This is the **reminders-first** menu: calendar sync + appointments list + reminder sequences — **not** the full `/appointments/scheduling` commerce stack.

### A. Appointment Reminders menu (reminders-first / pre-booking-nav)

| # | Menu label | Route | Sub-pages (children) |
|---|------------|-------|----------------------|
| 1 | Calendar | `/appointment-reminders` | Product home (workspace calendar) |
| 2 | Appointments | `/appointment-reminders/appointments` | Provider-synced appointment list |
| 3 | Reminders | `/appointment-reminders/reminders` | **Activity & Delivery** → same URL |
| | | | **Sequences** → `/appointment-reminders/reminders/sequences` |
| | | | **Templates** → `/appointment-reminders/reminders/templates` |
| 4 | Responses | `/appointment-reminders/responses` | Customer SMS replies; held queue `?view=held` |
| 5 | AI Rescheduler | `/appointment-reminders/ai-rescheduler` | AR SMS reschedule assistant |
| 6 | Analytics | `/appointment-reminders/analytics` | Reminder funnel metrics |
| 7 | Settings | `/appointment-reminders/settings?tab=scheduling` | **Scheduling & Rules** |
| | | | **Business Profile** → `?tab=business` |
| | | | **Notifications & Responses** → `?tab=notifications` |
| | | | **Integrations** → `?tab=integrations` (calendars) |
| 8 | Plan & Billing | `/appointment-reminders/settings?tab=billing` | |
| 9 | Business Settings | `/settings/business` | Shared workspace profile |

### B. Appointment Reminders mobile nav (booking hidden)

| Label | Route |
|-------|-------|
| Calendar | `/appointment-reminders` |
| Appointments | `/appointment-reminders/appointments` |
| Reminders | `/appointment-reminders/reminders` |
| Settings | `/appointment-reminders/settings?tab=scheduling` |

### C. AR pages in repo (same product shell — not all in sidebar)

| Page | Route |
|------|-------|
| Calendar (alternate path) | `/appointment-reminders/calendar` |
| Reminder sequence step editor | `/appointment-reminders/reminders/sequences/[stepKey]/edit` |
| Calendar connections (legacy) | `/appointment-reminders/calendars` |
| Held inbound (legacy) | `/appointment-reminders/held-inbound` → use Responses held view |
| Setup — Connect calendar | `/appointment-reminders/setup/connect` |
| Setup — Configure | `/appointment-reminders/setup/configure` |
| Setup — Activate | `/appointment-reminders/setup/activate` |
| Pricing / marketing | `/appointment-reminders/pricing` |
| Signup landing | `/signup/appointment-reminders` |

### D. AR booking submodule (added later — **not** part of “original AR-only” menu)

When `AR_HIDE_BOOKING_NAV=0` or unified appointments is on, these **extra** sidebar items appear:

| Menu label | Route |
|------------|-------|
| Booking page | `/appointment-reminders/booking` |
| Meetings | `/appointment-reminders/booking/meetings` |

**Booking subtree routes (scheduling-era — exclude from “original AR” mental model):**

- `/appointment-reminders/booking`
- `/appointment-reminders/booking/services`, `/new`, `/[id]`
- `/appointment-reminders/booking/meetings`, `/new`, `/[id]`

### E. Full unified “Appointments + Scheduling” (separate product — for boundary clarity)

Not Appointment Reminders-only; lives under `/appointments/**` (calendar, sell, packages, classes, etc.).  
**Do not merge with section 2** when you mean “AR before we brought in scheduling.”

---

## 3. Business SMS / Mass texting (Campaigns product)

**Sidebar sources:**

- **Focused V1 platform nav:** `buildSmsPlatformNav()` — `src/lib/products/sms-platform-nav.ts`
- **Older / fuller SMS nav:** `buildSmsNav()` — `src/lib/products/sms-nav.ts`

**Entitlement flag (target):** `mass_texting` / `MASS_TEXTING` (see `src/lib/products/feature-entitlements.ts`).  
**Launch note:** `MASS_MESSAGING_IN_V1_NAV = false` in `v1-launch-nav.ts` — routes exist, primary nav hidden.

### A. SMS platform menu (`buildSmsPlatformNav`) — recommended “mass SMS” operator menu

| # | Menu label | Route | Sub-pages |
|---|------------|-------|-----------|
| | **Main** | | |
| 1 | Dashboard | `/sms/dashboard` | |
| 2 | Conversations | `/conversations` | Shared inbox (also `/inbox` legacy) |
| 3 | Campaigns | `/campaigns` | |
| 4 | Analytics | `/sms/analytics` | Tabs: campaigns, audience, messaging |
| 5 | Audience | `/contacts` | Contacts, Lists `/contacts/lists`, Segments `/contacts/segments` |
| 6 | List Growth | `/grow/forms` | QR `/grow/qr-codes`, Web Forms `/grow/forms`, Tap-to-Join `/grow/tap-to-join`, Keywords `/grow/keywords` |
| | **Automate** | | |
| 7 | Drip Campaigns | `/automations/drip-campaigns` | Legacy list: `/drip-campaigns` |
| 8 | Playbooks | `/playbooks` | |
| 9 | Auto Replies | `/auto-replies` | |
| 10 | AI Replies | `/ai-replies` | |
| | **Account** | | |
| 11 | Settings | `/settings` | |
| 12 | Help | `/help` | |

### B. Older SMS menu (`buildSmsNav`) — still in codebase

| # | Menu label | Route |
|---|------------|-------|
| 1 | Dashboard | `/sms/dashboard` |
| 2 | Inbox | `/conversations` |
| 3 | Campaigns | `/campaigns` |
| 4 | Contacts | `/contacts` |
| | **Automate & Grow** | |
| 5 | Drip Campaigns | `/automations/drip-campaigns` |
| 6 | Playbooks | `/playbooks` |
| 7 | Grow | `/grow/keywords` |
| | **Manage** | |
| 8 | Numbers | `/numbers` |
| 9 | Analytics | `/sms/analytics` |
| | **Account** | |
| 10 | Settings | `/settings` |
| 11 | Help | `/getting-started` |

### C. Mass SMS mobile bottom nav (`buildMassSmsMobileNav`)

| Label | Route |
|-------|-------|
| Dashboard | `/dashboard` |
| Campaigns | `/campaigns` |
| Inbox | `/conversations` |
| Contacts | `/contacts` |

### D. Campaigns subtree (deep routes — same product)

| Page | Route |
|------|-------|
| Campaign list home | `/campaigns` |
| All / filters | `/campaigns/all`, `/drafts`, `/scheduled`, `/sending`, `/paused`, `/completed`, `/failed`, `/canceled`, `/recurring`, `/calendar` |
| Campaign detail | `/campaigns/[campaignId]` |
| Create campaign | `/campaigns/new` |
| Create by category | `/campaigns/new/[category]` |
| Review | `/campaigns/new/review` |
| Queue | `/campaigns/new/queue` |
| Success | `/campaigns/new/success` |
| Legacy voice campaigns | `/voice/campaigns` |

### E. Send & compose (not in sidebar — “Create” actions)

| Page | Route |
|------|-------|
| Send hub | `/send` |
| Quick send | `/send/quick` |
| AI composer | `/send/ai` |
| Send test | `/send/test` |

### F. Automations (workflow builder — mass SMS adjacent)

| Page | Route |
|------|-------|
| Automation list | `/automations` |
| New automation | `/automations/new` |
| Flow editor | `/automations/[flowId]/edit` |
| Flow detail | `/automations/[flowId]` |
| Execution detail | `/automations/[flowId]/executions/[executionId]` |
| Run history | `/automations/logs` |
| Templates | `/automations/templates` |
| Reports | `/reports/automations` |

### G. List growth / Grow (full tab set from `src/lib/grow-tabs.ts`)

| Tab label | Route |
|-----------|-------|
| Keywords | `/grow/keywords` |
| Forms | `/grow/forms` |
| Form editor | `/grow/forms/[id]` |
| Popups & widgets | `/grow/popups` |
| QR Codes | `/grow/qr-codes` |
| Click-to-text | `/grow/click-to-text` |
| Signup Pages | `/grow/pages` |
| Contests | `/grow/contests` |
| Contact cards | `/grow/contact-cards` |
| Sources | `/grow/sources` |
| Tap-to-Join list | `/grow/tap-to-join` |
| Tap-to-Join detail | `/grow/tap-to-join/[id]` |

### H. Audience & messaging utilities

| Page | Route |
|------|-------|
| Contacts | `/contacts` |
| Lists | `/contacts/lists` |
| Segments | `/contacts/segments` |
| Imports | `/contacts/imports` |
| Message templates | `/templates` |
| Media library | `/messaging/media` |
| Text-to-pay | `/messaging/payments` |
| Surveys | `/surveys` |
| Compliance | `/compliance` |
| Integrations | `/integrations` |
| Reports (general) | `/reports` |
| Campaign reports | `/reports/campaigns` |
| Link tracking | `/reports/links` |
| Legacy dashboard | `/dashboard` |
| Legacy analytics | `/analytics` (tabs: campaigns, messaging, sources, MCTB) |

### I. Numbers (shared with other products)

| Page | Route |
|------|-------|
| Manage numbers | `/numbers` |
| Buy numbers | `/numbers/buy` |
| Premium / pools | `/numbers/premium`, `/numbers/pools` |

---

## 4. Overlap map (why “platform sender for all” touches all three)

| Concern | MCTB | Appointment Reminders | Mass SMS |
|---------|------|----------------------|----------|
| **Shared inbox** | `/mctb/conversations` | `/appointment-reminders/responses` | `/conversations` |
| **Outbound SMS** | Recovery + AI recovery | Reminder sequences | Campaigns, drips, automations |
| **Compliance / 10DLC** | MCTB use case registration | AR reminder registration | Marketing use case registration |
| **Numbers** | Text-back sender, forwarding ingress | Usually platform/calendar-linked | Sending numbers, campaigns |
| **Analytics** | `/mctb/analytics` | `/appointment-reminders/analytics` | `/sms/analytics`, `/analytics` |

---

## 5. Plain-text quick copy (menus only)

```
MCTB (exclude AI Voice Agent / AI Receptionist)
- Overview                    /mctb
- Getting Started             /getting-started
- Missed Calls                /mctb/missed-calls
- Conversations               /mctb/conversations
- Voicemail                   /mctb/voicemail
- Analytics                   /mctb/analytics
- Missed-Call Recovery        /mctb/missed-call-recovery
- Text Back                   /mctb/text-back
- AI Recovery                 /mctb/ai-recovery
- Notifications               /mctb/notifications
- Phone & Forwarding          /mctb/phone
- Consent Log                 /mctb/compliance/consent
- Setup                       /mctb/setup

Appointment Reminders (original / reminders-first; booking nav off)
- Calendar                    /appointment-reminders
- Appointments                /appointment-reminders/appointments
- Reminders                   /appointment-reminders/reminders
    - Sequences               /appointment-reminders/reminders/sequences
    - Templates               /appointment-reminders/reminders/templates
- Responses                   /appointment-reminders/responses
- AI Rescheduler              /appointment-reminders/ai-rescheduler
- Analytics                   /appointment-reminders/analytics
- Settings                    /appointment-reminders/settings?tab=scheduling
- Plan & Billing              /appointment-reminders/settings?tab=billing
- Business Settings           /settings/business

Business SMS / Mass texting (platform nav)
- Dashboard                   /sms/dashboard
- Conversations               /conversations
- Campaigns                   /campaigns
- Analytics                   /sms/analytics
- Audience                    /contacts (+ lists, segments)
- List Growth                 /grow/* (keywords, forms, qr, tap-to-join, …)
- Drip Campaigns              /automations/drip-campaigns
- Playbooks                   /playbooks
- Auto Replies                /auto-replies
- AI Replies                  /ai-replies
- Settings                    /settings
- Help                        /help
```

---

## 6. Review requests / “Get More Reviews” (not a fourth top-level product)

There was **no** standalone sidebar product named “Reviews” with a `/reviews` home (unlike MCTB or Campaigns). Review collection was a **solution + automations workflow**, surfaced in three ways:

1. **Outcomes hub** — slug `review-requests`, title **“Get More Reviews”** (`src/lib/outcomes/registry.ts`)
2. **Solutions catalog** — **Automated Review Requests** under Customer Growth
3. **Runtime** — automation flows, SMS templates, `{{review_link}}` in settings, optional **Surveys** for NPS/polls

**V1 policy:** AGENTS.md / phase-1 inventory note **Reviews not on master** as a launch product; routes and registry remain in repo.

### A. Outcomes menu (local nav for “Get More Reviews”) — URLs still defined in code

**Note:** Middleware currently **redirects all `/outcomes/*` → `/dashboard`** (`src/middleware.ts`). The page module still exists, but these URLs are not reachable until that redirect is removed.

| Menu label | Route |
|------------|-------|
| Overview | `/outcomes/review-requests` |
| Set Up | `/outcomes/review-requests/setup` |
| Your Setups | `/outcomes/review-requests/active` |
| Review Profiles | `/outcomes/review-requests/profiles` |
| When It Runs | `/outcomes/review-requests/trigger` |
| Customer Eligibility | `/outcomes/review-requests/eligibility` |
| Request Messages | `/outcomes/review-requests/messages` |
| Reminder Rules | `/outcomes/review-requests/reminders` |
| Negative Feedback Routing | `/outcomes/review-requests/negative` |
| Notifications | `/outcomes/review-requests/notifications` |
| Test | `/outcomes/review-requests/test` |
| Reviews & Results | `/outcomes/review-requests/results` |

**Where those sections deep-link in the live app (launchHref):**

| Purpose | Link |
|---------|------|
| Build flow | `/automations/new` |
| Review links / business profile | `/settings/business` |
| Message copy | `/templates` |
| Negative feedback inbox | `/inbox` or `/conversations` |
| Staff notifications | `/settings/notifications` |
| Results reporting | `/reports/automations` |

### B. Solutions catalog (discovery pages — still routable)

| Page | Route |
|------|-------|
| Customer Growth category | `/solutions/customer-growth` |
| Automated Review Requests | `/solutions/customer-growth/automated-review-requests` |
| Customer Surveys (related) | `/solutions/customer-growth/customer-surveys` |
| All solutions | `/solutions` |

### C. Surveys (feedback / NPS — often paired with reviews)

**Legacy full `appNav` item “Surveys”** (`src/lib/nav.ts`):

| Menu label | Route |
|------------|-------|
| Surveys (parent) | `/surveys` |
| All Surveys | `/surveys` |
| Polls | `/surveys?type=poll` |
| NPS | `/surveys?type=nps` |
| Survey detail | `/surveys/[id]` |

### D. Other review-related entry points (not a dedicated menu)

| What | Route / note |
|------|----------------|
| Campaign intent “Request Reviews or Feedback” | `/campaigns/new` (category `review` in `src/lib/campaigns/catalog.ts`) |
| Review Request **Agent** type | Agent id `review_request` — setup via automations/agents, not `/mctb` |
| Record review on contact | API `POST /api/contacts/[id]/review` |
| Messaging setting: default review link | `/settings` → messaging (`{{review_link}}`) |
| Dashboard tile “Review Requests” | Links to `/solutions/customer-growth/automated-review-requests` |

### E. Plain-text copy — review solution menus

```
Get More Reviews (Outcomes local nav — /outcomes/* redirects to /dashboard today)
- Overview                      /outcomes/review-requests
- Set Up                        /outcomes/review-requests/setup
- Your Setups                   /outcomes/review-requests/active
- Review Profiles               /outcomes/review-requests/profiles
- When It Runs                  /outcomes/review-requests/trigger
- Customer Eligibility          /outcomes/review-requests/eligibility
- Request Messages              /outcomes/review-requests/messages
- Reminder Rules                /outcomes/review-requests/reminders
- Negative Feedback Routing     /outcomes/review-requests/negative
- Notifications                 /outcomes/review-requests/notifications
- Test                          /outcomes/review-requests/test
- Reviews & Results             /outcomes/review-requests/results

Solutions catalog
- Automated Review Requests     /solutions/customer-growth/automated-review-requests
- Customer Surveys              /solutions/customer-growth/customer-surveys

Surveys (legacy app nav)
- All Surveys                   /surveys
- Polls                         /surveys?type=poll
- NPS                           /surveys?type=nps
```

---

*End of copy sheet.*
