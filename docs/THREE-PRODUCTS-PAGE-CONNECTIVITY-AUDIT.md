# Three products — page & tab connectivity audit

> **Reviews + user-journey audit:** see `docs/FOUR-PRODUCTS-USER-JOURNEY-E2E-AUDIT.md` (MCTB, AR, Campaigns, Reviews — start-to-finish PASS/FAIL).

**Products:** Missed Call Text Back (MCTB) · Appointment Reminders (AR) · Campaigns (Mass Texting)  
**Environment:** Production `https://transovo.ai`  
**Smoke run:** 2026-10-14 (Playwright, cert browser account via `scripts/browser-cert/lib`)  
**Machine JSON:** `/opt/cursor/artifacts/three-products-route-audit.json`  
**Re-run:** `UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts`

---

## How to read this audit

| Column / term | Meaning |
|---------------|---------|
| **Page load** | Logged-in user can open the route; HTTP 200; no obvious error copy on screen. |
| **Wired** | UI calls real app APIs / server loaders (not mock-only shell). |
| **Runtime** | Actual SMS, voice, calendar sync, or campaign send — **not fully proven** by this pass (no live PSTN/SMS send). |
| **Prod smoke** | Result from automated route visit on transovo.ai. |

**Not in scope:** Unified **Inbox** (`/conversations`), **Contacts**, **Overview**, **Integrations**, **Settings** — except where they are the backend for a product tab (e.g. MCTB conversations).

**Console noise:** Every route logged `A bad HTTP response code (404) was received when fetching the script` (likely a non-critical asset/service-worker chunk). Treat separately from API failures below.

---

## Executive summary

| Product | Service tabs (nav) | Page load (prod) | Known broken on prod (this run) | Runtime send (code exists) |
|---------|-------------------|------------------|----------------------------------|----------------------------|
| **MCTB** | 6 tabs + inbox surfaces | **All checked routes OK** | None detected in smoke | **Yes** — TeXML voice + MCTB SMS jobs (needs forwarding, sender, consent, entitlement) |
| **Appointment Reminders** | 6 tabs | **10/14 routes OK** | **Sequences**, **Settings**, **Templates** (API 500); **AI Rescheduler** (500 + error UI) | **Yes** — reminder engine + `appointment_reminders` queue (needs AR entitlement, calendar, sender) |
| **Campaigns** | 6 tabs + create flow | **All checked routes OK** | None on load; **recurring broadcast** blocked in API if enabled | **Yes** — `/api/mass-texting/campaigns` + worker (needs `mass_texting`, A2P, credits) |

---

# 1. Missed Call Text Back (MCTB)

**Nav source:** `src/lib/products/business-messaging-nav.ts` → `MCTB_SERVICE_TABS`  
**Routes:** `src/lib/mctb/routes.ts`  
**UI:** Opus / Stage 2 under `src/newui-transplant/connected/mctb/` when `isNewUiStage2Enabled()` (production uses this for launch IA pages).

### 1.1 Service tabs (primary product chrome)

| Tab | Route | Page module | Primary APIs / data | Prod smoke | Notes |
|-----|-------|-------------|---------------------|------------|-------|
| **Activity** | `/mctb` | `mctb/page.tsx` → `overview-page.tsx` | `loadMctbOverviewCore`, `/api/mctb/setup`, overview metrics | **LOAD_OK** | Operational snapshot; links into ops surfaces. |
| **Recovery Rules** | `/mctb/missed-call-recovery` | `missed-call-recovery/page.tsx` → `mctb-ia-pages` | `/api/mctb/setup` (save rules, consent, exclusions, recovery) via `mctb-setup-client` | **LOAD_OK** | Replaces legacy `/mctb/setup/recovery` in IA. |
| **Text Back** | `/mctb/text-back` | `text-back/page.tsx` → IA text-back editor | `/api/mctb/setup` (templates, opener) | **LOAD_OK** | Press-1 + existing consent modes in runtime. |
| **AI Recovery** | `/mctb/ai-recovery` | `ai-recovery/page.tsx` | `/api/mctb/ai-recovery/*` settings & context | **LOAD_OK** | Inbound SMS agent path separate from first recovery text. |
| **Phone Setup** | `/mctb/phone` | `phone/page.tsx` → forwarding / sender | `/api/mctb/setup`, forwarding verify, `/api/mctb/live-test` | **LOAD_OK** | Business line vs ingress vs text-back sender roles. |
| **Analytics** | `/mctb/analytics` | `analytics-page.tsx` | `GET /api/mctb/analytics?range=` | **LOAD_OK** | Funnel metrics; drilldowns to missed calls / conversations. |

### 1.2 Inbox-linked MCTB surfaces (unified Inbox tabs)

| Surface | Route | Wired to | Prod smoke |
|---------|-------|----------|------------|
| Missed Calls | `/mctb/missed-calls` | `GET /api/mctb/missed-calls`, detail `/api/mctb/missed-calls/:id` | **LOAD_OK** |
| Voicemail | `/mctb/voicemail` | Voicemail APIs + `/api/phone/voicemail` (greeting setup) | **LOAD_OK** |
| Conversations | `/mctb/conversations` | Shared inbox engine, MCTB filter; `PATCH` reply, `/api/sms/send` for compose | **LOAD_OK** |
| Held replies (AR) | `/appointment-reminders/responses?view=held` | AR responses API (see AR section) | **LOAD_OK** |

### 1.3 Other MCTB routes (not service tabs)

| Route | Behavior | Prod smoke |
|-------|----------|------------|
| `/mctb/notifications` | Handoff notifications config → `/api/mctb/handoff` | **LOAD_OK** |
| `/mctb/compliance/consent` | Consent log / audit | **LOAD_OK** |
| `/mctb/missed-calls/[id]` | Detail timeline (not hit in batch smoke) | — |
| `/mctb/setup/*` | Legacy setup URLs; many **redirect** to IA routes (`resolveMctbSetupIaRedirect`) | `/mctb/setup` **LOAD_OK** |
| `/mctb/numbers` | Server redirect to `/mctb/phone?open=manage` (smoke may land before redirect) | **LOAD_OK** |
| `/mctb/setup/start` | Redirect → `/mctb` | — |
| `/mctb/ai-lead-recovery` | Redirect → `/mctb/ai-recovery` | — |
| `/mctb/calendar`, `/mctb/appointments/*`, `/mctb/booking/*` | Cross-product scheduling shells in MCTB namespace | Not smoke-tested this run |
| `/onboarding/mctb` | First-run wizard | Not smoke-tested this run |

### 1.4 MCTB — what works vs what this audit did not prove

**Connected (code + prod page load):**

- Configuration persists through **`/api/mctb/setup`** (`saveMctbSetup` / `fetchMctbSetup`).
- Operational lists and detail use **`/api/mctb/missed-calls`** and related MCTB APIs.
- Conversations reuse **inbox** APIs with MCTB product context.
- Live test entry points: **`/api/mctb/live-test`**, **`/api/mctb/setup-test`**.

**Not proven in this audit:**

- PSTN missed call → press-1 / existing-consent → outbound recovery SMS (requires live call + production telephony cert).
- A2P / sender approval states for a arbitrary new workspace.
- V1 production certification sign-off (`docs/V1-PRODUCTION-CERTIFICATION.md` still lists MCTB live checks as human).

---

# 2. Appointment Reminders (AR)

**Nav source:** `AR_SERVICE_TABS` in `business-messaging-nav.ts`  
**Routes:** `src/lib/appointment-reminders/routes.ts`  
**UI:** `src/newui-transplant/connected/appointment-reminders/*`

### 2.1 Service tabs

| Tab | Route | Page module | Primary APIs | Prod smoke | Notes |
|-----|-------|-------------|--------------|------------|-------|
| **Calendar** | `/appointment-reminders` | `ar-calendar-workspace-page.tsx` | `/api/appointment-reminders/overview`, `/api/appointment-reminders/calendar/events`, `/api/integrations/calendars`, sync | **LOAD_OK** | Default query `view=agenda&date=…` added client-side. |
| **Appointments** | `/appointment-reminders/appointments` | `appointments-page.tsx` | `/api/appointment-reminders/appointments` | **LOAD_OK** | List + detail drawer. |
| **Reminders** | `/appointment-reminders/reminders` | Reminders log page | Reminder delivery / log APIs | **LOAD_OK** | Operational send history. |
| **Sequences** | `/appointment-reminders/reminders/sequences` | `ar-reminders-sequences-page.tsx` | **`GET /api/appointment-reminders/reminders/workspace`** (+ test preview endpoints) | **API_FAIL** | **500** on workspace + `reminders/test?step=*` — page shell loads but data panel broken on cert tenant. |
| **AI Rescheduler** | `/appointment-reminders/ai-rescheduler` | `ar-ai-rescheduler-opus.tsx` | **`/api/appointment-reminders/ai-rescheduler/operations`** | **ERROR_UI** | **500** on operations; error copy detected on page. |
| **Analytics** | `/appointment-reminders/analytics` | AR analytics | AR analytics APIs | **LOAD_OK** | |

### 2.2 Adjacent AR routes (not top service tabs)

| Route | Purpose | Prod smoke |
|-------|---------|------------|
| `/appointment-reminders/responses` | Customer SMS responses | **LOAD_OK** |
| `/appointment-reminders/responses?view=held` | Held / needs-review queue | **LOAD_OK** |
| `/appointment-reminders/settings` | Plan, scheduling, integrations tabs | **API_FAIL** (same **500** family as sequences workspace API) |
| `/appointment-reminders/calendars` | Calendar connection management | **LOAD_OK** |
| `/appointment-reminders/reminders/templates` | Template library UI | **API_FAIL** (workspace API **500**) |
| `/appointment-reminders/setup/connect` | OAuth / connect step | **LOAD_OK** |
| `/appointment-reminders/setup/configure`, `/setup/activate` | Setup wizard | Not smoke-tested |
| `/appointment-reminders/pricing` | Plans | **LOAD_OK** |
| `/appointment-reminders/booking/*` | Hidden from unified nav when `appointmentRemindersHideBookingNav` | Not smoke-tested |
| `/appointment-reminders/reminders/sequences/[stepKey]/edit` | Sequence step editor | Not smoke-tested |

### 2.3 AR — runtime (reminder SMS)

**Wired in code:**

- Discovery + dispatch: `src/lib/appointment-reminders/reminder-discovery.ts`, jobs on **`appointment_reminders`** queue.
- Customer SMS: `src/lib/appointment-reminders/messaging/send-customer-sms-job` (and related sender pool).
- Settings / sequences UI depends on **`loadArReminderWorkspacePanel`** (`/api/appointment-reminders/reminders/workspace`).

**Broken on production (cert account, this run):**

- **`/api/appointment-reminders/reminders/workspace` → 500** breaks **Sequences**, **Settings** (scheduling tab), and **Reminder templates** previews.
- **`/api/appointment-reminders/ai-rescheduler/operations` → 500** breaks **AI Rescheduler** UI.

**Not proven:** Live reminder SMS to a real phone on a future appointment for this tenant (see `docs/AR-LAUNCH-READINESS-NOW.md`).

---

# 3. Campaigns (Mass Texting)

**Nav source:** `CAMPAIGNS_SERVICE_TABS`  
**UI:** Opus — `CampaignsConnectedOpus`, `kimi-campaigns-adapter.ts` → **`/api/mass-texting/campaigns/**`**

### 3.1 Service tabs

| Tab | Route | Page | Data source | Prod smoke |
|-----|-------|------|-------------|------------|
| **All Campaigns** | `/campaigns` | SSR `listBroadcastCampaigns` + `CampaignsConnectedOpus` | `/api/mass-texting/campaigns` | **LOAD_OK** |
| **Drafts** | `/campaigns/drafts` | `CampaignsFilteredPage` `fetchStatus=draft` | Same API, filtered | **LOAD_OK** |
| **Scheduled** | `/campaigns/scheduled` | Filter scheduled | Same | **LOAD_OK** |
| **Completed** | `/campaigns/completed` | Filter completed | Same | **LOAD_OK** |
| **Templates** | `/templates` | Legacy template list (not full Opus) | Template APIs | **LOAD_OK** |
| **Analytics** | `/sms/analytics` | `SmsAnalyticsView` in `CampaignsOpusShell` | SMS / campaign metrics APIs | **LOAD_OK** |

### 3.2 Additional campaign routes (filters / flow)

| Route | Purpose | Prod smoke |
|-------|---------|------------|
| `/campaigns/all`, `/sending`, `/paused`, `/failed`, `/canceled`, `/recurring` | Status filters | **LOAD_OK** |
| `/campaigns/calendar` | Send calendar view | **LOAD_OK** |
| `/campaigns/new` | Compose (Opus) | **LOAD_OK** |
| `/campaigns/new/review` | Launch review (`fetchLaunchReview`) | **LOAD_OK** (empty state if no draft id) |
| `/campaigns/new/queue`, `/success` | Launch countdown / confirmation | Not smoke-tested (need campaign id) |
| `/campaigns/[campaignId]` | Results / stats | Not smoke-tested |
| `/campaigns/new/[category]` | Playbook / sequence (`POST /api/campaigns`) | Not smoke-tested |
| `/templates/new`, `/templates/ai` | Template create / AI | `/templates/new` **LOAD_OK** |

### 3.3 Campaigns — connected vs gated

**Connected:**

- Draft save, audience preview, launch review, launch → **`launchCampaignWithAudit`** → worker **`campaign-processor`** → Telnyx SMS path.
- Test message modal → **`POST /api/sms/send`**.

**Gates (runtime may block despite UI load):**

- **`requireMassTextingWorkspace`** — APIs 403 without `mass_texting` entitlement (sidebar may still show **Activate** badge).
- **A2P** — `assertMassTextMarketingSendAllowed` at launch/send.
- **Credits** — segment reservation at launch.
- **Recurring** — `MASS_TEXT_RECURRING_PRODUCTION_ENABLED` must be on or save/launch throws.

**Not proven in this audit:** Full compose → review → launch → delivered SMS on production for cert workspace.

---

# 4. Cross-product comparison

| Concern | MCTB | AR | Campaigns |
|---------|------|-----|-----------|
| Product entitlement flag | MCTB / voice product access | `appointment_reminders` / AR plan | `mass_texting` |
| Primary send pipeline | Voice TeXML + MCTB SMS jobs | Reminder dispatch jobs | Mass-texting campaign worker |
| Worst prod smoke this run | None | Sequences / settings / templates API **500**; AI rescheduler **ERROR_UI** | None on load |
| Dedicated “review requests” product | No (out of MCTB scope) | Optional workflow template only | Playbook category `review` only |

---

# 5. Recommended follow-ups

1. **AR:** Debug **`loadArReminderWorkspacePanel`** failures causing **`/api/appointment-reminders/reminders/workspace` 500** on production (blocks Sequences + Settings + Templates).
2. **AR:** Debug **`/api/appointment-reminders/ai-rescheduler/operations` 500**.
3. **All three:** Run **interactive** cert (`scripts/mctb-production-browser-cert-exercise-all.ts`) for control-level saves on MCTB; AR golden-tenant live SMS runbook; campaigns launch on a test list with `mass_texting` entitled workspace.
4. Re-run route smoke after fixes: `npx tsx scripts/audit-three-products-production-routes.ts`.

---

# 6. Prod smoke matrix (quick reference)

| Product | Path | Verdict |
|---------|------|---------|
| MCTB | `/mctb` | LOAD_OK |
| MCTB | `/mctb/missed-call-recovery` | LOAD_OK |
| MCTB | `/mctb/text-back` | LOAD_OK |
| MCTB | `/mctb/ai-recovery` | LOAD_OK |
| MCTB | `/mctb/phone` | LOAD_OK |
| MCTB | `/mctb/analytics` | LOAD_OK |
| MCTB | `/mctb/missed-calls` | LOAD_OK |
| MCTB | `/mctb/conversations` | LOAD_OK |
| MCTB | `/mctb/voicemail` | LOAD_OK |
| MCTB | `/mctb/notifications` | LOAD_OK |
| MCTB | `/mctb/compliance/consent` | LOAD_OK |
| MCTB | `/mctb/setup` | LOAD_OK |
| MCTB | `/mctb/numbers` | LOAD_OK |
| AR | `/appointment-reminders` | LOAD_OK |
| AR | `/appointment-reminders/appointments` | LOAD_OK |
| AR | `/appointment-reminders/reminders` | LOAD_OK |
| AR | `/appointment-reminders/reminders/sequences` | **API_FAIL** |
| AR | `/appointment-reminders/ai-rescheduler` | **ERROR_UI** |
| AR | `/appointment-reminders/analytics` | LOAD_OK |
| AR | `/appointment-reminders/responses` | LOAD_OK |
| AR | `/appointment-reminders/responses?view=held` | LOAD_OK |
| AR | `/appointment-reminders/settings` | **API_FAIL** |
| AR | `/appointment-reminders/calendars` | LOAD_OK |
| AR | `/appointment-reminders/reminders/templates` | **API_FAIL** |
| AR | `/appointment-reminders/setup/connect` | LOAD_OK |
| AR | `/appointment-reminders/pricing` | LOAD_OK |
| Campaigns | `/campaigns` | LOAD_OK |
| Campaigns | `/campaigns/drafts` | LOAD_OK |
| Campaigns | `/campaigns/scheduled` | LOAD_OK |
| Campaigns | `/campaigns/completed` | LOAD_OK |
| Campaigns | `/templates` | LOAD_OK |
| Campaigns | `/sms/analytics` | LOAD_OK |
| Campaigns | `/campaigns/all` | LOAD_OK |
| Campaigns | `/campaigns/sending` | LOAD_OK |
| Campaigns | `/campaigns/paused` | LOAD_OK |
| Campaigns | `/campaigns/failed` | LOAD_OK |
| Campaigns | `/campaigns/canceled` | LOAD_OK |
| Campaigns | `/campaigns/recurring` | LOAD_OK |
| Campaigns | `/campaigns/calendar` | LOAD_OK |
| Campaigns | `/campaigns/new` | LOAD_OK |
| Campaigns | `/campaigns/new/review` | LOAD_OK |
| Campaigns | `/templates/new` | LOAD_OK |

---

*End of audit.*
