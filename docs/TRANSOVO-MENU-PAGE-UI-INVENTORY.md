# Transovo sidebar menu — page UI inventory

**Generated:** 2026-09-26 (code audit of production routes/components)

**Copy-friendly full detail (every box/tab/field):** [`docs/TRANSOVO-MENU-PAGE-UI-INVENTORY-DETAILED.md`](./TRANSOVO-MENU-PAGE-UI-INVENTORY-DETAILED.md) — includes this document plus the exhaustive **DETAILED SUPPLEMENT** section. On GitHub: open that file on branch `cursor/menu-page-ui-inventory-2304` (PR #538).

**Primary nav source:** `src/lib/products/mctb-nav.ts` → `buildMctbV1Nav()`  
**When this menu applies:** MCTB product shell (`resolveProductSidebarNav` → `effectiveShell === "mctb"`), typically when the workspace has MCTB and you are not on the Appointments-primary shell.

**Sections in the sidebar**

1. **AI Receptionist** — shown when `hasVoice` is true (voice / AI receptionist entitlement).
2. **Missed Call Text Back** — always in this nav build.
3. **Shared** — Integrations, Numbers (if `hasNumbers`), Billing, Settings.

**Product switcher:** Workspaces on the Appointments V1 shell use `buildAppointmentsV1Nav()` instead (`src/lib/products/appointments-nav.ts`). See [Appendix B](#appendix-b-appointments-product-sidebar-when-selected-in-product-switcher).

**Setup horizontal tabs:** Every `/mctb/setup/*` editor shares the same tab bar (`MCTB_SETUP_SECTIONS` in `src/lib/mctb/setup-sections.ts`): Overview | Phone & Forwarding | Consent | Text Back | Recovery | Voicemail | Notifications | Exclusions | Links | Test.

---

## Menu index (top-level sidebar)

| # | Section | Label | Route |
|---|---------|-------|-------|
| 1 | AI Receptionist | Overview | `/voice/overview` |
| 2 | AI Receptionist | Calls | `/voice/calls` |
| 3 | AI Receptionist | Receptionist | `/voice/receptionist` |
| 4 | AI Receptionist | Business Knowledge | `/voice/knowledge` |
| 5 | AI Receptionist | Call Handling | `/voice/call-handling` |
| 6 | AI Receptionist | Analytics | `/voice/analytics` |
| 7 | MCTB | Overview | `/mctb` |
| 8 | MCTB | Missed Calls | `/mctb/missed-calls` |
| 9 | MCTB | Inbox | `/mctb/conversations` |
| 10 | MCTB | AI Recovery | `/mctb/ai-recovery` |
| 11 | MCTB | Voicemail | `/mctb/voicemail` |
| 12 | MCTB | Analytics | `/mctb/analytics` |
| 13 | MCTB | Setup | `/mctb/setup` |
| 14 | Shared | Integrations | `/integrations` |
| 15 | Shared | Numbers | `/voice/numbers` (if entitled) |
| 16 | Shared | Billing | `/settings/billing` |
| 17 | Shared | Settings | `/settings` → redirects to `/settings/business` |

---

## 1. AI Receptionist — Overview (`/voice/overview`)

**Component:** `VoiceOverviewDashboard` (`src/components/voice/voice-overview-dashboard.tsx`)

### Page chrome
- **H1:** Overview
- **Description:** How the receptionist is running, recent activity, needs attention.

### States
- **Loading skeleton**
- **First run card:** “AI Receptionist” + Start setup → `/mctb/voice-agent`
- **Active operational mode**

### Active mode — blocks
1. **AI Receptionist status card**
   - Publication status pill (Active / Draft / Needs attention / Setup required)
   - Receptionist name, voice label
   - “Published configuration is active” (when active)
   - Link: Manage receptionist →
   - Rows: Phone | Calendar | Business knowledge | Business hours
2. **Needs attention** (list of items + “Review →” links) — when items exist
3. **Metrics strip** (period label, default “Last 7 days”)
   - Stat: Calls
   - Stat: Appointments booked
   - Stat: Callbacks requested
   - Link: View analytics →
4. **Recent calls table**
   - Columns: Caller | Time | Duration | Outcome | Attention | (chevron)
   - Link: View all calls →
   - Row links → `/voice/calls/:id`
5. **Dependencies / setup health** (footer cards when API returns dependency rows)

---

## 2. AI Receptionist — Calls (`/voice/calls`)

**Component:** inline page (`src/app/(app)/voice/calls/page.tsx`)

### Page chrome
- **H1:** Calls
- **Subtitle:** Track and manage calls handled by the AI receptionist.

### Blocks
1. **CallsMetrics** — answered, leads, appointments, talk time (+ change % when available)
2. **Search** — “Search calls…”
3. **Period** select — Today | Last 7 days | Last 30 days (hidden when “Needs attention” tab active)

### Top tabs (not sidebar)
- **All calls**
- **Needs attention** — embeds `NeedsAttentionView` (voice-only)

### Outcome filter tabs (All calls mode)
- All Calls | Leads | Appointments | Messages | Transfers | Voicemails | No Answer

### Table
- Columns: Caller | Date | Duration | Outcome | Attention | Recording indicator
- Pagination controls
- Row link → `/voice/calls/:id`

### Call detail (`/voice/calls/:id`) — opened from list, not in sidebar
- **H1:** Caller identity
- Header actions (contextual): links to conversation, etc.
- **What happened**
- **Still needs follow-up** (when applicable)
- **Summary**
- **Information collected**
- **Knowledge gaps** (when applicable)
- **Recording** (audio)
- **Transcript**
- **Call Data** (metadata)
- **Activity Feed**

---

## 3. AI Receptionist — Receptionist (`/voice/receptionist`)

**Component:** `VoiceReceptionistHub` (`src/components/voice/voice-receptionist-hub.tsx`)

### Page chrome
- **H1:** Receptionist
- **Actions:** Start setup / Continue setup | Open setup editor

### Status table
- Publish status
- Receptionist name
- Greeting (opening line)
- Capabilities list

**Note:** Full editor lives at `/mctb/voice-agent` / voice agent routes; this hub is a summary surface.

---

## 4. AI Receptionist — Business Knowledge (`/voice/knowledge`)

**Component:** `BusinessKnowledgeEditor` (`src/components/voice/knowledge/business-knowledge-editor.tsx`)

### Page chrome
- **H1:** Business Knowledge

### Sections
1. **Needs your review** (when gaps exist)
2. **Core business information** — name, description, services, etc.
3. **Business hours & timezone**
4. **Website** — URL, crawl/import controls
5. **FAQs & approved answers**
6. **Knowledge sources** — documents, imports, source list with actions

**Sub-nav:** May show `VoiceSubNav` contextual tabs when path matches voice section map (`src/components/voice/voice-nav.ts`).

---

## 5. AI Receptionist — Call Handling (`/voice/call-handling`)

**Component:** `CallHandlingOperationalPage` (`src/components/voice/call-handling-operational-page.tsx`)

### Page chrome
- **H1:** Call Handling (via PageHeader)

### Sections
1. **Current behavior** — who answers now (human vs AI), effective handler summary
2. **Transfers** — waterfall / transfer targets
3. **Business hours & after hours**
4. **On-call**
5. **Emergency & urgent calls**
6. **Transfer notifications**
7. **Caller protection** (spam/solicitor)
8. **Call recording**
9. **Recent transfers** (table when data exists)

**Related:** `/voice/inbound-routing` may redirect or overlap legacy routing; sidebar label is Call Handling.

---

## 6. AI Receptionist — Analytics (`/voice/analytics`)

**Component:** `VoiceAnalyticsDashboard` (`src/components/voice/voice-analytics-dashboard.tsx`)

### Page chrome
- **H1:** Analytics
- **Date range buttons:** 7 days | 30 days | 90 days
- **VoiceSubNav** (section tabs when applicable)

### KPI strip (6 cards)
- Calls | Appointments booked | Transfers answered | Callbacks requested | Avg. duration | Voicemail

### Sections
1. **Knowledge gaps banner** (link to Business Knowledge) — when open gaps > 0
2. **Call volume over time** (chart)
3. **Call outcomes** (non-exclusive outcome counts)
4. **Receptionist performance** — Median response time | Transfers failed | Voicemail (inbound)
5. **Caller sentiment** — Positive | Neutral | Negative | Unknown (only when ≥10 analyzed calls)
6. **Usage** — AI minutes | Phone minutes | link to billing
7. **Advanced** (collapsible) — response latency p95

---

## 7. MCTB — Overview (`/mctb`)

**Component:** `MctbOverviewView` (`src/components/mctb/overview-view.tsx`)

### Page chrome
- **H1:** Overview + status chip (Active | Paused | Needs attention | Setup incomplete)
- **Header CTA** (state-dependent): Finish setup | Resume now | Fix messaging | Manage setup
- **Setup incomplete banner** + Continue setup link

### Blocks (layout varies with `MCTB_LAUNCH_COMPACT_OVERVIEW`)
1. **Call Handling dashboard card** (non-compact only) — `CallHandlingDashboardCard`
2. **KPI strip** (4 tiles)
   - Missed calls | Recovery texts sent | Customer replies | Needs reply
3. **AI Recovery summary** — On/Off, policies, Manage link (or one-line compact)
4. **Needs attention** OR **“Nothing needs attention”** strip
5. **Recent missed calls** table — Caller | Missed | Recovery | Reply | View all
6. **Recent conversations** list + Open inbox
7. **Recent activity** (compact layout)
8. **Setup status** rows — Business line | Forwarding | Sender | Consent mode | Recovery pause | etc.

### States
- Loading skeleton | Error + Retry

---

## 8. MCTB — Missed Calls (`/mctb/missed-calls`)

**Component:** `MissedCallsView` (`src/components/mctb/missed-calls-view.tsx`)

### Page chrome
- **H1:** Missed Calls
- **Action:** Manage setup → `/mctb/setup`

### Summary metrics (4)
- Missed calls | Recovery texts | Replies | Needs reply (links to inbox filter)

### Toolbar / filters
- Search caller or number
- **Recovery outcome:** All | Needs attention | Replied | Waiting for consent | Suppressed | Failed
- **Date:** Today | Last 7 days | Last 30 days | All time
- **Trigger:** All | No answer | Busy | Rejected | Unreachable | Voicemail
- **Sort:** Newest first | Oldest first
- Filters panel (mobile sheet / desktop popover)
- Clear filters

### Table columns
- Caller (row link → detail) | Missed | Trigger | Recovery | Reply | Business line | Actions menu
  - Actions: Open | Call back | Open conversation (when exists) | More

### Pagination footer

### Missed Call Detail (`/mctb/missed-calls/:id`) — not in sidebar
- Back link to list (preserves return query)
- **Header:** caller + status + dominant action
- **Recovery lifecycle** (ordered steps: Call → Consent → Compliance text → Recovery text → Reply)
- **Call details**
- **Consent** panel
- **Text-back** panel
- **Voicemail** panel (when applicable)
- **Conversation** panel + Open conversation
- **Call customer**
- **Link activity**
- **Request form**
- **Diagnostics** (collapsed `<details>`)

---

## 9. MCTB — Inbox (`/mctb/conversations`)

**Component:** `KimiConversationsConnected` with `product=mctb` (`src/components/inbox/kimi-conversations-connected.tsx`)

### Layout (master–detail)
1. **Product filter bar** — `InboxProductFilters` (MCTB context on this route)
2. **Conversation list** (left)
   - Sidebar filter buckets (URL-driven): All | Mine | Unassigned | Closed | Snoozed | Spam | Tags | Teammates | **needs_reply** via query
   - Search
   - Bulk select / actions when checked
3. **Thread pane** (center) — message history, delivery states, compliance vs recovery bubbles
4. **Context panel** (right, when enabled) — contact / missed-call context

### Composer
- Reply field, send, eligibility gates (opt-out, sender, permissions)
- Draft preserved on recoverable errors

### URL parameters (common)
- `conversation=` deep link
- `filter=needs_reply` | `replied` | status filters
- `product=mctb` (forced server-side on this route)

---

## 10. MCTB — AI Recovery (`/mctb/ai-recovery`)

**Component:** `AiRecoverySettingsPage` (`src/components/mctb/ai-recovery/ai-recovery-settings-page.tsx`)

### Page chrome
- **H1:** AI Recovery
- **Save changes** + Saved indicator
- Alerts: messaging not ready | save errors

### Sections
1. **AI Recovery** — master enable switch + sender explanation + links to Inbox / Missed Calls
2. **Business information** — read-only card (name, services, service area, hours) + Edit business information
3. **Information to collect** — toggles:
   - Name | What they need | Service location | Urgency | Best time to call back
4. **Booking link** (when booking config available)
   - Enable booking link
   - Select existing link OR enter new URL + label

---

## 11. MCTB — Voicemail (`/mctb/voicemail`)

**Component:** `MctbVoicemailView` (`src/components/mctb/mctb-voicemail-view.tsx`)

### Page chrome
- **H1:** Voicemail
- **Action:** Voicemail settings → `/mctb/setup/voicemail`

### Master–detail
**List pane**
- Search voicemail
- Rows: caller | New pill | summary/transcript snippet | time · duration

**Detail pane** (selected message)
- Caller header + Call back | Open conversation
- **Original recording** (HTML audio)
- **AI summary** (labeled derived)
- **Transcript** or pending message

### Empty / error states
- No voicemails + Configure voicemail CTA
- Load error + Retry

---

## 12. MCTB — Analytics (`/mctb/analytics`)

**Component:** `MctbAnalyticsView` (`src/components/mctb/analytics/mctb-analytics-view.tsx`)

### Page chrome
- **H1:** Analytics
- **Range toggles:** 7 days | 30 days | 90 days

### KPI cards (4, linkable)
- Missed calls | Recovery texts sent | Customers replied | Reply rate

### Sections
1. **Recovery funnel** — Missed calls → Eligible → Recovery texts sent → Customer replies (with % notes)
2. **Charts:** Missed calls over time | Recovery texts over time | Replies over time
3. **Outcomes & delivery** — Delivery failures | Booking links sent | Callback requests | AI-assisted conversations | Tracking link clicks | Opt-outs (suppressed)
4. **Definitions** — Eligible | Recovery texts sent | Customer replies | Reply rate
5. **Why some callers weren't texted** — suppression reason table (Reason | Count | %)
6. **Voicemail** — count + Open voicemail →

---

## 13. MCTB — Setup (`/mctb/setup` and sub-routes)

**Shared chrome:** `MctbSetupShell` + **horizontal section tabs** (10 tabs listed at top of this doc).

### 13a. Setup — Overview (`/mctb/setup`)

**Component:** `MctbSetupOverviewView`

- **H1:** Setup
- **Meta:** Last successful test timestamp (when set)
- **Action:** Run live test → `/mctb/setup/test`
- **Status rail:** Recovery Active/Paused/Inactive | Business line | Text-back sender | Forwarding | Last test
- **Pause control** (`MctbSetupPauseControl`) — pause/resume recovery
- **Health strip:** Setup healthy / Needs attention + “X of Y core systems ready”
- **Attention rows** with fix links (expand “View N issues”)
- **Setup flow strip** (non-compact) — stages across phone → consent → recovery → voicemail
- **Call flow group** — summary rows (each links to section):
  - Phone & Forwarding | Consent | Text Back | Recovery | Voicemail
- **Operations group:**
  - Notifications | Exclusions | Links | Test
- **Recent system activity** timeline (non-compact)
- **Quick actions** panel (non-compact)

### 13b. Phone & Forwarding (`/mctb/setup/phone`)

**Component:** `setup-phone-forwarding-view.tsx`

Modules (H3 headings):
- Business line (public number)
- Forwarding destination (ingress)
- Carrier selection
- Forwarding setup method / instructions
- Ring timing (seconds before forward)
- Verification (“I've turned it on”, test call evidence)
- Drawer: carrier walkthrough / instruction steps

Also covers **text-back sender** context on this page per section description.

### 13c. Consent (`/mctb/setup/consent`)

**Component:** `setup-consent-view.tsx`

- Mode choice: **Press 1** vs **Use permission my business already has**
- Press-1: disclosure preview, publish, audio preview
- Existing consent: attestation checkbox (not prechecked)
- Links to compliance / consent history where implemented

### 13d. Text Back (`/mctb/setup/text-back`)

**Component:** `setup-text-back-view.tsx`

- Consent mode context (read-only link to Consent)
- Sender readiness strip
- **Press-1:** locked system compliance message preview + editable conversation opener
- **Existing consent:** recovery opener only
- Segment / character preview when shown
- Variables / link insertion (when supported)

### 13e. Recovery (`/mctb/setup/recovery`)

**Component:** `setup-recovery-view.tsx`

- **Recovery** — missed-call trigger checkboxes (no answer, busy, unreachable, etc.)
- **Pause recovery** — presets, timed pause, indefinite, resume
- **Recovery delay** — initial delay before text
- Cooldown / max automated messages (follow-up rules)

Legacy routes redirect here: `/mctb/setup/business-hours`, `/mctb/setup/follow-up`, `/mctb/setup/missed-call-rules` (rules merged into recovery in UI).

### 13f. Voicemail setup (`/mctb/setup/voicemail`)

- Greeting source: TTS | ElevenLabs | Record | Upload
- Preview / activate greeting
- Behavior after voicemail (text-back trigger when supported)
- Transcription toggle

### 13g. Notifications (`/mctb/setup/notifications`)

**Component:** `setup-notifications-view.tsx`

- Team recipients list
- Per-recipient email / mobile
- Event channel matrix (email/SMS per event type)
- Add / edit / remove recipients

### 13h. Exclusions (`/mctb/setup/exclusions`)

**Component:** `setup-exclusions-view.tsx`

- Do-not-text list table
- Add number modal
- How exclusions work (help section)
- Remove confirmation modal

### 13i. Links (`/mctb/setup/links`)

**Component:** `setup-links-view.tsx`

- **H2:** Links & request form
- Booking / tracking links
- Public request form toggle and URL
- Default link for recovery messages

### 13j. Test (`/mctb/setup/test`)

**Component:** `setup-test-view.tsx`

- **Setup test checkpoints** (readiness checklist)
- **Live forward test** — call business line, verify evidence
- Links to fix failing sections

### Wizard (`/mctb/setup/start`)

Guided first-time flow (same backend as editors): Phone → missed-call rules → Consent → Text Back → Voicemail → Test — uses `wizard-step-shell` per step.

---

## 14. Shared — Integrations (`/integrations`)

**Server page:** `src/app/(app)/integrations/page.tsx` + `IntegrationsHomeClient`

### Page chrome
- **H1:** Integrations
- **Action:** Manage API keys

### Top tabs (horizontal — **more tabs on this page**)
| Tab | Route |
|-----|-------|
| Directory | `/integrations` |
| Calendars | `/integrations?provider=calendar` |
| Payments | `/integrations?provider=stripe` |
| Connect apps | `/integrations/native` |
| CRM | `/integrations/crm` |
| API | `/integrations/api` |
| Webhooks | `/integrations/webhooks` |
| Developer logs | `/integrations/logs` |

### Summary cards (home)
- Connected connectors count
- API keys / webhooks / Stripe status cards (grid)

**Child routes** (reachable from tabs, not all in MCTB sidebar): native apps, CRM providers, calendar/payment focused pages, webhook editor, API key management, integration logs.

---

## 15. Shared — Numbers (`/voice/numbers`)

**MCTB numbers route:** `/mctb/numbers` uses `MctbNumbersView`; sidebar href is `/voice/numbers` (verify which route your workspace resolves — both exist).

### Page chrome
- **H1:** Numbers
- **Actions:** Add number | Refresh list

### Table columns
- Number | Label | Type | Messaging status | Line status

Empty state → Add your first business number.

**Buy flow:** `/numbers/buy` or `/voice/numbers/buy`.

---

## 16. Shared — Billing (`/settings/billing`)

**Component:** Kimi billing settings (`src/features/settings/kimi/billing/` or `settings/kimi-ui/billing`)

Typical blocks (billing product UI):
- Current plan / subscription status
- Usage summary (SMS, voice, credits)
- Payment method
- Invoices / billing history links
- Upgrade / manage subscription actions

---

## 17. Shared — Settings (`/settings` → `/settings/business`)

**Index:** redirects to **Business** (`src/app/(app)/settings/page.tsx`).

### Business (`/settings/business`) — `BusinessSettingsConnected`
- **H1:** Business settings
- **Save changes**
- **Settings tabs** (horizontal within settings chrome): Business | Team | Messaging | Calendar | Meetings | Security | Billing (per `SettingsTabs` / appointments nav children)
- Cards:
  - Booking enabled toggle
  - Business profile (name, email, phone, address, website, timezone)
  - Public legal (terms, privacy, SMS consent text/version)
  - Suspicious bookings (when shown)
  - Messaging registration / A2P brand & campaign status

### Other settings routes (reachable from settings tabs or direct URL — not all in MCTB sidebar)
| Route | Purpose |
|-------|---------|
| `/settings/users` | Team |
| `/settings/messaging` | Messaging & compliance |
| `/settings/calendar` | Calendar preferences |
| `/settings/ai-notetaker` | Meetings / notetaker |
| `/settings/security` | Security |
| `/settings/billing` | Billing (also top-level sidebar) |
| `/settings/notifications` | Notification preferences |
| `/settings/integrations` | Settings-scoped integrations |
| `/settings/branding`, `/settings/payments`, `/settings/data`, etc. | Additional admin |

---

## Appendix A — Mobile bottom nav (MCTB)

From `buildMctbV1MobileNav()`:
- Home (`/mctb`) | Missed | Inbox | Calls (if voice) | Setup

---

## Appendix B — Appointments product sidebar (when selected in product switcher)

Source: `buildAppointmentsV1Nav()` — **many items have nested children (flyout/submenu).**

| Top label | Default href | Child items (submenu) |
|-----------|--------------|------------------------|
| Home | `/appointments/overview` | — |
| Booking | `/appointments/services` | Meetings, Services, Classes, Workshops, Booking Pages, Share & embed, Packages*, Memberships*, Pricing & Payments*, Forms & Documents*, Contact merge*, Point of Sale*, Segments, Routing forms, Team Booking, Team pages, Meeting Polls, AI Booking |
| Calendar | `/appointments/calendar` | Calendar, Appointments, Clients, Waitlist, Recalls |
| Availability | `/appointments/availability` | Schedules, Routing, Locations, Resources |
| Clients | `/appointments/clients` | — |
| Messages | `/conversations` | Inbox, Campaigns |
| Reminders | `/appointments/reminders` | Reminder Sequences, Templates, Activity |
| Workflows* | `/appointments/workflows` | Workflows |
| Meetings* | `/video` | Upcoming, Recaps |
| Payments* | `/payments` | Payment requests, Transactions, Invoices |
| Analytics* | `/appointments/analytics` | Overview, Booking, Reminders, Automations, Reports, Service booking |
| Integrations | `/integrations?provider=calendar` | Calendars, Payments |
| Settings | `/settings/business` | Business, Team, Messaging, Calendar, Meetings, Security, Billing |
| Help | `/getting-started` | — |

\*Modules gated by `SchedulingModuleFlags` (workflows, meetings, commerce, etc.).

---

## Appendix C — How to refresh this inventory

```bash
# Route-level JSON (pages + APIs, not UI boxes):
npx tsx scripts/generate-appointments-mctb-inventory.ts

# Nav definitions:
#   src/lib/products/mctb-nav.ts
#   src/lib/products/appointments-nav.ts
#   src/lib/mctb/setup-sections.ts
```

For UI box-level updates, re-audit the `*View` / `*Dashboard` / `page.tsx` components referenced in each section above.

---

## Document limits

This inventory reflects **customer-facing UI blocks** in code as of the generation date. It does not list every modal, toast, or admin-only route. Hidden launch nav products (Campaigns, Smart Routing, etc.) are omitted unless they appear in the menus above.
