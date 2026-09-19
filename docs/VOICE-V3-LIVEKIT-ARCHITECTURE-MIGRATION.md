# Voice V3 — LiveKit-reference architecture migration

**Reference (not a dependency):** LiveKit GPT-Live responses delegation, function-tool runtime, async tools, front-desk/calendar example, March 2026 GPT-Live batch-continuation fixes.  
**Protocol authority:** Installed `openai` SDK Live types + OpenAI GPT-Live delegation docs (`response.item.create` → `response.create`).  
**Transport:** Telnyx SIP → OpenAI GPT-Live-1; Astra `gpt-6-astra` via Responses delegation; Transovo executes tools; Microsoft Graph is calendar truth.

**Rule:** Model requests → application authorizes → provider confirms → model communicates. Not: semantic blob → rules → planner → dispatch.

---

## Subsystem inventory

| Subsystem | Path | Classification | Notes |
|-----------|------|----------------|-------|
| `VoiceV3CallRuntime` | `state/call-runtime.ts` | **KEEP** | Authoritative per-call state; `replan` loses speech side effects |
| `VoiceV3CallContext` | `state/call-context.ts` | **KEEP** | Single application state |
| `CallerMeaning` / Zod schema | `intake/caller-meaning-schema.ts` | **MOVE_BEHIND_TOOL** | Becomes internal shape for `update_intake` + scheduling helpers, not LLM-facing mega-tool |
| `emit_caller_meaning` | `intake/emit-caller-meaning-tool.ts` | **DELETE** (primary) | Replaced by typed capability tools |
| `apply-caller-meaning` | `intake/apply-caller-meaning.ts` | **KEEP** | Called from `update_intake` tool implementation |
| `handle-delegated-meaning` | `intake/handle-delegated-meaning.ts` | **REPLACE** | → `tools/handle-delegated-voice-tools.ts` |
| `apply-extracted-meaning` | `intake/apply-extracted-meaning.ts` | **DELETE** | Planner/speak/FIND-after-meaning chain |
| `caller-turn-manager` | `conversation/caller-turn-manager.ts` | **REFACTOR** | Telemetry/correlation only; not conversation control |
| `semantic-turn-watchdog` | `conversation/semantic-turn-watchdog.ts` | **DELETE** (normal path) | Insurance semantic retry removed with tool errors to Astra |
| `caller-turn-semantic-progress` | `conversation/caller-turn-semantic-progress.ts` | **DELETE** or telemetry-only | |
| `evaluateVoiceV3Rules` | `state/call-rules.ts` | **KEEP** | Preconditions for tools, not tool choice |
| `agent-planner` / `chooseNextConversationAction` | `agent/*` | **REFACTOR** | Invariants + snapshot + claims only; no speak |
| `GoalManagerState` / `goal-manager` | `agent/goal-manager.ts` | **REFACTOR** | Track outcomes from tool results, not inferred goals from meaning |
| Recovery directives / matrix | `recovery/*` | **REFACTOR** | System-level only; tool errors → Astra |
| `live-speak-sync` | `agent/live-speak-sync.ts` | **DELETE** | Planner puppet speech |
| `live-response-trigger` | `live-response-trigger.ts` | **REFACTOR** | Protocol continuation only |
| `live-response-coordinator` | `delegation/live-response-coordinator.ts` | **KEEP** | Shrink to protocol barrier + optional commentary |
| `delegation-drained` / direct semantic | `semantic-turn-watchdog`, `direct-caller-meaning-extraction` | **DELETE** | |
| Claim gating | `agent/evaluate-claims.ts` | **KEEP** | Primary claim barrier |
| Operation registry | `operations/*` | **KEEP** | Behind BOOK/FIND/CANCEL tools |
| FIND dispatcher | `calendar/find-dispatch.ts` | **MOVE_BEHIND_TOOL** | `find_availability` |
| BOOK dispatcher | `calendar/book-dispatch.ts` | **MOVE_BEHIND_TOOL** | `book_appointment` |
| RESCHEDULE / CANCEL | `calendar/*-dispatch.ts` | **MOVE_BEHIND_TOOL** | |
| Microsoft adapters | `calendar/microsoft/*` | **KEEP** | |
| Offer set / slot IDs / generations | `calendar/offer-set.ts`, `rules/stale-result.ts` | **KEEP** | |
| `session.thinking.append` | `sync-agent-state-to-live.ts`, hooks | **KEEP** | Non-destructive context |
| `session.commentary.append` | `live-speak-sync`, greeting | **REFACTOR** | Verified facts only; no auto `response.create` |
| `response.create` (app) | coordinator, greeting bootstrap | **REFACTOR** | Category: protocol continuation + initial session bootstrap only |
| `CALLER_TURN_COMMITTED` | `caller-turn-manager.ts` | **REFACTOR** | Logs/telemetry only |
| Telemetry / call trace | `telemetry/*` | **KEEP** | Add `VOICE_TOOL_*` events |
| Persistence placeholder | `call-runtime.ts` | **KEEP** | |
| Astra instructions | `prompts/astra-backend-instructions.ts` | **REPLACE** | Tool-centric (Phase 21) |
| Live frontend instructions | `prompts/live-frontend-instructions.ts` | **REPLACE** | Conversation ownership (Phase 22) |
| Tests encoding planner speak | `test-voice-v3-*` | **REPLACE** | Phase 25 matrix |

---

## `response.create` call sites (migration target)

| Site | Today | Target |
|------|-------|--------|
| `requestDelegatedProtocolContinuation` | Protocol | **KEEP** |
| `requestInitialLiveGreeting` | Bootstrap | **KEEP** (until Live-native greet) |
| `syncPlannerSpeakToLive` | Orchestration | **DELETE** |
| `pushLiveThinkingEvent` | Context + speak | **REFACTOR** → context only |
| `pushVoiceV3RecoveryToLive` | Recovery speak | **REFACTOR** → context only default |
| `apply-extracted-meaning` slot speak | Orchestration | **DELETE** |
| `deferred-recovery-speak` | Recovery | **DELETE** |

No `response.cancel` in codebase today; cut-off risk = stacked `response.create`.

---

## Implementation phases (this repo)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | This migration doc | **Done** |
| 2–4 | `src/lib/voice-v3/tools/*` registry + execution | **Done** (wired to delegation) |
| 5–9 | Typed tools (intake, find, book, …) | **Partial** (intake, find, book; reschedule/cancel pending) |
| 10–12 | Remove planner/recovery speak | **Partial** (`syncPlannerSpeakToLive` removed from replan) |
| 13–14 | Delegation batch barrier + parallel tools | **Done** (barrier + `parallel_tool_calls`) |
| 15 | thinking/commentary without speak | **In progress** |
| 16 | Decouple `CALLER_TURN_COMMITTED` | **Pending** |
| 17–18 | Greeting tool gating / availability | **Pending** |
| 19 | Preserve safety assets | **Ongoing** |
| 20 | Delete dead paths after tests | **Pending** |
| 21–22 | Prompt rewrite | **In progress** |
| 23–24 | Tool result contract + telemetry | **In progress** |
| 25 | New test matrix | **Pending** |
| 26–27 | Dead code removal + `VOICE-V3-FINAL-ARCHITECTURE.md` | **Partial** |
| 28 | Deploy + PSTN acceptance | **Pending** |

---

## Tests to retire or rewrite

- Assertions that semantic failure **must** `response.create` for recovery speak  
- Critical paths listing `syncPlannerSpeakToLive` as required  
- `emit_caller_meaning`-only delegation race tests → tool batch tests (Phase 25 D–O)

---

*See also `docs/VOICE-V3-FINAL-ARCHITECTURE.md`, `docs/VOICE-V3-CONVERSATION-OWNERSHIP-AUDIT.md`.*
