# Product UI gap inventory — reconciled (copy-paste checklist)

**Audit date:** 2026-09-22  
**Repository HEAD audited:** `ccfa2d3e1d0effb9fea39f86dcf146bfd915f14b` (`master`)  
**Last known production Voice deploy (Coolify):** `4f5e99e4c566190e98f43c39fab781d0417c4311` — see `docs/VOICE-V3-PRODUCTION-DEPLOYMENT-REPORT.md`  
**Post-deploy on `master` (not necessarily production yet):** call-history fixes `33531dee` → `ccfa2d3e`

**Scope:** Customer-facing **UI/frontend** for **AI After Hours (Voice V3)** and **MCTB**.  
**Out of scope for this list:** Voice pipeline architecture changes, freshness/prompt/filler optimization, billing/Stripe, logging-only work, Mass SMS launch nav.

**Method:** Read `origin/master` implementation. Treat September browser cert (`docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md`, git `2a0de8d7`) and `docs/VOICE-V3-REMAINING-FEATURE-REUSE-AUDIT.md` (2026-09-21) as **inputs**, not authority. Rows below are re-labeled **CLOSED**, **STALE**, **PARTIAL**, **REAL GAP**, or **DEFERRED**.

**Status legend**

| Label | Meaning |
|--------|---------|
| **CLOSED** | Implemented on `master`; runtime or UI matches product intent |
| **STALE** | Was true on old SHA/cert; superseded by current routes or code |
| **PARTIAL** | Backend or API exists; UI/wiring/cert incomplete |
| **REAL GAP** | Genuine remaining customer-facing work |
| **DEFERRED** | Explicitly out of current train (product decision) |

---

## Executive summary (what to do next)

**Do not** run a “restore every branch gap” pass. Restore/cert regression on your line already passed request-only, knowledge, website crawl, qualification, booking, SEND_LINK, transfer, filesearch, and related scripts at **`4f5e99e4`** (your screenshots).

**Highest-value UI-only work on `ccfa2d3e` (no runtime rewrite):**

1. **Voice call detail** — remove mock cost/provider/activity/tags; bind Activity Feed + sidebar to `/api/voice/calls/[id]` (events already returned).
2. **Knowledge / wizard crawl** — poll `crawlJobId` + show job progress on `/voice/knowledge` and wizard Information step (API enqueues crawl; UI treats scan as instant).
3. **MCTB** — re-run browser cert on current HEAD; fix any **still failing** save/reload journeys (phone setup, consent mode) with evidence, not Sept 8 assumptions.
4. **IA cleanup** — decide fate of extra `/mctb/*` product routes (calendar, ai-lead-recovery, etc.) vs canonical MCTB map.

**Optional deploy:** `ccfa2d3e` adds call-history UI/API fixes; validate with one PSTN call + call detail page before promoting past `4f5e99e4`.

---

## A. Voice V3 — runtime / cert items (mostly CLOSED on `master`)

Reconciliation of `docs/VOICE-V3-REMAINING-FEATURE-REUSE-AUDIT.md` §1 and your pre-deploy regression matrix.

| ID | Topic | Status | Evidence on `ccfa2d3e` | Notes |
|----|--------|--------|-------------------------|--------|
| V3-R01 | `submit_appointment_request` / REQUEST_ONLY | **CLOSED** | `src/lib/voice-v3/appointment-request/execute-submit-appointment-request.ts`, `tools/submit-appointment-request-tool.ts` | Cert script PASS at restore SHA |
| V3-R02 | Qualification evaluators | **CLOSED** | `src/lib/voice-v3/qualification/evaluate-qualification.ts`, used from `policy/effective-tool-authorization.ts`, `state/call-rules.ts` | Not “branch-only” on current `master` |
| V3-R03 | Urgency / service policy gates | **CLOSED** | `src/lib/voice-v3/urgency/`, `policy/effective-tool-authorization.ts` | |
| V3-R04 | Booking persistence after `BOOKING_CONFIRMED` | **CLOSED** | `persist-booking-after-confirmation.ts` imported from `calendar/book-dispatch.ts` → `markVoiceCallBooked` | Reuse audit §2 “no DB hook” is **STALE** for `master` |
| V3-R05 | Website crawl (~100 pages) | **CLOSED** (backend) | `knowledge/website-crawl/*`, `MAX_USEFUL_PAGES = 100`, job handler in `job-handlers.ts` | UI progress = **PARTIAL** (see UI-03) |
| V3-R06 | `scan_website` → crawl job | **CLOSED** (API) | `POST /api/voice/knowledge` `action: scan_website` enqueues `crawlJobId` | Wizard calls this API |
| V3-R07 | File search / business knowledge (runtime) | **CLOSED** (per your cert) | `knowledge/astra-knowledge-instructions.ts`, ingestion scripts in repo | Prompt mentions `search_business_knowledge` + `file_search`; cert PASS |
| V3-R08 | SEND_LINK matrix | **CLOSED** | `execute-send-booking-link.ts` (existing on master) | 14/14 PASS in your matrix |
| V3-R09 | Transfer system | **CLOSED** (core) | compile + authorize + Python executor stack | PSTN warm path = ongoing **cert**, not missing code |
| V3-R10 | Demo / env config fallback guard | **CLOSED** | `config/demo-config-fallback.ts`, `from-published-agent.ts` | active-agent demo fallback PASS |
| V3-R11 | Google Calendar PSTN BOOK in V3 dispatch | **PARTIAL** | Wizard: `appointments-step.tsx` lists Google; platform OAuth in `lib/calendar/*`; **no** `voice-v3/calendar/google/*`; `book-dispatch.ts` hardcodes `provider: "microsoft"` | If your PSTN Google booking PASS, workspace likely uses Microsoft strategy, SEND_LINK, or cert on different SHA—**do not** block UI work on re-implementing Google BOOK here |
| V3-R12 | Booking persistence **automated DB test** hung | **STALE** (test env) | N/A | Remote DB timeout ≠ product gap; re-run locally if needed |
| V3-R13 | `instructions.system` in Live V3 prompts | **REAL GAP** (low) | Wizard compile path; not mapped into V3 Live instructions per reuse audit §4 | UI/prompt wiring only—**DEFERRED** if freshness train excluded |
| V3-R14 | `VoiceToolExecution` rows on V3 Node tool path | **REAL GAP** (ops) | No `persistVoiceV3ToolExecution` under `voice-v3` | Forensics/metadata gap—not customer UI unless surfacing in Calls |
| V3-R15 | Conversation freshness (`markCallerTurnSemanticApplied` usage) | **DEFERRED** | Function exists in `conversation/caller-turn-manager.ts` | Explicitly out of restore/cert train per your notes |
| V3-R16 | Call recording E2E → playback | **PARTIAL** | `docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md` — native transcript PASS; Telnyx recording **NOT PROVEN** on reference call | UI on `calls/[id]` may show real recording when API has one |

---

## B. Voice V3 — customer UI (REAL GAP / PARTIAL)

| ID | Surface | Status | What’s wrong | Primary files |
|----|---------|--------|--------------|----------------|
| UI-V01 | Call detail — cost & provider | **REAL GAP** | Hard-coded `$0.15 (est.)` and `Twilio` for all non-demo calls | `src/app/(app)/voice/calls/[id]/page.tsx` |
| UI-V02 | Call detail — activity timeline | **REAL GAP** | Always `MOCK_ACTIVITY_EVENTS` even when API loaded | Same; API `src/app/api/voice/calls/[id]/route.ts` has `events` |
| UI-V03 | Call detail — tags / lead status | **REAL GAP** | Static “Sales”, “Interested (High)”, non-persistent select | `calls/[id]/page.tsx` |
| UI-V04 | Call detail — contact card | **REAL GAP** | “Last contact: 10 mins ago” placeholder | Same |
| UI-V05 | Call detail — header chrome | **PARTIAL** | Breadcrumb “AI Receptionist”; Share/Download/More not wired | Same |
| UI-V06 | Call detail — transcript/recording | **PARTIAL** | Main column uses API for many fields; cert gaps for recording playback | `calls/[id]/page.tsx`, call history cert doc |
| UI-V07 | Knowledge admin — multi-page crawl | **PARTIAL** | `/voice/knowledge` single-URL source add; no crawl job status UI | `voice/knowledge/page.tsx` vs `api/voice/knowledge/crawl/[jobId]` |
| UI-V08 | Wizard — website import | **PARTIAL** | `information-step.tsx` fires `scan_website` but does not poll `crawlJobId` / embedding readiness | `information-step.tsx` |
| UI-V09 | Voice test entry points | **PARTIAL** | Wizard test uses `VoiceV3BrowserCall`; legacy `voice-agent-builder.tsx` still `AgentBrowserCall` (Telnyx) | Labeling / route consolidation |
| UI-V10 | Overview positioning | **PARTIAL** | Shows `runningCampaigns`, monthly cost—Mass SMS / legacy positioning | `voice/overview/page.tsx` |
| UI-V11 | Terminology | **PARTIAL** | Mixed “AI Receptionist” vs “AI After Hours” in calls UI | Nav uses AI After Hours (`ai-after-hours-nav.ts`) |

**Suggested single UI pass order:** UI-V02 → UI-V01 → UI-V03/V04 → UI-V07/V08 → UI-V09.

---

## C. MCTB — browser cert reconciliation

Source: `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md` (2026-09-08). Re-checked routes on `ccfa2d3e`.

| Cert ID | Sept 8 result | Reconciled status | Notes |
|---------|---------------|-------------------|--------|
| MCTB-05 | FAIL phone setup reload | **REAL GAP** (until re-cert PASS) | Verify save/hydrate on `/mctb/setup/phone` |
| MCTB-08 | FAIL Press-1 diagnostics | **PARTIAL** | May need test/diagnostics surface on setup test—not primary nav |
| MCTB-09 / MCTB-10 | FAIL consent persist | **REAL GAP** (until re-cert PASS) | `/mctb/setup/consent` |
| MCTB-13 | FAIL `/mctb/setup/links` 404 | **STALE** | Route exists: `src/app/(app)/mctb/setup/links/page.tsx` |
| MCTB-14 | FAIL invalid token | **PARTIAL** | `MCTB-14-invalid` PASS; full cert row may need fixture |
| MCTB-19 / MCTB-22 | FAIL timeouts | **UNKNOWN** | Re-run cert; likely setup section or selector drift |
| MCTB-20 | FAIL legacy recovery redirect | **STALE** | `mctb/setup/business-hours/page.tsx` redirects to `setupRecovery` |
| MCTB-29 | FAIL no missed call fixture | **STALE** (test data) | Not a product gap if runtime has calls |
| MCTB reachability (01-home, etc.) | PASS | **CLOSED** | Routes under `/mctb/*` present |

**MCTB IA / extra routes (product decision, not runtime bugs):**

| Route | Status | Notes |
|-------|--------|--------|
| `/mctb`, `/mctb/setup/*` (canonical spec) | **CLOSED** (routes exist) | Includes `notifications`, `links`, `recovery`, legacy redirects |
| `/mctb/calendar`, appointments, booking, reminders, ai-lead-recovery, voice-agent | **DEFERRED / IA** | Not in canonical MCTB nav map—hide, redirect, or cross-sell |
| R-05 “7 days no forwarded calls” alert | **REAL GAP** (if still required) | No implementation found in `src/lib/mctb` grep |

**MCTB action:** Run fresh browser cert against `ccfa2d3e` (or target deploy SHA). Only treat rows that **fail again** as REAL GAP.

---

## D. Documents to treat as STALE for gap planning

| Document | Why stale |
|----------|-----------|
| `docs/PRODUCT-UI-GAP-INVENTORY-2026-09-22.md` | Not on `master`; mixed branch vs shipped state |
| `docs/VOICE-V3-REMAINING-FEATURE-REUSE-AUDIT.md` §1 table | Master % and “on branch only” columns outdated for R01–R10 |
| `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md` | 2026-09-08 / git `2a0de8d7`; many FAILs fixed in code since |
| Old “merge gap-closure branch” narratives | Superseded by merge at `4f5e99e4` + follow-ups |

**Still useful:** `docs/VOICE-V3-PRODUCTION-DEPLOYMENT-REPORT.md`, `docs/VOICE-V3-CERT-PRE-DEPLOY-GO-NO-GO.md`, `docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`, MCTB page build specs under `docs/TRANSOVO-MCTB-PAGE-BUILD-SPEC-*.md`.

---

## E. Copy-paste — one new phone call + UI smoke (after deploy)

Use this after promoting `ccfa2d3e` (or stay on `4f5e99e4` for runtime-only check). Cloud agents cannot place PSTN calls; run on your phone.

```
VOICE V3 — SINGLE CALL SMOKE (≈5–8 min)
Workspace: _______________________
Business line called: ______________
Deploy SHA (from /api/health): ______________

1. Call business number; let AI answer; one natural question (hours or service area).
2. If Press-1 MCTB line — skip (this is Voice-only smoke).
3. Complete ONE intent you care about this week:
   [ ] Microsoft book   [ ] Request-only   [ ] Send link   [ ] Transfer   [ ] Callback
4. Hang up; wait 2 min.
5. Admin: /voice/calls → open latest call.
   [ ] Transcript matches conversation (not empty / not mock-only sidebar)
   [ ] Activity feed shows real events (FAIL today if still mock list)
   [ ] Recording plays IF recording enabled (optional until recording cert done)
6. DB spot-check (optional): voice call row, appointmentBooked or request row if applicable.

PASS / FAIL: ______   Notes: _______________________________
```

```
MCTB — QUICK RELOAD SMOKE (≈10 min, browser)
Deploy SHA: ______________

1. /mctb/setup/phone — change nothing material; Save; hard reload — fields still present [ ]
2. /mctb/setup/consent — switch mode; Save; reload — mode persisted [ ]
3. /mctb/setup/links — page loads (not 404) [ ]
4. /mctb/setup/recovery — loads; /mctb/setup/business-hours redirects here [ ]

PASS / FAIL: ______
```

---

## F. Copy-paste — engineering checklist (UI closure pass only)

```
[ ] UI-V02 Wire Activity Feed to API events on voice/calls/[id]
[ ] UI-V01 Replace hard-coded cost/provider with API or hide until billing truth exists
[ ] UI-V03 Remove or wire tags/lead status to contacts/CRM
[ ] UI-V07 Poll crawl job + show status on /voice/knowledge
[ ] UI-V08 Wizard information-step: poll crawlJobId until embedding ready
[ ] UI-V09 Single labeled browser test entry (VoiceV3BrowserCall) on agent voice-test
[ ] MCTB Re-run browser cert; fix only failing save/reload rows
[ ] IA Hide or redirect non-canonical /mctb/* routes per page manifest
[ ] Do NOT change GPT-Live / Sol / book-dispatch Microsoft commit path in this pass
[ ] Do NOT deploy without explicit request; commit on branch + PR
```

---

## G. SHA reference (for your notes)

| SHA | Role |
|-----|------|
| `4f5e99e4c566190e98f43c39fab781d0417c4311` | Documented production Voice + web deploy |
| `ccfa2d3e1d0effb9fea39f86dcf146bfd915f14b` | Current `master`; call history cert fixes |
| `26c2f897` | Feature bundle (pre-cert) per your GO screenshot |
| `bf89fa2b` / PR #471 | Restore/reconnect slice — phased merges, not full UI inventory |

---

*Generated by code audit on `master` at `ccfa2d3e`. Update this file after the next browser cert run or production deploy pin.*
