# Voice V3 — Conversation ownership audit

**Status:** Audit only — no refactor implemented in this document.  
**Governing sentence:** **Claim gating, not speech gating.** Live owns conversation; Astra owns semantic interpretation; Transovo owns business state; the planner owns business decisions; providers own external truth. Transovo may constrain what Amy may **claim** or **do** when authoritative state is required; it must not generally schedule ordinary conversational turns.

**Why this audit exists:** Production and code review focused on whether each mechanism (turn commit, planner, speak coordinator, recovery, `skipLiveSpeak`) was *internally correct*, instead of asking whether Transovo should control Amy’s conversational clock at all. Incremental protocol fixes (e.g. delegated `response.create` after empty `emit_caller_meaning`) remain necessary **plumbing** but do not fix the deeper drift: **backend-orchestrated speech**.

---

## 1. Intended vs actual architecture

### Intended (target)

| Lane | Owner | Responsibility |
|------|--------|----------------|
| **A — Live conversation** | GPT-Live / Amy | Listen, speak, interrupt, pacing, natural Q&A, wording |
| **B — Background intelligence** | Live delegation → Astra → Transovo → tools | Structured meaning, runtime, rules, FIND/BOOK, context injection |

Lane B runs **concurrently** with Lane A. Lane B **never** owns the conversational clock except narrow **claim barriers** (e.g. cannot say “you’re booked” until `BOOKING_CONFIRMED`).

### Actual (observed in code)

Healthy calls still tend to follow this **application-driven speech chain** after semantic work:

```
CALLER_TURN_COMMITTED (750ms quiet)
  → (optional) semantic insurance / stall breaker
Live delegation → Astra emit_caller_meaning
  → function_call_output + protocol response.create
  → applyExtractedCallerMeaning
  → CALLER_MEANING_APPLIED → runtime.replan("caller_meaning_applied")
  → afterVoiceV3StateChange
  → session.thinking.append (snapshot)
  → syncPlannerSpeakToLive
  → requestLiveSpeakContinuation → response.create
  → (parallel) FIND/BOOK hooks may pushLiveThinkingEvent → response.create
  → (on failure) pushVoiceV3RecoveryToLive → response.create
```

That chain makes Amy a **puppet** whose next utterance is often **scheduled by Transovo** after planner/recovery/async work, not by Live’s own turn-taking.

**Acceptance test for refactor completion:** Ordinary caller ↔ Amy exchange must **not** require `CALLER_TURN_COMMITTED → CALLER_MEANING_APPLIED → planner → app response.create` for Amy to speak.

---

## 2. Primary invariant violations (summary)

| Invariant | Current violation |
|-----------|-------------------|
| Normal conversation never requires Transovo permission to continue | `syncPlannerSpeakToLive` issues `response.create` on every material planner change with `SPEAK` disposition |
| Background state change must not cancel/restart active Amy speech | No `response.cancel` in repo, but **stacked `response.create`** from planner + recovery + BOOK/FIND + protocol continuation can compete with an in-flight Live response (matches production “starts → cut off → continues” reports) |
| Planner must not orchestrate speech | `nextConversationAction` + `live-speak-sync` explicitly map planner output → commentary + `response.create` |
| Astra must not block Amy | Delegation is async, but **meaning apply → replan → speak** ties conversational updates to semantic completion |
| `CALLER_TURN_COMMITTED` must not gate Live speech | Does not block Live directly, but gates **evidence**, **telemetry**, **stall breaker**, and correlates timing metrics to an artificial 750ms turn |

---

## 3. `response.create` call-site inventory

All production emission paths go through `VoiceV3LiveResponseCoordinator` (`live-response-coordinator.ts`) except tests.

| # | Entry point | File / function | Trigger | Category | Can supersede / compete with active speech? | Verdict |
|---|-------------|-----------------|---------|----------|-------------------------------------------|---------|
| 1 | Initial greeting | `greeting.ts` → `requestResponseCreate` | `session.started` | **LIVE_NATIVE_CONVERSATION** (session bootstrap) | Yes — starts first Amy audio | **REFACTOR** — keep bootstrap only if Live API requires explicit first speak; otherwise prefer Live-native session config |
| 2 | Delegated protocol continuation | `live-response-coordinator.ts` → `requestDelegatedProtocolContinuation` | All pending `function_call_output` submitted | **REQUIRED_DELEGATION_PROTOCOL_CONTINUATION** | Can interleave with planner speak if both fire in same tick | **KEEP** — not conversational orchestration; OpenAI-required |
| 3 | Planner speak | `live-speak-sync.ts` → `syncPlannerSpeakToLive` → `requestLiveSpeakContinuation` | `afterVoiceV3StateChange` when `nextConversationAction` → `SPEAK` | **LEGACY_ORCHESTRATION** | **Yes** — primary cut-off risk | **REMOVE** from normal path; inject facts/claims via context only |
| 4 | Planner queue flush | `live-response-coordinator.ts` → `flushContinuation` | Queued `requestResponseCreate` after tool barrier clears | **LEGACY_ORCHESTRATION** (planner/recovery) | Yes | **REFACTOR** — queue should not carry ordinary conversation |
| 5 | Meaning apply — slot selected | `apply-extracted-meaning.ts` | Slot change after meaning | **LEGACY_ORCHESTRATION** | Yes | **REMOVE** — context append for slot; no forced speak |
| 6 | FIND / availability | `find-dispatch.ts` → `pushLiveThinkingEvent` | FIND complete / fail | **AUTHORITATIVE_RESULT_COMMUNICATION** | Yes — always pairs thinking + `response.create` | **REFACTOR** — thinking/context only; speak only if narrow claim update requires explicit user notice (prefer Live picks up next turn) |
| 7 | BOOK lifecycle | `book-dispatch.ts` → `pushLiveThinkingEvent` | in progress / confirmed / failed | **AUTHORITATIVE_RESULT_COMMUNICATION** | Yes — `booking_confirmed` especially | **REFACTOR** — claim gating via `allowedClaims`; no automatic `response.create` on every phase |
| 8 | Recovery | `push-recovery-to-live.ts` → `hooks.requestSpeak` | Active recovery directive | **RECOVERY** | Yes | **REFACTOR** — default `skipLiveSpeak: true`; context only unless exceptional handoff |
| 9 | Semantic extraction failure | `handle-delegated-meaning.ts` → `handleSemanticExtractionFailure` | Decode fail + caller evidence | **RECOVERY** | Yes | **REFACTOR** — repair state in Lane B; do not auto-speak CLARIFY |
| 10 | Deferred recovery after greeting | `greeting/deferred-recovery-speak.ts` | Greeting completed + recovery active | **RECOVERY** | Yes | **REMOVE** or gate on exceptional handoff only |
| 11 | Semantic retry success | `semantic-extraction-retry.ts` → `applyExtractedCallerMeaning` | Retry applied (`source: semantic_retry`) | **RECOVERY** (feeds chain #3–5) | Yes | **REFACTOR** — retry updates runtime only |
| 12 | Stall breaker direct semantic | `semantic-turn-watchdog.ts` → `runDirectSemanticForTurn` | Insurance timeout | **RECOVERY** | Yes | **KEEP** insurance but must not trigger `response.create` except via removed planner path |
| 13 | Live hooks from calendar | `live-runtime-hooks.ts` `pushLiveThinkingEvent` | Any caller using default hooks | **AUTHORITATIVE_RESULT_COMMUNICATION** | Yes | **REFACTOR** — split `appendContext` vs `requestSpeak`; default no speak |

**No `response.cancel` call sites** under `src/lib/voice-v3`. Supersession is **logical** (coordinator queue + duplicate action keys + `supersedeStaleSpeaks`), not explicit audio cancel — but **new `response.create` while Live is speaking** is the likely cut-off mechanism.

---

## 4. Component-by-component audit

### 4.1 `caller-turn-manager.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | `session.input_transcript.delta` → 750ms quiet → `CALLER_TURN_COMMITTED` |
| **response.create** | No |
| **Cancel/supersede speech** | No |
| **Waits** | Timer only |
| **Consumers** | `onCallerTurnCommitted` (watchdog), telemetry, `caller-evidence` for semantic disposition |
| **Why** | App-side transcript grouping for backend/telemetry — **not** Live’s turn detector |
| **Verdict** | **REFACTOR** — keep for logging/correlation/insurance; **remove as primary semantic correlation** if Live delegation does not need forced commit (`forceCommitCallerTurn` on `session.delegation.created` may be redundant) |

### 4.2 `live-sideband-session.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | Sideband events |
| **Notable** | `session.delegation.created` → `forceCommitCallerTurn` + coordinator registration |
| **Greeting** | `requestInitialLiveGreeting` → commentary + `response.create` |
| **Verdict** | **REFACTOR** — delegation.created should not imply Transovo “finished caller turn”; audit whether commit is only for evidence |

### 4.3 `handle-delegated-meaning.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | `response.event` nested Astra / function tool completion |
| **response.create** | Protocol continuation via `completeDelegatedFunctionCall`; recovery via `pushVoiceV3RecoveryToLive` / `requestLiveSpeakContinuation` |
| **Waits** | Tool completion; async `applyExtractedCallerMeaning` in microtask |
| **Verdict** | **REFACTOR** — **KEEP** protocol completion; **REMOVE** recovery-driven speak on ordinary semantic failure; meaning apply should not imply speak |

### 4.4 `apply-extracted-meaning.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | Successful (or retry) meaning |
| **Chain** | `registerVoiceV3LiveSend` → `applyEvent` → `replan` → FIND/BOOK enqueue → optional `requestLiveSpeakContinuation` → `pushVoiceV3RecoveryToLive` with `skipLiveSpeak: true` only for `delegation` source |
| **Waits** | Runtime commit synchronous; FIND/BOOK background |
| **Verdict** | **REFACTOR** — Lane B only: apply meaning, enqueue ops, **append context**; **remove** `requestLiveSpeakContinuation` and default recovery speak |

### 4.5 `call-runtime.ts` (`applyEvent` / `replan`)

| Aspect | Detail |
|--------|--------|
| **Trigger** | `CALLER_MEANING_APPLIED` |
| **response.create** | Indirect via `replan` → `afterVoiceV3StateChange` |
| **Verdict** | **REFACTOR** — `replan` should sync **context/claims** to Live, not trigger planner speak |

### 4.6 `after-state-change.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | Any `commitContext` / `replan` |
| **response.create** | Via `syncPlannerSpeakToLive` |
| **Supersede** | `supersedeStaleSpeaks` on `BOOKING_CONFIRMED` (queue only) |
| **Waits** | Planner synchronous |
| **Verdict** | **REFACTOR** — **KEEP** snapshot append; **REMOVE** `syncPlannerSpeakToLive` from default path |

### 4.7 `agent-planner.ts` + `choose-next-conversation-action.ts`

| Aspect | Detail |
|--------|--------|
| **Role today** | Business readiness + **`nextConversationAction`** used as speak script |
| **response.create** | No direct; drives `live-speak-sync` |
| **Verdict** | **REFACTOR** — rename/repurpose to **business constraints** (`missingRequired`, `allowedClaims`, `safeNextBackendActions`); **decouple** `nextConversationAction` from speech scheduling (or rename to `suggestedBusinessFocus` not wired to `response.create`) |

### 4.8 `live-speak-sync.ts`

| Aspect | Detail |
|--------|--------|
| **Trigger** | Planner `SPEAK` actions |
| **response.create** | Always for ASK_*, CLARIFY_*, PRESENT_*, INFORM_*, etc. |
| **Also** | `session.commentary.append` with scripted instructions |
| **Verdict** | **REMOVE** as default orchestration layer — this is the core puppet mechanism |

### 4.9 `live-response-coordinator.ts`

| Aspect | Detail |
|--------|--------|
| **Roles** | (1) Protocol barriers (2) Planner/recovery speak queue (3) Dedup/supersede |
| **Verdict** | **REFACTOR** — shrink to **protocol continuation + optional explicit backend announcements**; do not grow coordinator to “fix” competing speaks |

### 4.10 `live-response-trigger.ts`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Documented: “GPT-Live does not speak after session.thinking.append alone” |
| **Assumption** | **Challenge in refactor** — prefer Live API patterns where context updates suffice; this helper embodies speech gating |
| **Verdict** | **REFACTOR** — restrict to **REQUIRED_DELEGATION_PROTOCOL_CONTINUATION** and rare exceptional announcements |

### 4.11 `push-recovery-to-live.ts` + recovery sync

| Aspect | Detail |
|--------|--------|
| **response.create** | When `skipLiveSpeak` false |
| **Verdict** | **REFACTOR** — default context-only; recovery must not be second conversation engine |

### 4.12 `semantic-turn-watchdog.ts`

| Aspect | Detail |
|--------|--------|
| **CALLER_TURN_COMMITTED** | Schedules 12s stall breaker; logs `FORWARD_PROGRESS_STALLED` |
| **Direct semantic** | Insurance only |
| **Verdict** | **KEEP** insurance with **no speak side effects**; **REFACTOR** coupling to committed turn as authority |

### 4.13 Claim gating (`evaluate-claims.ts`, snapshot `allowedClaims` / `forbiddenClaims`)

| Aspect | Detail |
|--------|--------|
| **Today** | Claims computed and sent in `session.thinking.append` — **good direction** |
| **Gap** | Planner still forces speak for missing fields instead of trusting Live with `missing_required` in context |
| **Verdict** | **KEEP** and **expand** — primary mechanism for BOOK/FIND truth barriers |

### 4.14 Context sync (`sync-agent-state-to-live.ts`)

| Aspect | Detail |
|--------|--------|
| **Mechanism** | `session.thinking.append` with snapshot + `next_conversation_need` |
| **Verdict** | **KEEP** — align with non-destructive updates; **remove** paired automatic `response.create` |

---

## 5. `CALLER_TURN_COMMITTED` consumers

| Consumer | File | Gates Live speech? | Verdict |
|----------|------|--------------------|---------|
| `onCallerTurnCommitted` | `semantic-turn-watchdog.ts` | No direct; enables stall breaker / legacy direct semantic | **REFACTOR** |
| `ensureTurnProgressCommitted` | `caller-turn-semantic-progress.ts` | No | **KEEP** telemetry |
| `hasCommittedCallerEvidenceForSemantic` | `caller-evidence.ts` | Affects empty vs invalid semantic disposition only | **KEEP** |
| `getCallerEvidenceTurnId` | Used in delegation handler | Correlation only | **KEEP** |
| Timing / `CALLER_TURN_TIMING` | `caller-turn-timing.ts` | No | **KEEP** |
| `forceCommitCallerTurn` | `live-sideband-session.ts` on delegation | May race Live’s own timing | **AUDIT** — likely **REFACTOR** off primary Astra path |

Live→Astra delegation is initiated by **Live** (`session.delegation.created`), not by `CALLER_TURN_COMMITTED`. The artificial commit is mainly for **Transovo evidence and insurance**, not for OpenAI delegation itself.

---

## 6. Competing speech hypothesis (cut-off / restart)

**Symptom:** Amy begins speaking, audio stops or restarts, then continues.

**Likely mechanism (no `response.cancel` in codebase):**

1. Live is already generating audio for response *N* (natural or prior create).
2. Lane B completes: `CALLER_MEANING_APPLIED` → `syncPlannerSpeakToLive` → `response.create` *M*.
3. Same window: protocol `response.create` after tool output, or `pushLiveThinkingEvent` after FIND/BOOK, or recovery `requestSpeak`.
4. Live API treats new `response.create` as **new response work**, interrupting or superseding in-progress output.

**Evidence in code:**

- `after-state-change.ts` runs `syncPlannerSpeakToLive` in `queueMicrotask` after every material snapshot change — **during** ongoing speech.
- `apply-extracted-meaning.ts` can trigger speak + recovery in same meaning-apply window.
- `live-response-coordinator.ts` `scheduleContinuationFlush` can flush **planner** continuations immediately after **protocol** continuation (see PSTN hardening tests).

**Refactor direction:** **Never** issue app `response.create` for ordinary planner/recovery/context updates while classification of “active Live response” is unknown; prefer **context-only** updates. Track active response id from sideband if API exposes it before any optional speak.

---

## 7. Tests that encode orchestration we may no longer want

| Test file | Encoded behavior | Post-refactor |
|-----------|------------------|---------------|
| `test-voice-v3-delegation-protocol-race.ts` | Recovery must `response.create` after semantic failure | Expect **context-only** recovery; speak optional |
| `test-voice-v3-pstn-hardening.ts` | Planner speak after tool output; stale speak queue | Rewrite for **no planner create** on ordinary missing field |
| `test-voice-v3-delegation-protocol-matrix.ts` | `CALLER_MEANING_APPLIED` + planner queue | Add **autonomy** tests per section 8 below |
| `test-voice-v3-serialization-audit.ts` | Critical path includes `syncPlannerSpeakToLive` | Update critical path to **context sync only** |
| `test-voice-v3-async-architecture.ts` | Coordinator blocking | **KEEP** protocol barriers only |

**Do not** treat passing legacy tests as proof of correct architecture.

---

## 8. Required tests after refactor (spec)

1. **Ordinary conversation autonomy** — caller answer → Amy responds without planner `response.create`.
2. **Backend semantic delay (3s)** — Amy keeps talking; meaning apply updates context without interrupt.
3. **FIND delay (5s)** — intake continues; availability context injected without cancel.
4. **State change during Amy speech** — meaning apply mid-utterance → **no** new `response.create`.
5. **Missing field** — planner marks email required in context; Live asks naturally; no competing create if already speaking.
6. **Booking truth barrier** — no `CLAIM_BOOKED` until confirmed; Live may converse but not claim booked.
7. **Recovery** — broken delegation repaired in background without alternate Amy monologue.
8. **Protocol continuation** — function output → exactly one delegated `response.create` (distinct from app orchestration).

---

## 9. Recommended refactor phases (implementation order)

**Phase 0 — Stop incremental orchestration patches**  
No new planner/recovery speak paths; protocol continuation only.

**Phase 1 — Kill default planner speak**  
Remove `syncPlannerSpeakToLive` from `afterVoiceV3StateChange`; keep `buildAgentSnapshotLiveAppend`. Rename/document `nextConversationAction` as business hint only.

**Phase 2 — Split context vs speak in hooks**  
`pushLiveThinkingEvent` → context-only default; explicit `requestSpeak` only for whitelisted exceptional cases (document each).

**Phase 3 — Recovery demotion**  
Default `skipLiveSpeak: true`; remove `deferred-recovery-speak` auto create.

**Phase 4 — Meaning apply lane**  
`apply-extracted-meaning.ts` — no `requestLiveSpeakContinuation`; FIND/BOOK append only.

**Phase 5 — CALLER_TURN_COMMITTED decoupling**  
Remove `forceCommitCallerTurn` from delegation.created if evidence allows; keep telemetry commit.

**Phase 6 — Active response guard**  
If sideband exposes in-progress response, block category 3–5 `response.create` (not category 2 protocol).

**Phase 7 — Docs/tests**  
Update `VOICE-V3-ASYNC-DEPENDENCY-GRAPH.md` (remove outdated “skip continuation on empty” if still present); add autonomy test suite.

---

## 10. Master KEEP / REMOVE / REFACTOR table

| Area | Verdict |
|------|---------|
| Delegated `function_call_output` + protocol `response.create` | **KEEP** |
| `session.thinking.append` / snapshot / `allowedClaims` | **KEEP** (expand) |
| `syncPlannerSpeakToLive` + planner-driven `response.create` | **REMOVE** (normal path) |
| `pushLiveThinkingEvent` default speak pairing | **REFACTOR** → context-only default |
| Recovery `requestSpeak` | **REFACTOR** → exceptional only |
| `CALLER_TURN_COMMITTED` | **REFACTOR** → telemetry/insurance, not speech gate |
| Speak coordinator queue for planner | **REMOVE** / shrink |
| Initial greeting `response.create` | **REFACTOR** — bootstrap only |
| Stall breaker direct semantic | **KEEP** without speak side effects |
| Microsoft FIND/BOOK | **KEEP** async; **REFACTOR** speak side effects |

---

## 11. Related documents to update after refactor

- `docs/VOICE-V3-ASYNC-DEPENDENCY-GRAPH.md` — remove “skip delegated response.create on empty” (superseded by protocol fix `fd9f0ca7`); add conversation-ownership lanes.
- `docs/VOICE-V3-OPENAI-PROTOCOL.md` — distinguish protocol `response.create` vs application orchestration.
- `src/lib/voice-v3/live-runtime-hooks.ts` — comment today **requires** speak after thinking; invert default.

---

*Audit produced for architecture reset. Next step: implement Phase 1–2 behind feature flag or direct cut per product sign-off, with new autonomy tests before PSTN re-cert.*
