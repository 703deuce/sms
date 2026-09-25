# Voice V3 — All-in-one (copy-friendly)

Single file: **operator order (Pass 1→2→3)**, **full Cursor Pass 1 prompt**, **Pass 1 report**, **after-hours market audit**, **cert checklist**.

**Last updated:** 2026-09-25  
**Pass 1 branch:** `cursor/voice-v3-e2e-product-completion-2304` (PR #505) — **closed; do not polish further.**  
**Pass 2 branch:** `cursor/voice-v3-pass-2-call-handling-2304` — Call Handling operational UI.  
**Cert order:** Merge Pass 1 → Pass 2 → PSTN certification.

---

## Table of contents

1. [Pass order (do not reorganize nav first)](#1-pass-order-do-not-reorganize-nav-first)
2. [Full Cursor prompt — Voice V3 end-to-end product completion pass](#2-full-cursor-prompt--voice-v3-end-to-end-product-completion-pass)
3. [Pass 1 report — matrix, UI inventory, certification, verdict](#3-pass-1-report--matrix-ui-inventory-certification-verdict)
4. [After-hours feature audit vs Smith / My AI Front Desk / Goodcall](#4-after-hours-feature-audit-vs-smith--my-ai-front-desk--goodcall)
5. [Key code pointers](#5-key-code-pointers)

---

## 1. Pass order (do not reorganize nav first)

Do **not** start reorganizing navigation yet. If transfers move to a new page before the feature-completeness pass finishes, you risk a polished page around incomplete functionality.

| Pass | Name | Goal |
|------|------|------|
| **1** | Product completeness | Every orange/partial item end-to-end: config → persistence → API → runtime → usable UI. PSTN-only items → **CERTIFICATION ONLY**. **No nav reorg.** |
| **2** | Product surface architecture | Once everything exists, pull buried capabilities out of the wizard (e.g. **Transfers / on-call**). |
| **3** | Certification | Certify the **finished** product, not something you are about to restructure. |

**Transfers rule (Pass 1):** Do **not** create the final **Call Handling / Transfers** page. Document every control the later page will need. Wizard stays the config entry point during Pass 1.

---

## 2. Full Cursor prompt — Voice V3 end-to-end product completion pass

Give Cursor this **before** Pass 2 UI structure work.

### Objective

Before reorganizing Voice V3 UI or creating dedicated pages, perform a complete **end-to-end product completion pass** on the existing **AI After-Hours Receptionist**.

We already have a substantial Voice V3 product.

- This is **NOT** an architecture rewrite.
- This is **NOT** permission to replace working Voice V3 runtime components.
- This is **NOT** a request to redesign navigation yet.

**Goal:** Every Voice V3 capability we intend to ship must exist end-to-end:

`configuration → persistence → API/backend → runtime consumption → resulting data/state → customer-visible management/result UI`

- Anything fully implemented and only waiting for PSTN certification → **CERTIFICATION ONLY** (no feature rewrite).
- Anything partial → **complete** it.
- Backend/runtime without customer UI → **surface** it.
- UI without wiring → **complete or truthfully hide**.

Do **not** count code existence alone as product completion.

### 0. Protected architecture — do not redesign

Preserve:

```
Telnyx PSTN → LiveKit SIP → Python LiveKit worker → AgentSession → GPT-Live
→ delegated Responses reasoning → LiveKit FunctionTools → Transovo V3 tool client
→ deterministic Transovo backend/runtime → providers
```

Do **NOT** introduce: another OpenAI websocket path, another conversational engine, custom STT/TTS stack, keyword routing, subagents, manual VAD replacement, another booking/transfer/post-call architecture, **MCTB PlatformSenderAssignment** into Voice routing.

Preserve **known-good Microsoft FIND/BOOK**. Trace existing behavior first.

### 1. Source of truth

Reconcile actual code against:

- `docs/VOICE-V3-POST-RECONCILIATION-COMPLETION-REPORT.md`
- `docs/VOICE-V3-GAP-RECONCILIATION-REPORT.md`
- `docs/VOICE-V3-TRANSFER-CERT-READINESS.md`
- `docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`
- Voice V3 wizard/config, APIs, runtime, customer-facing pages
- Feature audit hypothesis — **verify every status from source**

### 2. Define “done”

For each capability, trace: UI entry → config → validation → API → persistence → compiled/runtime config → runtime consumption → provider → persisted event/state → post-call (if any) → customer-visible result → error/fallback → **tenant isolation**.

Classify exactly one of: **COMPLETE** | **CERTIFICATION ONLY** | **PARTIAL — BACKEND/RUNTIME** | **PARTIAL — UI** | **PARTIAL — BOTH** | **INTENTIONALLY OUT OF SCOPE**.

### 3. Complete partial/orange surfaces

**A. Knowledge gaps** — Owner must: see gaps, see source calls, question/topic, review, add/correct approved knowledge, dismiss, resolve, link to call. **No** auto-learning from callers.

**B. Voice analytics** — Real Voice V3 surface from `loadVoiceAnalytics` / APIs. No fake after-hours page. **Do not** use MCTB analytics as final Voice experience.

**C. Call reasons** — Derive from outcomes, summaries, intake, post-call, transcript — no duplicate LLM pipeline unless necessary.

**D. Needs attention** — Callback, message, failed transfer, emergency, unresolved gap, booking failure, etc. — usable owner view without duplicate DB if possible.

**E. Recording** — Audit chain; fix only real breaks; else **CERTIFICATION ONLY**.

**F. Post-call summary/email** — Config UI must match runtime.

**G. Digest** — Truth: EXISTING COMPLETE | EXISTING PARTIAL | GENERIC INFRA ONLY | OUT OF SCOPE. Do not auto-build competitor morning digest.

**H. Transfer/on-call** — Complete chain; **document** future dedicated page; **do not** build that page in Pass 1.

Also audit: scheduling (MS/Google/Calendly/REQUEST_ONLY/SEND_LINK), spam/solicitor vs carrier SCREEN, website/knowledge self-serve, notifications, call history, self-serve test, tenant isolation.

### 4. Transfer/on-call — complete functionality first

Audit: wizard → persistence → compile → `authorize-transfer.ts` → on-call resolution → Python executor → outcomes → notifications → call detail/analytics.

**UI rule:** No final Transfers page in Pass 1. Document controls for Pass 2 page (destinations, warm/direct, waterfall order, timeouts, on-call, fallback, emergency, notifications).

### 5–13. Out of scope (do not build)

Human answering-service backup, payments, outbound AI campaigns, integration marketplace, second engine, full daytime front-office, MCTB platform sender changes, speculative competitor features.

### 14. Required output — feature completion matrix

Columns: Capability | UI | Persistence | Backend/API | Runtime | Result UI | Tenant scoped | Status before | Work performed | Status after | Certification needed

### 15. Required output — UI surface inventory

Current Voice customer pages + section **CAPABILITIES TOO BURIED FOR FINAL PRODUCT** (no moves yet). Transfers/on-call is the prime Pass 2 candidate.

### 16. Required output — remaining certification matrix

Tests: normal PSTN, callback/message, MS regression, Google, direct/warm/waterfall transfer, emergency/on-call, spam, recording ingest/playback, transcript, summary, email, webhook, new owner UI surfaces — with EXPECTED RESULT, EVIDENCE, PASS/FAIL.

### 17. Required final verdict block

```
VOICE V3 CORE ARCHITECTURE CHANGED: YES / NO
PARTIAL FEATURES REMAINING: [n]
BACKEND-ONLY CUSTOMER FEATURES REMAINING: [n]
UI-ONLY UNWIRED FEATURES REMAINING: [n]
CERTIFICATION-ONLY FEATURES: [list]
CUSTOMER-SPECIFIC MANUAL SETUP REMAINING: [list]
READY FOR UI INFORMATION-ARCHITECTURE PASS: YES / NO
READY FOR PSTN CERTIFICATION: YES / NO
READY FOR SELF-SERVE PAID ACQUISITION: YES / NO
```

### Change discipline

Read before editing. Smallest complete fix. Preserve working components. No production auto-deploy. No live Telnyx routing experiments. No MCTB platform sender changes. No MS FIND/BOOK changes without defect evidence.

---

## 3. Pass 1 report — matrix, UI inventory, certification, verdict

### Executive summary

Pass 1 closed three owner-facing gaps (no nav reorg, no Transfers page):

1. **Knowledge gaps** — `GET/PATCH /api/voice/knowledge-gaps`, panel on `/voice/knowledge#knowledge-gaps`, gaps on call detail API.
2. **Voice analytics** — Real `/voice/analytics` dashboard; `/voice/analytics/after-hours` → `/voice/analytics`; `voiceProduct` metrics on API.
3. **Needs attention** — Failed/exhausted `VoiceTransfer` (14d) with call links.

Remaining: mostly **CERTIFICATION ONLY** + Pass 2 surface architecture + ingress ops clarity.

### Work performed (Pass 1 branch)

| Area | Change |
|------|--------|
| Knowledge gaps | API + `KnowledgeGapsPanel` + call detail |
| Analytics | `VoiceAnalyticsDashboard`, no MCTB redirect |
| After-hours route | Redirect (stub removed) |
| Needs attention | `failed_transfer` kind |
| Docs | This all-in-one + split docs in `docs/VOICE-V3-E2E-*` |

### §14 — Feature completion matrix

| Capability | UI | Persistence | Backend | Runtime | Result UI | Tenant | Before | Pass 1 work | After | Cert needed |
|------------|----|-------------|---------|---------|-----------|--------|--------|-------------|-------|-------------|
| CFNA / keep number | Wizard + routing | Yes | Yes | Yes | Partial | Yes | PARTIAL-UI | — | PARTIAL-UI | PSTN ingress per tenant |
| GPT-Live Amy | Wizard | Yes | Yes | Yes | Calls | Yes | COMPLETE | — | COMPLETE | Smoke PSTN |
| Greeting / hours | Wizard | Yes | Compile | Yes | Calls | Yes | COMPLETE | — | COMPLETE | — |
| Website crawl | Wizard + KB | Yes | Jobs | RAG | Knowledge | Yes | COMPLETE | — | COMPLETE | Index/vector setup |
| FAQ / knowledge | Knowledge page | Yes | Yes | Yes | Search | Yes | COMPLETE | — | COMPLETE | — |
| Knowledge gaps | Knowledge panel | `voice_knowledge_gaps` | API | Post-call | Panel + detail | Yes | PARTIAL-UI | **Done** | COMPLETE | Real calls + post-process |
| Intake | Wizard | Yes | Tools | Yes | Detail | Yes | COMPLETE | — | COMPLETE | — |
| Take message | Wizard | Yes | Tool | Yes | Outcomes | Yes | COMPLETE | — | COMPLETE | PSTN |
| Callback | Wizard | Yes | Yes | Yes | NA + list | Yes | COMPLETE | — | COMPLETE | PSTN |
| MS book/find/reschedule/cancel | Wizard | Yes | FIND/BOOK | Yes | Detail | Yes | COMPLETE | — | COMPLETE | **Regression PSTN** |
| Google book | Wizard | Yes | Provider | Yes | Detail | Yes | PARTIAL | — | CERT ONLY | PSTN book |
| Calendly V3 | Blocked | — | — | — | — | — | OUT OF SCOPE | — | OUT OF SCOPE | — |
| Booking link SMS | Wizard | Yes | Yes | Yes | SMS | Yes | COMPLETE | — | COMPLETE | Sender |
| Emergency + on-call | Wizard | Yes | Auth | Python | Notify | Yes | COMPLETE | — | CERT ONLY | PSTN waterfall |
| Direct/warm/waterfall | Wizard | Yes | Auth+Py | Yes | Detail | Yes | COMPLETE | — | CERT ONLY | PSTN matrix |
| Transfer fallback | Wizard | Yes | Yes | Yes | Outcomes | Yes | COMPLETE | — | CERT ONLY | PSTN |
| Staff notifications | Wizard | Yes | Brevo/SMS | Events | Email/SMS | Yes | COMPLETE | — | COMPLETE | Deliverability |
| Spam solicitor | Wizard | Yes | Tool | Yes | Outcomes | Yes | COMPLETE | — | CERT ONLY | PSTN DECLINE |
| Carrier Spam Likely | Wizard | Meta | LiveKit | Hint | Meta | Yes | COMPLETE | — | CERT ONLY | Telnyx header |
| end_call | — | — | Catalog | Yes | — | Yes | COMPLETE | — | COMPLETE | — |
| Recording | Wizard | VoiceRecording | start-telnyx | Provider | Player | Yes | PARTIAL | — | CERT ONLY | E2E ingest/playback |
| Transcript | — | Yes | Pipeline | LK/DG | Detail | Yes | COMPLETE | — | COMPLETE | — |
| Summary | — | Insights | LLM | — | Detail+email | Yes | COMPLETE | — | COMPLETE | — |
| Webhooks | Config | Queue | emit | — | Logs | Yes | COMPLETE | — | COMPLETE | Test URL |
| Completed-call email | Notifications editor | Meta | notify | post-call | Email | Yes | COMPLETE | — | COMPLETE | Brevo |
| AI recovery SMS | Wizard | — | hook | SMS | — | Yes | COMPLETE | — | CERT ONLY | PSTN |
| Calls inbox/detail | `/voice/calls` | Yes | APIs | — | UI | Yes | COMPLETE | Gaps | COMPLETE | — |
| Voice analytics | Dashboard | Aggregates | API | — | UI | Yes | PARTIAL | **Done** | COMPLETE | — |
| After-hours analytics URL | Redirect | — | Same | — | Redirect | Yes | Stub | **Done** | COMPLETE | — |
| Call reasons | Outcomes table | outcome | API | Derived | Dashboard | Yes | PARTIAL | Outcomes | COMPLETE | Raw taxonomy |
| Needs attention | `/voice/needs-attention` | Mixed | Loader | — | UI | Yes | PARTIAL | +xfer fail | COMPLETE | — |
| Morning digest | Prefs | in-app | `notification_digest` | Generic | Email | Yes | PARTIAL | Audited | **GENERIC INFRA** | Not Voice product |
| Callback SLA overdue | Wizard | metadata | Job | Notify | In-app | Yes | COMPLETE | — | COMPLETE | — |

### §15 — UI surface inventory

| Route | Purpose |
|-------|---------|
| `/voice/receptionist` + wizard | Onboarding / agent config |
| `/voice/calls`, `/voice/calls/[id]` | Call list + detail |
| `/voice/knowledge` | KB + website scan + **knowledge gaps** |
| `/voice/analytics` | Voice metrics (not MCTB) |
| `/voice/needs-attention` | Callbacks, VM, MCTB, forms, **failed transfers** |
| `/voice/callback-requests` | Callback queue |
| `/voice/inbound-routing` | Handling mode |
| `/voice/reports` | Cross-product reports |
| `/voice/billing` | Usage |

**Too buried for final product (Pass 2 — do not move in Pass 1):**

| Capability | Today | Proposed Pass 2 home |
|------------|-------|----------------------|
| Transfers / on-call / waterfall | Wizard Call Handling | **Call Handling / Transfers** |
| After-hours notifications | Wizard | Settings or Call Handling |
| On-call schedule | Wizard | With transfers |
| Spam / blocklist | Wizard + API | Call Handling / Compliance |
| Business hours / holidays | Wizard | Hours & coverage |
| Recording / telephony | Wizard | Call Handling / agent |
| Webhooks | Integrations | Integrations |

**Transfer page control inventory (Pass 2):**

- `voiceV2HumanTransferEnabled`, `transferRouting` (single vs waterfall)
- `transferDestinations[]`, `transferPlanSteps[]` (order, warm/direct, ring seconds)
- `transferRingSeconds`, `transferFallback`
- On-call → `resolveActiveOnCallTarget`; after-hours → `authorize-transfer.ts`
- Urgency rules; `afterHoursNotifications`; `validateVoiceV3TransferPolicyForPublish`
- Runtime: `transfer_executor.py`; outcomes: `VoiceTransfer` + `notifyVoiceV3TransferOutcome`

### §16 — Certification matrix (all PENDING until run)

| Test | Expected | Evidence |
|------|----------|----------|
| After-hours PSTN call | Amy answers, tools work | Call + transcript |
| Callback / message | Persisted outcome | DB + NA |
| MS scheduling regression | FIND/BOOK OK | Script + PSTN |
| Google scheduling | Book on calendar | Tool trace |
| Direct / warm / waterfall transfer | Outcome + notify | VoiceTransfer + PSTN |
| Emergency on-call | On-call dest | Transfer + email/SMS |
| SCREEN / DECLINE spam | Policy honored | Screening metadata |
| Solicitor | Tool outcome | History |
| Recording ingest + playback | READY + UI plays | DB + browser |
| Transcript + summary | Completed | Detail |
| Completed-call email | Brevo sent | Idempotency |
| Webhook | 2xx | Delivery log |
| Knowledge gaps UI | Resolve → KB source | UI + sources table |
| Voice analytics | Loads | `/voice/analytics` |

### §17 — Final verdict

```
VOICE V3 CORE ARCHITECTURE CHANGED: NO

PARTIAL FEATURES REMAINING: 4
  - Voice ingress (MCTB toggle → Voice V3 PSTN) — ops/product
  - Recording E2E — CERTIFICATION ONLY
  - Google live book — CERTIFICATION ONLY
  - Morning digest as Voice product — GENERIC INFRA ONLY

BACKEND-ONLY CUSTOMER FEATURES REMAINING: 0 (Pass 1 scope)

UI-ONLY UNWIRED FEATURES REMAINING: 0 (Pass 1 scope)

CERTIFICATION-ONLY FEATURES:
  - Warm / direct / waterfall transfer
  - Emergency on-call PSTN
  - Google PSTN book
  - Carrier Spam Likely SCREEN
  - Solicitor DECLINE on PSTN
  - Recording ingest + playback E2E
  - AI recovery SMS E2E

CUSTOMER-SPECIFIC MANUAL SETUP REMAINING:
  - Outbound SMS number (booking link / recovery)
  - Calendar OAuth (Google/Microsoft)
  - Telnyx screening / trunk (platform)
  - LiveKit SIP outbound trunk (warm transfer)
  - Knowledge indexing / FileSearch

READY FOR UI INFORMATION-ARCHITECTURE PASS: YES

READY FOR PSTN CERTIFICATION: YES (after Pass 1 merge)

READY FOR SELF-SERVE PAID ACQUISITION: NO
  (PSTN matrix not run; ingress per tenant; recording E2E unproven)
```

### Digest audit (§G)

| Q | A |
|---|---|
| Producer | `processNotificationDigests()` — `src/lib/notifications/digest.ts` |
| Content | Unread **in-app** notifications (not Voice-specific) |
| Scheduler | `notification_digest` job — daily |
| Config | `workspaceNotificationPrefs.digestFrequency` |
| Classification | **GENERIC INFRA ONLY** — not Voice morning digest product |

### Recording path (§E)

`callRecording` → `startTelnyxRecordingForVoiceV3Call` → `VoiceRecording` → call API → player. **CERTIFICATION ONLY** unless staging finds pre-provider break (`VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`).

### Next steps (Pass 1 closed — do not continue polishing Pass 1)

1. Merge Pass 1 branch (#505).  
2. **Pass 2:** Product surface architecture — Call Handling / Transfers operational UI (same persisted config as wizard).  
3. Run §16 PSTN certification on the **finished** customer product (after Pass 2).  
4. Clarify customer-facing Voice V3 ingress when toggling AI on business number.

**Ordering rationale:** Certify after operational surfaces exist so transfer PSTN work is not immediately invalidated by moving configuration out of the wizard.

---

## 4. After-hours feature audit vs Smith / My AI Front Desk / Goodcall

**Scope:** Competitive / marketing truth for “AI after-hours receptionist.”  
**Legend:** ✅ code | 🟡 cert/external | 🟠 partial | ❌ missing | ⏭️ intentional skip

**Pass 1 updates (supersedes 🟠 rows below):** knowledge-gap **owner UI** on `/voice/knowledge`; **`/voice/analytics`** real dashboard; after-hours URL redirect; failed transfers in needs-attention. Recording E2E and PSTN transfer/book still 🟡.

### Short answer

Voice V3 is **largely implemented** on `master` (+ Pass 1 UI): booking, intake, callbacks, transfers (code), spam, on-call, notifications, post-call pipeline.

**Not ready for “Google Ads plumber, zero hand-holding”** until PSTN cert + recording E2E + per-tenant ingress proof.

**MCTB platform sender** is separate (engineering on `master`; handset cert pending).

### Ingress and positioning

| Capability | Status | Notes |
|------------|--------|--------|
| CFNA | ✅/🟡 | Verify number → Voice V3 PSTN |
| Keep existing number | ✅ | |
| Natural AI (GPT-Live) | ✅ | |
| Greeting / hours / context | ✅ | |
| Website auto-setup | ✅ | `website-crawl/*` |
| FAQs / custom knowledge | ✅ | |
| Knowledge-gap discovery | ✅/🟡 after Pass 1 | Post-call persist + owner UI; needs live calls |
| Custom intake + memory | ✅ | |

### Conversation actions

| Capability | Status |
|------------|--------|
| Take message / callback | ✅ |
| MS book / find / reschedule / cancel | ✅ (MS cert baseline) |
| Google book | 🟡 CERT ONLY |
| Send / SMS booking link | ✅ |
| Emergency + on-call | ✅ code / 🟡 PSTN |
| Direct / warm / waterfall | 🟡 CERT ONLY |
| Transfer fallback | ✅ |
| Emergency notifications | ✅ |
| Spam solicitor + blocklist | ✅ / 🟡 PSTN |
| Carrier Spam Likely | 🟡 CERT ONLY |
| end_call | ✅ |

### Post-call and dashboard

| Capability | Status |
|------------|--------|
| Recording | 🟠 → **CERT ONLY** (E2E unproven) |
| Transcript / summary / email | ✅ |
| Calls inbox / detail | ✅ |
| Voice analytics | ✅ after Pass 1 |
| After-hours analytics route | ✅ redirect after Pass 1 |
| Needs attention | ✅ improved Pass 1 |
| Knowledge-gap analytics | 🟠 (count on analytics; no separate report) |
| Webhooks | ✅ |
| Morning digest | ❌ Voice product — generic infra only |
| English/Spanish | ✅ model |

### Transfer / on-call (emphasis)

Wizard → `authorize-transfer.ts` → Python `transfer_executor.py` → notifications. **PSTN cert pending** (`VOICE-V3-TRANSFER-CERT-READINESS.md`).

### Post-call pipeline (on master)

```
runVoiceV3CallHistoryPostProcess → summary → runVoiceV3PostCallSideEffects (webhooks, gaps) → optional recovery SMS
```

### Scheduling

MS ✅ certified baseline · Google 🟡 · Calendly ❌ blocked · REQUEST_ONLY / SEND_LINK ✅

### MCTB platform sender (not Voice Amy)

| | |
|---|---|
| Platform TFN assignment | ✅ engineering |
| Handset / ACTIVE_ASSIGNMENT cert | 🟡 pending |

### Intentionally absent

Human backup call center · payments on call · integration catalog · outbound AI campaigns · full daytime front-office · Smith-style post-call SMS follow-up (foundation exists later)

### Market summary

For *“Keep your number; when you don’t answer after hours, Amy takes over”* — **feature-complete in software**, **not commercial-complete** until PSTN cert + recording E2E + ingress clarity.

### Go/no-go certification checklist

1. After-hours PSTN: FAQ → intake → callback or MS book  
2. Emergency → on-call waterfall → warm handoff → notifications  
3. Spam/solicitor path (DECLINE or SCREEN)  
4. Recording on → transcript → summary → email → playback  
5. Webhook + optional recovery SMS  
6. Knowledge gaps: open → resolve → KB source  
7. Voice analytics loads  

### Bottom line

- **Substantial product in code?** Yes.  
- **Safe to claim vs Smith with no footnotes?** Almost — cert + recording + ingress.  
- **Transfers held in implementation?** Yes; cert pending.  
- **Right next question:** Does every row work reliably enough for paid acquisition without hand-holding? **Cert first**, then Pass 2 UI for transfers.

---

## 5. Key code pointers

| Area | Path |
|------|------|
| Post-call pipeline | `src/lib/voice-v3/call-history/post-call-pipeline.ts` |
| Webhooks + knowledge gaps | `src/lib/voice-v3/post-call/run-post-call-side-effects.ts` |
| Knowledge gaps owner API | `src/app/api/voice/knowledge-gaps/route.ts` |
| Notifications | `src/lib/voice-v3/notifications/*` |
| Transfer auth | `src/lib/voice-v3/transfer/authorize-transfer.ts` |
| Transfer execution | `voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py` |
| Spam | `src/lib/voice-v3/spam-protection/*`, `voice-v3-livekit.ts` |
| Tools | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| Calls UI | `src/app/(app)/voice/calls/` |
| Analytics | `src/lib/voice/analytics.ts`, `src/components/voice/voice-analytics-dashboard.tsx` |
| Website crawl | `src/lib/voice-v3/knowledge/website-crawl/` |
| Needs attention | `src/lib/platform/needs-attention.ts` |
| Digest (generic) | `src/lib/notifications/digest.ts` |

---

*End of all-in-one document.*
