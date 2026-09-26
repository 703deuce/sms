# TRANSOVO — New UI → Production Integration Audit

**Status:** Audit + migration plan only (no production migration code in this pass).  
**Baseline branch:** `cursor/newui-production-integration-audit-2304`  
**Baseline commit:** `41b29bdeae3cfb50f4eb99a75afbbaf354e46c1d` — *Add newui sandbox for MCTB and voice UI exploration.*  
**Worktree used:** `/workspace/.worktrees/newui-integration-audit` (checked out from `origin/master`; **not** merged from `cursor/menu-page-ui-inventory-2304`).  
**Main workspace note:** `/workspace` remains on `cursor/menu-page-ui-inventory-2304` for inventory docs only; migration baseline is the worktree above.

---

## Executive summary

`newui/` is a **standalone Next.js 16 design sandbox** (`newui/package.json`, own `@/` alias) with **zero** `fetch` / API usage. All customer data is from `newui/lib/data.ts` or inline constants. Production `src/app/(app)/*` already implements real auth, Prisma loaders, and `/api/mctb/*` + `/api/voice/*` + inbox + call-handling ownership.

**Target:** Promote `newui` presentation into the **existing** production app shell and routes—one app, real backends, thin view-model adapters where shapes differ.

**Highest risks:** (1) mock `SaveBar` and inbox send paths, (2) newui **Call Handling** page missing `VoiceIngressSetupPanel` / persisted handler switch, (3) newui **Receptionist** is a static summary vs production full editor, (4) missing **Missed-call Rules** setup tab, (5) carrying **duplicate** `inbound-handling` GETs into shell, (6) platform-sender / consent / TeXML write paths.

---

## newui project inventory

| Area | Location |
|------|----------|
| Routes | `newui/app/(app)/…` + `newui/app/page.tsx` → redirect `/voice/overview` |
| Shell | `newui/app/(app)/layout.tsx`, `newui/components/app/app-sidebar.tsx`, `topbar.tsx` |
| Nav config | `newui/lib/nav.ts` (`NAV`, `MCTB_SETUP_SECTIONS`, `INTEGRATION_TABS`, `SETTINGS_TABS`) |
| Mock data | `newui/lib/data.ts` |
| App kit | `newui/components/app/*` (kit, status, charts, save-bar, link-tabs, …) |
| Product UI | `newui/components/voice/*`, `newui/components/mctb/*` |
| Primitives | `newui/components/ui/*` (shadcn-style) |

**newui route count:** **25** customer routes (26 `page.tsx` files including root redirect).

---

## Mock / demo behavior in newui (remove on integration)

| Source | What it fakes |
|--------|----------------|
| `newui/lib/data.ts` | `BUSINESS`, `VOICE_CALLS`, `MISSED_CALLS`, `CONVERSATIONS`, `VOICEMAILS`, `CHART_WEEK`, `NUMBERS` |
| `newui/components/app/app-sidebar.tsx` | Workspace name/initials, static nav badges (`3`, `4`) |
| `newui/components/app/topbar.tsx` | Search (no op), notification dot, avatar `JD` |
| `newui/components/app/save-bar.tsx` | **Simulated save** (`setTimeout`, no API) |
| `newui/components/mctb/inbox.tsx` | Local `sent` messages, draft send, bulk checkboxes (no API) |
| `newui/components/mctb/exclusions-table.tsx` | `INITIAL` rows, local add/remove only |
| `newui/components/mctb/consent-editor.tsx` | Local mode/attestation only |
| `newui/components/mctb/text-back-editor.tsx` | Local opener state only |
| `newui/app/(app)/voice/call-handling/page.tsx` | Inline `TRANSFERS`, `RECENT` arrays; Save button inert |
| `newui/app/(app)/voice/receptionist/page.tsx` | Static `CAPABILITIES`, fake agent “Ava” |
| `newui/app/(app)/voice/knowledge/page.tsx` | Static FAQ/gap rows (partial `BUSINESS`) |
| `newui/components/voice/calls-browser.tsx` | Filters client-side on `VOICE_CALLS` only |

**No** `fetch`, `/api/`, or server actions anywhere under `newui/`.

---

## Reusable newui design system (promote to production)

**Shell / chrome:** `app-sidebar`, `topbar`, `SidebarProvider` layout pattern.

**Layout primitives:** `components/app/kit.tsx` (`Page`, `PageHeader`, `Panel`, `Stat`, `Rows`, `Pill`, …), `link-tabs`, `button-link`, `range-toggle`, `charts.tsx`, `status.tsx` (`OutcomePill`, `RecoveryPill`).

**Patterns:** `save-bar` (wire to real mutations), `missed-calls-browser`, `inbox` (split pane), `voicemail-browser`, `calls-browser`, `recent-calls-table`, `text-back-editor`, `consent-editor`, `exclusions-table`.

**UI primitives:** Full `newui/components/ui/*` set—evaluate merge vs existing `src/components/ui/*` (avoid duplicate Button/Table stacks long-term).

**Nav:** `newui/lib/nav.ts` is the **approved IA presentation**; production should source equivalent structure from `src/lib/products/*` while matching labels/hrefs.

---

## Production shell / global data (integration target)

| Concern | Production source today | newui today | Integration note |
|---------|-------------------------|-------------|------------------|
| Auth/session | `getSession`, `requireWorkspaceContext` | None | Keep server layout gate |
| Workspace list/switch | `loadShellData` → `AppShell` | Fake workspace button | Wire sidebar footer to `shell.workspaces` |
| User | Session in `AppShell` | Topbar `JD` | Real name/email/avatar |
| Entitlements | `getUserProductAccess`, `getWorkspaceProductFeatures` | All nav always visible | Gate `NAV` items like production |
| Inbox unread | `shell.inboxUnreadCount` | Badge `4` on Inbox | Single shell query; do not re-fetch per page |
| Notifications | `shell.unreadNotifications` | Decorative bell dot | Real notifications or hide |
| Metrics strip | `shell.metrics` | N/A in newui topbar | Only if product needs global usage |
| Call handling | `loadCallHandlingOwnershipState` in `(app)/layout.tsx` | Not shown in newui shell | **Read persisted state only** on GET; switch via existing POST paths (`/api/mctb/inbound-handling`, appointment-receptionist save)—never Telnyx on every navigation |
| Primary voice agent | `loadPrimaryVoiceAgentId` | N/A | Receptionist/knowledge pages need agent id |
| Nav timing | `logNavTiming` | N/A | Preserve; avoid adding client waterfalls |

**Performance — do not regress:** Production layout already parallelizes shell loads; newui must not add per-page duplicate entitlement/workspace calls. **Do not** call `resolveInboundHandlingDecision` (provider reconciliation) from layout—today `GET /api/mctb/inbound-handling` does; keep that off hot read paths except explicit setup/switch UI (`voice-ingress-setup-panel`).

---

# Migration map (by family)

Fields abbreviated where identical patterns repeat. **TEST REQUIREMENTS** default: cold load, filter/search, open detail, save where applicable, refresh persistence, entitlement denial, workspace isolation—plus product-specific items listed.

---

## GLOBAL / SHELL

### App shell + sidebar + topbar

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `src/app/(app)/layout.tsx` → `AppShell` |
| **NEWUI ROUTE** | `newui/app/(app)/layout.tsx` |
| **VISUAL COMPONENT(S)** | `AppSidebar`, `Topbar`, `SidebarProvider` |
| **REAL DATA SOURCE** | `loadShellData`, session, entitlements, `loadCallHandlingOwnershipState` (when switcher shown) |
| **REAL READ PATH** | Server `(app)/layout.tsx` (existing) |
| **REAL WRITE/MUTATION PATH** | Workspace switch APIs (existing shell); call-handler switch via inbound-handling / receptionist APIs (not on layout GET) |
| **MOCK DATA TO REMOVE** | `BUSINESS`, badge counts, fake user, fake search |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Product switcher, maintenance redirect, service worker, nav timing, try-it gating, outcome instances |
| **NEWUI-ONLY DEMO BEHAVIOR TO REMOVE** | Static workspace chip, ⌘K search with no handler |
| **PERMISSIONS/ENTITLEMENTS** | Hide MCTB/Voice sections per `productFeatures` / `productAccess` |
| **PROVIDER/EXTERNAL DEPENDENCIES** | None on read layout |
| **PERFORMANCE CONCERNS** | Single shell payload; optional: trim `loadShellData` if newui shell needs less |
| **INTEGRATION NOTES** | Replace `AppShell` chrome styling with newui components; keep children slot unchanged |
| **TEST REQUIREMENTS** | Switch workspace; verify nav items match entitlements; call-handling badge matches DB without Telnyx on each click |

### Home redirect

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/dashboard` or product home (varies) |
| **NEWUI ROUTE** | `newui/app/page.tsx` → `/voice/overview` |
| **INTEGRATION NOTES** | Align with V1 launch home (may be `/voice/overview` or `/mctb` per entitlement)—do not hardcode without product rule |

---

## AI RECEPTIONIST (`/voice/*` in newui nav)

### Overview

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/overview` |
| **NEWUI ROUTE** | `/voice/overview` |
| **VISUAL COMPONENT(S)** | newui page + `kit` stats; production `VoiceOverviewDashboard` |
| **REAL DATA SOURCE** | `loadVoiceOverviewSummary` (SSR), `/api/voice/overview` (client refresh) |
| **REAL READ PATH** | `src/app/(app)/voice/overview/page.tsx` |
| **REAL WRITE/MUTATION PATH** | N/A (read-only dashboard) |
| **MOCK DATA TO REMOVE** | `BUSINESS`, `VOICE_CALLS` slice in newui |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Needs-attention links, KPI definitions, error/retry |
| **PERMISSIONS/ENTITLEMENTS** | `hasVoice` / AI after-hours |
| **INTEGRATION NOTES** | Adapter: overview summary DTO → newui `Stat` / recent calls table |
| **TEST REQUIREMENTS** | KPIs match API; links to calls/knowledge |

### Calls list

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/calls` |
| **NEWUI ROUTE** | `/voice/calls` |
| **VISUAL COMPONENT(S)** | `CallsBrowser`, `RecentCallsTable` |
| **REAL DATA SOURCE** | `/api/voice/calls` (production); **also** `MOCK_CALL_ROWS` when demo flag |
| **REAL READ PATH** | Client fetch in production page |
| **MOCK DATA TO REMOVE** | `VOICE_CALLS` in newui; ensure production demo mock disabled in prod |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Attention mode, pagination, outcome filters, metrics row |
| **INTEGRATION NOTES** | Map `VoiceCall` view-model from API row type in `lib/voice/calls/*` |
| **TEST REQUIREMENTS** | Filter/search/pagination; attention tab |

### Call detail

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/calls/[id]` |
| **NEWUI ROUTE** | `/voice/calls/[id]` |
| **REAL DATA SOURCE** | `/api/voice/calls/[id]`, recordings stream URLs |
| **MOCK DATA TO REMOVE** | `VOICE_CALLS.find` in newui |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Transcript, recording playback, block caller, knowledge gaps link |
| **PROVIDER DEPENDENCIES** | Telnyx recording URLs |
| **TEST REQUIREMENTS** | Play recording; deep link |

### Receptionist

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/receptionist` |
| **NEWUI ROUTE** | `/voice/receptionist` |
| **VISUAL COMPONENT(S)** | newui static summary vs `VoiceReceptionistEditor` |
| **REAL DATA SOURCE** | `/api/voice/agents`, `/api/solutions/appointment-receptionist` |
| **REAL WRITE PATH** | POST appointment-receptionist, agent publish flows |
| **MOCK DATA TO REMOVE** | Entire static CAPABILITIES/greeting in newui |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Full wizard/editor, publish, voice test, calendar connections |
| **INTEGRATION NOTES** | **CASE C:** newui is marketing summary only—migrate visual **around** existing editor or split “summary + edit” using newui `Panel` patterns without losing editor fields |
| **TEST REQUIREMENTS** | Publish receptionist; PSTN smoke (manual) |

### Business Knowledge

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/knowledge` |
| **NEWUI ROUTE** | `/voice/knowledge` |
| **VISUAL COMPONENT(S)** | newui static lists vs `BusinessKnowledgeEditor` |
| **REAL DATA SOURCE** | `/api/voice/knowledge/*`, crawl jobs, gaps |
| **MOCK DATA TO REMOVE** | Inline FAQ rows in newui page |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | Upload, crawl, source CRUD, gap resolution |
| **TEST REQUIREMENTS** | Add source; crawl job status |

### Call Handling

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/call-handling` |
| **NEWUI ROUTE** | `/voice/call-handling` |
| **VISUAL COMPONENT(S)** | newui simplified panels vs `CallHandlingOperationalPage` |
| **REAL DATA SOURCE** | `/api/solutions/appointment-receptionist`, `/api/voice/agents`, `/api/voice/call-handling/recent-transfers` |
| **REAL WRITE PATH** | POST appointment-receptionist; transfer/spam/after-hours editors |
| **MOCK DATA TO REMOVE** | `TRANSFERS`, `RECENT` constants |
| **PRODUCTION-ONLY FUNCTIONALITY TO PRESERVE** | `VoiceIngressSetupPanel` (MCTB vs AI switch), emergency transfer, spam, recording config, on-call schedule |
| **PERFORMANCE CONCERNS** | Load setup once; do not chain redundant agent list + receptionist GET per subpanel |
| **INTEGRATION NOTES** | **Critical:** newui omits inbound handler switch—must embed production switch UX in newui layout |
| **TEST REQUIREMENTS** | Switch handler (explicit); verify persistence without provider GET on unrelated pages |

### Analytics

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/analytics` |
| **NEWUI ROUTE** | `/voice/analytics` |
| **REAL DATA SOURCE** | `/api/voice/analytics`, export |
| **MOCK DATA TO REMOVE** | `CHART_WEEK` |
| **PRODUCTION-ONLY** | After-hours sub-route `/voice/analytics/after-hours` (no newui page—preserve link or merge) |
| **TEST REQUIREMENTS** | Date range; export if entitled |

### Numbers (shared nav)

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/voice/numbers` → redirect `MCTB_ROUTES.numbers` (`/mctb/numbers`) |
| **NEWUI ROUTE** | `/voice/numbers` (mock list) |
| **REAL DATA SOURCE** | `/api/mctb/numbers`, TFV, setup |
| **MOCK DATA TO REMOVE** | `NUMBERS` |
| **PRODUCTION-ONLY** | Buy flow `/voice/numbers/buy`, drawer host, sender mode |
| **TEST REQUIREMENTS** | Assign line; sender registration states |

---

## MCTB operational

### Overview

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb` |
| **NEWUI ROUTE** | `/mctb` |
| **REAL DATA SOURCE** | `loadMctbOverview` |
| **REAL READ PATH** | SSR `src/app/(app)/mctb/page.tsx` → `MctbOverviewView` |
| **MOCK DATA TO REMOVE** | `MISSED_CALLS`, `CONVERSATIONS`, `BUSINESS` |
| **PRODUCTION-ONLY** | Pause banner, setup health, inbound handling summary |
| **TEST REQUIREMENTS** | KPI parity with missed-calls list |

### Missed calls list

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/missed-calls` |
| **NEWUI ROUTE** | `/mctb/missed-calls` |
| **VISUAL** | `MissedCallsBrowser` vs `MctbMissedCallsView` |
| **REAL DATA SOURCE** | `loadMctbMissedCallsListData`, `/api/mctb/missed-calls` |
| **MOCK DATA TO REMOVE** | `MISSED_CALLS` |
| **PRODUCTION-ONLY** | URL filter persistence, legacy `/voice/missed-calls` redirect |
| **TEST REQUIREMENTS** | Filters survive detail navigation |

### Missed call detail

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/missed-calls/[id]` |
| **NEWUI ROUTE** | `/mctb/missed-calls/[id]` |
| **REAL DATA SOURCE** | `/api/mctb/missed-calls/[id]`, timeline libs |
| **MOCK DATA TO REMOVE** | Lookup in `MISSED_CALLS` / `CONVERSATIONS` |
| **PRODUCTION-ONLY** | Press-1 vs existing consent timelines, compliance + recovery bubbles, diagnostics |
| **TEST REQUIREMENTS** | Open conversation; no resend override |

### Inbox / Conversations

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/conversations` |
| **NEWUI ROUTE** | `/mctb/conversations` |
| **VISUAL** | `Inbox` vs `KimiConversationsConnected` |
| **REAL DATA SOURCE** | `loadConversations`, inbox APIs, eligibility engine |
| **MOCK DATA TO REMOVE** | `CONVERSATIONS`, local `sent` state |
| **PRODUCTION-ONLY** | Product filter `mctb`, permissions, composer gates (opt-out, sender) |
| **WRITE PATH** | Existing send/message APIs (not newui fake send) |
| **TEST REQUIREMENTS** | Send reply; suppressed states; refresh |

### AI Recovery

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/ai-recovery` |
| **NEWUI ROUTE** | `/mctb/ai-recovery` |
| **REAL DATA SOURCE** | `/api/mctb/ai-recovery/context`, `settings`, `/api/mctb/lead-recovery/config` |
| **MOCK DATA TO REMOVE** | `SaveBar` fake save |
| **PRODUCTION-ONLY** | Lead recovery provider panel, simulation drawer (`/api/mctb/lead-recovery/simulate`) |
| **NOTE** | `/mctb/ai-lead-recovery` production route—decide canonical URL (likely ai-recovery only) |
| **TEST REQUIREMENTS** | Save settings; entitlement for AI recovery |

### Voicemail inbox

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/voicemail` |
| **NEWUI ROUTE** | `/mctb/voicemail` |
| **VISUAL** | `VoicemailBrowser` vs `MctbVoicemailWorkspace` |
| **REAL DATA SOURCE** | MCTB voicemail loaders/APIs (see production component) |
| **MOCK DATA TO REMOVE** | `VOICEMAILS` |
| **PRODUCTION-ONLY** | Audio authoritative, transcript partial failure, link to missed call |
| **TEST REQUIREMENTS** | Play audio; mark reviewed if supported |

### Analytics

| Field | Value |
|-------|--------|
| **PRODUCTION ROUTE** | `/mctb/analytics` |
| **NEWUI ROUTE** | `/mctb/analytics` |
| **REAL DATA SOURCE** | `/api/mctb/analytics` |
| **MOCK DATA TO REMOVE** | `CHART_WEEK` |
| **PRODUCTION-ONLY** | Suppression drilldowns, funnel metrics rules (exclude Press-1 from KPI) |
| **TEST REQUIREMENTS** | Drilldown links with date range |

---

## MCTB setup

| newui route | Production route | Primary read/write | Mock in newui | Production-only to preserve |
|-------------|------------------|--------------------|---------------|------------------------------|
| `/mctb/setup` | `/mctb/setup` | `/api/mctb/setup`, `/api/mctb/overview`, multi-fetch overview view | `BUSINESS`, static checklist | Pause control, wizard entry `/mctb/setup/start`, missed-call-rules row |
| `/mctb/setup/phone` | `/mctb/setup/phone` | `/api/mctb/setup`, onboarding, forwarding verification | `BUSINESS`, `SaveBar` | Carrier guides, server-side verification evidence |
| `/mctb/setup/consent` | `/mctb/setup/consent` | `/api/mctb/setup`, `/api/mctb/consent-prompt` | `ConsentEditor` local state | Press-1 vs existing_consent, attestation, publish prompt |
| `/mctb/setup/text-back` | `/mctb/setup/text-back` | `/api/mctb/setup` | `TextBackEditor` local | Two-message Press-1 preview, segment encoding |
| `/mctb/setup/recovery` | `/mctb/setup/recovery` | `/api/mctb/setup` | `SaveBar` | Pause semantics, cooldown (not business-hours page) |
| `/mctb/setup/voicemail` | `/mctb/setup/voicemail` | setup + greeting studio APIs | `SaveBar` | Activate vs save, TTS/ElevenLabs/record |
| `/mctb/setup/notifications` | `/mctb/setup/notifications` | setup APIs | Static toggles | Real notification channels |
| `/mctb/setup/exclusions` | `/mctb/setup/exclusions` | `/api/mctb/exclusions` | `ExclusionsTable` local state | Workspace scoping, audit |
| `/mctb/setup/links` | `/mctb/setup/links` | `/api/mctb/booking-links` | Static URLs | CRUD booking links |
| `/mctb/setup/test` | `/mctb/setup/test` | `/api/mctb/live-test`, try-it | `BUSINESS` | Real test checkpoints, not fake % |

**Production setup routes without newui pages (CASE C — add using newui patterns):**

- `/mctb/setup/missed-call-rules` — **required** per MCTB spec 09; **missing from** `MCTB_SETUP_SECTIONS` in newui nav.
- `/mctb/setup/start` — guided wizard.
- `/mctb/setup/business-hours`, `/mctb/setup/follow-up` — redirect to recovery (preserve redirects).
- `/mctb/compliance/consent` — consent log audit (not in newui nav).

---

## SHARED (nav in newui, pages not built in sandbox)

Integration tabs from `INTEGRATION_TABS` → production `src/app/(app)/integrations/**` (17 pages). **No newui pages**—migrate shell only first, then restyle integrations using `newui/components/ui` + `kit` patterns.

| Production route | Notes |
|------------------|--------|
| `/integrations` (+ calendars, payments, native, crm, api, webhooks, logs) | OAuth connect flows, webhooks—high write risk |
| `/voice/numbers` → `/mctb/numbers` | See Numbers above |

---

## ACCOUNT / WORKSPACE / BILLING

| newui nav | Production | Notes |
|-----------|------------|--------|
| `/settings/billing` | `/settings/billing` | Stripe entitlements |
| `/settings` + tabs | `/settings/*` (17 routes) | Team, business, security, messaging—CASE C surfaces |

**SETTINGS_TABS** in newui only lists Business, Team, Billing—production has broader settings; preserve all routes, adopt newui form/table patterns incrementally (Phase 5–6).

---

## OTHER PRODUCTION SURFACES (out of newui scope but must not break)

Preserve routes and behavior (hidden nav OK per V1 flags):

- **Voice legacy:** `/voice/agents/*`, `/voice/setup`, `/voice/missed-calls`, `/voice/conversations`, `/voice/voicemail`, try-it, smart routing, campaigns, etc.
- **MCTB legacy:** appointments/booking/calendar/reminders/voice-agent under `/mctb/*` if still entitled.
- **Appointments V1:** `/appointments/*` (separate product; not in newui).
- **Mass texting:** `/campaigns`, `/conversations` global inbox.
- **Public/onboarding:** `/onboarding/mctb`, `/f/mctb/:token`.

---

# Final audit report (15 answers)

1. **Baseline:** Branch `cursor/newui-production-integration-audit-2304` @ commit **`41b29bdeae3cfb50f4eb99a75afbbaf354e46c1d`** (`origin/master`).

2. **Total newui routes:** **25** (voice 7 + mctb 17 + root redirect).

3. **Total applicable production routes:** **~131** in scope of newui nav families (voice **39**, mctb **32**, integrations **17**, settings **17**, plus shared numbers/compliance paths). **25** are direct newui mirrors requiring presentation swap; remainder are **CASE C** (preserve functionality, newui styling) or legacy redirects.

4. **Exact one-to-one route matches (25):**  
   `/voice/overview`, `/voice/calls`, `/voice/calls/[id]`, `/voice/receptionist`, `/voice/knowledge`, `/voice/call-handling`, `/voice/analytics`, `/voice/numbers` (prod redirects to mctb numbers),  
   `/mctb`, `/mctb/missed-calls`, `/mctb/missed-calls/[id]`, `/mctb/conversations`, `/mctb/ai-recovery`, `/mctb/voicemail`, `/mctb/analytics`,  
   `/mctb/setup`, `/mctb/setup/phone`, `/mctb/setup/consent`, `/mctb/setup/text-back`, `/mctb/setup/recovery`, `/mctb/setup/voicemail`, `/mctb/setup/notifications`, `/mctb/setup/exclusions`, `/mctb/setup/links`, `/mctb/setup/test`.

5. **Production routes without direct newui equivalent (selected):**  
   MCTB: `missed-call-rules`, `setup/start`, `compliance/consent`, `numbers`, `ai-lead-recovery`, appointments/booking/calendar/reminders/voice-agent.  
   Voice: full `agents/*` tree, `analytics/after-hours`, `needs-attention`, legacy missed-calls/conversations/voicemail under `/voice`, buy numbers, try-it, setup, etc.  
   Shared: all `/integrations/*` pages, most `/settings/*` beyond three tabs.

6. **Newui routes without production equivalent:** **None** (all mirror production paths). **Caveat:** newui `/voice/receptionist` and `/voice/knowledge` are **not feature-equivalent**—they are static mocks on the same URLs.

7. **Production functionality missing from newui:** Inbound call-handling switch & `VoiceIngressSetupPanel`; missed-call rules setup; consent log; real receptionist editor; knowledge CRUD/crawl; inbox send/eligibility; forwarding verification; wizard; platform sender / TFV states; AI lead recovery sub-UI; compliance surfaces; recordings/transcript tooling on call detail; pagination/API on calls list; entitlements-gated nav.

8. **Mock/demo in newui:** Listed in table above (`data.ts`, `SaveBar`, inbox send, exclusions, consent/text-back local state, call-handling/receptionist/knowledge static content, sidebar badges, topbar search/notifications).

9. **Reusable newui inventory:** See § “Reusable newui design system”.

10. **Production APIs/loaders reusable unchanged (representative):**  
    `loadMctbOverview`, `loadMctbMissedCallsListData`, `loadVoiceOverviewSummary`, `loadConversations`, `loadShellData`, `loadCallHandlingOwnershipState`, `/api/mctb/setup`, `/api/mctb/missed-calls`, `/api/mctb/analytics`, `/api/mctb/exclusions`, `/api/mctb/ai-recovery/*`, `/api/mctb/lead-recovery/*`, `/api/voice/calls`, `/api/voice/overview`, `/api/voice/analytics`, `/api/voice/knowledge/*`, `/api/solutions/appointment-receptionist`, `/api/mctb/inbound-handling` (POST switch only on explicit action).

11. **Areas requiring adapters:** Call row → `VoiceCall`; missed call row → `MissedCall`; conversation → inbox thread model; voicemail items; analytics series → `CHART_WEEK` shape; overview stats; number rows; recovery status enums (map to `RecoveryPill` / `OutcomePill`).

12. **Careful write-path integration:** Setup saves (`/api/mctb/setup`), consent prompt publish, exclusions mutations, booking links, AI recovery settings, appointment-receptionist (call handling), inbound-handling mode switch (Telnyx), message send, TFV/numbers, knowledge source mutations.

13. **Performance hot paths to avoid carrying forward:** Duplicate `fetch('/api/mctb/inbound-handling')` on every page; setup overview 6+ parallel client fetches; client-only voice calls page waterfall; global hydration of heavy dashboards; **any** Telnyx reconciliation on GET layout.

14. **Blockers:**  
    - Two component libraries (`src/components/ui` vs `newui/components/ui`)—need merge strategy.  
    - `newui` is separate package—integration path is **port components into `src/`**, not deploy `newui/` as second app.  
    - Receptionist/knowledge newui pages under-specified vs production editors.  
    - Missing missed-call-rules in newui nav/spec.  
    - Production `/voice/calls` still has demo mock fallback—must not confuse with newui migration.

15. **Proposed migration order:**  
    **Phase 1:** Tokens + port `ui` primitives + shell (`AppSidebar`/`Topbar`) wired to `loadShellData` / entitlements / call-handling read state.  
    **Phase 2:** Voice operational read surfaces: overview → calls list/detail → analytics.  
    **Phase 3:** MCTB operational: overview → missed calls → detail → voicemail → analytics → conversations (hardest: composer).  
    **Phase 4:** MCTB setup (phone, consent, text-back, recovery, voicemail, notifications, exclusions, links, test) + **add missed-call-rules** page in newui style.  
    **Phase 5:** Voice configuration: call-handling (with ingress panel), knowledge, receptionist editor shell.  
    **Phase 6:** Shared integrations + settings/billing + numbers; legacy route redirects; dead UI removal only after browser certification.

---

## Explicit non-goals (this pass)

- No production UI replacement  
- No backend refactors  
- No deletion of legacy components  
- No merge of `cursor/menu-page-ui-inventory-2304` into `master`

---

*Next step after review: authorize implementation per phase, starting with Phase 1 shell + shared primitives.*
