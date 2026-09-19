# Voice V3 — Turn revision & operation lifecycle benchmark

**Date:** 2026-09-19  
**Purpose:** Compare current Transovo Voice V3 orchestration to the production pattern described in LiveKit workflows (supervisor + mid-conversation intent change), LiveKit async tools (running work vs current intent), and Pipecat async/cancellable functions — **without implementing changes**.  
**Companion:** `docs/VOICE-V3-CALLBACK-CALL-2-BOOKING-TO-CALLBACK-FORENSIC-REPORT.md` (Call 2 evidence).

---

## Executive alignment

Your framing matches what the code and Call 2 logs show:

| Concept | LiveKit / Pipecat pattern | Transovo today |
|--------|---------------------------|----------------|
| Outer loop | **Call session** owns the caller; tasks are temporary | **Amy (GPT-Live)** owns conversation; **Astra** is delegated supervisor |
| New caller input | New reasoning turn from updated conversation | **Committed turns increment** (`turn_sequence`) but **do not trigger** fresh Astra work in Transovo |
| Current intent vs running work | Separable; stale async results | **Partial** — `scheduling.generation` + `STALE` ops + `VOICE_TOOL_STALE_RESULT_IGNORED` for find; **not** tied to caller-turn revision |
| Intent stickiness | Operation temporary | **`dialog.activeGoal`** often set by **tool executors** (`BOOK_APPOINTMENT` on scheduling tools) — mixes “backend work” with “caller goal” |
| Call 2 failure mode | Preempt / re-reason on new transcript | Delegation #2 **chained tools** while **turn 11+ committed**; **no** new `session.delegation.created` |

**Conclusion:** Amy + Astra + tools is compatible with the LiveKit supervisor pattern. What is missing is **session orchestration around Astra**: conversation-revision freshness boundaries and explicit separation of **current caller objective** vs **running backend operations** — not another LLM agent.

**Freeze:** Straight callback (`request_callback` early invoke + `needs_information`) is proven on Call 1 — do not weaken that contract while fixing orchestration.

---

## Target architecture (reference — your model)

```
CALL SESSION (Amy — continuous owner)
  caller turn revisions: 10 → 11 → 12 …
       │
       ▼
  ASTRA (semantic supervisor — fresh decision per revision when needed)
       │
       ├── facts: update_intake, scheduling preference
       ├── reads: find_availability, find_appointment
       ├── writes: book / reschedule / cancel / request_callback / transfer / SMS
       └── TRANSOVO validates + persists
```

**Principles:**

1. Booking is **work inside the call**, not a permanent “BOOKING MODE.”
2. Every consequential backend step should know **which caller-turn revision** it was based on.
3. Before the next consequential step, ask: **is conversation still at that revision?** If not → do not continue blindly; allow fresh Astra reasoning.
4. **Stale** read results must not steer Amy; **committed writes** reconcile rather than pretend they never happened.

---

## Answers to the ten investigation questions

### 1. Does a committed caller turn increment some existing revision/generation?

**Yes — several partial counters, not one authoritative “conversation revision” for orchestration.**

| Mechanism | Where | Used for orchestration? |
|-----------|--------|-------------------------|
| `turn_sequence` | `caller-turn-manager.ts` — increments on each `CALLER_TURN_COMMITTED` | **No** — logging/timing only |
| `runtime.version` | `VoiceV3CallContext` — bumps on context mutations | State versioning; not caller-turn keyed |
| `scheduling.generation` | Bumps on `set_scheduling_preference` / scheduling merge | **Yes** — stale find results & operations |
| `intake` field `revision` | Per captured field | Field-level, not call conversation revision |
| `CallerTurnTiming.lastTurnSequence` | `caller-turn-timing.ts` | Telemetry; `activeTurnId` updated on commit |

**Gap:** There is **no** `conversationRevision` (or equivalent) that **gates** Astra protocol continuations or invalidates in-flight delegated reasoning when `turn_sequence` advances.

**Hook that could attach revision:** `onCallerTurnCommitted` in `delegation-timing.ts` is **intentionally empty**:

```typescript
export function onCallerTurnCommitted(_input: { ... }): void {
  // intentionally empty
}
```

GPT-Live is documented as owning turn semantics; Transovo does not currently react to new commits.

---

### 2. Can Amy delegate while an Astra delegation is still active?

**At the Transovo server boundary: nothing clearly forbids a second `session.delegation.created`.**

- Sideband handles each `session.delegation.created` independently (`live-sideband-session.ts`).
- `VoiceV3LiveResponseCoordinator` tracks multiple `delegationId`s but has a single `activeDelegationId` pointer updated on create.

**Observed on Call 2:** Only **two** delegations for the whole call; delegation #2 ran a **multi-tool chain** while caller turns 11–16 committed. So in practice **Amy/Live did not open a new delegation** during active backend work — whether due to OpenAI Live session rules, Amy prompt behavior, or “one delegation until complete” is **not enforced in Transovo code** from this audit.

**Related:** `isSemanticInterpretationInFlight` / `markSemanticInterpretationStarted` wrap tool execution (`handle-delegated-voice-tools.ts`) but **do not block** new Live delegations.

---

### 3. If not, why?

**Transovo does not implement “block delegate while tools running.”** Likely causes of Call 2 behavior (stack ranked):

1. **GPT-Live / Amy** did not emit another `session.delegation.created` after turn 11 (product/model session policy — outside repo).
2. **No Transovo rule** says: “new `CALLER_TURN_COMMITTED` → cancel protocol continuation / request new delegation.”
3. **Delegated protocol continuation** (`live-response-coordinator.ts`) flushes `response.create` / continuations after tool outputs **without** checking current `turn_sequence`.

---

### 4. Can an existing Astra delegation be superseded?

**Partially for Amy speech, not for in-flight Astra tool chains.**

- `LIVE_RESPONSE_SUPERSEDED` exists for **Live `response.create`** dedupe/session close — not for canceling an open Responses delegation.
- No API found to **abort** an in-progress `item_*` delegation or discard pending function calls when a new caller turn commits.
- Tool outputs still submit via `completeDelegatedFunctionCall` → protocol continuation → Astra may chain next tool **on the same delegation**.

**Goal manager** (`goal-manager.ts`) can `abandonGoal` and `cancelRunningOperationsForGoal` — but that path is tied to **legacy `CallerMeaning`** (`apply-caller-meaning.ts`), **not** the production Voice V3 basic tool path (`handle-delegated-meaning.ts` explicitly: no CallerMeaning on production PSTN tools).

---

### 5. Can the caller continue speaking while `find_availability` runs?

**Yes.** Evidence: Call 2 — `FIND_AVAILABILITY_DISPATCHED` at 21:43:17 while `CALLER_TURN_COMMITTED` for turns 12–16 and ongoing `session.input_audio.append` / transcript deltas.

Microsoft FIND runs asynchronously (`find-dispatch.ts`, execution lane). Conversation ingress **does not pause**.

---

### 6. Does Astra get the new conversation when another delegation starts?

**When a new delegation is created, Live supplies updated conversation context to the delegated Responses session** (OpenAI transport). Transovo does not rebuild transcript itself for Astra; it appends **thinking** snippets (intake objective, availability, etc.) via `session.thinking.append`.

**Call 2:** No delegation after turn 11 → **Astra never got a fresh delegated reasoning pass** on the post-pivot turns.

---

### 7. Can we attach `basedOnCallerTurnRevision` to backend operations?

**Partial infrastructure only.**

| Today | Detail |
|-------|--------|
| `VoiceV3Operation` | `stateVersionAtStart`, `schedulingGeneration`, optional `goalId` — **no `callerTurnId` / turn sequence** |
| `noteBackendOperationDispatched(liveSessionId, opId, turnId?)` | Associates op with `activeTurnId` in **timing** map — **telemetry**, not authoritative stale logic |
| Tool execution | `callerTurnId: null` always in `handle-delegated-voice-tools.ts` → `completeDelegatedFunctionCall` |
| Find dispatch | `noteBackendOperationDispatched(ctx.liveSessionId, opId)` — **no turn id passed** |

**Verdict:** Schema and hooks could be extended; **orchestration does not use caller-turn revision today.**

---

### 8. Can existing scheduling generation / stale-result machinery be reused?

**Yes — for availability reads tied to scheduling preference changes, not for “caller changed intent to callback.”**

- `isStaleSchedulingPreference` — drop find results when `resultSchedulingGeneration < ctx.scheduling.generation` (`stale-result.ts`).
- `applyFindAvailabilityResult` — logs `VOICE_TOOL_STALE_RESULT_IGNORED` / `AVAILABILITY_RESULT_STALE`.
- `markOperationsStaleForScheduling` — marks ops `STALE` when scheduling generation changes (`merge-scheduling-meaning.ts`).

**Gap:** Stale is keyed to **scheduling generation**, not **caller turn revision**. A pivot to callback **without** bumping scheduling generation may still leave **in-flight find** and **`BOOK_APPOINTMENT` goal** authoritative.

**Analogy to your model:** Reuse the **same pattern** (generation + STALE + ignore result for Amy) but keyed on **`conversationRevision`** (or last committed turn at delegation start vs now).

---

### 9. Which tools are safe to supersede/cancel vs reconcile?

Mapping to current code behavior (your classification + repo truth):

| Class | Tools | Transovo today |
|-------|--------|----------------|
| **State / facts** | `update_intake`, `set_scheduling_preference` | Facts persist; scheduling bump can stale ops; **goal forced to BOOK** on scheduling tools |
| **Read / search** | `find_availability`, `find_appointment` | Find async; results **stale** on scheduling generation mismatch; can still complete HTTP |
| **Reversible / pre-commit** | Transfer prep, send link (pre-send) | Transfer/link have their own gates; **no turn-revision cancel** audited here |
| **Committed write** | `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `request_callback` persist | Execute to provider/DB; **no blind cancel** — correct |
| **Terminal** | `end_call`, live transfer bridge | Provider lifecycle |

**Important:** `set_scheduling_preference` is **not** “facts only” in code — it **mutates `dialog.activeGoal` to `BOOK_APPOINTMENT`** (`set-scheduling-preference-tool.ts`). That is the stickiness you flagged.

---

### 10. Why exactly did turns 11–16 fail to trigger fresh Astra reasoning?

**Evidence-based chain (Call 2):**

| Time (UTC) | Event |
|------------|--------|
| 21:43:07 | Turn **10** committed (4 chars) |
| 21:43:11 | **`session.delegation.created`** — delegation `item_EPx7vkMh8EUH80n94Gp1C` |
| 21:43:13 | `update_intake` |
| 21:43:14 | Turn **11** committed (47 chars) — **during** tool chain |
| 21:43:15 | `set_scheduling_preference` → **`BOOK_APPOINTMENT`** |
| 21:43:17 | `find_availability` dispatched |
| 21:43:15–24+ | Turns **12–16** committed |
| (rest of call) | **No** second delegation after #2 |

**Root orchestration gap (matches your red flag):**

1. **No Transovo listener** on `CALLER_TURN_COMMITTED` to invalidate in-flight delegated reasoning or signal Live to delegate again.
2. **Astra protocol continuation** advances `update_intake` → `set_scheduling_preference` → `find_availability` on **one delegation** without a **freshness check** against `turn_sequence`.
3. **Amy/Live did not create** delegations 3+ despite new commits (behavioral/product layer).
4. **`activeGoal` pinning** after scheduling tools makes intake context **booking-shaped** even when intake block said “unresolved” immediately after `update_intake`.

**Not the primary explanation:** `request_callback` prompt weakness — **Call 1 proved** Astra can switch tools when given a fresh delegation with callback intent.

**Exact caller text for turn 11:** Not in production logs (`CALLER_TURN_COMMITTED` logs char counts only). Pivot timing is recoverable; wording is not without verbose pipeline, DB transcript, or Telnyx.

---

## Code map — sticky goal vs orchestration

### `callback_open` (telemetry only)

See forensic report §1 — **not** “callback operation open.”

### Goal stickiness from tools

| Tool | Sets `dialog.activeGoal`? |
|------|---------------------------|
| `request_callback` | `REQUEST_CALLBACK` |
| `set_scheduling_preference` | **`BOOK_APPOINTMENT`** (always on success path) |
| `find_availability` | **`BOOK_APPOINTMENT`** |
| `update_intake` | **No** |

Intake **operation** follows `activeGoal` (`operation-requirements.ts`): `UNKNOWN` → `unresolved` until goal changes.

### Unused-on-production-path: `goal-manager.ts`

Rich **goal instances**, `ABANDONED`, `cancelRunningOperationsForGoal` — wired through **`applyGoalLifecycleFromMeaning`** (CallerMeaning), **not** through basic delegated function tools. Potential **reuse** for operation lifecycle without reviving CallerMeaning as primary planner.

### Operations registry

`VoiceV3Operation` statuses include **`STALE`**, **`CANCELLED`**, **`OUTCOME_UNKNOWN`** — aligned with async-tool thinking; linkage to caller turn is the missing piece.

---

## Comparison table — frameworks vs Voice V3

| Capability | LiveKit / Pipecat (target) | Voice V3 current |
|------------|----------------------------|------------------|
| Session owns caller | AgentSession | GPT-Live Amy |
| Supervisor on intent divergence | Supervisor / task group | Astra delegation |
| New user turn → new reasoning | Turn detection + cancel preemptive generation | **Not wired** in Transovo |
| Async work while talking | Async tools + task registry | FIND async; **chain continues** |
| Stale async result | Discard for conversation | **Scheduling generation only** |
| Cancel vs reconcile writes | Protected book path | Writes go to provider; callback persist is committed |
| Max tool steps per turn | Configurable loop limit | **Protocol continuation** across tools on one delegation |
| Mid-flight intent change | First-class in workflow docs | **Call 2 failed** — no fresh delegation |

---

## Recommended next engineering direction (design only)

**Do not** add keyword routers or weaken Call 1 callback contract.

**Do** benchmark implementations against:

1. **`conversationRevision`** (monotonic with `CALLER_TURN_COMMITTED`) stored on runtime context.
2. **Record on each operation / delegation:** `basedOnConversationRevision` (and optionally `callerTurnId`).
3. **Freshness gate (deterministic, not intent):** before each Astra protocol continuation or second+ tool in a delegation, if `currentRevision > basedOnRevision` → **stop chaining**; surface to Live/Amy that new caller input requires new semantic pass (exact mechanism TBD: Live API vs `response.cancel` vs new delegation).
4. **Decouple** `activeGoal` from scheduling tool side effects — treat scheduling as **facts + generation**, let **Astra’s next tool choice** set goal via `request_callback` / `book_appointment` / etc.
5. **Reuse** `markOperationsStaleForScheduling` pattern for **conversation-stale** reads (find results).
6. **Wire** `onCallerTurnCommitted` for telemetry + freshness signals (not CallerMeaning classification).
7. **Optional:** Reconnect `goal-manager` abandon/cancel to tool-driven goal changes without CallerMeaning F2.

**Investigation before coding:**

- Capture one booking → callback test with `VOICE_V3_PIPELINE_LOG=verbose` and/or export `CALLER_TURN_TIMING` per turn for delegation #2.
- Confirm OpenAI Live rules: can Amy delegate while Responses delegation has pending tool outputs?

---

## References (external — your research)

- LiveKit workflows: appointment agent with **supervisor when intents diverge** (mid-conversation intent change).
- LiveKit **async tools** / running tasks / cancellation exposure to the model.
- LiveKit production issues: paused scheduling skipping user input; long `on_user_turn_completed` blocking; interrupted turns missing from context.
- Pipecat: async functions + cancellable tasks; separation of “conversation continues” vs “cancel operation on interrupt.”

---

## Related repo docs

- `docs/VOICE-V3-CALLBACK-CALL-2-BOOKING-TO-CALLBACK-FORENSIC-REPORT.md`
- `docs/VOICE-V3-CALLBACK-TOOL-AND-PROMPT-REFERENCE.md`
- `docs/VOICE-V3-REQUEST-CALLBACK-TOOL-CONTRACT-PASS.md`
- `src/lib/voice-v3/delegation/live-response-coordinator.ts`
- `src/lib/voice-v3/conversation/delegation-timing.ts`
- `src/lib/voice-v3/operations/registry.ts`
- `src/lib/voice-v3/calendar/find-dispatch.ts`
- `src/lib/voice-v3/agent/goal-manager.ts`

---

*End of benchmark — investigation only, no implementation in this document.*
