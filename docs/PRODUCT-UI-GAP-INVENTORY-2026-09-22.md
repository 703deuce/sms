# Transovo product UI / frontend gap inventory

**Generated:** 2026-09-22 (UTC)  
**Scope:** Customer-facing UI and frontend wiring only — **AI After Hours (Voice V3 agent)** and **Missed Call Text Back (MCTB)**.  
**Explicitly out of scope for this list:** logging/observability consoles, pricing/billing/Stripe checkout, backend-only refactors unless they block UI truth.

**How to use:** Each line is a gap or partial item. Status keys: **NOT DONE** | **PARTIAL** | **BUILT — NOT CERTIFIED** | **IA / NAV DEBT** | **DEFERRED (product)**.

**Primary references:** `docs/VOICE-V3-REMAINING-FEATURE-REUSE-AUDIT.md`, `docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`, `docs/VOICE-V3-AFTER-HOURS-OPS-AUDIT.md`, `docs/VOICE-V3-TRANSFER-CERT-READINESS.md`, `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md`, MCTB page build specs 01–12, `docs/MCTB-FRONTEND-REBUILD-KICKOFF.md`, `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md`, `scripts/mctb-launch-readiness-matrix.ts`.

---

## Part 1 — AI After Hours / Voice V3 agent (UI → frontend)

### 1.1 Product shell & information architecture

| ID | Status | Gap |
|----|--------|-----|
| V3-IA-01 | **IA / NAV DEBT** | Focused nav (`ai-after-hours-nav.ts`) covers Overview, Agent, Calls, Knowledge, Call Handling, Numbers — many legacy `/voice/*` routes still reachable (setup, campaigns, receptionist, operations, testing, schedule, consent-log, billing, analytics variants) without Mode-4-style consolidation. |
| V3-IA-02 | **PARTIAL** | `/voice/overview` uses `VoiceSubNav` + live API — not fully aligned with single “AI After Hours” chrome spec; still shows campaign-oriented copy in places. |
| V3-IA-03 | **PARTIAL** | Multi-agent UX (`/voice/agents`, create agent) vs product contract “one Amy” — UI still exposes multiple agents; primary agent resolution depends on workspace config. |
| V3-IA-04 | **NOT DONE** | Embed / public agent surface (`/embed/voice/[agentId]`) — not in focused nav; completeness vs support model unclear. |

### 1.2 Appointment Receptionist wizard (configuration UI)

| ID | Status | Gap |
|----|--------|-----|
| V3-WIZ-01 | **BUILT — NOT CERTIFIED** | Wizard leaf manifest completeness: `callbackRequiredCollectFieldIds` in inventory but missing manifest row — `test-voice-v3-wizard-cert-matrix` / backend propagation can fail until fixed. |
| V3-WIZ-02 | **PARTIAL** | **Custom system instructions** (`instructions.system` / tone from publish) — editable in wizard/publish path but **not loaded into V3 GPT-Live `sessions.accept` instructions** (customer sees saved copy; live call may not use it). |
| V3-WIZ-03 | **PARTIAL** | **Agent name / business persona** on PSTN — prompt audit: `agentName` can fall back to env defaults instead of published wizard identity unless resolver passes wizard fields into `buildVoiceV3Prompts`. |
| V3-WIZ-04 | **PARTIAL** | Manifest “future consumer” flags vs compiled config — some controls save and compile but UI/runtime labels still imply “not wired” (documentation + status chips need alignment). |
| V3-WIZ-05 | **PARTIAL** | **REQUEST_ONLY** booking strategy — wizard UI supports mode; **`submit_appointment_request` executors** live on gap-closure branches, not fully on production line — UI can over-promise. |
| V3-WIZ-06 | **PARTIAL** | **Qualification / urgency** editors — compiled to config; evaluator/runtime on branch (`d275f9c3`) — UI fields may not change live call behavior on current `master`. |
| V3-WIZ-07 | **PARTIAL** | **Service-specific booking policy** — partial via services compile; full policy UI/engine not merged from gap-closure. |
| V3-WIZ-08 | **PARTIAL** | **Google Calendar** — provider appears in Appointments step OAuth flow; **Voice V3 book/find for Google** is separate engineering track — UI “connected” ≠ PSTN bookable on Google until certified. |
| V3-WIZ-09 | **PARTIAL** | Acuity / Cal.com — shown in calendar picker; comment in UI: **not wired for live booking** (sets disconnected state). |
| V3-WIZ-10 | **PARTIAL** | **Custom OpenAI voice** — gated by `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1`; not default customer path. |
| V3-WIZ-11 | **BUILT — NOT CERTIFIED** | **Emergency & human transfer** editor (`EmergencyTransferEditor`, waterfall, warm/direct) — UI substantial; **PSTN certification** (DIRECT / WARM / WATERFALL / exhausted) not signed off (`VOICE-V3-TRANSFER-CERT-READINESS.md`). |
| V3-WIZ-12 | **PARTIAL** | Publish blocking for warm transfer without outbound trunk — UI validation exists; customer must discover via publish error (UX polish). |
| V3-WIZ-13 | **PARTIAL** | **After-hours notifications** editor added; **transfer/booking notification hooks** in UI copy vs runtime — ops audit: event types defined, not all wired at boundaries. |
| V3-WIZ-14 | **PARTIAL** | **Messages & callbacks** / callback required fields — UI present; manifest gap V3-WIZ-01 blocks formal cert. |
| V3-WIZ-15 | **NOT DONE** | **Business auto-import / website review wizard** (Maps + multi-page crawl + diff/apply) — on branch (`6f0c8044`), **no customer UI on `master`**. |
| V3-WIZ-16 | **NOT DONE** | **Large-site knowledge crawl** (~100 pages, sitemap, job progress UI) — on branch (`55e48438`), **not on `master`**. |
| V3-WIZ-17 | **PARTIAL** | **Knowledge step** — single-URL scan + KB list (`/voice/knowledge`, `information-step`) — no in-call retrieval management UI on master beyond scan/sync; no merged RAG tool surfacing in wizard test. |

### 1.3 Voice test & activation (wizard Step 7 / agent editor)

| ID | Status | Gap |
|----|--------|-----|
| V3-TEST-01 | **BUILT — NOT CERTIFIED** | `VoiceV3BrowserCall` + `/api/voice/agents/:id/v3-wizard-live-test` wired in appointment receptionist `test-step.tsx` — **PART Q interactive Live audio certification** still required per `VOICE-V3-PR433-VERIFICATION-GATE-FULL-REPORT.md`. |
| V3-TEST-02 | **PARTIAL** | Legacy `AgentBrowserCall` (Telnyx WebRTC) still used in `voice-agent-builder.tsx` — parallel test path; risk of wrong stack for V3 validation. |
| V3-TEST-02 | **PARTIAL** | `voice-test` under `/voice/agents/[id]/voice-test` uses **receptionist** `VoiceTestStep` — verify parity with appointment receptionist wizard test path. |
| V3-TEST-03 | **PARTIAL** | “Call my phone” PSTN test — depends on number assignment + publish; no unified “certified ready” banner in UI. |

### 1.4 Calls workspace (list + detail) — post-call product UI

| ID | Status | Gap |
|----|--------|-----|
| V3-CALL-01 | **BUILT — NOT CERTIFIED** | **Call history product** — list uses real `/api/voice/calls`; **recording ingest → playback** not proven on staging PSTN (`VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md` **FAIL** until recording E2E). |
| V3-CALL-02 | **BUILT — NOT CERTIFIED** | **Browser UI pass** — list/detail/player/responsive **not completed** in certification; APIs smoke-tested only. |
| V3-CALL-03 | **PARTIAL** | **Call detail** — still uses **hard-coded mock “Activity Feed”** (`MOCK_ACTIVITY_EVENTS`) for all calls, not authoritative timeline API. |
| V3-CALL-04 | **PARTIAL** | **Call detail** — placeholder **cost** (`$0.15 (est.)`), **provider label “Twilio”**, static **Tags & Lead Status** — not runtime-backed (misleading if shown to customers). |
| V3-CALL-05 | **PARTIAL** | Demo call IDs still supported with mock transcript path — OK for demos; must not be linked from production nav as real data. |
| V3-CALL-06 | **PARTIAL** | **Full V3 lifecycle timeline** on detail — API has events; UI polish / authoritative ordering per spec ongoing (`VOICE-V3-AFTER-HOURS-OPS-AUDIT.md`). |
| V3-CALL-07 | **PARTIAL** | **Processing states** (recording/transcript/summary in flight) — partially implemented; needs browser proof on slow paths. |
| V3-CALL-08 | **PARTIAL** | **Speaker attribution display** — depends on recording channel map; empirical PSTN proof pending. |
| V3-CALL-09 | **PARTIAL** | **Deepgram fallback UI** — should reflect when native vs fallback transcript used; not proven in UI on real recording. |

### 1.5 Knowledge, call handling, numbers (standalone pages)

| ID | Status | Gap |
|----|--------|-----|
| V3-KNOW-01 | **PARTIAL** | `/voice/knowledge` — CRUD/scan for sources; **no merged** sitemap crawl job UI / progress on master. |
| V3-ROUTE-01 | **PARTIAL** | `/voice/inbound-routing` — call handling/routing presentation; alignment with compiled transfer + hours vs legacy voice routing unclear without walkthrough. |
| V3-NUM-01 | **PARTIAL** | `/voice/numbers` + buy flow — exists; entitlement and AI After Hours primary line assignment UX not fully certified. |

### 1.6 Runtime truth vs UI (customer-visible, not “logging”)

These affect what the UI should show as “configured” vs what calls actually do:

| ID | Status | Gap |
|----|--------|-----|
| V3-RT-01 | **PARTIAL** | Published wizard **silent env fallback** (`VOICE_V3_BOOKING_AGENT_CONFIG`) when snapshot missing — UI can show “published” while runtime uses demo config. |
| V3-RT-02 | **PARTIAL** | **Transfer destinations empty** at runtime despite wizard data — publish/snapshot/E.164 normalization failures → `TRANSFER_NOT_CONFIGURED` (UI should surface publish health). |
| V3-RT-03 | **PARTIAL** | **Booking persistence** — successful book on call may not create **`voice_appointments` / appointmentBooked** UI indicators on Calls list until post-book hook merged (reporting/outcome badges). |

### 1.7 Explicitly excluded from this gap list (per your request)

- Voice forensics / `VoiceToolExecution` rows / internal telemetry dashboards  
- Stripe, plan purchase, usage billing, `monthlyCostCents` on overview (may still display — treat as cosmetic until billing phase)  
- Mass SMS / campaigns / legacy voice AI platform pages (hidden nav, not V1 AI After Hours)  

### 1.8 Suggested priority order (UI-facing)

1. Call detail truthfulness (remove mock activity/cost/provider/tags; wire real timeline)  
2. Call history browser + recording playback certification  
3. Wizard manifest + publish health (transfer, identity, instructions.system)  
4. Step 7 Live browser cert + deprecate Telnyx browser test confusion  
5. Merge branch UI: REQUEST_ONLY, qualification, website crawl/knowledge  
6. Transfer PSTN cert + overview copy/IA cleanup  

---

## Part 2 — Missed Call Text Back (UI → frontend)

### 2.1 Canonical IA vs what exists in the repo

| ID | Status | Gap |
|----|--------|-----|
| MCTB-IA-01 | **PARTIAL** | Product home **`/mctb`** shipped (`mctbShellHome()` → `/mctb`) — good; **final legacy link sweep** across app/email/bookmarks still required per kickoff doc. |
| MCTB-IA-02 | **IA / NAV DEBT** | **Extra MCTB-prefixed routes** not in canonical IA map: `/mctb/calendar`, `/mctb/appointments/*`, `/mctb/booking/*`, `/mctb/reminders`, `/mctb/ai-lead-recovery`, `/mctb/voice-agent` — risk of duplicate or pre-rebuild surfaces. |
| MCTB-IA-03 | **IA / NAV DEBT** | Duplicate analytics entry: `/mctb/analytics` vs `/analytics/mctb`. |
| MCTB-IA-04 | **PARTIAL** | **Compliance hub** — spec: `/mctb/compliance` + `/mctb/compliance/consent`; only **consent** route present (no compliance landing). |
| MCTB-IA-05 | **PARTIAL** | **Numbers** — `/mctb/numbers` exists; manifest also lists Numbers under Configure — ensure one canonical entry in product nav vs setup phone roles. |
| MCTB-IA-06 | **PARTIAL** | Conversations canonical route **`/mctb/conversations`** implemented with inbox filter — some flows still land on **`/conversations`** without `product=mctb` (cert MCTB-57). |
| MCTB-IA-07 | **PARTIAL** | Legacy redirects in `next.config.ts` for missed-calls/setup/analytics — **business-hours / follow-up** → recovery: cert still reported failures on some paths (MCTB-20, MCTB-57-*); verify in current build and re-run browser cert. |

### 2.2 Setup workspace (spec 07–12) — section coverage

| ID | Status | Gap |
|----|--------|-----|
| MCTB-SET-01 | **PARTIAL** | Horizontal setup nav (`setup-sections.ts`) groups **Missed-call rules, Text back, Links** under **Recovery** section id — spec 07 lists them as **named setup areas**; discoverability/linking from Setup overview rows must match spec labels. |
| MCTB-SET-02 | **PARTIAL** | Routes exist: `/mctb/setup/missed-call-rules`, `text-back`, `links`, `recovery`, `consent`, `voicemail`, `notifications`, `exclusions`, `test`, `start` — **not all** listed as top-level setup nav items. |
| MCTB-SET-03 | **BUILT — NOT CERTIFIED** | **Phone & forwarding** — UI present; browser cert **MCTB-05 FAIL** (phone setup did not render after reload) — needs retest/fix. |
| MCTB-SET-04 | **BUILT — NOT CERTIFIED** | **Consent** — UI present; cert **MCTB-09/10 FAIL** (consent mode did not persist after reload). |
| MCTB-SET-05 | **PARTIAL** | **Text back** (spec 10) — press-1 dual bubble preview, segment count, sender/consent context — implement vs spec §84 checklist not formally signed off. |
| MCTB-SET-06 | **PARTIAL** | **Recovery controls** (spec 12) — replaces business-hours/follow-up; legacy routes still in repo (`business-hours`, `follow-up` pages) — redirect behavior must be 100%. |
| MCTB-SET-07 | **PARTIAL** | **Links & request form** — `/mctb/setup/links` **exists** (older cert reported 404 — likely stale); confirm nav link from Setup overview + save/reload journey. |
| MCTB-SET-08 | **PARTIAL** | **Notifications / handoff** — `/mctb/setup/notifications` exists (older cert 404 — stale); fields map to `MctbHandoffConfig` — browser cert failures on handoff flows (MCTB-35–38, 43–44) need retest. |
| MCTB-SET-09 | **PARTIAL** | **Test & diagnostics** — page exists; **MCTB-08 FAIL** Press-1 runtime diagnostics surface not available in cert environment. |
| MCTB-SET-10 | **PARTIAL** | **Wizard** `/mctb/setup/start` vs **onboarding** `/onboarding/mctb` — two process UIs; must share backend and not diverge (spec 07). |
| MCTB-SET-11 | **DEFERRED** | Spec 07 “Links & Request Form” / exclusions depth — out of scope notes in page-spec series for some passes; exclusions page exists — parity with manifest still owed. |

### 2.3 Operational pages (spec 01–06)

| ID | Status | Gap |
|----|--------|-----|
| MCTB-OP-01 | **PARTIAL** | **Overview** (`/mctb`) — real `loadMctbOverview`; page-spec §61 **DoD checklist** (30+ items) not tracked as complete in repo. |
| MCTB-OP-02 | **PARTIAL** | **Missed calls list** (spec 02) — table, filters, persistence on return — reachability PASS in old cert; full DoD (responsive, a11y, filter-empty) not ledgered complete. |
| MCTB-OP-03 | **BUILT — NOT CERTIFIED** | **Missed call detail** (spec 03) — route exists; cert **MCTB-29 FAIL** (no seeded detail link) — needs fixture/data + full lifecycle UI proof. |
| MCTB-OP-04 | **PARTIAL** | **Conversations** (spec 04) — Kimi inbox + `product=mctb`; deep link `/mctb/conversations/:id` — verify thread context panel (missed call link) per spec. |
| MCTB-OP-05 | **PARTIAL** | **Voicemail inbox** (spec 05) — `/mctb/voicemail` + setup; master-detail, partial failure states — DoD §114 not signed off. |
| MCTB-OP-06 | **PARTIAL** | **Analytics** (spec 06) — page exists; KPI definitions **R-03** in launch matrix: “definitions not locked” — UI may show metrics without documented denominators. |
| MCTB-OP-07 | **PARTIAL** | **AI Lead Recovery** (`/mctb/ai-lead-recovery`) — product extension surface; not in core MCTB page-spec 01–12 series — scope/cross-link rules need product decision. |

### 2.4 Public & onboarding

| ID | Status | Gap |
|----|--------|-----|
| MCTB-PUB-01 | **PARTIAL** | **`/f/mctb/:token`** public request form — cert **MCTB-14 FAIL** invalid token error UX; **MCTB-14-invalid PASS** — edge cases remain. |
| MCTB-PUB-02 | **PARTIAL** | Onboarding wizard — trial/TFV states; live PSTN verify **BLOCKED** in cert (expected). |

### 2.5 UI / config defects (settings coverage)

| ID | Status | Gap |
|----|--------|-----|
| MCTB-DEF-01 | **PARTIAL** | `requestFormEnabled`, `defaultLinkUrl`, `requestFormFieldsJson` — **settings coverage doc** flagged missing UI; **links page now implements** — update coverage proof + cert (was MCTB-13/48). |
| MCTB-DEF-02 | **PARTIAL** | Legacy schedule fields (`businessHoursOnly`, `allowedStartTime/EndTime`) — **runtime only** per coverage table; Recovery Controls UI must remain sole customer schedule story (no hidden weekly SMS schedule UI). |

### 2.6 Frontend rebuild / design-system completeness

| ID | Status | Gap |
|----|--------|-----|
| MCTB-UX-01 | **PARTIAL** | MCTB **not** in Mode 4 rebuild manifest — visual parity with Appointments relies on incremental `/mctb/*` build; no batch-state “complete” ledger like Mode 4 pages. |
| MCTB-UX-02 | **PARTIAL** | All page specs require: loading, empty, error, degraded, permission — **per-page DoD unchecked** in spec markdown. |
| MCTB-UX-03 | **PARTIAL** | Responsive/a11y (320px, 200% zoom, keyboard) — required by rules; **no consolidated QA sign-off** document post-rebuild. |
| MCTB-UX-04 | **NOT DONE** | **R-06** — user-facing sweep to remove **AI receptionist** references outside deferred/hidden areas. |
| MCTB-UX-05 | **NOT DONE** | **R-05** — “No forwarded calls in 7 days” alert surfacing in Overview/setup health. |

### 2.7 Browser certification snapshot (2026-09-08 — re-run recommended)

Older run: **129 PASS / 56 FAIL** overall (appointments + MCTB). **MCTB-specific failures** to retest after recent routes:

- MCTB-05 phone setup reload  
- MCTB-08 Press-1 diagnostics  
- MCTB-09/10 consent persist  
- MCTB-13/48 setup links (likely fixed — route exists)  
- MCTB-19/22/49 setup flow timeouts  
- MCTB-20/57 business-hours & follow-up → recovery redirect  
- MCTB-29 missed call detail seed  
- MCTB-31–34, 41–42, 46 — **404** (identify which routes; many may be fixed)  
- MCTB-35–38, 43–44 notifications (route exists now)  
- MCTB-57 conversations redirect expectation  

**Launch matrix UI rows:** `UI-01` all 9 pages real DB — **MANUAL**; `UI-02` signup E2E — **MANUAL** (excludes billing detail per your scope).

### 2.8 Explicitly excluded from this gap list (per your request)

- Stripe checkout, subscription webhooks, trial billing holds (matrix Phase Stripe/Trial — backend)  
- Internal admin snapshots `/api/admin/mctb/*`  
- Carrier live SMS/PSTN certification (runtime, not UI)  
- Mass texting / Smart Routing / AI receptionist products  

### 2.9 Suggested priority order (UI-facing)

1. Fix consent + phone setup save/reload (MCTB-09/10, MCTB-05)  
2. Re-run MCTB browser cert against current routes; close 404/redirect debt  
3. Missed call detail + Press-1 diagnostics surfaces (spec 03 + test)  
4. Setup IA: explicit Text back / Missed-call rules / Links in overview + nav  
5. Conversations deep links always `product=mctb`  
6. Remove or gate non-canonical `/mctb/appointments/*` etc.  
7. Page-spec DoD pass per route (01 → 12) with a11y/responsive  
8. Overview “needs attention” + metric definition copy (R-03, R-05)  

---

## Part 3 — Copy-paste master checklist (both products)

```
AI VOICE AGENT (UI/FRONTEND) — GAPS
[ ] Legacy /voice routes still reachable; focused AI After Hours IA incomplete
[ ] Wizard manifest incomplete (callbackRequiredCollectFieldIds)
[ ] Wizard custom instructions.system not applied to V3 live session
[ ] Wizard agent name/business identity can fall back to env on PSTN
[ ] REQUEST_ONLY / qualification / urgency UI vs runtime (branch not merged)
[ ] Google/Acuity/Cal.com calendar UI vs actual V3 book providers
[ ] Transfer editor UI vs PSTN cert (DIRECT/WARM/WATERFALL)
[ ] Knowledge: single-URL only; no merged sitemap/100-page crawl UI
[ ] Business import wizard not on master
[ ] Step 7 V3 browser Live test not interactively certified; Telnyx browser path still parallel
[ ] Call list real API; call detail uses mock activity + fake cost/provider/tags
[ ] Call recording playback + browser UI not certified
[ ] Call detail timeline/summary/processing states incomplete vs spec
[ ] Publish health: empty transfer destinations / env fallback not visible in UI

MCTB (UI/FRONTEND) — GAPS
[ ] Legacy /voice/* and /conversations link cleanup (product=mctb)
[ ] Non-canonical /mctb/* routes (appointments, booking, calendar, reminders, ai-lead-recovery, voice-agent)
[ ] /mctb/compliance landing missing (consent only)
[ ] Setup nav: text-back / missed-call-rules / links discoverability under Recovery grouping
[ ] Phone setup reload failure (cert)
[ ] Consent mode persist failure (cert)
[ ] Press-1 diagnostics in test UI (cert)
[ ] Links + notifications routes (verify cert after 404 fixes)
[ ] business-hours / follow-up → recovery redirects (verify)
[ ] Missed call detail journey + fixture (cert)
[ ] Page specs 01–12 Definition-of-Done not signed off in repo
[ ] Voicemail + analytics KPI definition alignment
[ ] Public request form invalid-token UX
[ ] Remove AI receptionist copy (R-06); 7-day no-forwarding alert (R-05)
[ ] Full browser cert re-run (2026-09-08 baseline stale)
```

---

*End of inventory.*
