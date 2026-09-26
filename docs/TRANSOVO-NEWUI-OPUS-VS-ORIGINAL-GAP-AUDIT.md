# Opus (New UI Stage 2) vs original production UI — gap audit

**Purpose:** Single copy-paste inventory for product/engineering.  
**Opus scope:** Routes in `src/newui-transplant/mirror/MANIFEST.json` (26 entries) rendered when `isNewUiStage2Enabled()` is true (`NEXT_PUBLIC_NEWUI_STAGE2` + `NEXT_PUBLIC_NEWUI_SHELL`).  
**“Original”:** Legacy components still used when Stage 2 is off (`src/components/**`, `VoiceReceptionistEditor`, `MctbOverviewView`, `MctbSetup*View`, `CallHandlingOperationalPage`, etc.) plus canonical routes in `src/app/(app)/**` that Opus nav links to but did not transplant.  
**As of:** 2026-09-26 (post Stage 2 wiring pass on `master`: setup overview/phone multi-fetch, call-handling add target + `textSummary`, shell full-bleed `d092117b`).  
**Stale note:** `docs/TRANSOVO-NEWUI-OPUS-BACKEND-WIRING-GAP-INVENTORY.md` predates some of that wiring; this doc supersedes it for **page existence** and **original-vs-Opus feature** comparison.

**How to read severity**

| Tag | Meaning |
|-----|---------|
| **BUILD** | No Opus page or flow; original exists — net-new Opus work (or port legacy into Opus chrome). |
| **PORT** | Backend + legacy UI exist; Opus shows summary/mock/dead link — port or re-home legacy editor into Opus. |
| **WIRE** | Opus UI exists but control/data not connected (Category B in wiring doc). |
| **A** | No production backend (Category A — do not fake). |
| **OK** | Parity acceptable for V1 Opus scope (may still differ visually). |

---

# Part 1 — Pages and flows the original had but Opus does not (must build or port)

## 1.1 Dead-end or missing editor (highest priority)

| Item | Original (Stage 2 off) | Opus today | Work |
|------|------------------------|------------|------|
| **AI Receptionist setup editor** | `VoiceReceptionistEditor` at `/voice/receptionist` — full wizard: identity/voice, greeting, responsibilities, caller info, appointment handling, messages/callbacks, publish/test (`src/components/voice/receptionist/voice-receptionist-editor.tsx`) | Summary tiles only; **“Open setup editor”** and **“Continue setup”** link to `/voice/receptionist` (same page — no editor) | **PORT** full editor (or new Opus route e.g. `/voice/receptionist/edit`) with same persist/publish APIs |
| **Voice agent sub-editors** (legacy IA) | `/voice/agents/[id]/about`, `/capabilities`, `/advanced`, `/voice-test`, `/integrations` | Redirects / not in Opus manifest; capability depth lived here for older IA | **BUILD/PORT** only if product still needs granular agent routes; otherwise fold into receptionist editor |
| **MCTB setup horizontal section nav** | `MctbSetupShell` + `MctbSetupSectionNav` on every setup section (`src/components/mctb/setup/mctb-setup-shell.tsx`) | Opus setup pages have **no** shared `LinkTabs` / section nav (sandbox had `newui/app/(app)/mctb/setup/layout.tsx`; production Opus does not) | **BUILD** Opus setup layout wrapping all `/mctb/setup/*` transplant pages |

## 1.2 Original product routes not in Opus manifest (reachable from legacy nav / docs)

| Route / flow | Original | Opus | Work |
|--------------|----------|------|------|
| **Call handling — MCTB vs AI ingress switch** | `VoiceIngressSetupPanel` on `CallHandlingOperationalPage` (`/voice/call-handling`) | Opus call-handling page has **no** ingress ownership switch | **PORT** panel into Opus call-handling (read persisted state; write via existing inbound-handling / receptionist APIs — no provider on layout GET) |
| **MCTB compliance — Consent log** | `/mctb/compliance/consent` (audit) | Not in Opus manifest or nav | **BUILD** Opus compliance surface or link out with Opus shell |
| **MCTB guided first-time setup** | `/onboarding/mctb`, `/mctb/setup/start` | Not Opus; wizard still legacy | **BUILD** Opus wizard or keep legacy behind flag (product decision) |
| **MCTB numbers management** | `/mctb/numbers` → setup phone `?open=manage`; legacy numbers UI | Opus nav uses `/voice/numbers` (partial table); no Opus drawer UX from setup phone | **PORT** number/sender management from legacy setup phone drawers |
| **Buy number** | `/voice/numbers/buy` | Opus numbers links here (legacy flow, not Opus-styled) | **BUILD** Opus buy flow or accept legacy page under Opus shell |
| **Voice — Try it / live test** | `/voice/try-it` → canonical `/mctb/setup/test` for MCTB; voice-specific try surfaces may exist | Not in Opus voice nav | **WIRE** header CTAs to test routes where spec requires |
| **Voice — Needs attention** | `/voice/needs-attention` | Not in Opus manifest | **BUILD** or merge into overview/calls filters |
| **Voice analytics — After hours** | `/voice/analytics/after-hours` | Not in Opus manifest | **BUILD** sub-page or link from Opus analytics |
| **Voice — Legacy setup hub** | `/voice/setup` (hours, dependencies) | Knowledge **Edit hours** still jumps to `/voice/setup` | **PORT** hours editor into Opus knowledge or dedicated Opus setup section |
| **MCTB — Voice Agent product page** | `/mctb/voice-agent` | Not in Opus MCTB nav (Opus uses shared call-handling) | **BUILD** if still a product entry from overview inventory |
| **MCTB — AI Lead Recovery URL** | `/mctb/ai-lead-recovery` redirects to `/mctb/ai-recovery` | Opus label “AI Recovery” only | **OK** (redirect); ensure bookmarks/marketing URLs documented |

## 1.3 Shared nav (Opus chrome, non-transplant bodies)

These appear in Opus sidebar (`src/newui-transplant/lib/nav.ts`) but are **not** Opus mirror pages — they use legacy `src/app` pages under Opus shell (`shouldUseNewUiShell`):

| Area | Routes | Gap |
|------|--------|-----|
| **Integrations** | `/integrations`, `/integrations/calendars`, `payments`, `native`, `crm`, `api`, `webhooks`, `logs` | **BUILD** Opus-styled integration directory or accept legacy UI in new shell |
| **Settings** | `/settings`, `/settings/business`, `/settings/team`, `/settings/billing` | Same — legacy settings in Opus chrome only |
| **Billing** | `/settings/billing` | Same |

## 1.4 Intentionally out of Opus / V1 launch (do not treat as Opus bugs unless product re-opens)

Legacy routes still in repo but hidden or deferred: `/voice/campaigns`, `/voice/conversations` (MCTB uses `/mctb/conversations`), `/voice/missed-calls` (redirects to `/mctb`), Smart Routing, AI receptionist list at `/voice/agents`, `/mctb/appointments/*`, `/mctb/booking/*`, `/mctb/calendar`, `/mctb/reminders`, mass texting surfaces, etc. Rebuild only if added back to V1 Opus IA.

## 1.5 Consolidated into other routes (original URL may exist; no separate Opus page needed)

| Legacy URL | Resolution |
|------------|------------|
| `/mctb/setup/missed-call-rules`, `/mctb/setup/follow-up`, `/mctb/setup/business-hours` | Redirect to `/mctb/setup/recovery` — triggers/rules live on Recovery editor (Opus + legacy) |
| `/voice/numbers` (production) | May redirect to MCTB numbers; Opus implements list at `/voice/numbers` |

---

# Part 2 — Per-page comparison (Opus manifest routes + global chrome)

For each route: **Original reference**, **Opus surface**, **Missing vs original** (UI, wiring, backend).

---

## Global Opus chrome (all Stage 2 pages)

| | |
|--|--|
| **Original** | Production `AppShell`: real workspace switcher, user menu, notifications, inbox unread, entitlements, optional metrics |
| **Opus** | `newui-transplant` sidebar + topbar |
| **Missing** | **WIRE/A:** Search / ⌘K (**A** — no command palette API); Help (**A**); notification feed (**A**); avatar account menu (**A**); workspace list (**A**); sidebar badges “3” / “4” and AI minutes meter (**A** / static); live Knowledge gap count and inbox unread from shell (**WIRE** to `loadShellData`) |

---

## `/` (manifest)

| | |
|--|--|
| **Original** | Product-dependent home (`/dashboard`, entitlement-based) |
| **Opus** | Redirect to `/voice/overview` |
| **Missing** | Entitlement-aware home (MCTB-only tenants may expect `/mctb`) — **WIRE** product routing rule |

---

## AI Receptionist

### `/voice/overview`

| | |
|--|--|
| **Original** | `VoiceOverviewDashboard` — KPIs, needs-attention links, operational mode, recent calls, dependency rows |
| **Opus** | `NewUiVoiceOverviewPage` — SSR `loadVoiceOverviewSummary`, stats, receptionist panel, recent calls table |
| **Missing** | Client **refresh** control; full **needs-attention** list/block parity with legacy; **error/retry** empty states; any legacy-only deep links (knowledge gaps, setup) — compare `VoiceOverviewDashboard` section-by-section |

### `/voice/calls`

| | |
|--|--|
| **Original** | Server paging, date range query params, attention mode, outcome filters tied to API |
| **Opus** | Single `GET /api/voice/calls?limit=100&dateRange=7d`; client filters only |
| **Missing** | **WIRE:** date range refetch; **A:** server pagination/cursor; **A:** dedicated “needs attention” API tab; KPI **deltas** if legacy showed them; preserve list context on detail return |

### `/voice/calls/[id]`

| | |
|--|--|
| **Original** | Transcript, recording playback, block caller, knowledge gap links, mark handled |
| **Opus** | `GET` + `PATCH` mark handled; adapter `buildVoiceCallDetailWired` |
| **Missing** | **WIRE:** recording URL / player if API returns but adapter omits; full transcript layout; block caller; link to create/resolve knowledge gap; diagnostics panel if legacy had it |

### `/voice/receptionist`

| | |
|--|--|
| **Original** | Full **`VoiceReceptionistEditor`** (multi-section wizard, save draft, activate, voice test, calendar deps) |
| **Opus** | Read-only summary from `GET /api/voice/overview` (name, voice label, publish status) |
| **Missing** | **PORT (critical):** entire editor; greeting body; capabilities grid (live, not static cards); language / speaking speed; publish/test flows; **fix dead “Open setup editor” link** |

### `/voice/knowledge`

| | |
|--|--|
| **Original** | `BusinessKnowledgeEditor` — sources, crawl, FAQ CRUD, gaps, hours |
| **Opus** | Heavy partial wiring: gaps, crawl, upload, add FAQ, save core fields, dismiss/resolve |
| **Missing** | **WIRE/B:** FAQ **edit/delete** inline (not `window.prompt`); **Edit hours** inline (legacy uses `/voice/setup`); gap UX polish; empty/error states |

### `/voice/call-handling`

| | |
|--|--|
| **Original** | `CallHandlingOperationalPage` + **`VoiceIngressSetupPanel`**, transfer/spam/on-call/recording editors |
| **Opus** | Wizard load/save, switches, recent transfers, **Add target** (wizard), keywords from `transferTriggers`, **textSummary** toggle |
| **Missing** | **PORT:** ingress MCTB vs AI switch; **B:** Edit on-call rotation UI; **B:** “+ Add” emergency keyword phrase input; **A/B:** recording retention **Change**; decorative stats (“142 calls blocked”); spam/transfer **edit** rows if legacy had per-row CRUD beyond Save |

### `/voice/analytics`

| | |
|--|--|
| **Original** | Charts, export, after-hours drilldown link |
| **Opus** | `NewUiVoiceAnalyticsPage` — `GET /api/voice/analytics?days=` (not mirror component) |
| **Missing** | **A:** daily **Booked** time series; mirror-only usage/latency meters (**A**); **BUILD:** link/page for `/voice/analytics/after-hours`; export if legacy had it |

### `/voice/numbers`

| | |
|--|--|
| **Original** | `/mctb/numbers` or numbers workspace — drawers, TFV, sender mode, buy flow |
| **Opus** | Table from `GET /api/mctb/numbers` |
| **Missing** | **B:** row detail / management drawer; **PORT:** buy flow in Opus; sender registration states; refresh after mutations |

---

## Missed Call Text Back

### `/mctb`

| | |
|--|--|
| **Original** | `MctbOverviewView` — call-handling dashboard card, needs-attention accordion, setup-incomplete banner, pause/resume CTAs, richer setup health + analytics footer |
| **Opus** | `NewUiMctbOverviewPage` — KPIs, AI Recovery strip, recent missed/conversations, setup health rows |
| **Missing** | **PORT:** `CallHandlingDashboardCard`; **needs-attention** list (not static green banner); setup-incomplete **Finish setup** → onboarding; **pause/resume** on overview; performance snapshot / analytics footer; state-dependent header CTAs per spec 01 |

### `/mctb/missed-calls`

| | |
|--|--|
| **Original** | `MctbMissedCallsView` — server filters, URL persistence, pagination, row actions |
| **Opus** | `GET /api/mctb/missed-calls`, client filters |
| **Missing** | **WIRE:** date filter in browser; server-side filter query params; real pagination; **Add to exclusions** row action; KPI deltas; preserve filters on detail return |

### `/mctb/missed-calls/[id]`

| | |
|--|--|
| **Original** | Full spec 03 lifecycle, timeline from API, voicemail playback, link activity, request form, diagnostics |
| **Opus** | Adapter-driven detail view; sender from setup API; voicemail `src` when `voicemailRecordingSrc` set |
| **Missing** | **WIRE:** ensure all API timeline events render; link activity / request form sections if API provides; conversation deep link; header actions parity (call customer, view consent); collapsed diagnostics |

### `/mctb/conversations`

| | |
|--|--|
| **Original** | `KimiConversationsConnected` / shared inbox — paging, assignee, product filters, eligibility, MCTB context |
| **Opus** | Opus `inbox.tsx` + kimi adapter (~25 threads) |
| **Missing** | **WIRE:** paging; **Mine/Unassigned/Closed/Spam** (real API filters); mark read/close bulk; context panel consent + assignee; **missed call** context fetch; composer eligibility copy; thread reload after send; `/conversations?product=mctb` parity |

### `/mctb/ai-recovery`

| | |
|--|--|
| **Original** | Lead recovery / AI recovery settings pages with live toggles and booking links |
| **Opus** | Wired load/save (`context`, `lead-recovery/config`, `ai-recovery/settings`, booking link create) |
| **Missing** | Verify parity with legacy field set (all collect fields, policies); error states on save; any legacy-only policy copy |

### `/mctb/voicemail`

| | |
|--|--|
| **Original** | `MctbVoicemailWorkspace` — audio authoritative, mark reviewed, caller conversation link |
| **Opus** | List + transcript/summary; `recordingSrc` via adapter when `hasRecording` |
| **Missing** | **WIRE:** mark reviewed; **Open conversation** when no `conversationId`; multi-line selector; settings link prominence |

### `/mctb/analytics`

| | |
|--|--|
| **Original** | `loadMctbAnalytics` — funnel, suppression, drilldowns |
| **Opus** | Wired range + charts + suppression links |
| **Missing** | Minor: human-readable suppression reason labels; voicemail metric drilldowns if legacy had extras |

### `/mctb/setup` (overview)

| | |
|--|--|
| **Original** | `MctbSetupOverviewView` — multi-fetch, pause presets, attention, call-flow/operations rows, activity |
| **Opus** | `useMctbSetupOverviewWiring` (post–Stage 2 pass) — same data sources |
| **Missing** | **B:** pause **presets** (1h / tomorrow / custom) vs single toggle; visual parity with legacy premium cards; setup section nav (**Part 1**) |

### `/mctb/setup/phone`

| | |
|--|--|
| **Original** | Onboarding + carrier guides + verification + sender drawers |
| **Opus** | `useMctbSetupPhoneWiring` — carrier, ring, instructions, verify, sender status |
| **Missing** | **A:** throughput “75 msg/min” display; **PORT:** full number-management drawer (`?open=manage`); parity with canonical carrier guide presentation |

### `/mctb/setup/consent`

| | |
|--|--|
| **Original** | `MctbSetupConsentView` — mode, attestation, prompt publish |
| **Opus** | Mode + attestation save; prompt preview |
| **Missing** | Press-1 disclosure **publish** inline if legacy allowed; link to consent history |

### `/mctb/setup/text-back`

| | |
|--|--|
| **Original** | `MctbSetupTextBackView` — Press-1 two-bubble preview, GSM segments, variables |
| **Opus** | Opener save/load |
| **Missing** | Locked compliance bubble + segment engine parity; recovery goal section if legacy had it on same page |

### `/mctb/setup/recovery`

| | |
|--|--|
| **Original** | Triggers, pause, cooldown, max messages (incl. missed-call rules consolidated here) |
| **Opus** | Wired triggers, delay, cooldown, pause, save |
| **Missing** | **A:** “Blocked caller ID” trigger toggle (no runtime rule); ensure trigger labels match runtime |

### `/mctb/setup/voicemail`

| | |
|--|--|
| **Original** | Greeting sources (TTS, ElevenLabs, record, upload), preview, activate |
| **Opus** | TTS + activate + transcription flag wired |
| **Missing** | **PORT:** non-TTS sources; greeting preview play; studio flows from legacy |

### `/mctb/setup/notifications`

| | |
|--|--|
| **Original** | Handoff recipients + event matrix |
| **Opus** | Add recipient + matrix persist |
| **Missing** | **B:** recipient edit/delete (⋯); **A:** “Forwarding stopped working” row |

### `/mctb/setup/exclusions`

| | |
|--|--|
| **Original** | List/add/delete exclusions |
| **Opus** | Wired |
| **Missing** | **OK** for core CRUD — compare import/bulk if legacy had it |

### `/mctb/setup/links`

| | |
|--|--|
| **Original** | Default link + request form |
| **Opus** | Display + copy; partial save hooks |
| **Missing** | **B:** inline edit default URL; **A:** multi-link list + click analytics |

### `/mctb/setup/test`

| | |
|--|--|
| **Original** | Live test + checklist |
| **Opus** | `useMctbTestWiring` + setup-test APIs |
| **Missing** | Parity with legacy checkpoint copy; Press-1-only steps when mode = press_1 |

---

# Part 3 — Suggested build order (opinionated)

1. **Receptionist editor (PORT)** — unblocks largest dead-end.  
2. **MCTB setup layout + section nav (BUILD)** — makes setup usable.  
3. **Call-handling ingress panel (PORT)** — ownership switch is product-critical.  
4. **MCTB overview needs-attention + call-handling card (PORT)** — operational truth.  
5. **Conversations inbox depth (WIRE)** — daily MCTB work.  
6. **Integrations/settings Opus bodies (BUILD)** — or explicitly document “legacy in Opus shell” for V1.  
7. Everything else in Part 2 by customer traffic (calls list paging, knowledge FAQ edit, numbers drawers).

---

# References

| Doc / code | Use |
|------------|-----|
| `src/newui-transplant/mirror/MANIFEST.json` | Opus route list |
| `docs/TRANSOVO-NEWUI-OPUS-STAGE2-WIRING-COMPLETION.md` | Category A/B after wiring pass |
| `docs/TRANSOVO-NEWUI-OPUS-BACKEND-WIRING-GAP-INVENTORY.md` | Per-control wiring (partially stale) |
| `docs/TRANSOVO-NEWUI-PRODUCTION-INTEGRATION-AUDIT.md` | Original migration map |
| `docs/MCTB-MENU-PAGE-INVENTORY.md` | Legacy MCTB sidebar inventory |
| Stage 2 toggle | `src/lib/newui-transplant/stage2-enabled.ts` |

---

*End of audit — copy from this file as needed.*
