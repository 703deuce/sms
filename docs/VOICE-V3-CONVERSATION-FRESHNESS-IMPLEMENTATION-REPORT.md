# Voice V3 — Conversation freshness implementation report

**Date:** 2026-09-19 (UTC)  
**Branch:** `cursor/voice-v3-conversation-freshness-architecture-2304`  
**Merge/deploy:** See **`docs/VOICE-V3-CONVERSATION-FRESHNESS-PRE-MERGE-REPORT.md`** — **CODE MERGE READY: YES**; **PRODUCTION CERTIFIED: NO** (PSTN re-delegation)  

**Architecture:** `docs/VOICE-V3-CONVERSATION-FRESHNESS-ARCHITECTURE.md` (CURRENT PRODUCTION DESIGN + HISTORICAL INVESTIGATION)

---

## 1. Code changes (this pass)

| Area | Change |
|------|--------|
| Coordinator correlation | `onDelegatedNestedResponseEvent` no longer falls back to `activeDelegationId` (missing `delegation_id` → log + skip). `registerPendingFunctionCall` rejects missing `delegationId` when **>1** delegation exists. |
| Observability | `hasFreshDelegationAtRevision`, `FRESH_DELEGATION_GAP_AFTER_REVISION`, `getPendingCallDelegationId` (test). |
| Event harness | `src/lib/voice-v3/testing/delegation-freshness-harness.ts` |
| Matrix tests | `scripts/test-voice-v3-conversation-freshness-matrix.ts` |
| Amy contract | `scripts/test-voice-v3-amy-redelegation-prompt-contract.ts` (prompt only; **not** Live model cert) |
| Helpers | `seedConversationRevisionForTests` in `scripts/voice-v3-test-helpers.ts` |
| Docs | Architecture split CURRENT vs HISTORICAL |

Prior foundation (unchanged intent): revision snapshot, stale gate, tool classes, stale read, book reconciliation telemetry, delegation policy text.

---

## 2. `activeDelegationId` audit

| Location | Class | Notes |
|----------|-------|-------|
| `onDelegationCreated` → `this.activeDelegationId = delegationId` | **A** | Convenience “latest delegation” pointer only. |
| `registerPendingFunctionCall` → fallback when `delegations.size ≤ 1` | **B** | Safe when only one delegation; explicit `delegationId` preferred. |
| `registerPendingFunctionCall` → reject if `>1` delegation and no `delegationId` | **C fixed** | Prevents ambient mis-attachment during overlap. |
| `onDelegatedNestedResponseEvent` → ~~`activeDelegationId` fallback~~ | **C fixed** | Requires explicit `delegation_id` on nested events. |
| `submitDelegatedFunctionCallOutput` → `input.delegationId ?? row.delegationId` | **Safe** | Pending row carries originating delegation. |
| `requestDelegatedProtocolContinuation` → `input.delegationId ?? activeDelegationId` | **B** | Input should carry delegation from submit path; fallback only when single-delegation sessions. |
| `requestResponseCreate` → updates phase on `activeDelegationId` | **A** | Conversational speak path only; not delegated tool protocol. |
| `hasOpenDelegationAwaitingTool` / speak queue | **A** | Session-level gating; does not block new `session.delegation.created`. |

Production `live-sideband-session.ts` passes `serverEvent.delegation_id` on every `response.event`.

---

## 3. Primary question: fresh delegation after stale

| Layer | Status |
|-------|--------|
| **Transovo blocks stale consequential tools** | **Proven** (matrix + unit tests). |
| **Transovo accepts overlapping delegations** | **Proven** — D2 stale + D3 fresh Call 2 structural replay; overlap correlation test. |
| **Transovo creates `session.delegation.created`** | **No** — OpenAI/Live emits; handlers do not suppress second delegation. |
| **Amy guarantees re-delegate after revision advance** | **Not proven** — OpenAI contract is **B** (permitted, model-dependent). Prompt contract tested; Live audio cert **NOT_RUN**. |
| **Gap observability** | `FRESH_DELEGATION_GAP_AFTER_REVISION` when stale exists without delegation at current revision. |

**Call 2 fix requires:** stale gates **plus** production PSTN proof that Amy issues a new delegation after meaningful redirect (or documented OpenAI limitation + product follow-up).

---

## 4. Test results

### Commands

```bash
npx tsx scripts/test-voice-v3-conversation-freshness.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-conversation-freshness-matrix.ts
npx tsx scripts/test-voice-v3-amy-redelegation-prompt-contract.ts
npx tsx scripts/test-voice-v3-pstn-hardening.ts
npx tsx scripts/test-voice-v3-scheduling-tool-integration.ts
```

### Matrix (implemented PASS ids)

`01`, `02`, `04`, `05`, `06`, `07`, `08`, `15`, `16`, `18`, `20`, `21`, `22`, `23`, `24` — see matrix script output line `VOICE_V3_CONVERSATION_FRESHNESS_MATRIX`.

### 25-case spec mapping

| Spec # | Status |
|--------|--------|
| 1–2 straight booking/callback (orchestration) | **PASS** (matrix 01–02) |
| 3–6 straight transfer/cancel/reschedule/SEND_LINK | **Not in matrix yet** — use existing product cert scripts |
| 7–14 switching | **Partial** — **07**, **08** event replay; others need same harness pattern |
| 15 rapid revision | **PASS** |
| 16 FIND race | **PASS** |
| 17 pre-write revision | **Partial** (stale book block in unit test) |
| 18 write during commit | **PASS** |
| 19 post-success before claim | **Not automated** |
| 20–23 overlap / interleave | **PASS** (20, 21, 22, 23) |
| 24–25 duplicate continuation / write | **24 PASS**; **25** needs dedicated idempotency scenario |

---

## 5. OpenAI / model uncertainty (post-deploy PSTN)

1. **Amy re-delegation timing** after barge-in / redirect while stale backend work runs.  
2. Whether Live coalesces multiple caller turns into **one** new delegation vs several.  
3. Conversational UX when `FRESH_DELEGATION_GAP_AFTER_REVISION` fires in production logs.

**Recommended PSTN calls after deploy**

1. Call 2 replay: book phrasing → mid-FIND redirect to callback → confirm `session.delegation.created` D3+ and `request_callback` from fresh delegation.  
2. Reverse: callback → book mid-chain.  
3. Monday → Tuesday during FIND (single fresh FIND on D2).  
4. Straight callback + SEND_LINK regression on production build.

---

## 6. Ready for merge?

**No.** Stale authorization and overlap correlation are substantially better, but **Amy re-delegation on real PSTN** remains the gating item for Call 2 class failures.

---

## 7. Files touched

See git history on branch; key additions: `delegation-freshness-harness.ts`, `test-voice-v3-conversation-freshness-matrix.ts`, `test-voice-v3-amy-redelegation-prompt-contract.ts`, coordinator correlation fixes, architecture/report updates.
