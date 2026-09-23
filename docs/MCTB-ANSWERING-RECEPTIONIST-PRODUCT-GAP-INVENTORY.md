# MCTB + Call Answering + AI Receptionist — Product gap inventory

**Purpose:** Page-by-page inventory of what exists in the dashboard today and what still needs to finish for the **combined product group**:

- **Missed Call Text Back (MCTB)** — missed call → consent/eligibility → recovery SMS → conversations
- **Call answering ownership** — who handles forwarded ingress (MCTB TeXML vs AI voice agent)
- **AI receptionist / after-hours voice** — answer, route, book, transfer on live calls

**Audience:** Product, engineering, certification. Copyable checklist — no screenshots.

**Reconciled:** 2026-09-23 · **Baseline:** `master` post PR #484 (simplified launch FAQ on Company Brain).

**Authority order:** MCTB page manifest + build specs 01–12 → completion ledger → connectivity audits → `docs/V1-PRODUCTION-CERTIFICATION.md` → this doc (synthesis).

---

## 1. What “finished” means for this group

| Layer | Done when |
|-------|-----------|
| **UI / IA** | Every manifest route exists under `/mctb/*` (or declared legacy redirect); no orphan nav links; spec 01–12 checklists satisfied or explicitly deferred with product sign-off |
| **Runtime truth** | Visible controls map to persistence; preview matches send path; Press-1 + existing_consent both certified on PSTN |
| **Ownership** | One canonical ingress switch; MCTB pause ≠ disable forwarding; Voice path matches published agent runtime (V3 contract where that is the product) |
| **Conversational SMS** | Simplified launch: goal + template + **AI Replies** FAQ grounded on approved Company Brain (#484); advanced scenario editor optional post-launch |
| **Receptionist ops** | Call list/detail backed by real `VoiceCall` data (not demo mocks); Smith/Rosie parity items either shipped or explicitly out of V1 |
| **Launch gate** | `npm run test:v1-production-readiness` + documented live PSTN/SMS matrix + browser walkthrough evidence |

**Explicitly not required for MCTB simplified launch (separate items):** PLATFORM vs CUSTOMER SMS sender mode (`docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`), full Smith human receptionist queue, unified voice+SMS inbox, global “Publish” hub for all agent edits.

---

## 2. Product shells and navigation (cross-cutting)

| Surface | Canonical entry | Status | Gaps |
|---------|-----------------|--------|------|
| MCTB product shell | `/mctb/*` via `buildMctbV1Nav` | **Mostly complete** | Ledger: live console/network QA **BLOCKED** without authenticated deploy session |
| Legacy Voice MCTB | `/voice/missed-calls`, `/voice/setup`, … | **Redirects / dual** | Final pass: all in-app links → `/mctb/*` per `docs/MCTB-FRONTEND-REBUILD-KICKOFF.md` |
| AI After Hours shell | `/voice/overview`, `/voice/agents/*`, … | **Exists** | `ai_receptionist` still **deferred** in `v1-product-status.ts`; nav hidden unless `TRANSOVO_V1_SHOW_DEFERRED_NAV=1` |
| MCTB + Voice in one mental model | Call handling switch on `/mctb/voice-agent` | **Partial** | Switch not on Setup overview or onboarding; legacy `/numbers/[id]/call-handling` vs `mctbInbound` — see `docs/MCTB-FINAL-PRODUCT-DIRECTION-AUDIT.md` §1 |
| Entitlement mismatch | Customer sees “Voice Agent” in MCTB nav | **Gap** | V1 says AI receptionist deferred, but MCTB nav exposes Voice Agent + AI Lead Recovery — align entitlement, copy, and gating |

**P0:** Legacy link cleanup; ingress switch discoverability (Setup or onboarding + Numbers context).  
**P1:** Single “Business operating profile” IA (Smith/Rosie doc) — not a launch blocker for MCTB SMS.

---

## 3. MCTB operational pages

### 3.1 Overview — `/mctb`

| Status | **UI LOCKED** per `docs/MCTB-PAGE-BY-PAGE-COMPLETION-LEDGER.md` |
|--------|---------------------------------------------------------------------|
| Gaps | Authenticated **browser + network** regression not recorded in ledger; needs-attention deep links must stay aligned with runtime reason codes after any API change |

### 3.2 Missed Calls list — `/mctb/missed-calls`

| Status | **LOCKED** (list UI) |
|--------|----------------------|
| Gaps | **Consent filter PARTIAL** — filter UI without `consentMode` on list rows/API enrichment |
| Gaps | Live QA session (BLOCKED in ledger) |

### 3.3 Missed Call detail — `/mctb/missed-calls/:id`

| Status | **Route + view exist** (`MctbMissedCallDetailView`); **not** in completion ledger as LOCKED |
|--------|---------------------------------------------------------------------------------------------|
| Spec | `docs/TRANSOVO-MCTB-PAGE-BUILD-SPEC-03-MISSED-CALL-DETAIL.md` |
| Gaps to verify | Full §71 checklist: Press-1 **two-message** lifecycle, timeline from authoritative events (not frontend inference), header actions only real ops, partial degradation, permission states |
| Gaps | No dedicated visual-reference / ledger sign-off like Home and Missed Calls list |

**P0:** Spec 03 certification pass + ledger row.  
**P1:** Polish to Appointment-detail visual baseline.

### 3.4 Conversations — `/mctb/conversations`

| Status | **Wired** — shared inbox + MCTB filter (`product=mctb`) per spec 04 |
|--------|-----------------------------------------------------------------------|
| Gaps | **Not** unified with voice calls (Rosie/Smith “one inbox”); voice remains `/voice/calls` |
| Gaps | Conversation → appointment **attribution** (`conversationId` / `missedCallId` on create) — **GAP** in `docs/MCTB-CROSS-SURFACE-OWNERSHIP-AUDIT.md` |
| Gaps | Booking/pay actions gated on appointments entitlement — verify non–appointments workspaces |

**P0:** Attribution on book-from-thread if light booking is launch scope.  
**P1:** Unified conversations (voice + SMS) — receptionist product.

### 3.5 Voicemail inbox — `/mctb/voicemail`

| Status | **COMPLETE** in ledger (inbox + studio) |
|--------|------------------------------------------|
| Gaps | Live QA BLOCKED; ElevenLabs on **operational** inbox (not setup-only) — product choice vs spec 05 |

### 3.6 Analytics — `/mctb/analytics`

| Status | **COMPLETE** (UI) |
|--------|-------------------|
| Gaps | **Multi-line / business-line filter N/A** — API not implemented; KPIs must match Overview/Missed Calls denominators |
| Gaps | Live QA BLOCKED |

### 3.7 Compliance — `/mctb/compliance/consent`

| Status | **Route exists**; consent log linked from Setup consent |
|--------|----------------------------------------------------------|
| Gaps | Ledger does not lock compliance page; confirm parity with legacy `/voice/consent-log` redirect and spec audit requirements |

### 3.8 Public request form — `/f/mctb/:token`

| Status | **Route exists** |
|--------|------------------|
| Gaps | Links setup: **form field editor PARTIAL** (JSON saved, UI defaults only) — `docs/MCTB-SETUP-CONNECTIVITY-AUDIT.md` §F |

---

## 4. MCTB configuration (Setup)

Setup horizontal IA (`MCTB_SETUP_SECTIONS`): Overview, Phone, Recovery, Consent, Voicemail, Notifications, Exclusions, Test.  
**Sub-routes** (not top-level nav tabs): Text Back, Links, Missed-call rules (legacy redirects into Recovery).

| Page | Route | Ledger / audit | Gaps |
|------|-------|----------------|------|
| Setup overview | `/mctb/setup` | PASS | — |
| Phone & forwarding | `/mctb/setup/phone` | COMPLETE | Live forward verification (human PSTN) |
| Recovery controls | `/mctb/setup/recovery` | COMPLETE | Duplicate trigger editor vs legacy `/missed-call-rules`; **max attempts** read-only when simplified UI on; **follow-up** row links to Text Back but graph follow-up not editable in Setup |
| Consent | `/mctb/setup/consent` | COMPLETE | — |
| Text Back | `/mctb/setup/text-back` | Connectivity **Complete** | Under simplified launch: goal-driven section; ensure spec 10 two-bubble Press-1 preview everywhere |
| Links & request form | `/mctb/setup/links` | **Partial** | Custom form fields; duplicate `defaultLinkUrl` entry points (Links vs Recovery booking) |
| Notifications | `/mctb/setup/notifications` | COMPLETE | Launch: **email-only** team notifications (`MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY`); SMS/in-app matrix hidden; `bookingBehavior` storage vs thread wiring **Partial** |
| Voicemail setup | `/mctb/setup/voicemail` | Ledger **stale NOT_STARTED** vs later **COMPLETE** for inbox — **setup page implemented** | Reconcile ledger; onboarding voicemail step marks complete **without** persisting greeting (audit §2) |
| Exclusions | `/mctb/setup/exclusions` | COMPLETE (later ledger block) | Reconcile stale NOT_STARTED in §Setup shell |
| Test & diagnostics | `/mctb/setup/test` | Ledger **stale NOT_STARTED** | Page exists; Try It **disabled** in nav (`MCTB_LAUNCH_TRY_IT_ENABLED=false`); live test **Partial** (needs real calls/SMS); Try It consent TeXML sync **Partial** |
| Guided wizard | `/mctb/setup/start`, `/onboarding/mctb` | Onboarding COMPLETE | Align step copy with simplified launch (no Try It CTA) |

**P0:** Live PSTN matrix on Test page (forwarding + Press-1 + existing consent + reply).  
**P0:** PLATFORM/CUSTOMER sender configuration (not built).  
**P1:** Form field editor; editable max attempts / follow-up if product re-enables advanced recovery.

---

## 5. MCTB adjacent surfaces (same shell)

| Page | Route | Status | Gaps |
|------|-------|--------|------|
| AI Lead Recovery | `/mctb/ai-lead-recovery` | **UI Done** per `docs/MCTB-AI-LEAD-RECOVERY-COMPLETION-BOUNDARY.md` | Simplified launch: primary tuning is **AI Replies ON + goal** on Text Back/Recovery; full scenario UI is advanced. **Live validation** + screenshot QA open. Production 404 on route reported in one smoke — verify deploy routing/middleware (route exists in repo) |
| Voice Agent wizard | `/mctb/voice-agent` | **8-step wizard** (`docs/MCTB-VOICE-AGENT-WIZARD-EIGHT-SCREENS.md`) | Post-go-live edits spread across `/voice/agents/*`, Knowledge, inbound routing — no Rosie 12-card hub |
| Call handling switch | On voice-agent page | **Implemented** | V3 ingress may not match `setInboundHandlingMode` TeXML assistant path — **High** (`MCTB-FINAL-PRODUCT-DIRECTION-AUDIT.md`) |
| Light booking | `/mctb/calendar`, appointments, booking, reminders | **UI copies** appointments | Deep links to `/appointments/*` in places; packages/classes trim — `docs/MCTB-LIGHT-BOOKING-LEDGER.md` |
| Payments | `/payments` (shared) | Stripe Text-to-Pay wired | Refund from detail, invoice copy, error states **open** (completion boundary §D) |
| Integrations | `/integrations` | Shared workspace | OAuth here; LR owns policy targets only |
| Numbers legacy | `/mctb/numbers` | Redirect to phone drawer | OK |

---

## 6. AI receptionist / voice dashboard (`/voice/*`)

Treated as **execution layer** for answered calls when ownership = Voice Agent. V1 product flag: **deferred**, but code and **AI After Hours** nav are substantial.

| Page | Route | Status | Gaps |
|------|-------|--------|------|
| Overview | `/voice/overview` | Exists | Depth vs MCTB analytics; entitlement |
| AI Agent | `/voice/agents`, `[id]/*` | Exists | No single Publish hub; wizard split from MCTB `/mctb/voice-agent` for MCTB customers |
| Calls list | `/voice/calls` | **Mock/demo path** | `MOCK_CALL_ROWS` when not on API — **not production-finished** |
| Call detail | `/voice/calls/[id]` | **Mock transcript/activity** | No Smith-style **Call Decisions** timeline in UI (runtime forensics exist backend) |
| Knowledge | `/voice/knowledge` | Exists | Separate from MCTB Company Brain (intentional for FAQ SMS vs voice RAG) |
| Inbound routing | `/voice/inbound-routing` | Technical rules UI | Not the same as canonical **MCTB vs AI** switch — duplicate mental model |
| Conversations (voice) | `/voice/conversations` | Legacy SMS | Redirect/canonicalize to `/mctb/conversations` or `/inbox` |
| Analytics / billing | `/voice/analytics`, `/voice/billing` | Exists | Overlap with product-level Analytics |
| Tools / testing / AI platform | `/voice/tools`, `/voice/testing`, `/voice/ai-platform` | Admin-ish | Hide or gate for V1 customers |

**P0 (if AI receptionist is sold with MCTB):** Real call list/detail from `VoiceCall`; ingress alignment with Voice V3 PSTN contract.  
**P1:** Call Decisions UI, unified inbox, Receptionist Setup hub (`docs/RECEPTIONIST-SMITH-ROSIE-TRANSOVO-COMPARISON.md`).

---

## 7. Runtime, certification, and launch blockers (group-wide)

| Item | Status | Notes |
|------|--------|-------|
| V1 cert verdict | **MCTB NOT READY** | `docs/V1-PRODUCTION-CERTIFICATION.md` — live PSTN, A2P, browser evidence |
| TeXML frozen pipeline | Certified path locked | `npm run verify:mctb-final-pipeline` — env-dependent failures ≠ code regressions |
| Both consent modes | Required | press_1 + existing_consent |
| AI Replies FAQ | **Code complete** (#484) | Company Brain; not Voice V3 RAG |
| AI_BOOK at launch | Hidden | `MCTB_LAUNCH_HIDE_AI_BOOK_UI` |
| SMS sender mode | **Not implemented** | Explicit PLATFORM vs CUSTOMER |
| Billing / A2P honesty | PARTIAL | No send before approval; live TFV/10DLC human steps |
| Tenant isolation | Automated partial | Live verification needed |
| Lead Recovery E2E | Scripts exist | `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md` — manual on real SMS |

---

## 8. Prioritized finish list

### P0 — Ship MCTB + ownership + minimum credible receptionist

1. **Live certification matrix** — Press-1, existing consent, pause, reply, opt-out, A2P states (human + runbook).
2. **Missed call detail** — Spec 03 checklist + ledger lock.
3. **Ingress / call handling** — Document and fix Voice V3 vs TeXML assistant routing; switch discoverability on Setup/onboarding/Numbers.
4. **PLATFORM/CUSTOMER sender** — Product configuration + runtime semantics.
5. **Nav truth** — No 404s from sidebar; legacy `/voice/*` → `/mctb/*`; entitlement matches visible Voice Agent.
6. **Consent filter** — API/list enrichment for missed calls filter.
7. **Conversation → appointment attribution** — If booking from MCTB thread is launch-critical.

### P1 — Product completeness (post-launch or parallel)

1. Analytics multi-line filter API + UI.
2. Request form field editor; notification SMS/in-app when launch flag lifted.
3. Recovery: editable max attempts / follow-up graph controls (or remove misleading rows).
4. **Voice calls UI** — Replace mocks; call detail timeline/decisions.
5. Unified Conversations (voice + SMS) and Receptionist Setup hub (Rosie cards + Publish).
6. Human / Hybrid staffing mode (Smith parity) — new product layer.
7. Ledger hygiene — reconcile stale NOT_STARTED rows; add Missed Call Detail section.
8. Payments polish (refund, invoice status, errors).

### P2 — Strategic / competitor parity

- Website widget, live chat takeover, human queue, CSV export call log, call intelligence graphs — see Smith/Rosie comparison doc.

---

## 9. Page checklist summary (quick scan)

| Area | Route(s) | UI built? | Runtime wired? | Cert / spec done? |
|------|----------|-----------|----------------|-------------------|
| MCTB Home | `/mctb` | Yes | Yes | UI locked; live QA open |
| Missed calls | `/mctb/missed-calls` | Yes | Yes | UI locked; consent filter partial |
| Missed call detail | `/mctb/missed-calls/:id` | Yes | Mostly | **Spec 03 not locked** |
| Conversations | `/mctb/conversations` | Yes | Yes | Attribution gap |
| Voicemail | `/mctb/voicemail` | Yes | Yes | Live QA open |
| Analytics | `/mctb/analytics` | Yes | Yes | Multi-line gap |
| Setup (all sections) | `/mctb/setup/*` | Yes | Mostly | Test/live partial; ledger stale lines |
| AI Lead Recovery | `/mctb/ai-lead-recovery` | Yes | Yes | Live + screenshot QA |
| Voice Agent wizard | `/mctb/voice-agent` | Yes | Yes | Ingress alignment |
| Call handling | Switch on voice-agent | Yes | **Risk** | V3 vs TeXML |
| Voice calls | `/voice/calls` | Yes | **No (mock)** | **Major gap** |
| Voice agent admin | `/voice/agents/*` | Yes | Yes | Deferred product flag |
| Compliance | `/mctb/compliance/consent` | Yes | Yes | Verify vs spec |
| Public form | `/f/mctb/:token` | Yes | Yes | Field editor partial |

---

## 10. Canonical references

| Doc | Use |
|-----|-----|
| `docs/TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST.md` | Route completeness |
| `docs/TRANSOVO-MCTB-PAGE-BUILD-SPECS.md` | Per-page implementation specs 01–12 |
| `docs/MCTB-PAGE-BY-PAGE-COMPLETION-LEDGER.md` | What is LOCKED vs partial |
| `docs/MCTB-SETUP-CONNECTIVITY-AUDIT.md` | Control-level wiring |
| `docs/MCTB-FINAL-PRODUCT-DIRECTION-AUDIT.md` | Ownership, voicemail, launch flags |
| `docs/MCTB-SIMPLIFIED-LAUNCH-FAQ-CLOSURE-REPORT.md` | #484 FAQ scope |
| `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md` | Next messaging item |
| `docs/MCTB-AI-LEAD-RECOVERY-COMPLETION-BOUNDARY.md` | LR finish line |
| `docs/RECEPTIONIST-SMITH-ROSIE-TRANSOVO-COMPARISON.md` | Receptionist IA gaps |
| `docs/MCTB-VOICE-AGENT-WIZARD-EIGHT-SCREENS.md` | Wizard copy inventory |
| `docs/V1-PRODUCTION-CERTIFICATION.md` | Launch gate honesty |

---

*Update this inventory when a page moves to LOCKED, a cert row passes, or IA/entitlement decisions change.*
