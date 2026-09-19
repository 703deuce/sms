# Voice V3 — Conversation freshness architecture

**Date:** 2026-09-19 (UTC)  
**Status:** Investigation + **implementation foundation** (branch `cursor/voice-v3-conversation-freshness-architecture-2304`) — **stop before merge/deploy** until PSTN + Amy re-delegation certification  
**Evidence:** Production Call 2 (`v3:Pr6y46…`, deploy `ea2114d9`), installed OpenAI Live SDK types, Voice V3 production code paths  

**Companion documents:**

- `docs/VOICE-V3-CALLBACK-CALL-2-BOOKING-TO-CALLBACK-FORENSIC-REPORT.md`
- `docs/VOICE-V3-TURN-REVISION-AND-OPERATION-LIFECYCLE-BENCHMARK.md`
- `docs/VOICE-V3-CONVERSATION-FRESHNESS-IMPLEMENTATION-REPORT.md` — what shipped, telemetry, test matrix status

---

## Executive summary

Call 2’s **first failing boundary** is **session orchestration**, not callback persistence or callback prompting:

1. Caller turn **10** committed → Live created **delegation D2** (~`21:43:11` UTC).
2. D2 began a **multi-tool Responses chain** (`update_intake` → `set_scheduling_preference` → `find_availability`).
3. Caller turns **11–16** committed **during** that chain.
4. Transovo **never** obtained a **fresh** `session.delegation.created` / Astra semantic pass for the updated conversation.
5. Transovo **continued** the old chain via **`response.item.create` (function_call_output)** + **`response.create`** (delegated protocol continuation).

**Target fix:** **Freshness orchestration** — deterministic conversation revision vs delegation revision — **not** intent classification (no keyword router, CallerMeaning revival, or Transovo “callback means X”).

**Authorization model (implementation):** A delegation is authorized for **semantic decisions** against the conversation revision snapshotted at `session.delegation.created`. When `currentConversationRevision > basedOnConversationRevision`, that delegation is **semantically stale**: it must not launch **new** consequential tools (steering, writes, terminal), but may still complete OpenAI protocol (`response.item.create` + `response.create`) and in-flight provider commits. **Withholding `response.create` is not documented as cancellation** and is **not** the production supersession mechanism.

**OpenAI protocol facts (verified):** Live documents **`response.item.create`** (including `function_call_output`) and **`response.create`** (request or continue delegated Responses work). **`response.cancel` is not** on the GPT-Live delegation surface. Caller interruption does **not** imply backend cancellation; Live and delegated backend work are separate timelines (`session.delegation.created` carries its own `delegation.id`, `response_id`, `offset_ms`).

---

## CURRENT PRODUCTION DESIGN (authoritative)

1. **Semantic supersession ≠ protocol cancellation ≠ provider cancellation.**
2. **`response.create` may continue** a stale delegation’s OpenAI protocol after `function_call_output`; continuation does **not** reset `semanticFreshness`.
3. **Pre-dispatch authorization** blocks stale delegations from **new** `SEMANTIC_STEERING`, `COMMITTED_WRITE`, and `TERMINAL` tools; `SHARED_FACT` and `READ` follow class policy.
4. **Fresh delegations are independent** — each `session.delegation.created` snapshots `basedOnConversationRevision`; stale D1 does not contaminate fresh D2 when `delegation_id` is explicit on `response.event`.
5. **Transovo does not create delegations** — Amy/Live emits `session.delegation.created`. Transovo logs `FRESH_DELEGATION_GAP_AFTER_REVISION` when revision advances while stale delegations exist but no delegation snapshots the current revision (observability only).
6. **Fresh Astra availability (OpenAI contract):** SDK/docs describe **multiple** delegations over a Live session (`delegation.id` per `session.delegation.created`). **Not guaranteed** that Amy will delegate again after every caller turn — **model behavior (B)** plus **Amy prompt contract**. Transovo does **not** suppress a second `session.delegation.created` when OpenAI sends it (**not C** in production handlers).

**Tests:** `scripts/test-voice-v3-conversation-freshness-matrix.ts` (event harness), `scripts/test-voice-v3-amy-redelegation-prompt-contract.ts` (prompt only).

---

## HISTORICAL INVESTIGATION (superseded hypotheses)

The sections below retain Call 2 forensics and early Gate B / “withhold `response.create`” hypotheses. **Do not implement withholding as supersession.** Lab script `scripts/voice-v3-live-delegation-continuation-lab.ts` is optional research only.

---

## 1. Exact current delegation lifecycle (Investigation 1)

### 1.1 Event flow (production Voice V3 basic / intake pipeline)

```
GPT-Live (Amy)
  │
  ├─► session.delegation.created
  │         live-sideband-session.ts (type === "session.delegation.created")
  │         ├─ commitCallerTranscript(sessionId)  [legacy buffer]
  │         └─ VoiceV3LiveResponseCoordinator.onDelegationCreated({ id, response_id? })
  │
  ├─► response.event (nested Responses stream)
  │         live-sideband-session.ts → handleDelegatedAstraResponseEvent()
  │         ├─ coordinator.onDelegatedNestedResponseEvent(delegationId, nested)
  │         └─ on response.output_item.done + function_call:
  │                handleDelegatedVoiceToolCall() [microtask]
  │
  │    Nested types handled:
  │         response.created | response.in_progress  → phase STREAMING
  │         response.output_item.done (function_call) → dispatch tool
  │         response.completed                        → phase COMPLETED, scheduleContinuationFlush
  │         response.failed | response.incomplete     → terminal phases
  │
  ├─► Tool path
  │         handle-delegated-voice-tools.ts
  │         ├─ registerPendingFunctionCall()
  │         ├─ executeVoiceTool() → execute-voice-tool.ts / per-tool modules
  │         └─ completeDelegatedFunctionCall()
  │                └─ coordinator.submitDelegatedFunctionCallOutput()
  │                       ├─ outbound: response.item.create { function_call_output }
  │                       └─ if no pending outputs:
  │                              requestDelegatedProtocolContinuation()
  │                                   └─ outbound: response.create { event_id }
  │
  └─► (repeat nested response.event until response.completed for that continuation)
```

### 1.2 Source file / function index

| Step | File | Function / symbol |
|------|------|-------------------|
| Sideband ingress | `src/lib/voice-v3/live-sideband-session.ts` | `handleLiveSidebandServerEvent` (delegation + `response.event`) |
| Delegation register | `src/lib/voice-v3/delegation/live-response-coordinator.ts` | `onDelegationCreated` |
| Nested Responses | `src/lib/voice-v3/intake/handle-delegated-meaning.ts` | `handleDelegatedAstraResponseEvent` |
| Tool dispatch | `src/lib/voice-v3/tools/handle-delegated-voice-tools.ts` | `handleDelegatedVoiceToolCall` |
| Tool execution | `src/lib/voice-v3/tools/execute-voice-tool.ts` | `executeVoiceTool` |
| Output + continuation | `src/lib/voice-v3/delegation/complete-delegated-function-call.ts` | `completeDelegatedFunctionCall` |
| Protocol output | `live-response-coordinator.ts` | `submitDelegatedFunctionCallOutput` |
| Protocol continuation | `live-response-coordinator.ts` | `requestDelegatedProtocolContinuation` |
| Blocked app speak | `live-response-coordinator.ts` | `requestResponseCreate` (non-protocol blocked) |
| Caller turn commit | `src/lib/voice-v3/conversation/caller-turn-manager.ts` | `commitCapturingTurn` → `CALLER_TURN_COMMITTED` |
| Turn commit hook | `src/lib/voice-v3/conversation/delegation-timing.ts` | `onCallerTurnCommitted` (**empty**) |
| Transcript (parallel) | `src/lib/voice-v3/intake/caller-turn-buffer.ts` | `commitCallerTranscript` on delegation create |

### 1.3 Per `response.create` in production path

| # | Caller | `delegation_id` | Purpose |
|---|--------|-----------------|--------|
| 1 | `requestDelegatedProtocolContinuation` | Active delegation from pending function call row (or `activeDelegationId`) | **Continue** delegated Responses backend **waiting for tool results** (SDK docstring) |
| 2 | `requestResponseCreate` | N/A (greeting only when `allowBeforeDelegation`) | Initial greeting — **not** used for Astra chaining in basic pipeline |

**Correlation today:** `DelegationRuntime.delegationId`, `PendingFunctionCall.delegationId`, server `response.event.delegation_id`. Coordinator does **not** store `offset_ms`, `basedOnConversationRevision`, or caller `turnId` on delegation (tool path passes `callerTurnId: null` always).

### 1.4 Answers to Investigation 1 sub-questions

| # | Question | Finding (code + SDK) |
|---|----------|----------------------|
| 1 | Which `delegation_id`? | From `response.event.delegation_id` or coordinator `activeDelegationId` / pending call row. |
| 2 | Does `response.create` continue existing sequence? | **Yes** — SDK: “continue a delegated response waiting for tool results.” Emitted after all pending `function_call_output` items submitted (`hasPendingFunctionOutputs()` false). |
| 3 | New `session.delegation.created` while Responses waiting on tools? | **Not controlled by Transovo.** Live model may delegate again; coordinator tracks **multiple** `delegations` map entries but **only** `activeDelegationId` updated on create. **No** code prevents overlapping delegations. **Not verified** in lab whether OpenAI always allows parallel delegations. |
| 4 | Caller speech commits while delegated sequence waiting? | **Turn manager commits independently** (750ms quiet). `onCallerTurnCommitted` is **no-op**. Old delegation continues when tools complete + `response.create` fires. **Call 2 proved this.** |
| 5 | Caller speech between tool A output and `response.create` for tool B? | Same: revision advances; continuation still sent when barrier clears (no revision check). |
| 6 | Documented abandon/supersede API? | **Live `ClientEvent`:** no cancel. **Beta/Realtime `response.cancel`:** exists for **Realtime** client events, **not** in `openai/resources/live/*`. **Responses HTTP** `cancel(responseID)` exists for **beta responses** API — unclear mapping to **sideband delegated** loop. **Do not assume** without experiment. |
| 7 | Withhold `response.create`? | **Unknown end state** from docs alone. Coordinator would leave delegation in `TOOL_OUTPUT_SUBMITTED` / `CONTINUING` until `response.completed` or error. Risk: **stuck delegation** (Pipecat-class bugs) if backend waits indefinitely. **Requires staged test.** |
| 8 | New Live delegation if old sequence not continued? | **Likely** Amy/Live can `session.delegation.created` again (Call 1/2 show multiple delegations per call). **Not** gated on prior delegation `COMPLETED` in Transovo. |

---

## 2. Call 2 failure boundary (exact)

| Time (UTC) | Event | `turn_sequence` | Semantic note |
|------------|-------|-----------------|----------------|
| 21:43:07 | Turn 10 committed | 10 | Triggers D2 shortly after |
| 21:43:11 | `session.delegation.created` D2 | 10 | `basedOnConversationRevision` **would be 10** |
| 21:43:13 | `update_intake` dispatched | 10 | Facts — preserve |
| 21:43:14 | **Turn 11 committed** | **11** | **Conversation advanced** — D2 stale for *new* consequential chaining |
| 21:43:15 | `set_scheduling_preference` | 11+ | Forces `activeGoal=BOOK_APPOINTMENT` |
| 21:43:17 | `find_availability` dispatched | 11+ | FIND async |
| 21:43:15–24 | Turns 12–16 | 12–16 | **No** new delegation |
| (end) | Hangup | — | No `request_callback` |

**First failure:** **Turn 11+ not coupled to delegation freshness** → stale **Responses continuation** after turn 10 boundary.

**Secondary factors (not primary boundary):** Astra tool choice; `set_scheduling_preference` / `find_availability` writing `BOOK_APPOINTMENT` to `dialog.activeGoal`; no Transovo intent router required to explain failure.

---

## 3. Official OpenAI protocol findings (Investigation 10)

### 3.1 Installed SDK — Live API (`node_modules/openai/resources/live/live.d.ts`)

| Symbol | Role |
|--------|------|
| `DelegationCreatedEvent` | `type: 'session.delegation.created'`, **`offset_ms`**: ms from session start, `delegation.id`, `delegation.target` (`client` \| `responses`), optional `delegation.response_id` |
| `ResponseEvent` | `type: 'response.event'`, nested `event`, optional `delegation_id` |
| `ResponseItemCreateEvent` | `type: 'response.item.create'`, `item` (e.g. `function_call_output`) — “Add an input item … use `response.create` to request a response.” |
| `ResponseCreateEvent` | `type: 'response.create'` — “Request a response … **or continue a delegated response waiting for tool results**. Requires Responses delegation.” |
| `ClientEvent` union | Includes `ResponseItemCreateEvent`, `ResponseCreateEvent` — **no** `ResponseCancelEvent` |

### 3.2 What is **not** on Live client surface

- **`response.cancel`** — present in `openai/resources/realtime/realtime.d.ts` and `beta/realtime`, **absent** from `live/live.d.ts` `ClientEvent`.
- **Delegated Responses HTTP cancel** — `beta/responses` `Responses.cancel(responseID)` — separate from sideband; **not wired** in Voice V3.

### 3.3 Documented application responsibility (paraphrase from Live docs / product model)

- Live supplies **conversation context** and initiates **delegated** backend work.
- Application owns **tool execution**, **permissions**, **business records**, **continuation** after tool output.

### 3.4 Verified answer to the key question

> When caller conversation advances while a Responses delegation is inside a multi-tool continuation loop, what **documented** mechanism should the application use to stop continuing stale backend reasoning and allow GPT-Live to make a fresh delegation?

**From installed Live types and docstrings only:**

1. **There is no documented Live client “cancel delegated Responses job” primitive.**
2. **Documented continuation** is explicit: `response.item.create` (tool result) + optional **`response.create`** to resume reasoning.
3. **Therefore the plausible supported pattern** (hypothesis — **must be lab-validated**):
   - Always complete **protocol** for outstanding `function_call` via `response.item.create`.
   - **Omit** `response.create` when conversation revision &gt; delegation `basedOnConversationRevision` and semantic supersession applies.
   - Rely on **GPT-Live** to issue a **new** `session.delegation.created` when the conversational layer needs fresh backend reasoning (full duplex + new delegation).

**Unresolved until experiment:** Does withheld `response.create` leave delegation hung, complete with `response.incomplete`, or error? Can Amy delegate while prior delegation awaits continuation?

---

## 4. Installed SDK findings (summary)

- **Timeline anchor:** `DelegationCreatedEvent.offset_ms` — **not read** anywhere in `src/` today (`grep` no matches). Production logs should be checked for field presence on `VOICE_V3_BASIC_DELEGATION_CREATED`.
- **Transovo today** passes only `{ id, response_id? }` into `onDelegationCreated` — **`offset_ms` dropped** at ingress.

---

## 5. `conversationRevision` design (Investigation 2)

### 5.1 Smallest authoritative representation

**Recommendation:** Alias **`conversationRevision`** to **`CallerTurn.sequence`** from `caller-turn-manager.ts` (monotonic on each meaningful `CALLER_TURN_COMMITTED`).

| Property | Value |
|----------|--------|
| Increment | `s.sequence += 1` in `commitCapturingTurn` |
| ID | `turnId = turn_{liveSessionId}_{sequence}` |
| Commit rule | 750ms quiet + min 2 chars + dedupe fingerprint |
| Semantic meaning | **None** — only “committed caller segment count” |

**Do not** conflate with:

- `scheduling.generation` (scheduling preference churn only)
- `runtime.version` (any context mutation)
- `intake` field revisions

### 5.2 Synchronous read sites (design)

| Consumer | API (proposed) |
|----------|----------------|
| Delegation create | `getCurrentConversationRevision(liveSessionId)` → `state(sessionId).sequence` |
| Pre-dispatch tool | same |
| Pre-continuation | same |
| Async result apply | read **at completion time** + compare to operation’s `basedOnConversationRevision` |

### 5.3 Commit path performance (Requirement 20)

`CALLER_TURN_COMMITTED` today: increment, log, timing, `queueMicrotask(onCallerTurnCommitted)`. **Suitable** for adding: mark delegations **potentially stale**, bump revision pointer — **no** Astra/Microsoft/Telnyx on hot path.

### 5.4 Barge-in vs committed turn (Requirement 27)

- **Freshness boundary** should attach to **`CALLER_TURN_COMMITTED`** (strongest committed signal in basic pipeline), **not** raw audio delta or partial transcript alone.
- `session.output_audio.delta` / barge-in does **not** increment `turn_sequence` until commit fires.

### 5.5 OpenAI `offset_ms` vs `turn_sequence`

| Mechanism | Pros | Cons |
|-----------|------|------|
| `offset_ms` | Same timeline as Live session | Not stored; ms granularity; harder to align with turn boundaries |
| `turn_sequence` | Deterministic, already logged (`CALLER_TURN_COMMITTED`) | App-local; may lag speech slightly (750ms commit) |

**Recommendation:** **Primary orchestration:** `turn_sequence`. **Secondary correlation / telemetry:** record `delegationCreatedOffsetMs` when present on `session.delegation.created`.

---

## 6. Delegation revision design (Investigation 3) — design only

Extend `DelegationRuntime` (conceptual — **not implemented**):

```typescript
basedOnConversationRevision: number;  // snapshot at session.delegation.created
delegationCreatedOffsetMs?: number;     // from server event
semanticFreshness: "FRESH" | "STALE";   // STALE when currentRevision > basedOn...
```

**Rules:**

- STALE ≠ cancel provider writes ≠ delete facts ≠ known intent.
- STALE = “do not let **this delegation’s** chained **consequential** Responses steps steer the **current** conversation without fresh Astra.”

**Existing partial hook:** `getCommittedTurnsSinceLastSemanticApply` + `lastSemanticAppliedSequence` — only updated if `markCallerTurnSemanticApplied` runs (delegation path **does not** call it on tool completion). **Reuse pattern**, wire to continuation gate.

---

## 7. Safest freshness boundary (Investigation 4) — two gates

### GATE A — pre-dispatch

**When:** `response.output_item.done` → before `executeVoiceTool`.

**Check:** `currentConversationRevision > delegation.basedOnConversationRevision`.

**Policy sketch:**

| Tool class | Gate A behavior |
|------------|-----------------|
| FACT | May still run (idempotent merge) or short-circuit with “superseded” output — **tool-specific** |
| READ | May skip dispatch **or** allow run but tag result `semanticFreshness: STALE` |
| COMMITTED WRITE | If not yet authorized at commit boundary — block; if commit started — **do not** block (Requirement 22) |
| TERMINAL | Policy per transfer/end state machine |

### GATE B — post-result / pre-continuation (**primary for Call 2**)

**When:** After `response.item.create` (function_call_output), **before** `requestDelegatedProtocolContinuation` → `response.create`.

**Check:** same revision compare.

**If stale:**

1. **Still send** `function_call_output` if already computed (Requirement 16 — never orphan).
2. **Do not** send `response.create` for that delegation barrier (hypothesis).
3. Mark delegation `semanticFreshness: STALE`; allow Live/Amy to open **new** delegation.
4. Optionally attach `semantic_disposition: SUPERSEDED` in logs / tool result metadata for Astra on **future** delegation (not keyword routing).

**Call 2 replay — Gate B:**

- After `update_intake` output at revision 10, turn 11 commits **before** continuation → **withhold** continuation → `set_scheduling_preference` / `find` **should not** run **under same stale chain** (Gate A would also block if function_call arrives after turn 11).

---

## 8. Four orthogonal lifecycles (Requirement 14)

| Lifecycle | Owner | Examples |
|-----------|-------|----------|
| 1. Caller conversation revision | Transovo turn manager | `turn_sequence` |
| 2. Semantic decision freshness | Transovo gate + Astra on new delegation | `basedOnConversationRevision` |
| 3. Physical tool/provider execution | Executors, Graph, Telnyx | FIND HTTP, BOOK POST |
| 4. Conversation continuation | GPT-Live Amy | listen/speak during async work |

**Semantic supersession ≠ physical cancellation** (Requirement 15).

---

## 9. Tool lifecycle matrix (Investigations 5, 21)

Classes align with `concurrency-policy.ts` where registered. **`send_booking_link`** and **`request_callback`** missing from `VOICE_TOOL_KIND_BY_NAME` — treat as **mutation** / committed write operationally.

| Tool | Class | Conv. continues while running? | Cancel physical on revision? | Mark semantic stale on revision? | Must finish provider? | Must `function_call_output`? | Stale result to Amy? | Same delegation continue? | Reconcile on intent change? | Commit point |
|------|-------|-------------------------------|------------------------------|----------------------------------|----------------------|------------------------------|----------------------|---------------------------|----------------------------|--------------|
| `update_intake` | FACT | Yes | Unnecessary | No (facts kept) | N/A | Yes | Yes (facts) | If fresh | No | On merge |
| `set_scheduling_preference` | FACT | Yes | Unnecessary | Yes for *scheduling steer* | N/A | Yes | Stale prefs don’t steer | **No** if stale | schedulingGeneration | On context merge |
| `find_availability` | READ | Yes | **Unsafe to require** | **Yes** | Optional | Yes | **No** if stale | **No** if stale | Yes (generation) | Dispatch |
| `find_appointment` | READ | Yes | Same as find | Yes | Optional | Yes | No if stale | No if stale | Yes | Dispatch |
| `book_appointment` | WRITE | Yes | **No** after commit | N/A after commit | **Yes** | Yes | Outcome yes when material | No | **Yes** | Graph POST start |
| `reschedule_appointment` | WRITE | Yes | No after commit | N/A | Yes | Yes | Outcome yes | No | Yes | Provider commit |
| `cancel_appointment` | WRITE | Yes | No after commit | N/A | Yes | Yes | Outcome yes | No | Yes | Provider commit |
| `request_callback` | WRITE | Yes | No after persist start | N/A | Yes | Yes | Outcome yes | No | Yes | DB persist |
| `send_booking_link` | WRITE | Yes | No after send start | N/A | Yes | Yes | Outcome yes | No | Yes | SMS/link dispatch |
| `transfer_call` | TERMINAL | Limited | Provider-dependent | Yes pre-commit | If started | Yes | State yes | No | Yes | Telnyx transfer |
| `end_call` | TERMINAL | No | N/A | N/A | N/A | Yes | N/A | No | N/A | Hangup |

---

## 10. Operation registry (Investigation 6)

`VoiceV3Operation` today: `stateVersionAtStart`, `schedulingGeneration`, statuses `STALE` | `CANCELLED` | `OUTCOME_UNKNOWN`, etc.

**Safe extensions (design):**

- `basedOnConversationRevision?: number`
- `originatingDelegationId?: string`
- `semanticFreshness?: "FRESH" | "STALE"` (operation-scoped, especially READ)

**Parallel pattern:** `schedulingGeneration` invalidates find/book **scheduling** — **do not merge** with `conversationRevision`. A caller can change **intent** without changing scheduling generation (callback mid-book).

`markOperationsStaleForScheduling` → model **`markOperationsSemanticallyStaleForConversation`** for READ ops only.

---

## 11. `activeGoal` dependency audit (Investigation 7)

**Do not delete/rename yet.** Redefine toward **active operation** with `basedOnConversationRevision` before treating as caller intent.

| File / function | R/W | Goal / effect | Why | If removed | If non-authoritative |
|-----------------|-----|---------------|-----|------------|----------------------|
| `call-context.ts` | W init | `UNKNOWN` | Default | Break typing | OK as “no operation” |
| `merge-intake-state.ts` `mergeDialogActiveGoalFromTool` | W | Maps tool → goal | Executor side-effect | Tools lose goal hints | Astra-only goal selection |
| `set-scheduling-preference-tool.ts` | W | `BOOK_APPOINTMENT` | **Forces booking** on pref | Find/book rules change | **Call 2 stickiness reduced** |
| `find-availability-tool.ts` | W | `BOOK_APPOINTMENT` | Same | Same | Same |
| `request-callback-tool.ts` / `execute-request-callback.ts` | W | `REQUEST_CALLBACK` | Callback op | Callback rules | OK if op registry owns |
| `reschedule-appointment-tool.ts` | W | `RESCHEDULE_APPOINTMENT` | Mgmt flow | Break dispatch guards | OK with op registry |
| `cancel-appointment-tool.ts` | W | `CANCEL_APPOINTMENT` | Mgmt flow | Break cancel-dispatch | OK with op registry |
| `call-rules.ts` | R | goal | Tool gating | Rules blind | Need op type |
| `operation-requirements.ts` | R | goal | Intake requirements | Validation breaks | Use `activeOperation` |
| `appointment-management-dispatch.ts` | R | goal | Route mgmt | Break | Op type |
| `cancel-dispatch.ts` | R | `CANCEL_APPOINTMENT` | Guard | Break | Op type |
| `evaluate-recovery.ts` / `conversation-need.ts` | R | goal | Recovery copy | Degraded recovery | Op + revision |
| `choose-next-conversation-action.ts` | R | goal | Legacy planner path | Less used in basic | Low impact basic |
| `goal-manager.ts` | R/W | instances + `dialog.activeGoal` | **CallerMeaning era** | Multi-goal | Basic path bypass |
| `sync-agent-state-to-live.ts` | R | snapshot | Commentary | Less context | Op label |
| `live-response-coordinator.ts` | R | telemetry | Logs only | None | None |
| `caller-meaning.ts` | R | `current_goal` | Legacy | N/A if frozen | N/A |

---

## 12. Call 2 replay against proposed model (Investigation 8)

**Without assuming turn 11 meant callback** (architecture must work for any new information):

1. D2 `basedOnConversationRevision = 10`.
2. `update_intake` — Gate A: fresh → runs; facts kept.
3. Turn 11 commits → `currentRevision = 11` → D2 `semanticFreshness = STALE`.
4. `set_scheduling_preference` function_call arrives — Gate A: **block or execute but mark stale**; **must not** issue continuation that chains `find` under D2.
5. If `find` already dispatched — physical run completes; `VOICE_TOOL_STALE_RESULT_IGNORED` **pattern extended** with **conversation revision**; Amy must not present slots as current offer.
6. **Fresh** `session.delegation.created` D3 @ revision ≥ 11 — Astra sees **full** Live conversation; **Astra** chooses next tools (book, callback, transfer, FAQ, clarify) — **Transovo does not**.

---

## 13. Reverse-switch simulations (Investigation 9, Requirement 30)

Generic pattern (no A→B hardcoding):

| Transition | Revision | Delegation | Running op | Stale work | Preserved facts | Committed write | New Astra |
|------------|----------|------------|------------|------------|-----------------|-----------------|-----------|
| BOOK → CALLBACK | +1 | D1 stale | FIND running | FIND semantically stale | name, phone | — | D2 fresh |
| CALLBACK → BOOK | +1 | D1 stale | callback needs_info | callback op open | callback fields | — | D2 fresh |
| BOOK → TRANSFER | +1 | D1 stale | FIND | stale read | facts | — | D2 fresh |
| TRANSFER prep → BOOK | +1 | D1 stale | transfer pending | transfer | facts | if commit started, reconcile | D2 |
| RESCHEDULE → CALLBACK | +1 | stale | lookup | stale | facts | — | fresh |
| CANCEL → BOOK | +1 | stale | cancel | stale | facts | if cancel committed, tell Astra truth | fresh |
| BOOK → FAQ → BOOK | +2 | D1 stale after FAQ | — | FAQ read | facts | — | D2, D3 |
| Monday → Tuesday correction | +1 | stale | FIND gen N | stale offers | facts | — | fresh FIND |
| Rapid +3 during FIND | +3 | stale | FIND | stale | facts | — | **one** fresh @ rev latest (coalesce) |

---

## 14. Race matrix (Requirement 29)

| Case | current rev | deleg rev | physical op | semantic fresh | protocol | provider | fresh Astra? | Amy may claim |
|------|-------------|-----------|-------------|----------------|----------|----------|--------------|---------------|
| A. New turn before first function_call | +1 | stale | — | STALE | N/A | — | Yes | Listen |
| B. Turn after call, before dispatch | +1 | stale | — | STALE | pending call | — | Yes | Gate A |
| C. Turn during READ | +1 | stale | RUNNING | STALE | open call | — | Yes | Not stale slots |
| D. Turn after read, before `response.create` | +1 | stale | DONE | STALE | output pending cont. | result valid | Yes | Gate B |
| E. Turn during model next call gen | +1 | stale | — | STALE | in flight | — | Yes | Wait |
| F. Turn before write dispatch | +1 | stale | — | STALE | — | — | Yes | Gate A |
| G. Turn during Graph POST | +1 | stale | RUNNING | STALE | must complete | **authoritative** | Yes after | Reconcile truth |
| H. Turn after provider success, before Amy says | +1 | stale | SUCCEEDED | STALE | — | truth | Yes | Must not deny booking |
| I. Multiple turns during one op | +n | stale | RUNNING | STALE | — | — | **Coalesce** @ max rev | — |
| J. Barge-in during stale Amy speech | — | — | — | — | — | — | Live handles audio | Stop stale claim via freshness on **committed** turn |

---

## 15. Claim grounding (Requirement 23)

Today: `isPresentedOfferCurrent`, `schedulingGeneration`, `VOICE_TOOL_STALE_RESULT_IGNORED`, recovery blockers in `evaluate-recovery-blocker.ts`.

**Extend:** Spoken availability/booking claims require **`conversationRevision` match** (and provider truth). Committed writes remain **visible** to fresh Astra even when conversation moved on.

---

## 16. Protocol structural integrity (Requirement 28)

**Invariants (target tests):**

1. Every accepted `function_call` gets exactly one `function_call_output` (`submitDelegatedFunctionCallOutput` dedupes via `outputSubmitted`).
2. No duplicate `response.create` per barrier (`delegatedProtocolContinuationSent` Set).
3. Stale path: output **without** continuation — **lab validate** no orphan hang.
4. Idempotent tool dedupe (`executedCallIds`) preserved.

---

## 17. Smallest implementation plan (ordered — **after** lab validation)

1. **Lab:** Withhold `response.create` on stale revision in test harness; observe delegation lifecycle + ability to create new delegation.
2. **Record** `offset_ms` + `basedOnConversationRevision` on `onDelegationCreated`.
3. **Wire** `onCallerTurnCommitted` → mark active delegations potentially stale (O(1)).
4. **Gate B** in `requestDelegatedProtocolContinuation` (revision check).
5. **Gate A** in `handleDelegatedVoiceToolCall` for consequential tools.
6. **Extend** find-dispatch stale ignore for `conversationRevision`.
7. **Operation registry** fields + READ semantic stale.
8. **Defer** `activeGoal` cleanup until op registry drives call-rules.
9. **Certification matrix** (Requirement 30) + straight-line regression (Requirement 31).
10. **Latency:** no extra LLM; fresh delegation only when revision &gt; based (Requirement 32).

---

## 18. Protected / frozen surfaces (Requirement 31)

**Do not change** in freshness pass without explicit re-cert:

- Call 1 straight `request_callback` + `needs_information` loop + persist
- Microsoft book / find / reschedule / cancel executors and idempotency
- `send_booking_link` executor
- Callback persistence (`execute-request-callback`, `VOICE_V3_CALLBACK_*`)
- MCTB / unrelated products

**Do not introduce:**

- Keyword routing, transcript regex intent, CallerMeaning planner, pre-Astra classifier, callback-specific re-delegation, separate Booking/Callback agents

---

## 19. Architecture invariants (Requirement 33)

| # | Invariant | Design support |
|---|-----------|----------------|
| 1 | New caller info not ignored during Astra work | Revision counter + stale mark |
| 2 | Transovo need not know semantic meaning | Revision compare only |
| 3 | Astra = semantic authority | Fresh delegation |
| 4 | Amy = conversational owner | No app `response.create` speak |
| 5 | Shared facts survive | FACT class policy |
| 6 | Stale reads don’t steer | Gate B + presentation freshness |
| 7 | Committed writes reconciled | WRITE policy |
| 8 | Function-call protocol completed | Always `function_call_output` |
| 9 | Stale delegations don’t chain consequential tools | Withhold `response.create` (hypothesis) |
| 10 | Straight-line paths unchanged | Gates no-op when revision equal |
| 11 | Generic across tools | Tool matrix |
| 12 | No second intent LLM | Explicit exclusion |

---

## 20. Unresolved questions (must close before implementation)

1. **Withheld `response.create`:** exact server behavior (complete, hang, error, timeout)?
2. **Parallel delegations:** can `session.delegation.created` fire while prior delegation awaits continuation?
3. **Gate A blocked call:** what `function_call_output` should Astra receive (structured `superseded` vs synthetic error) — must not invent semantics; minimal protocol-safe payload TBD with OpenAI guidance.
4. **Production `offset_ms`:** confirm logged on `session.delegation.created` in sideband payloads.
5. **HTTP Responses.cancel** — any supported mapping from Live `delegation.response_id` for emergency abort (currently **not** used)?

---

## 21. References

- OpenAI Live API types: `node_modules/openai/resources/live/live.d.ts`
- Forensic: `docs/VOICE-V3-CALLBACK-CALL-2-BOOKING-TO-CALLBACK-FORENSIC-REPORT.md`
- Benchmark: `docs/VOICE-V3-TURN-REVISION-AND-OPERATION-LIFECYCLE-BENCHMARK.md`

---

*End of investigation document. No runtime changes are authorized by this file alone.*
