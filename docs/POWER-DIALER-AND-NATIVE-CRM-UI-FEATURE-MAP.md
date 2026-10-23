# Power Dialer + Native CRM — UI feature & reachability map

**Purpose:** For every shipped capability in the Power Dialer + native CRM surface (including the 74-route smoke set), this document states **what it is**, **where the user opens it in the app**, and **how they use it**. Items marked **GAP** have backend/API support but **no clear end-user path** (or only partial UI).

**App shell:** Use the **product switcher** → **Power Dialer**. Shared CRM routes (`/app/contacts`, `/app/contacts/deals`, `/app/contacts/tasks`, `/app/contacts/calendar`) keep the **Power Dialer** sidebar when opened from Power Dialer or after a prior Power Dialer visit (cookie `transovo_shell_context=power_dialer`). **Workspace** header **Contacts** sets `workspace` and shows the workspace sidebar. Companies + CRM settings stay on **Contacts sub-nav** only (`contacts-subnav.tsx`).

**Power Dialer sidebar (locked order):** `new-app/lib/nav.ts` → `powerDialerNavItems()` — Calling: Overview, Dialer, Campaigns, Calling Lists · Sales CRM: Contacts, Deals, Tasks, Calendar · Activity: Callbacks, Call History, Number Health, Analytics · Configuration: Integrations, Settings.

**Reachability legend**

| Code | Meaning |
|------|---------|
| **NAV** | Left sidebar under Power Dialer or Contacts sub-nav |
| **TAB** | Tab or secondary nav on a page |
| **DEEP** | URL or link from another screen (not in main sidebar) |
| **IN-FLOW** | Appears during dialing / campaign / list workflow |
| **API** | Integrations, exports, or automation only (no dedicated settings screen) |
| **GAP** | User cannot fully configure or use without API, missing UI, or admin-only env |

---

## 1. Power Dialer — sidebar pages

### 1.1 Overview — `/app/power-dialer` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Today KPIs (attempts, conversations, answer rate, talk time) | Power Dialer → **Overview** | Read dashboard |
| Attention / setup blockers | Same page | Fix issues listed (e.g. mic not ready) |
| **Start dialing** | Header button on Overview | Opens **Dialer** (`/app/power-dialer/dialer` or active session query) |
| Setup checklist (lists, campaigns, callbacks) | Overview panels | Follow counts; callbacks link → **Callbacks** with `?tab=due_today` |
| Recent campaigns | Overview → Campaigns panel | Row links to **`/app/power-dialer/campaigns/[id]/queue`** (campaign detail) |
| Recent activity | Overview panel | Read-only attempt list |

**API behind UI:** `GET /api/phone/power-dialer/overview`

---

### 1.2 Dialer — `/app/power-dialer/dialer` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Live power-dialing session | Power Dialer → **Dialer**; or Overview **Start dialing**; or Campaign sub-nav **Open dialer** (`?campaign=`) | Start/pause session, disposition calls, next contact |
| Campaign-scoped dialing | **Campaigns** → open campaign → **Open dialer** link | `?campaign={id}` |
| Session presets (save/load dialer UI config) | In dialer UI (preset dropdown when presets exist) | **IN-FLOW** — `GET/POST /api/phone/power-dialer/session-presets` |
| Parallel / power / preview dial modes (per campaign) | Set on **campaign** (Call handling tab), not global dialer | **Campaign editor sheet** reads `GET /api/phone/power-dialer/dial-modes` for locked reasons |
| Attempt actions (transfer, VM drop, recording, etc.) | During active call in dialer | **IN-FLOW** — various `POST` under `/api/phone/power-dialer/attempts/...` |

**API with no GET in smoke:** `POST /api/phone/power-dialer/sessions` (session start), `POST /api/phone/power-dialer/ai-callbacks` (**GAP** — no UI reference found)

---

### 1.3 Campaigns — `/app/power-dialer/campaigns` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Campaign list / create / edit | Power Dialer → **Campaigns** | Table + **Campaign editor sheet** (name, list, rules, dial mode, scripts, dispositions, members, etc.) |
| Campaign detail sub-areas | Open a campaign → sub-nav (**DEEP**) | See §1.3a |
| Clone / rerun / queue prep | Editor or campaign actions (where exposed) | **IN-FLOW** — campaign APIs |

**API:** `GET /api/phone/power-dialer/campaigns`, `.../campaigns/table`, `GET/PATCH .../campaigns/[id]`, etc.

#### 1.3a Campaign deep routes (**DEEP** — not in sidebar)

| Route | How to open | Purpose |
|-------|-------------|---------|
| `/app/power-dialer/campaigns/[id]/contacts` | Campaign sub-nav **Contacts** | Campaign contact membership |
| `/app/power-dialer/campaigns/[id]/queue` | Sub-nav **Queue** | Queue inspection / prep |
| `/app/power-dialer/campaigns/[id]/history` | Sub-nav **History** | Campaign-specific history |
| `/app/power-dialer/campaigns/[id]/analytics` | Sub-nav or links | Per-campaign analytics |

Component: `campaign-subnav.tsx` links + **Open dialer**.

---

### 1.4 Calling Lists — `/app/power-dialer/calling-lists` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| List catalog | Power Dialer → **Calling Lists** | Create, open list |
| List detail | Click a list → `/app/power-dialer/calling-lists/[id]` (**DEEP**) | Members, import CSV, CRM import, export, bulk actions |
| CSV import wizard | List detail | **IN-FLOW** — `POST .../lists/[id]/import-csv`, `.../import` |
| CRM source import | List detail | Uses `GET .../lists/crm-sources`, `POST .../import-crm` |
| Link list to campaign | Campaign editor → list picker | Editor links to **Calling Lists** if empty |

**API:** `GET /api/phone/power-dialer/lists`, `GET/PATCH .../lists/[id]`, members, export, etc.

---

### 1.5 Callbacks — `/app/power-dialer/callbacks` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Scheduled callbacks | Power Dialer → **Callbacks**; Overview link `?tab=due_today` | View/act on callbacks |
| Eligibility / reschedule | Callback row actions | **IN-FLOW** — `GET/PATCH .../callbacks/[id]`, eligibility |

**API:** `GET /api/phone/power-dialer/callbacks`

---

### 1.6 Call History — `/app/power-dialer/call-history` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Attempts / calls table | Power Dialer → **Call History** | Filter, open row |
| Call / attempt detail | Row → `/app/power-dialer/call-history/[id]` (**DEEP**) | Recording, review, disposition context |
| Sessions list | Call History → **Sessions** tab → `/app/power-dialer/call-history/sessions` | Session-level history |

**API:** Attempts via phone/calls APIs; `GET .../attempts/[id]`, recording, review routes.

---

### 1.7 Number Health — `/app/power-dialer/number-health` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Caller ID health summary | Power Dialer → **Number Health** | See numbers used for outbound |
| Per-number detail | Row → `/app/power-dialer/number-health/[phoneNumberId]` (**DEEP**) | Drill into one number |
| Free tools | Link on Number Health page → `/app/power-dialer/number-health/free-tools` (**DEEP**) | Supplementary tools |
| Premium AMD / health | Link → `/app/power-dialer/number-health/premium` (**DEEP**) | Premium signals (entitlement-dependent) |
| Manage numbers | Link → **Workspace → Numbers** `/app/numbers` | Purchase/configure DIDs |

**API:** `GET /api/phone/power-dialer/number-health`, `.../number-health/[phoneNumberId]`

---

### 1.8 Analytics — `/app/power-dialer/analytics` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Overview KPIs + trend | Power Dialer → **Analytics** | Range selector (7d/30d/90d) |
| Section tabs (campaigns, reps, numbers, screening, usage, funnel, dispositions, leaderboard, live, reports) | **Analytics** page segmented control **or** `analytics-nav.tsx` links **or** `?tab=` query | Switch sections on one page |
| Legacy paths `/analytics/campaigns`, etc. | Bookmarked URLs | **307 redirect** to `/analytics?tab=...` (still reachable, not separate screens) |
| Export CSV | **Analytics** header **Export** buttons | **API** download — `GET .../analytics/export?days=` |
| Live board | Analytics → **Live board** tab | Polls `GET .../analytics/live-board` |
| Scheduled email reports | Analytics → **Reports** tab | `GET/POST .../analytics/scheduled-reports` |

**API:** `GET /api/phone/power-dialer/analytics?range=`

---

### 1.9 Integrations — `/app/power-dialer/integrations` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| CRM connection list | Power Dialer → **Integrations** | Connect Salesforce, HubSpot, etc. (providers supported in app) |
| Provider setup | Click provider → `/app/power-dialer/integrations/[provider]` (**DEEP**) | OAuth/connect, field mapping, inbound sync trigger |
| Sync history | Provider page or `/app/power-dialer/integrations/sync-history` (**DEEP**) | Retry failed syncs |

**API:** `GET /api/phone/power-dialer/integrations`, `.../integrations/[provider]`, sync-history, sync-inbound.

---

### 1.10 Settings — `/app/power-dialer/settings` (**NAV**)

All tabs are on one page (`settings-content.tsx` tab bar). User: **Power Dialer → Settings** → pick tab.

| Tab | User-facing capabilities | Primary APIs |
|-----|--------------------------|--------------|
| **General** | Default timezone | `GET/PATCH .../settings` |
| **Dialing** | Ring timeout, post-call interval, default caps | Settings |
| **Dispositions** | Disposition sets & outcomes library | `.../dispositions` |
| **Cadences** | Multi-step cadence definitions | `GET/POST .../cadences` |
| **Scripts** | Script library + **Example preview** | `.../scripts` |
| **Voicemail Drops** | Upload/manage VM drop audio | `.../voicemail-drops`, upload |
| **Call Screening** | Screening-related defaults | Settings |
| **Caller ID** | Default outbound numbers (from workspace numbers) | Settings + Numbers provider |
| **Recording** | Dialer recording policy (distinct from global Phone recording) | Settings |
| **Compliance** | Legal notice, DNC list, list consent bases, audit log, abandoned-rate by campaign | `GET/PATCH .../compliance` |
| **Team** | Rep roster, campaign access assignments, **manager impersonation** start/stop | `GET .../team`, `.../impersonation` |
| **API & Webhooks** | API keys, outbound webhooks, link to OpenAPI | `.../developer/api-keys`, `.../developer/webhooks` |
| **Usage & Subscription** | Minutes / limits display | Settings + analytics usage |

**Campaign-level overrides:** Many defaults are overridden in **Campaign editor** (dial mode, scripts, dispositions, caps).

---

## 2. Native CRM (Contacts product) — Workspace nav

**Entry:** Product switcher → **Workspace** (or default shell) → sidebar **Contacts** `/app/contacts`.

**Sub-nav** (`contacts-subnav.tsx`): Contacts | Companies | Deals | Tasks | Calendar | CRM settings.

### 2.1 Contacts — `/app/contacts` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Search & list | **Contacts** | Search, paginate |
| **Folders** | Left panel on Contacts page | Create/rename folders; filter by folder |
| **Saved views** | Dropdown “Saved view” | **Select existing views only** — loads `GET /api/crm/native/views` (**GAP:** no UI to **create/edit** saved views) |
| Contact detail | Click row → `/app/contacts/[id]` (**DEEP**) | Edit fields, tasks, history |
| **Merge duplicates** | Contacts header → **Merge duplicates** | Wizard — `GET .../contacts/duplicates`, `POST .../merge`, undo |
| Bulk move to folder | Select rows + folder + move | `PATCH .../contacts/bulk` |
| Export | **Export** link | `GET /api/crm/native/contacts/export` (**API** file download) |
| Power-dialer-sourced contacts | Same list | Copy explains PD imports appear here |

**API:** `GET /api/crm/native/contacts`, views, folders, bulk, export, merge.

---

### 2.2 Companies — `/app/contacts/companies` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| List / search / add | **Companies** sub-nav | Create company, search |
| Company detail | Row → `/app/contacts/companies/[id]` (**DEEP**) | Linked contacts & deals |

**API:** `GET/POST .../companies`, `GET .../companies/[id]`

---

### 2.3 Deals — `/app/contacts/deals` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Kanban / table | **Deals** sub-nav | Move deals between stages (dropdown per card) |
| Pipeline stages | Loaded with deals | Stages returned from `GET /api/crm/native/deals` (**GAP:** no UI to **add/rename/reorder stages**; standalone `GET /api/crm/native/deal-stages` unused in UI) |

---

### 2.4 Tasks — `/app/contacts/tasks` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Due / overdue / upcoming / done buckets | **Tasks** sub-nav | Filter tabs; mark done |

**API:** `GET /api/crm/native/tasks?bucket=`

---

### 2.5 Calendar — `/app/contacts/calendar` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| CRM appointments list | **Calendar** sub-nav | Create appointment (title + default 1h slot) |
| Link to contact | From appointment row | **DEEP** → contact |

**API:** `GET/POST /api/crm/native/appointments`, `.../appointments/[id]`

---

### 2.6 CRM settings — `/app/contacts/settings` (**NAV**)

| Feature | How the user gets there | What they do |
|---------|-------------------------|--------------|
| Custom fields | **CRM settings** tab | Add text/number/select fields |
| Dial policy (workspace-wide frequency, area codes) | **Dial & inbound** panel | Aligns with power-dialer P22 limits |
| Country / fallthrough / team scopes | Same page | Save → `PATCH /api/crm/native/settings` |

**API:** `GET/PATCH .../settings`, `GET/POST .../custom-fields`

---

## 3. Smoke checklist — all 74 routes mapped

### 3.1 Pages (21)

| # | Path | Sidebar / entry |
|---|------|-----------------|
| 1 | `/app/power-dialer` | Power Dialer → Overview |
| 2 | `/app/power-dialer/dialer` | Power Dialer → Dialer |
| 3 | `/app/power-dialer/campaigns` | Power Dialer → Campaigns |
| 4 | `/app/power-dialer/calling-lists` | Power Dialer → Calling Lists |
| 5 | `/app/power-dialer/callbacks` | Power Dialer → Callbacks |
| 6 | `/app/power-dialer/call-history` | Power Dialer → Call History |
| 7 | `/app/power-dialer/number-health` | Power Dialer → Number Health |
| 8 | `/app/power-dialer/analytics` | Power Dialer → Analytics |
| 9–13 | `/app/power-dialer/analytics/{campaigns,reps,numbers,screening,usage}` | Redirect → Analytics `?tab=` |
| 14 | `/app/power-dialer/settings` | Power Dialer → Settings |
| 15 | `/app/power-dialer/integrations` | Power Dialer → Integrations |
| 16 | `/app/contacts` | Workspace → Contacts |
| 17 | `/app/contacts/companies` | Contacts sub-nav |
| 18 | `/app/contacts/deals` | Contacts sub-nav |
| 19 | `/app/contacts/tasks` | Contacts sub-nav |
| 20 | `/app/contacts/calendar` | Contacts sub-nav |
| 21 | `/app/contacts/settings` | Contacts sub-nav |

### 3.2 Power Dialer APIs (GET smoke — 40)

| API | User-facing surface |
|-----|---------------------|
| `/api/phone/power-dialer/overview` | Overview page |
| `/api/phone/power-dialer/settings` | Settings (all tabs load/save) |
| `/api/phone/power-dialer/compliance` | Settings → Compliance |
| `/api/phone/power-dialer/dial-modes` | Campaign editor → Dial mode (locked reasons) |
| `/api/phone/power-dialer/analytics?range=` | Analytics |
| `/api/phone/power-dialer/analytics/live-board` | Analytics → Live board |
| `/api/phone/power-dialer/analytics/scheduled-reports` | Analytics → Reports |
| `/api/phone/power-dialer/analytics/export` | Analytics → Export buttons |
| `/api/phone/power-dialer/number-health` | Number Health |
| `/api/phone/power-dialer/team` | Settings → Team |
| `/api/phone/power-dialer/campaigns` (+ `table`, `[id]`) | Campaigns + editor + deep routes |
| `/api/phone/power-dialer/lists` (+ `[id]`, `crm-sources`) | Calling Lists + detail |
| `/api/phone/power-dialer/scripts` | Settings → Scripts; Campaign editor |
| `/api/phone/power-dialer/dispositions` | Settings → Dispositions; Campaign editor |
| `/api/phone/power-dialer/voicemail-drops` | Settings → VM Drops; Campaign editor |
| `/api/phone/power-dialer/cadences` | Settings → Cadences |
| `/api/phone/power-dialer/callbacks` | Callbacks page |
| `/api/phone/power-dialer/session-presets` | Dialer session UI |
| `/api/phone/power-dialer/workspace-members` | Campaign editor (members); Team |
| `/api/phone/power-dialer/integrations` (+ sync-history) | Integrations pages |
| `/api/phone/power-dialer/impersonation` | Settings → Team; banner when active |
| `/api/phone/power-dialer/developer/api-keys` | Settings → API & Webhooks |
| `/api/phone/power-dialer/developer/webhooks` | Settings → API & Webhooks |
| `GET .../sessions` | **405** — use Dialer UI to start sessions (**POST**) |
| `GET .../ai-callbacks` | **405** (POST only — AI bridge) · UI: Callbacks → **AI callbacks** tab lists `source`/`disposition` rows |

### 3.3 Native CRM APIs (11)

| API | User-facing surface |
|-----|---------------------|
| `/api/crm/native/views` | Contacts → sidebar saved views + **Manage views** sheet (`POST`, `PATCH/DELETE .../views/[id]`) |
| `/api/crm/native/folders` | Contacts → Folders panel |
| `/api/crm/native/contacts` | Contacts list |
| `/api/crm/native/companies` | Companies |
| `/api/crm/native/deals` | Deals (includes stages) |
| `/api/crm/native/tasks` | Tasks |
| `/api/crm/native/appointments` | Calendar |
| `/api/crm/native/custom-fields` | CRM settings |
| `/api/crm/native/settings` | CRM settings |
| `/api/crm/native/deal-stages` | Deals → **Manage pipeline**; CRM settings → **Pipelines** (`deal-pipeline-editor-sheet.tsx`) |
| `/api/crm/native/contacts/duplicates` | Merge duplicates wizard |

### 3.4 Public v1 + Zapier (12) — **API** only

| API | User-facing surface |
|-----|---------------------|
| `/api/v1/power-dialer/*` | **Settings → API & Webhooks** (keys + docs); external automation |
| `/api/v1/zapier/polling/*` | Power Dialer → **Integrations** → Zapier panel (links to Settings → API & Webhooks) |

Requires `Authorization: Bearer <api-key>` — smoke expects **401** without key.

---

## 4. Related routes (not in 74-smoke but user-reachable)

| Path | Entry |
|------|--------|
| `/app/phone/power-dialer` | Legacy Phone product link → redirects to **Dialer** or lists/campaigns via `?tab=` |
| `/app/contacts/[id]` | Contacts row |
| `/app/contacts/companies/[id]` | Company row |
| `/app/power-dialer/campaigns/[id]/*` | Campaign sub-nav |
| `/app/power-dialer/calling-lists/[id]` | List row |
| `/app/power-dialer/call-history/[id]` | History row |
| `/app/power-dialer/number-health/[id]`, `free-tools`, `premium` | Number Health links |
| `/app/numbers` | Workspace → Numbers (caller ID for PD) |

---

## 5. GAP register (UI-8 batch — branch `feature/power-dialer-ui-completion`)

| Item | Status | Evidence |
|------|--------|----------|
| Power Dialer sidebar + CRM shell persistence | **Closed** | SSR cookie in `app/app/layout.tsx` + `shell-context-provider.tsx`; browser: `hard-refresh-*.png`, `sidebar-*.png` in `/opt/cursor/artifacts/ui-8/` |
| Saved views CRUD | **Closed** | `contacts-saved-views-sheet.tsx`, `?openViews=1` deep link; browser: `saved-view-create.png`; log `saved_view_*` in `/opt/cursor/artifacts/ui-8-browser-proof-final.log` |
| Pipeline stage editor | **Closed** | `deal-pipeline-editor-sheet.tsx`; browser: `manage-pipeline.png` |
| Advanced dial modes admin UI | **Closed** | `advanced-dial-modes-panel.tsx` on **Settings → Dialing**; browser: `settings-advanced-dial-modes.png` |
| Campaign editor five dial modes + locks | **Closed** | `campaign-editor-sheet.tsx`; browser: `campaign-editor-handling.png` + `campaign_mode_copy_*` passes |
| Live session controls (UI-6.8) | **Closed** | `dialer-live-controls-reference.tsx` + session `data-testid`s; browser: `dialer-live-controls-audit.png` |
| Overview campaign deep links | **Closed** | browser: `overview-campaign-queue.png` |
| Call History Sessions tab | **Closed** | `call-history-content.tsx` → `/call-history/sessions`; browser: `call-history-sessions.png` |
| Callbacks five tabs | **Closed** | browser: `callbacks-tabs.png` |
| Dialer session presets (zero presets path) | **Closed** | `session-presets-sheet.tsx`; browser: `presets-sheet.png` |
| Calendar month/week/day/list + create/reschedule/cancel | **Closed** | `crm-calendar-workspace.tsx` + `/api/crm/native/appointments`; API: `test-crm-native-b2.ts` |
| Deals add/edit/move stage | **Closed** | `crm-section-workspaces.tsx`, `deal-editor-sheet.tsx`, `PATCH /api/crm/native/deals/:id`; API: `test-crm-native-b2.ts` |
| Pipeline stage reorder/delete (deals reassigned) | **Closed** | `upsertDealStages` in `lib/server/crm/native/deals.ts`; API: `test-crm-native-b2.ts` |
| Tasks complete/reopen/owner/link/delete | **Closed** | `crm-tasks-workspace.tsx` + `/api/crm/native/tasks`; API: `test-crm-native-b2.ts` |
| Contacts add/folder/merge wizard | **Closed** | `contacts-workspace.tsx`, `contact-merge-wizard.tsx`, native contacts/folders/merge APIs |
| Company detail (contacts/deals/activity) | **Closed** | `CompanyDetailWorkspace` + `GET /api/crm/native/companies/:id` |
| Settings dial-mode toggle → campaign editor locks | **Closed** | `advanced-dial-modes-panel.tsx` + `campaign-editor-sheet.tsx` (`advanced-dial-modes-updated`) |
| AI callbacks visibility | **Closed** | Callbacks **AI callbacks** tab |
| Zapier discoverability | **Closed** | browser: `integrations-zapier.png` |
| Live board supervisor area | **Closed** | browser: `analytics-live-board.png` |
| **Supervisor listen/whisper/barge (M67 media)** | **External** | `analytics-batch6-panels.tsx` — Telnyx M67 not provisioned in this environment |
| **POST ai-callbacks** (create from UI) | **N/A** | Integration-only (`ai-callback-bridge`); not a rep-facing action |
| Empty-DB `prisma migrate deploy` (full chain) | **External** | Pre-existing failure at `20260906130000_voice_appointments_external_id_unique` (missing `voice_appointments` table); log `/opt/cursor/artifacts/migration-empty-db-fresh.log`. Renamed CRM migration `20261024210000_crm_task_deal_appointment_status` applies cleanly on `pd_prodlike`. |

### UI-8 browser proof (Playwright / Chromium, local `pd_prodlike`, `http://localhost:3100`)

- **Command:** `cd new-app && DATABASE_URL=… UI_AGENT_BASE_URL=http://localhost:3100 npm run test:ui-8-browser`
- **Log:** `/opt/cursor/artifacts/ui-8-browser-proof-final.log` (64/64 pass on 2026-10-23)
- **Screenshots:** `/opt/cursor/artifacts/ui-8/*.png`
- **Results JSON:** `/opt/cursor/artifacts/ui-8/results.json`
- **Note:** Use `localhost` (not `127.0.0.1`) against `next dev` so client bundles hydrate (`allowedDevOrigins` in `new-app/next.config.mjs`).

### UI-6/7 API acceptance

- **Log:** `/opt/cursor/artifacts/ui-6-7-acceptance.log` (22/22 pass)

---

## 6. Legacy / separate Phone product (not Power Dialer)

Users in **Phone** product (`/app/phone/*`) get standard business phone: Dialer, Calls, Forwarding, Auto Attendant, Voicemail, MCTB (if enabled), etc. That is **separate** from **Power Dialer** (`/app/power-dialer/*`) except shared **Numbers** and WebRTC stack.

---

*Updated for UI-8 batch on `feature/power-dialer-ui-completion`. Smoke: `npm run smoke:power-dialer-get` in `new-app/`. Browser proof: `npm run test:ui-8-browser`.*
