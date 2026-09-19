# Voice V3 — Conversation freshness implementation report

**Date:** 2026-09-19 (UTC)  
**Branch:** `cursor/voice-v3-conversation-freshness-architecture-2304`  
**Status:** Foundation implemented — **do not merge or deploy** until full switching/race matrix + PSTN certification  

**Architecture:** `docs/VOICE-V3-CONVERSATION-FRESHNESS-ARCHITECTURE.md`

---

## Objective

Generic **semantic supersession** without Transovo intent classification:

- **Amy** owns the Live conversation.
- **Astra** delegations snapshot `basedOnConversationRevision` at `session.delegation.created`.
- New committed caller turns advance revision and mark older delegations **STALE** for new consequential work.
- **Physical** provider/protocol work may continue; **authorization** gates new steering/writes/terminal from stale delegations.

**Not used:** withheld `response.create` as a cancellation API, keyword routing, CallerMeaning, pre-Astra classifiers.

---

## Implemented components

| # | Spec item | Implementation |
|---|-----------|----------------|
| 1 | Conversation revision | `src/lib/voice-v3/conversation/conversation-revision.ts` — `getCurrentConversationRevision()` = last committed caller turn `sequence`; `CONVERSATION_REVISION_ADVANCED` via `delegation-timing.onCallerTurnCommitted` (wired from `caller-turn-manager.ts`) |
| 2 | Delegation snapshot | `live-response-coordinator.onDelegationCreated` — `basedOnConversationRevision`, `delegationCreatedOffsetMs`, `responseId`, `semanticFreshness: FRESH`; `DELEGATION_REVISION_SNAPSHOTTED`, `FRESH_DELEGATION_CREATED` |
| 3 | Semantic stale on new turn | `markDelegationsSemanticallyStale` when revision advances; `DELEGATION_SEMANTICALLY_STALE` |
| 4 | Tool classes | `delegation/conversation-freshness.ts` — SHARED_FACT, SEMANTIC_STEERING, READ, COMMITTED_WRITE, TERMINAL |
| 5 | Pre-dispatch gate | `handle-delegated-voice-tools.ts` — `shouldBlockStaleToolPreDispatch` → `STALE_TOOL_DISPATCH_BLOCKED` + `SEMANTIC_SUPERSEDED` tool output (protocol-safe) |
| 6 | Tool output protocol | `buildSemanticSupersededToolResult` — `status: superseded`, `reason: conversation_advanced`, revision fields |
| 7 | Delegated continuation | `requestDelegatedProtocolContinuation` still sends `response.create`; logs `STALE_DELEGATION_PROTOCOL_CONTINUED` when delegation stale (`note: protocol_completion_not_semantic_authorization`) |
| 8 | Amy re-delegate policy | `live-delegation-policy.ts` — explicit re-delegate when caller redirects during in-flight backend work |
| 9 | Coalesce rapid turns | **Partial** — revision is O(1) latest sequence; no extra Astra pass per fragment (Live transcript preserved). No new coalescing scheduler beyond existing turn commit quiet window. |
| 10 | activeGoal protection | `set-scheduling-preference-tool.ts`, `find-availability-tool.ts` — skip `BOOK_APPOINTMENT` goal merge when delegation semantically stale |
| 11 | Committed write reconciliation | `book-dispatch.ts` — `COMMITTED_WRITE_RECONCILED_AFTER_REVISION` when Graph confirm succeeds after revision advanced during commit |
| 12 | Stale read grounding | `find-dispatch.ts` — `STALE_READ_RESULT_IGNORED` when current revision > revision at FIND dispatch |
| 13 | Correlation | Pending function calls carry `delegationId`; coordinator map per delegation; `activeDelegationId` still used as fallback when Live omits id — **full cross-delegation race audit not complete** |
| 14 | Telemetry | See table below |
| 15 | Test matrix | Unit/integration subset — see below |
| 16 | Protected regressions | Microsoft/callback executors unchanged; scheduling hardening scripts re-run |

---

## Telemetry events

| Event | Where |
|-------|--------|
| `CONVERSATION_REVISION_ADVANCED` | `conversation-revision.ts` |
| `DELEGATION_REVISION_SNAPSHOTTED` | `live-response-coordinator.ts` |
| `DELEGATION_SEMANTICALLY_STALE` | `live-response-coordinator.ts` |
| `FRESH_DELEGATION_CREATED` | `live-sideband-session.ts` |
| `STALE_TOOL_DISPATCH_BLOCKED` | `handle-delegated-voice-tools.ts` |
| `STALE_READ_RESULT_IGNORED` | `find-dispatch.ts` |
| `STALE_DELEGATION_PROTOCOL_CONTINUED` | `live-response-coordinator.ts` |
| `COMMITTED_WRITE_RECONCILED_AFTER_REVISION` | `book-dispatch.ts` |

Existing pipeline logs (`DELEGATED_CONTINUATION_REQUESTED`, `ASTRA_FUNCTION_CALL_RECEIVED`, booking/callback logs) unchanged.

---

## Tool class behavior (stale delegation)

| Class | Pre-dispatch block? | Notes |
|-------|---------------------|--------|
| SHARED_FACT (`update_intake`) | No | Facts may still merge |
| READ (`find_*`) | No | May run; apply path may ignore stale conversation reads |
| SEMANTIC_STEERING (`set_scheduling_preference`) | Yes | No stale `BOOK_APPOINTMENT` goal |
| COMMITTED_WRITE | Yes | Superseded output unless commit already in flight |
| TERMINAL | Yes | |

---

## Automated tests

**Script:** `npx tsx scripts/test-voice-v3-conversation-freshness.ts`

Covers:

- Tool classification and stale block rules
- Delegation revision snapshot + manual stale mark
- Turn commit → auto stale via `onCallerTurnCommitted`
- Stale `set_scheduling_preference` does not set `activeGoal`
- Stale steering + `book_appointment` → superseded tool output (no provider dispatch)

**Also run (regression):**

- `npx tsx scripts/test-voice-v3-pstn-hardening.ts`
- `npx tsx scripts/test-voice-v3-scheduling-tool-integration.ts`

### Spec §15 matrix — status

| Scenario | Automated | Notes |
|----------|-----------|--------|
| 1–5 Straight paths | Partial | Covered by existing PSTN hardening / scheduling integration, not freshness-specific |
| 6–12 Operation switching | **Not yet** | Needs multi-step delegation simulation or recorded PSTN replay |
| 13–14 Day change / rapid revisions during FIND | Partial | Stale read ignore unit path only |
| 15 Pre-write revision | Partial | Stale `book_appointment` block test |
| 16 Write during revision | **Not yet** | Telemetry hook only (`COMMITTED_WRITE_RECONCILED_AFTER_REVISION`) |
| 17 Post-success before spoken confirm | **Not yet** | |
| 18–19 Delegation overlap / correlation | **Not yet** | Requires coordinator integration tests |

---

## Out of scope / deferred

- Microsoft provider executors, callback persistence modules (unchanged)
- Full 19-case switching matrix as dedicated CI suite
- PSTN manual certification (Call 2 replay, booking→callback)
- Optional lab: `scripts/voice-v3-live-delegation-continuation-lab.ts` (research only; not production gate)

---

## Success condition (remaining)

Before merge/deploy:

1. PSTN or high-fidelity simulation proving booking→callback (and reverse) with fresh delegation after turn advance.
2. Automated tests for overlapping delegations (18–19).
3. Confirm no duplicate provider writes / duplicate `function_call_output` under race (idempotency paths).

---

## Files touched (implementation)

**New**

- `src/lib/voice-v3/conversation/conversation-revision.ts`
- `src/lib/voice-v3/delegation/conversation-freshness.ts`
- `scripts/test-voice-v3-conversation-freshness.ts`
- `scripts/voice-v3-live-delegation-continuation-lab.ts` (optional)
- `docs/VOICE-V3-CONVERSATION-FRESHNESS-IMPLEMENTATION-REPORT.md`

**Modified**

- `src/lib/voice-v3/delegation/types.ts`
- `src/lib/voice-v3/delegation/live-response-coordinator.ts`
- `src/lib/voice-v3/conversation/delegation-timing.ts`
- `src/lib/voice-v3/live-sideband-session.ts`
- `src/lib/voice-v3/tools/handle-delegated-voice-tools.ts`
- `src/lib/voice-v3/tools/execute-voice-tool.ts`
- `src/lib/voice-v3/tools/types.ts`
- `src/lib/voice-v3/tools/set-scheduling-preference-tool.ts`
- `src/lib/voice-v3/tools/find-availability-tool.ts`
- `src/lib/voice-v3/calendar/find-dispatch.ts`
- `src/lib/voice-v3/calendar/book-dispatch.ts`
- `src/lib/voice-v3/prompts/live-delegation-policy.ts`
- `docs/VOICE-V3-CONVERSATION-FRESHNESS-ARCHITECTURE.md`
