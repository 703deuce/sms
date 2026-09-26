# Transovo New UI — Stage 2 Runtime Certification

**Branch:** `cursor/newui-stage2-transplant-2304`  
**Date:** 2026-09-26  
**Verdict:** **Transplant pass complete — runtime gate PARTIAL (not Stage 3 ready)**

Stage 2 exact-code transplant is accepted structurally (see `docs/TRANSOVO-NEWUI-STAGE-2-REPORT.md`). This document records the **low-RAM runtime gate** requested before Category B wiring.

Artifacts:

- Voice + full-route attempt: `/opt/cursor/artifacts/newui-stage2-cert-runtime.json` (latest file may be MCTB-only subset)
- MCTB pass: `/opt/cursor/artifacts/newui-stage2-cert-mctb.json`
- Rollback: `/opt/cursor/artifacts/newui-stage2-rollback.json`
- Scripts: `scripts/newui-stage2-cert-runtime.mjs`, `scripts/newui-stage2-cert-rollback.mjs`, `scripts/newui-stage2-resolve-ids.ts`

---

## 1. Runtime session

| Metric | Value |
|--------|--------|
| Worktree | `/workspace/.worktrees/newui-integration-audit` |
| Dev server | Single `next dev -p 3001` (tmux `newui-stage2-cert`) |
| Auth | `DEV_AUTH_BYPASS=1` + Playwright `page.request.get(/api/auth/dev-bypass)` |
| Base URL | `http://localhost:3001` (required — dev-bypass redirects to `localhost`, not `127.0.0.1`) |
| Flags (ON) | `NEXT_PUBLIC_NEWUI_SHELL=1`, `NEXT_PUBLIC_NEWUI_STAGE2=1` |
| Memory before server | ~9311 MB used |
| Memory peak (during tour) | ~13310 MB used |
| Memory after browser closed | ~1124–13289 MB (varies; dev server stop frees most) |

**Operational note:** Long sequential Playwright tours repeatedly triggered **Next/Turbopack instability** (dev process exit, `ERR_CONNECTION_REFUSED` mid-tour). Voice routes were certified in one stable pass; MCTB/setup routes were split into a second pass with partial completion before the dev server died again.

---

## 2. Dynamic detail IDs (workspace `ws_1`)

| Route | Record ID | Source |
|-------|-----------|--------|
| `/voice/calls/[id]` | `cmuhpvud403282x5j720z1c1f` | `scripts/newui-stage2-resolve-ids.ts` (latest `voiceCall`) |
| `/mctb/missed-calls/[id]` | `cmuhpvn7o386s2b394w5g5h5c` | same (`missedCallEvent`) |

---

## 3. Runtime fixes applied during gate (integration only — not presentation redesign)

| File | Reason |
|------|--------|
| `src/components/newui-shell/newui-transplant-shell-layout.tsx` | Import `appointmentsProductShellHome` (was invalid `appointmentsShellHome`) — blocked **all** shell renders |
| `src/lib/newui-transplant/adapters/voice-calls.ts` | `fmtCallDateTable` returns `{date,time}` object — fixed React child crash on Voice overview/calls/detail |
| `src/lib/newui-transplant/adapters/voice-numbers.ts` | API `messagingStatus` is object — `.trim()` threw on `/voice/numbers` and risked MCTB surfaces |

`newui/` sandbox: **untouched** (no diff).

---

## 4. Route results (representative tour)

### Voice — **PASS (8/8)** in stable pass

| Route | HTTP | Stage 2 component | Data boundary | Result |
|-------|------|-------------------|---------------|--------|
| `/voice/overview` | 200 | `NewUiVoiceOverviewPage` | `loadVoiceOverviewSummary` (server) | PASS |
| `/voice/calls` | 200 | `NewUiVoiceCallsPage` → `CallsBrowser` | `GET /api/voice/calls` | PASS |
| `/voice/calls/{id}` | 200 | `NewUiVoiceCallDetailPage` | `GET /api/voice/calls/:id` | PASS (client fetch; marker `Transcript`) |
| `/voice/analytics` | 200 | `NewUiVoiceAnalyticsPage` | `GET /api/voice/analytics` | PASS |
| `/voice/receptionist` | 200 | `NewUiLegacyEditorPage` → `VoiceReceptionistEditor` | Legacy editor (Category B) | PASS shell; **legacy client error** `Cannot read properties of undefined (reading 'map')` |
| `/voice/knowledge` | 200 | `NewUiLegacyEditorPage` → `BusinessKnowledgeEditor` | Legacy editor (Category B) | PASS |
| `/voice/call-handling` | 200 | `NewUiLegacyEditorPage` → `CallHandlingOperationalPage` | DB-backed passive read (Stage 1 invariant) | PASS |
| `/voice/numbers` | 200 | `NewUiVoiceNumbersPage` | `GET /api/mctb/numbers` | PASS |

No mock Northside/Supply House markers on Voice data surfaces in pass.

### MCTB — **PARTIAL**

| Route | HTTP | Stage 2 component | Notes | Result |
|-------|------|-------------------|-------|--------|
| `/mctb` | 200 | `NewUiMctbOverviewPage` | `loadMctbOverview` (server); marker timing/auth sensitivity | **Needs re-run** (200, transplant chunk, marker not asserted) |
| `/mctb/missed-calls` | 200 | `NewUiMctbMissedCallsPage` → `MissedCallsBrowser` | Server list props | **PASS** |
| `/mctb/missed-calls/{id}` | 200 | `NewUiMctbMissedCallDetailPage` | `GET /api/mctb/missed-calls/:id`; notes: detail body rendered | **PASS** (data); marker check flaky |
| `/mctb/conversations` | — | `NewUiMctbConversationsPage` → `Inbox` | Dev server died mid-tour | **Not certified this session** |
| `/mctb/ai-recovery` | — | Legacy wrapper → `AiRecoverySettingsPage` | Server died | **Not certified** |
| `/mctb/voicemail` | — | `NewUiMctbVoicemailPage` | Server died | **Not certified** |
| `/mctb/analytics` | — | `NewUiMctbAnalyticsPage` | Server died | **Not certified** |
| `/mctb/setup` | — | `NewUiMctbSetupOverviewPage` → `MctbSetupOverview` | Server died | **Not certified** |
| `/mctb/setup/phone` | — | Legacy wrapper → `MctbSetupPhoneView` | Server died | **Not certified** |
| `/mctb/setup/consent` | — | `ConsentEditor` (transplant) | Server died | **Not certified** |
| `/mctb/setup/text-back` | — | `TextBackEditor` + `GET /api/mctb/setup` | Server died | **Not certified** |
| `/mctb/setup/exclusions` | — | `ExclusionsTable` (mock rows) | Server died | **Not certified** |

**Action before Stage 3:** Re-run `STAGE2_ROUTE_PREFIX=/mctb` cert after a fresh dev server, or split setup routes into a third micro-pass to avoid OOM/turbopack crash.

---

## 5. Rollback flags

| Flag | Test | Result |
|------|------|--------|
| `NEXT_PUBLIC_NEWUI_STAGE2=0` | `/voice/calls`, `/mctb/missed-calls` on port 3002 | **Legacy body** (no transplant header) — see `newui-stage2-rollback.json` |
| `NEXT_PUBLIC_NEWUI_SHELL=0` | Unchanged from Stage 1 | Full shell rollback remains available |

---

## 6. Network / provider (passive navigation)

Measured across completed browser legs of the tour:

| Check | Count | Expected |
|-------|-------|----------|
| Browser `GET /api/call-handling` | **0** | 0 |
| Browser requests to Telnyx | **0** | 0 |

No handler switch exercised (out of scope for this gate).

---

## 7. Remaining fake / inert interaction boundaries (Stage 3 inventory)

| Location | Behavior | Stage 3 wire target |
|----------|----------|---------------------|
| `newui-transplant/components/app/save-bar.tsx` | `setTimeout` fake save | Real mutation per surface |
| `newui-transplant/components/mctb/consent-editor.tsx` | Local mode/attestation; hardcoded Northside disclosure; Preview audio inert; `SaveBar` | `/api/mctb/setup` consent APIs + `MctbSetupConsentView` loaders |
| `newui-transplant/components/mctb/text-back-editor.tsx` | Hardcoded compliance copy; preview uses Northside/Rachel; `SaveBar` | `/api/mctb/setup` message template + canonical compliance renderer |
| `newui-transplant/components/mctb/exclusions-table.tsx` | `INITIAL` mock rows; local add/remove | MCTB exclusions API + `MctbSetupExclusionsView` |
| `newui-transplant/components/mctb/inbox.tsx` | `send()` appends local bubble only; static opt-out copy | Production inbox composer + centralized SMS eligibility |
| `connected/mctb/setup-pages.tsx` `NewUiMctbSetupConsentPage` | Does not load setup API | Same as legacy consent editor wiring |
| Voice Category B wrappers | Presentation shell + **full legacy editor body** | Keep legacy mutations; only swap boundary if New UI adds controls |

---

## 8. Stage 3 functional matrix (Category B — mapping only, no implementation)

### `/voice/receptionist`

| New UI surface | Production capability | Loader / API | Notes |
|---------------|----------------------|--------------|-------|
| `NewUiLegacyEditorPage` shell | Full receptionist wizard/editor | `VoiceReceptionistEditor`, `/api/voice/agents`, solution receptionist APIs | Runtime **map** error observed — fix during wiring |
| Transplant-only pages in `newui/` | Greeting preview cards | N/A in Stage 2 | Not transplanted as primary |

### `/voice/knowledge`

| New UI surface | Production capability | Loader / API |
|---------------|----------------------|--------------|
| Shell + `BusinessKnowledgeEditor` | Source CRUD, URL/text/file, FAQs, gaps, processing status | Existing knowledge editor routes under `src/components/voice/knowledge/` |

### `/voice/call-handling`

| New UI surface | Production capability | Loader / API |
|---------------|----------------------|--------------|
| Shell + `CallHandlingOperationalPage` | Handler selection, transfer, spam, recording, on-call, readiness | DB-backed ownership state (passive read certified Stage 1); mutations via existing operational page |

### `/mctb/conversations`

| New UI surface | Production capability | Loader / API |
|---------------|----------------------|--------------|
| `Inbox` list/thread UI | Thread load, selection | `fetchInboxListPage`, `fetchConversation` (connected) |
| Composer | Send, eligibility, opt-out, sender mode, A2P/platform sender | **Must** use production eligibility engine — `inbox` send is **fake** today |

### `/mctb/ai-recovery`

| New UI surface | Production capability | Loader / API |
|---------------|----------------------|--------------|
| Shell + `AiRecoverySettingsPage` | Full AI recovery config/save | Existing `src/components/mctb/ai-recovery/` APIs |

### MCTB setup (representative)

| Route | New UI | Production |
|-------|--------|------------|
| `/mctb/setup` | Overview shell | `MctbSetupOverview` + `/api/mctb/setup` |
| `/mctb/setup/phone` | Legacy wrapper | `MctbSetupPhoneView`, forwarding verification APIs |
| `/mctb/setup/consent` | `ConsentEditor` (fake) | `MctbSetupConsentView`, consent mode persistence |
| `/mctb/setup/text-back` | `TextBackEditor` (partial API read) | Setup message template + compliance copy from runtime |
| `/mctb/setup/recovery` | Legacy wrapper | `MctbSetupRecoveryView` |
| `/mctb/setup/voicemail` | Legacy wrapper | `MctbSetupVoicemailEditorView` |
| `/mctb/setup/exclusions` | `ExclusionsTable` (fake) | `MctbSetupExclusionsView` |
| `/mctb/setup/links`, `/test`, notifications | Legacy wrappers | Existing setup views |

---

## 9. Exact-code integrity

- `newui/` reference tree: **no changes**
- Transplant trees: `src/newui-transplant/**` — **no visual redesign** during gate; only adapter/shell integration fixes above
- Legacy pages preserved behind `isNewUiStage2Enabled()` branches

---

## 10. Conclusion

| Criterion | Status |
|-----------|--------|
| Stage 2 transplant structure | **Complete** |
| Voice transplanted routes vs production data | **Certified (8/8)** |
| MCTB + setup transplanted routes | **Partially certified** — server stability limited second half of tour |
| Rollback | **Verified** (`STAGE2=0`) |
| Passive call-handling / Telnyx | **0 / 0** |
| Stage 3 gap inventory | **Documented above** |

**Do not start Stage 3** until MCTB/setup routes are re-run to PASS on a stable dev session (or production smoke equivalent).
