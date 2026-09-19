# Voice V3 conversation freshness — pre-merge report

**Branch:** `cursor/voice-v3-conversation-freshness-architecture-2304`  
**Date:** 2026-09-19 (UTC)

---

## Verdict

| Gate | Status |
|------|--------|
| **CODE MERGE READY** | **YES** — all deterministic/local gates below pass |
| **PRODUCTION CERTIFIED** | **NO** — PSTN/Live re-delegation pending after deploy |

---

## 1. Files changed (this branch, cumulative)

**Core:** `conversation-revision.ts`, `conversation-freshness.ts`, `live-response-coordinator.ts`, `delegation-timing.ts`, `handle-delegated-voice-tools.ts`, `find-dispatch.ts`, `book-dispatch.ts`, tool freshness hooks, `live-delegation-policy.ts`, `live-frontend-instructions.ts`, `live-sideband-session.ts`

**Tests/harness:** `delegation-freshness-harness.ts`, `test-voice-v3-conversation-freshness.ts`, `test-voice-v3-conversation-freshness-matrix.ts`, `test-voice-v3-amy-redelegation-prompt-contract.ts`, `voice-v3-test-helpers.ts`

**Docs:** architecture, implementation report, this pre-merge report

**Not changed:** Microsoft booking/find/cancel/reschedule executors, `execute-request-callback` persistence core, `execute-send-booking-link` core

---

## 2. Runtime behavior changed

- Conversation revision from committed caller turns; delegation snapshots `basedOnConversationRevision`
- Semantic stale marks on revision advance; pre-dispatch authorization by tool class
- Protocol continues (`response.create`) without resetting freshness
- Stale READ apply ignored; stale steering blocked; committed writes reconcile
- Overlap: explicit `delegation_id` required when multiple delegations exist
- Telemetry: `FRESHNESS_TOOL_AUTHORIZATION_DECISION`, `FRESH_DELEGATION_GAP_AFTER_REVISION`, existing stale/continuation events

---

## 3. 25/25 certification matrix

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-conversation-freshness-matrix.ts
```

**Result:** `VOICE_V3_CONVERSATION_FRESHNESS_MATRIX_25_25` — all `C01`–`C25` PASS.

Harness uses production coordinator + `handleDelegatedAstraResponseEvent` + tool handlers. Switching cases simulate **Astra tool choice** after fresh `session.delegation.created`; Transovo does not classify caller intent.

---

## 4. Protected regressions (executed)

| Command | Result |
|---------|--------|
| `npx tsx scripts/test-voice-v3-conversation-freshness.ts` | PASS |
| `npx tsx scripts/test-voice-v3-pstn-hardening.ts` | PASS |
| `npx tsx scripts/test-voice-v3-scheduling-tool-integration.ts` | PASS |
| `npx tsx scripts/test-voice-v3-callback-matrix.ts` | TOTAL_PASS=17 |
| `npx tsx scripts/test-voice-v3-booking.ts` | PASS |
| `npx tsx scripts/test-voice-v3-delegation-protocol-race.ts` | PASS |
| `npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts` | TOTAL_PASS=14 |
| `npx tsx scripts/test-voice-v3-reschedule.ts` | PASS |
| `npx tsx scripts/test-voice-v3-cancellation.ts` | PASS |
| `npx tsx scripts/test-voice-v3-callback-invariants.ts` | PASS |
| `npx tsx scripts/test-voice-v3-callback-isolation.ts` | PASS |
| `npx tsx scripts/test-voice-v3-delegated-dedup.ts` | PASS |

---

## 5. Amy re-delegation contract

- **Compiled artifact:** `/opt/cursor/artifacts/voice-v3-amy-compiled-live-instructions.txt`
- **Test:** `npx tsx scripts/test-voice-v3-amy-redelegation-prompt-contract.ts` — PASS
- **Live model:** NOT_RUN_REQUIRES_LIVE_OR_PSTN

Policy includes generic re-delegation while backend work runs, illustrative examples only, confirmed provider facts preserved.

---

## 6–8. Correlation, stale-write, latency

- **Overlap:** C20/C22 — outputs correlated to correct `delegation_id`; D1 completion does not refresh D2 freshness (C21)
- **Stale continuation:** C23 — `response.create` after superseded output; subsequent write still blocked
- **Write races:** C18/C25 — in-flight commit completes; duplicate dispatch idempotent
- **Latency:** O(1) revision bookkeeping only; no added LLM or provider calls in freshness path

---

## 9–11. Frozen surfaces

| Surface | Changed? |
|---------|----------|
| Microsoft executors | **No** |
| Callback persistence executor | **No** |
| SEND_LINK executor | **No** |

---

## 12. Intent classifier introduced?

**No.** No keyword router, regex intent, CallerMeaning, or Transovo semantic routing.

---

## 13. Remaining PSTN-only uncertainty

Prove on real GPT-Live/PSTN after deploy:

`revision N → D1 stale → revision N+1 committed → session.delegation.created D2 → D2/Astra selects current operation → D1 cannot override`

Watch logs: `CALLER_TURN_COMMITTED`, `DELEGATION_SEMANTICALLY_STALE`, `FRESH_DELEGATION_GAP_AFTER_REVISION`, `FRESH_DELEGATION_CREATED`, `FRESHNESS_TOOL_AUTHORIZATION_DECISION`, `STALE_TOOL_DISPATCH_BLOCKED`.

**Suggested certification call:** Start booking/FIND, change mind mid-flight (callback or Tuesday correction); confirm fresh delegation + authorized tool from D2.

---

## 14. Approval

**CODE MERGE READY: YES**  
**PRODUCTION CERTIFIED: NO — PSTN pending**

Do not merge/deploy until product owner approves merge for certification deploy.
