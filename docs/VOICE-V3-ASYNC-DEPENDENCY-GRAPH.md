# Voice V3 — Async / concurrency dependency graph

**Authority:** OpenAI GPT-Live docs (delegation, `response.item.create`, `response.create`, `session.thinking.append`, `session.commentary.append`) + installed `openai` SDK Live types (`node_modules/openai/resources/live/live.d.ts`).  
**Not authority:** Legacy Realtime-only parameter names (e.g. `turn_detection` / semantic VAD) — **not present** on Live session types in SDK 7.17.x.

## Lanes

| Lane | Owner | Must not block |
|------|--------|----------------|
| Conversation | GPT-Live (listen/speak/interrupt) | Microsoft FIND, Astra apply, planner persistence |
| Semantic | Astra / `emit_caller_meaning` | Live speech (except protocol barriers below) |
| Runtime | Transovo state, rules, planner | Network I/O to Microsoft |
| Execution | FIND / BOOK / lookup | Amy TTS completion |
| Context-sync | `session.thinking.append` / commentary / coordinator | Runtime commit |

## PROTOCOL_BARRIER (OpenAI — do not parallelize)

| Step | Ordering | Source |
|------|----------|--------|
| Delegated `function_call` completes | Wait for nested `response.output_item.done` | Live delegation |
| Submit outputs | `response.item.create` with `function_call_output` for each pending `call_id` | Live API |
| Continue delegation | `response.create` only after **all** required outputs submitted | Live API; error if pending |
| Empty semantic, no caller evidence | Submit output; **then** delegated `response.create` (protocol) — application ignore only | See `fd9f0ca7`; speech orchestration audit: `VOICE-V3-CONVERSATION-OWNERSHIP-AUDIT.md` |

## DATA_DEPENDENCY / MUTATION_BARRIER (application)

| Step | Depends on | Lane |
|------|------------|------|
| Validate `CallerMeaning` | Raw tool arguments | Semantic → Runtime |
| `CALLER_MEANING_APPLIED` | Valid meaning | Runtime |
| Rules / planner | Committed context | Runtime |
| FIND dispatch | `mayFindAvailability` / `requiredAction`, buildable window | Runtime → Execution |
| FIND result merge | `schedulingGeneration`, `requestKey` | Execution → Runtime (stale if gen changed) |
| BOOK | Selected slot, intake, revalidation, single commit registry | Execution (sequential inside BOOK) |
| BOOKING_CONFIRMED | Microsoft create success | Mutation barrier |

## CONVERSATION_NON_BLOCKING

| Step | Was blocking? | Target |
|------|----------------|--------|
| `dispatchFindAvailabilityIfRequired` (Microsoft HTTP) | **Yes** — awaited in `apply-extracted-meaning` | **Background execution lane** (`enqueueFindAvailabilityIfRequired`) |
| `dispatchBookingIfRequired` | Awaited after meaning | Fire-and-forget; internal BOOK gates unchanged |
| `pushVoiceV3RecoveryToLive` after meaning | After FIND | Runs after enqueue; planner already ran on `applyEvent` |
| Persistence snapshot | Already `void` in runtime | Background |

## BACKGROUND_NON_BLOCKING

- Telemetry (`CALLER_TURN_TIMING`, pipeline logs)
- Durable snapshot placeholder
- FIND Microsoft Graph (when enqueued)

## Turn commit latency (Live)

- **App-side:** `caller-turn-manager` commits after `COMMIT_QUIET_MS` (750ms) following last `session.input_transcript.delta`.
- **SDK Live types:** No `turn_detection` / semantic VAD fields found under `openai/resources/live/*` for gpt-live-1 sideband path.
- **Measure:** `speech_end_to_turn_commit_ms` uses last transcript fragment timestamp vs `turnCommittedAt`.

## Stale concurrent FIND

- `schedulingGeneration` on recovery and offer sets.
- `isStaleSchedulingPreference` on result apply → `AVAILABILITY_RESULT_STALE` / operation `STALE`.
- New generation may dispatch new FIND without waiting for prior Graph response.

## Critical path: `CALLER_TURN_COMMITTED` → `agent_audio_started`

Classifications: **REQUIRED_PROTOCOL** | **REQUIRED_DATA** | **REQUIRED_MUTATION** | **UNNECESSARY_SERIALIZATION**

| Step | Location | Waits on | Class | Notes |
|------|----------|----------|-------|-------|
| Transcript quiet commit | `caller-turn-manager.ts` `COMMIT_QUIET_MS` | 750ms since last delta | REQUIRED_DATA | App turn boundary; **not tuned in async pass** |
| Turn committed hook | `semantic-turn-watchdog.ts` `onCallerTurnCommitted` | — | — | `function_tool`: **no** 1.2s direct defer (insurance only for `output_text`) |
| Direct semantic insurance | `semantic-turn-watchdog.ts` `DIRECT_SEMANTIC_DEFER_MS` | 1200ms timer | UNNECESSARY_SERIALIZATION (primary) | Disabled when `VOICE_V3_INTAKE_TRANSPORT=function_tool` |
| Delegation drain | `semantic-turn-watchdog.ts` `drainQueuedSemanticTurns` | `response.completed` | UNNECESSARY_SERIALIZATION (primary) | No-op on `function_tool`; gated on pending tool outputs / in-flight semantic |
| Live delegation stream | `handle-delegated-meaning.ts` | nested Astra events | REQUIRED_PROTOCOL | Wait for `response.output_item.done` + tool args |
| Tool output | `live-response-coordinator.ts` `submitFunctionCallOutput` | — | REQUIRED_PROTOCOL | `response.item.create` before continuation |
| Continuation flush | `live-response-coordinator.ts` `scheduleContinuationFlush` | microtask; pending outputs cleared | REQUIRED_PROTOCOL | `response.create` after outputs |
| Runtime meaning apply | `apply-extracted-meaning.ts` | validate + `applyEvent` | REQUIRED_MUTATION | **Not awaited** from delegation handler (background) |
| Live send registration | `apply-extracted-meaning.ts` | — | REQUIRED_DATA | Register **before** `applyEvent` so `replan` can sync snapshot/speak |
| Planner + snapshot | `after-state-change.ts` | `planAgentState` | REQUIRED_DATA | `queueMicrotask` → `session.thinking.append` + `syncPlannerSpeakToLive` |
| FIND | `find-dispatch.ts` | Microsoft Graph | EXECUTION_LANE | Background via `enqueueFindAvailabilityIfRequired` |
| BOOK | `book-dispatch.ts` | revalidate + Graph create | REQUIRED_MUTATION | Fire-and-forget dispatch; gates inside BOOK unchanged |
| Recovery speak after meaning | `apply-extracted-meaning.ts` `pushVoiceV3RecoveryToLive` | — | UNNECESSARY_SERIALIZATION (happy path) | `skipLiveSpeak: true` for `source: delegation`; context append only |
| Semantic retry | `semantic-extraction-retry.ts` | retry runner | RETRY only | Failure path; not awaited from delegation handler |
| Agent audio | Live model + coordinator | prior barriers | REQUIRED_PROTOCOL | Measured as `responseCreateRequestedAt` → `agent_audio_started` |

### Primary-path defect fixed (production `semantic_retry` / `delegation_drained`)

1. **`response.completed` → `delegation_drained`** re-ran direct extraction while Live `function_tool` delegation was the authoritative path → second semantic cycle (`semantic_retry` source).
2. **`onCallerTurnCommitted` → 1.2s direct defer** stacked on every turn even when delegation was already in flight.
3. **`await applyExtractedCallerMeaning`** in the delegation completion microtask extended the handler lifetime (recovery speak duplicated planner `response.create`).

## Per-await audit (caller-turn hot path)

| File | Function | Await | Classification | Notes |
|------|----------|-------|----------------|-------|
| `handle-delegated-meaning.ts` | `completeEmitCallerMeaningFunctionCall` | `applyExtractedCallerMeaning` | ~~UNNECESSARY~~ **void** | Output submitted first; apply on background lane |
| `apply-extracted-meaning.ts` | `applyExtractedCallerMeaning` | — | — | **No longer awaits FIND** |
| `find-dispatch.ts` | `completeFindAvailabilityAfterDispatch` | Graph / `fetchBusy` | EXECUTION_LANE | Runs in background unless `awaitCompletion: true` (tests) |
| `book-dispatch.ts` | `dispatchBookingIfRequired` | Revalidate + create | MUTATION_BARRIER | Enqueued async; internal serialization preserved |
| `live-response-coordinator.ts` | `submitFunctionCallOutput` | — | REQUIRED_PROTOCOL | Then `scheduleContinuationFlush` → `response.create` when queue allows |
| `semantic-extraction-retry.ts` | retry runner | Astra/direct | RETRY path only | `turn_path: RETRY` |

## Performance acceptance (post-architecture)

- Ordinary intake turns: `turn_path: HAPPY_PATH`, `semantic_retry_count: 0`.
- FIND turns: `overlapped_operations` includes FIND op id while planner may already show `ASK_REQUIRED_FIELD`.
- Caller stop → first useful Amy audio: segment table from `CALLER_TURN_TIMING` (not cumulative transcript length).

## References

- OpenAI Live: delegation nested `response.event`, function output before continuation `response.create`.
- Full duplex + `session.thinking.append` for background availability (commentary for speakable verified results).
