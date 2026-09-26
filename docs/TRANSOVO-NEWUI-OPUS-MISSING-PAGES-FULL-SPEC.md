# Opus — missing whole pages & surfaces: full content specification

**Purpose:** For every **net-new or unported whole page** (or full-page workflow) that Opus does not ship today, this document lists **everything that must appear on that page** — placement top→bottom, labels, controls, states, cross-links, and authoritative backend paths.

**Companion:** `docs/TRANSOVO-NEWUI-OPUS-VS-ORIGINAL-GAP-AUDIT.md` (gap summary).

**Opus today:** 26 manifest routes + Opus chrome; Stage 2 swaps page bodies via `isNewUiStage2Enabled()`.

**Authority for content:** Legacy production components cited below (not Opus mirror mock data). MCTB canonical specs apply where noted.

---

## Inventory — whole pages / workflows Opus does not ship

| # | Surface | Canonical route(s) | Reference implementation | Opus status |
|---|---------|-------------------|-------------------------|-------------|
| 1 | **AI Receptionist setup editor** | `/voice/receptionist` (editor mode) | `VoiceReceptionistEditor` | Summary only; editor bypassed when Stage 2 on |
| 2 | **MCTB Setup workspace chrome** | All `/mctb/setup/*` | `MctbSetupShell` + `MctbSetupSectionNav` | No shared layout/tabs on Opus setup |
| 3 | **Call routing / ingress ownership** | Block on `/voice/call-handling` | `VoiceIngressSetupPanel` | Missing on Opus call-handling |
| 4 | **MCTB first-time onboarding wizard** | `/onboarding/mctb` | `MctbOnboardingWizard` | Legacy only (minimal chrome) |
| 5 | **MCTB consent audit log** | `/mctb/compliance/consent` | `MctbConsentLogView` | Legacy only |
| 6 | **Buy / search phone numbers** | `/voice/numbers/buy` | `PremiumNumbersPageClient` | Legacy UI; Opus links here |
| 7 | **Integrations hub** | `/integrations` + tabs | `IntegrationsPage` + sub-routes | Legacy in Opus shell |
| 8 | **Settings (Opus nav subset)** | `/settings/business`, `/settings/team`, `/settings/billing` | Kimi/legacy settings | Legacy in Opus shell |

**Redirects (not separate Opus builds unless product re-opens):**

- `/voice/agents/*` → `/voice/receptionist`
- `/voice/setup` → `/mctb/setup`
- `/voice/needs-attention` → `/voice/calls?attention=open`
- `/voice/analytics/after-hours` → `/voice/analytics`
- `/mctb/voice-agent` → `/voice/agents` → `/voice/receptionist`
- `/voice/inbound-routing` → `/voice/call-handling`

---

# 1. AI Receptionist setup editor

## Route & placement

| Field | Value |
|-------|--------|
| **Canonical route** | `/voice/receptionist` when user chooses **Edit** / **Open setup editor** (today same URL must become editor or `/voice/receptionist/edit`) |
| **Page archetype** | Settings / builder (long-form editor with section nav + sticky save bar) |
| **Shell** | Opus app shell (sidebar: AI Receptionist → Receptionist) |
| **Reference** | `src/components/voice/receptionist/voice-receptionist-editor.tsx` |
| **Read APIs** | `GET /api/voice/agents` (primary agent id) → `GET /api/solutions/appointment-receptionist?agentId=`; `GET /api/integrations/calendars`; `GET /api/integrations/connections` |
| **Write APIs** | `POST /api/solutions/appointment-receptionist` (`create_draft`, grouped draft save via `persistReceptionistDraftGroups`); activate via `persistReceptionistActivate` |
| **Preview** | `POST /api/voice/tts-preview`; test panel uses `TestStep` + `onEnsureAgent` save-before-test |

## Page header (top)

| Element | Position | Content / behavior |
|---------|----------|-------------------|
| **H1** | Left | `Receptionist` |
| **Description** | Under H1 | `Configure how your AI receptionist speaks, collects information, and helps callers.` |
| **Status pill** | Header actions | One of: `Setup required` \| `Unsaved changes` \| `Draft saved — publish to go live` \| `Live` |
| **Test receptionist** | Header actions | Button toggles inline **Test** section (`TestStep`) |
| **Go live / Publish changes** | Header actions | Primary when draft or unpublished; disabled when live with no pending changes |
| **Live region** | Below header | Status message (save/publish feedback) |
| **Error banner** | Below header | Destructive alert on API/validation errors |
| **Draft notice** | When live + unsaved | `Live callers use your published configuration until you publish saved changes.` |

## Section navigation

| Viewport | Placement | Items (anchor links) |
|----------|-----------|----------------------|
| Desktop | Sticky left column `lg:w-48` | 1. Identity & Voice → `#identity-voice` |
| | | 2. Greeting & Conversation → `#greeting-conversation` |
| | | 3. Responsibilities → `#responsibilities` |
| | | 4. Caller Information → `#caller-information` |
| | | 5. Appointment Handling → `#appointment-handling` |
| | | 6. Messages & Callbacks → `#messages-callbacks` |
| Mobile | Horizontal chip links | Same six labels |

## Section 1 — Identity & voice (`#identity-voice`)

**Card:** bordered panel, H2 `Identity & voice`, helper `Name, role, and how Amy sounds on the phone.`

**Component:** `VoiceStep` with `parts={["identity", "voice"]}`, `showSidePanel={false}`.

**Fields & controls (from `voice-step.tsx`):**

| Control | Purpose |
|---------|---------|
| **Business / agent identity** | Business name, agent display name, role (wizard state: `businessName`, `agentName`, `role`, etc.) |
| **Voice picker grid** | Built-in voices (`WIZARD_VOICES` + backups); select sets `voiceId`, `voiceLabel`, `voiceSource`, `speakingSpeed` |
| **Preview clip** | Per-voice Play → `POST /api/voice/tts-preview` |
| **Speaking speed** | Numeric/slider tied to `speakingSpeed` |
| **Conversation behaviors** (when voice part shown) | `conversationBehaviors`: backchannel level, interruption style, pause patience, speaking pace, accent style (Live prompt controls) |
| **Custom OpenAI voice** | Only if `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1` |

## Section 2 — Greeting & conversation (`#greeting-conversation`)

**Component:** `VoiceStep` with `parts={["greeting"]}`.

| Control | Purpose |
|---------|---------|
| **Opening greeting textarea** | `openingGreeting` with `{{businessName}}`, `{{agentName}}` tokens |
| **Greeting preview** | Rendered sample using substituted tokens |
| **Side panel tips** | Hidden in receptionist editor (`showSidePanel={false}`) |

## Section 3 — Responsibilities (`#responsibilities`)

**Component:** `GoalsStep` — `compactCapabilities`, `hideSidePanel`, `hideSolutionName`.

**Capability toggles** (representative set from goals step; stored in `state.capabilities[]`):

| Capability id | User-facing intent |
|-----------------|-------------------|
| `answer_questions` | Answer business questions from knowledge |
| `book_appointments` | Book appointments on the call |
| `transfer_calls` | Transfer to team (depends on Call Handling) |
| `take_messages` | Take messages |
| `reschedule` / `cancel` | Appointment changes when enabled |
| (others per `GoalsStep` option list) | Hire-mode may restrict certain pairs |

**Dependency rows** (below capabilities, divided list):

| Row title | Detail source | Link |
|-----------|---------------|------|
| Business hours | `formatHoursSummary(state)` | `/voice/knowledge` — **Manage business hours** |
| Business knowledge | Knowledge enabled flag | `/voice/knowledge` — **Manage business knowledge** |
| Transfer calls | Transfer capability + `transferWizardValidationIssues` | `/voice/call-handling` — **Manage call handling** |

## Section 4 — Caller information (`#caller-information`)

**Component:** `ReceptionistCollectFieldsEditor`.

| Control | Purpose |
|---------|---------|
| **Qualify callers before booking** | Checkbox `qualificationEnabled` |
| **Collect fields list** | Per row: enable checkbox, editable label, required checkbox, reorder up/down, remove |
| **Add field** | Adds custom collect field to `collectFields[]` |
| **Appointment type context** | Uses `selectedAppointmentTypeId` / `appointmentTypes` where applicable |

## Section 5 — Appointment handling (`#appointment-handling`)

**Component:** `ReceptionistBookingHandlingSection` + calendar summary.

| Block | Controls |
|-------|----------|
| **Calendar connection** | Status from integrations; link **Connect calendar →** or **Manage integrations** → `/integrations` |
| **When someone wants an appointment** | Radio: `MICROSOFT_365` (book live), `REQUEST_ONLY`, `SEND_LINK`, `NONE` — updates `bookingStrategy` + `capabilities` |
| **Booking behavior** (when booking on) | Checkboxes: `askPreferredDayFirst`, `offerEarliestThree`, `confirmBeforeBooking`, `sendSmsAfterBooking` on `bookingBehavior` |

## Section 6 — Messages & callbacks (`#messages-callbacks`)

| Control | Purpose |
|---------|---------|
| **Take messages and callback requests** | Checkbox `callbackRequestsEnabled`; seeds `callbackRequiredCollectFieldIds` when enabled |
| **Callback required fields** | `CallbackRequiredFieldsEditor` when enabled |
| **Dependency row** | After-hours notifications → `/voice/call-handling` |

## Section 7 — Test (conditional, `#test`)

Shown when **Test receptionist** toggled.

| Content | `TestStep` — voice test / PSTN test hooks; `onEnsureAgent` saves draft before test |

## Sticky footer (fixed bottom)

| Left | Right actions |
|------|----------------|
| Context copy: unsaved / draft / live state | **Save draft** (disabled if no dirty groups); **Go live** / **Publish changes** |

**Dirty-group save model:** `computeDirtyGroups` — partial saves by ownership group via `persistReceptionistDraftGroups`.

## States required

| State | Behavior |
|-------|----------|
| Loading | `Loading receptionist…` until first `GET` completes |
| Hydrated empty | Default wizard preset `after_hours` |
| Error | Banner + retry via reload |
| Live + pending publication | Warning pill + publish CTA |
| Validation | Transfer issues surfaced when transfer capability on |

## Opus summary page (what exists today — not the editor)

Keep as **read-only** landing: agent initial, name, voice label, published pill, version, static capability cards, **Open setup editor** must route to editor spec above.

---

# 2. MCTB Setup workspace chrome (all setup section pages)

Not a standalone route — **wrap every Opus `/mctb/setup/*` page**.

## Reference

- Legacy: `MctbSetupShell` + `MctbSetupSectionNav` (`src/components/mctb/setup/`)
- Opus sandbox: `newui/app/(app)/mctb/setup/layout.tsx` — `PageHeader` + `LinkTabs`

## Layout structure (top → bottom)

| # | Region | Content |
|---|--------|---------|
| 1 | **Page header** | H1 `Setup`; optional meta e.g. last successful test timestamp; primary action **Run live test** → `/mctb/setup/test` |
| 2 | **Section tabs** | Horizontal `LinkTabs` — see table below |
| 3 | **Section body** | Child route content (Overview, Phone, etc.) |

## Section tabs (canonical order — `MCTB_SETUP_SECTIONS`)

| Label | Route | Description (tooltip) |
|-------|-------|------------------------|
| Overview | `/mctb/setup` | Setup status and section shortcuts |
| Phone & Forwarding | `/mctb/setup/phone` | Business line, forwarding, messaging sender |
| Consent | `/mctb/setup/consent` | How permission to text is established |
| Text Back | `/mctb/setup/text-back` | First recovery message and delivery timing |
| Recovery | `/mctb/setup/recovery` | Pause, triggers, cooldown, duplicate protection |
| Voicemail | `/mctb/setup/voicemail` | Greeting and behavior |
| Notifications | `/mctb/setup/notifications` | Team email/SMS for recovery events |
| Exclusions | `/mctb/setup/exclusions` | Numbers that should not receive recovery texts |
| Links | `/mctb/setup/links` | Request form and customer links |
| Test | `/mctb/setup/test` | Verify forwarding and recovery |

**Attention dots:** Optional `navAttention` Set on section ids when setup overview reports problems (legacy shell).

**Note:** Missed-call rules are **not** a separate tab; consolidated under **Recovery** (`/mctb/setup/missed-call-rules` redirects).

---

# 3. Call routing & ingress ownership (on Call Handling)

## Placement

**Top of `/voice/call-handling`**, above transfer behavior — **not** a separate route.

**Reference:** `VoiceIngressSetupPanel` in `src/components/voice/voice-ingress-setup-panel.tsx`.

## Card: Your number & call routing

| # | Block | Content |
|---|-------|---------|
| 1 | **H2** | `Your number & call routing` |
| 2 | **Explainer** | Distinguishes **who receives forwarded calls** vs **Amy transfer behavior** below |
| 3 | **Data grid** (2-col) | **Your business line** (E.164 formatted); **Transovo forwarding destination**; **Active product on this line** (AI Receptionist vs MCTB); **Forwarding setup status** (from API) |
| 4 | **How it works** | Ordered list: carrier forward → choose handler → configure transfers below; note carrier account performs forwarding |
| 5 | **Actions row** | `CallHandlingSwitcher` (card variant); link **Phone & recording in AI agent setup**; **MCTB forwarding instructions** → `/mctb/setup/phone`; **Advanced routing rules** → `/voice/inbound-routing` (today redirects to call-handling) |

## APIs

| Read | `GET /api/mctb/inbound-handling` (forwarding block); call-handling context from `useCallHandlingOptional()` |
| Write | Handler switch via existing call-handling / inbound-handling POST paths (not on layout GET) |

## Legacy call-handling page sections (Opus must eventually match)

Below ingress panel, full `CallHandlingOperationalPage` includes:

| Order | Section | Editor component |
|-------|---------|------------------|
| 1 | Transfer effective status | `TransferEffectiveStatusCard` |
| 2 | Current behavior summary | Grid + `TransferWaterfallPreview` |
| 3 | Transfers | `EmergencyTransferEditor` |
| 4 | Business hours & after hours | Summary lines + link to knowledge hours + `AfterHoursBehaviorEditor` |
| 5 | On-call | `OnCallScheduleEditor` |
| 6 | Emergency & urgent | Urgency toggle + `UrgencyRulesEditor` |
| 7 | Transfer notifications | `AfterHoursNotificationsEditor` |
| 8 | Caller protection | `SpamUnwantedCallsEditor` |
| 9 | Call recording | `RecordingConfigCard` |
| 10 | Recent transfers | Table + refresh → `GET /api/voice/call-handling/recent-transfers` |

**Header actions (legacy):** Links to Receptionist, Advanced routing, Calls needs attention.

**Save:** `POST /api/solutions/appointment-receptionist` `save_draft` / wizard save (Opus partial mirror exists).

---

# 4. MCTB first-time onboarding wizard

## Route & shell

| Field | Value |
|-------|--------|
| **Route** | `/onboarding/mctb` (`/mctb/setup/start` may redirect here) |
| **Archetype** | Temporary process wizard (not main Opus product nav) |
| **Chrome** | Minimal: Transovo logo + product name; **Save & exit** → `/mctb/setup`; **Need help?** external |
| **Reference** | `src/components/mctb/onboarding-wizard.tsx` |
| **API** | `GET/POST /api/mctb/onboarding`; forwarding test `start_forwarding_test`; live test `POST /api/mctb/live-test` |

## Progress indicator

`MctbOnboardingProgress` — stages aligned to steps below (6 stages before ready).

## Step: `business_line`

| Area | Fields |
|------|--------|
| Main | Business name; Business phone (tel); Carrier select (from API carrier list); Website (optional) |
| Aside | Explainer / why business line |
| Footer | **Continue** → POST business fields |

## Step: `connect_calls`

| Area | Content |
|------|---------|
| H1 | Connect calls |
| Body | `MctbPhoneForwardingPanel`: business number, carrier, ring seconds, forward destination display, verification state, connection status |
| Footer | **Back**; **Save & verify later** or **Continue** when verified; may start forwarding test |

## Step: `consent`

| Area | Content |
|------|---------|
| H1 | How should callers give permission to text? |
| Body | `MctbConsentModeCards`: **Press 1** (recommended) vs **Existing consent** + attestation checkbox when existing |
| Footer | **Continue** (disabled if existing mode without attestation) |

## Step: `recovery`

| Area | Content |
|------|---------|
| H1 | Recovery message & texting |
| Main | `MctbRecoveryGoalSetupSection` (goal + opener template); Press-1 compliance note; text-back number status + TFV/messaging verification CTAs |
| Aside | `MctbMessagingActivationPanel` |
| Footer | **Continue** (requires non-empty message template) |

## Step: `voicemail`

| Area | Content |
|------|---------|
| H1 | Set up voicemail |
| Body | `OnboardingVoicemailStep` (platform default / custom greeting); respects press-1 mode |
| Footer | **Continue** → mark voicemail configured |

## Step: `review_test`

| Area | Content |
|------|---------|
| H1 | Review & test |
| Checklist rows | Business line, Forwarding, Consent, Recovery message, Messaging — each with **Edit** jump to step |
| Actions | **Run live test**; forwarding warning with link back to connect_calls |
| Timeline | `MctbVerificationTimeline` / live test checkpoints (from API) |
| Footer | Activate trial / finish → `ready` |

## Step: `ready`

| Content |
|---------|
| Success icon; **You're ready**; messaging pending copy if TFV not approved; trial days remaining |
| **Go to MCTB** → `/mctb`; **Review setup** → `/mctb/setup` |

## States

Loading spinner; error alert; demo start (`start_demo`); drawers for number add / verify (`drawerMode`).

---

# 5. MCTB consent history (compliance audit)

## Route

| Field | Value |
|-------|--------|
| **Route** | `/mctb/compliance/consent` |
| **Archetype** | Audit / compliance list |
| **Reference** | `src/components/mctb/consent-log-view.tsx` |
| **API** | `GET /api/mctb/consent-log?caller=` |

## Page structure (top → bottom)

| # | Region | Details |
|---|--------|---------|
| 1 | **Back link** | `← Setup` → `/mctb/setup` |
| 2 | **Header** | H1 `Consent history`; description Press-1 audit record; action **Consent settings** → `/mctb/setup/consent` |
| 3 | **Callout** | What the log proves (consenting caller vs business line vs ingress; identity unavailable when not verified) |
| 4 | **KPI strip** (3 cards) | Total consent events; Consents today; Texts sent after consent today |
| 5 | **Filter bar** | Label **Filter by caller**; search input; **Search** button |
| 6 | **Error state** | Rose alert |
| 7 | **Table** or empty | See columns below |

## Table columns

| Column | Cell content |
|--------|----------------|
| Caller / Consenting number | Verified ANI or amber “Unavailable — identity not verified” |
| Business number | Customer business line or — |
| Transovo number | Ingress / business fallback |
| Method | Badge e.g. Press 1 |
| Timestamp | Locale formatted `consentedAt` |
| Follow-up text | SMS sent time, queued status, or — |
| Details | Expand **Show** / **Hide** |

## Expanded row (full width)

| Column A | Column B |
|----------|----------|
| Identity verified yes/no; Method; Scope; Consent mode | Call session id; Prompt asset id; Link **View missed call timeline** when `missedCallEventId` |

## Empty state

No events copy + link to consent setup.

---

# 6. Buy / search phone numbers

## Route

| Field | Value |
|-------|--------|
| **Route** | `/voice/numbers/buy` (Opus **Numbers** links here) |
| **Reference** | `src/components/numbers/premium-numbers-page.tsx` |
| **APIs** | Premium search product API, checkout modal, workspace assignment |

## Page flow (business mode — default for voice buy)

| # | Region | Content |
|---|--------|---------|
| 1 | **Mode** | Business vs personal (voice uses business) |
| 2 | **Number type** | Local vs toll-free |
| 3 | **Search inputs** | Area codes; toll-free prefix selector; industry; AI-suggested keywords; extra keywords; **Search** / load more |
| 4 | **Personal chips** | (personal mode) preference chips — repeating digits, etc. |
| 5 | **Results sections** | **Top Picks**; **Best Matches For Your Business**; **Other Memorable Numbers** with cards (number, price, favorite heart) |
| 6 | **Checkout** | `PremiumCheckoutModal` — purchase flow |
| 7 | **Success** | `PremiumSuccessPanel` after purchase |

## States

Loading / searching; suggest keywords error; favorites set; empty results messaging.

## Post-purchase

Number must appear in `GET /api/mctb/numbers` and MCTB setup phone sender panels.

---

# 7. Integrations (Opus Shared nav)

## Routes & tabs

From Opus `INTEGRATION_TABS` / production `integrations/page.tsx`:

| Tab | Route |
|-----|-------|
| Directory | `/integrations` |
| Calendars | `/integrations/calendars` or `?provider=calendar` |
| Payments | `/integrations/payments` |
| Connect apps | `/integrations/native` (+ sub: appointments, leads, orders, tasks, audit, ai-policy, `[provider]`) |
| CRM | `/integrations/crm` (+ pipeline, `[provider]`) |
| API | `/integrations/api` |
| Webhooks | `/integrations/webhooks` |
| Developer logs | `/integrations/logs` |

## Directory home (`/integrations`) — required content

| # | Region | Content |
|---|--------|---------|
| 1 | **Tabs** | Horizontal integration tabs |
| 2 | **Header** | Integrations title / section header |
| 3 | **Client body** | `IntegrationsHomeClient` — connection cards by provider (calendars, Stripe, CRM, API keys, webhooks status) |
| 4 | **Server-loaded flags** | Connected API keys; webhooks/endpoints; `listConnections`; Stripe customer presence |

**Per connected integration:** status, connect/disconnect, link to detail route.

## Calendars page

Calendar provider connections (Microsoft, Google, Calendly, etc.) — connect OAuth, pick calendars, used by receptionist booking.

## Payments

Stripe connect state, payment methods for product billing.

## API / Webhooks / Logs

API key CRUD; outbound webhook endpoints; developer log tail — match existing legacy pages under `src/app/(app)/integrations/*`.

**Opus work:** Re-skin each route with Opus `Page` / `Panel` OR document “legacy body acceptable in Opus shell for V1.”

---

# 8. Settings (Opus Shared nav subset)

Opus sidebar links: **Settings** → `/settings/business` (matchPrefix); **Billing** → `/settings/billing`. `SETTINGS_TABS` in Opus nav: Business, Team, Billing.

## `/settings/business`

**Reference:** `BusinessSettingsConnected` + Kimi business cards.

| # | Section / card | Fields & actions |
|---|----------------|------------------|
| 1 | **Settings tabs** | Resolve via `resolveSettingsTabs` (business, team, billing, …) |
| 2 | **Business profile** | Workspace name, support email, business phone, address, website, timezone |
| 3 | **Messaging registration** | A2P/brand/campaign status card from `MessagingRegistration` |
| 4 | **Booking enabled** | Toggle booking for workspace |
| 5 | **Public legal** | Terms URL, privacy URL, SMS consent text/version |
| 6 | **Suspicious bookings** | Table from `/api/appointments/settings` |
| 7 | **Save** | Persist business + platform settings APIs |

## `/settings/billing`

Subscription, plan, payment method, invoices — legacy billing page (Stripe portal links).

## `/settings/team`

Users/roles invitation — legacy `settings/users` or team route linked from tabs.

**Other settings routes** (exist in repo, not in Opus nav): security, messaging, notifications, branding, calendar, data, workspaces, etc. — add to Opus only if IA expands.

---

# Appendix A — Opus manifest pages (NOT whole-page rebuilds)

These **exist in Opus**; they need **parity fixes** per `TRANSOVO-NEWUI-OPUS-VS-ORIGINAL-GAP-AUDIT.md`, not full page specs here:

`/mctb`, `/mctb/missed-calls`, `/mctb/missed-calls/[id]`, `/mctb/conversations`, `/mctb/ai-recovery`, `/mctb/voicemail`, `/mctb/analytics`, all `/mctb/setup/*` **section bodies**, `/voice/overview`, `/voice/calls`, `/voice/calls/[id]`, `/voice/knowledge`, `/voice/call-handling` (minus ingress + legacy section depth), `/voice/analytics`, `/voice/numbers` (list only).

---

# Appendix B — Business hours editor (not a standalone Opus page)

**Canonical home:** Business Knowledge — `/voice/knowledge` (hours section / link to schedule editor in knowledge pipeline).

Legacy link target was `/voice/setup` (redirects to MCTB setup). Opus knowledge **Edit hours** should open inline editor or deep link `#hours` on knowledge page.

**Must include:** Weekly schedule, timezone, closed days, holiday list (if product supports), save to receptionist wizard `operatingMaturity.businessSchedule`.

---

# Appendix C — Suggested Opus implementation order for whole pages

1. Receptionist editor (port `VoiceReceptionistEditor` into Opus shell)  
2. MCTB setup layout + `LinkTabs`  
3. `VoiceIngressSetupPanel` on Opus call-handling  
4. MCTB onboarding wizard (Opus styling or wrap legacy)  
5. Consent history compliance page  
6. Numbers buy (Opus styling or wrap `PremiumNumbersPageClient`)  
7. Integrations + Settings bodies (wrap or rebuild per V1 scope)

---

*End of document — copy from this file.*
