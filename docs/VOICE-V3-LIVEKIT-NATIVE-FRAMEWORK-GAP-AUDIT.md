# VOICE V3 — LIVEKIT NATIVE FRAMEWORK GAP AUDIT

**Date:** 2026-09-20  
**Scope:** Audit only — no production changes, no deploy, no PSTN in this pass.  
**Installed runtime truth:** `livekit-agents==1.8.2` (verified in Cloud Agent venv).  
**Production Voice V3 path:** `voice-runtime-python/transovo_voice/voice_v3/` + `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` + `src/lib/voice-v3/tools/*`.

**Behavioral certification (locked):** PSTN job `AJ_sXE7NzDkuVMp` proves native GPT-Live → `delegation="responses"` → Astra → LiveKit `FunctionTool` → Transovo → Microsoft, including failed `book_appointment` → intake → confirmed book. Do **not** reopen zero-tool job `AJ_9a4soz3r6fkB` as an architecture redesign trigger.

**Note on PR #449:** Intake projection (`buildToolIntakeProjection`) exists on branch `cursor/voice-v3-livekit-intake-state-trace-2304`, **not** on `master` at audit time. Section 16 references that branch for projection behavior.

---

## A. Executive result

| Verdict | Count (concerns bucketed) |
|---------|---------------------------|
| **PROVEN_NATIVE_USED** | 18 |
| **NATIVE_AVAILABLE_NOT_USED** | 9 |
| **TRANSOVO_SPECIFIC** | 14 |
| **PARTIAL** | 7 |
| **MISSING** | 3 |
| **NOT_APPLICABLE** | 6 |

**Headline:** The production stack **already uses** LiveKit for GPT-Live duplex conversation, Responses delegation, FunctionTool execution, bounded tool steps (`max_tool_steps=5`), opt-in **cancellable** reads, **duplicate** policies (`name_and_args` + replace/reject), native **EndCallTool**, and LiveKit **SIP transfer** after Transovo authorization. Transovo correctly retains business truth (intake, generations, OfferSets, idempotency, provider commit, claim rules). **Do not** build Transovo running-tool registries, custom tool-loop coordinators, or transcript→Responses bridges.

---

## B. Architecture (actual production path)

```
PSTN SIP participant
  → LiveKit room
  → run_voice_v3_livekit_session (Python worker)
      → TransovoBackend.resolve_voice_v3_livekit_session (HTTP)
      → build_livekit_tools(raw schemas from TS) + EndCallTool
      → GPTLiveModel(model=gpt-live-1, delegation="responses", responses_options={...})
      → AgentSession(llm=gpt_live, tools=session_tools, max_tool_steps=5)
      → Agent(instructions=amyInstructions)  // Amy only; no tools on Agent
      → session.start(agent, room, room_io)

On delegated function_call (GPT-Live → Responses):
  → LiveKit tool_executor executes @function_tool handler
  → TransovoV3ToolClient.execute → execute_voice_v3_livekit_tool (HTTP)
  → executeVoiceTool (TS) → runtime / Microsoft / SMS / etc.
  → JSON serialized FunctionTool output → Responses continuation → GPT-Live speaks

Parallel path (Amy-side, not Astra tools):
  → user_input_transcribed (final) → commit_voice_v3_livekit_caller_utterance
```

**Files:** `session.py`, `tools.py`, `tool_client.py`, `voice-v3-livekit.ts`, `execute-voice-tool.ts`.

---

## C. Native framework primitive matrix

| CONCERN | LIVEKIT 1.8.2 PRIMITIVE | AVAILABLE? | USED BY US? | EXACT CONFIG / LOCATION | TRANSOVO OVERLAP | VERDICT |
|---------|-------------------------|------------|-------------|-------------------------|------------------|---------|
| GPT-Live duplex conversation | `GPTLiveModel` | YES | YES | `session.py` — no `stt`/`vad`/`tts` on `AgentSession` | Caller turn commit to Transovo | **PROVEN_NATIVE_USED** |
| Turn taking / barge-in | GPT-Live service + `AgentSession` turn handling | YES | YES | Model-controlled; no Silero/VAD on V3 session | — | **PROVEN_NATIVE_USED** |
| Responses delegation | `GPTLiveModel(delegation="responses")` | YES | YES | `responses_options`: model, instructions, tool_choice=auto, parallel_tool_calls=false | Astra instructions from TS | **PROVEN_NATIVE_USED** |
| Amy vs Astra instructions | `Agent.instructions` vs `responses_options.instructions` | YES | YES | Separate strings from `resolveVoiceV3LiveKitSession` | `buildVoiceV3Prompts` | **PROVEN_NATIVE_USED** |
| FunctionTool execution | `@function_tool` + `AgentSession` tool loop | YES | YES | `build_livekit_tools` → `function_tool(..., raw_schema=...)` | HTTP to Transovo | **PROVEN_NATIVE_USED** |
| Tool-result → backend continuation | `gpt_live_model.py` `_maybe_continue_response` | YES | YES | Certified call behavior | Structured JSON results | **PROVEN_NATIVE_USED** |
| `max_tool_steps` | `AgentSession(max_tool_steps=…)` | YES | YES | **5** from config `maxToolSteps` (`voice-v3-livekit.ts` default 5) | None | **PROVEN_NATIVE_USED** |
| Parallel tool calls | `responses_options.parallel_tool_calls` | YES | YES (off) | `false` in production resolve | TS policy also gates env | **PROVEN_NATIVE_USED** |
| Tool cancellation | `ToolFlag.CANCELLABLE` | YES | PARTIAL | `find_availability`, `find_appointment` only (`tools.py`) | Stale generation ignore in TS | **PARTIAL** |
| Running-task cancel tools | `lk_agents_get_running_tasks`, `lk_agents_cancel_task` | YES | YES (implicit) | Auto-injected when any cancellable tool registered (`agent_activity.py` ~697–704) | Not in startup `toolCount` log | **PROVEN_NATIVE_USED** |
| Duplicate handling | `on_duplicate`, `duplicate_scope` | YES | YES | READ: `replace`; else `reject`; scope **`name_and_args`** (`tools.py`) | Idempotency on writes (TS) | **PROVEN_NATIVE_USED** |
| Async / background tools | `ctx.update()`, `AsyncToolset`, `tool_handling.async_options` | YES | NO | Not configured in `session.py` | — | **NATIVE_AVAILABLE_NOT_USED** |
| Progress updates while running | `RunContext.update()` | YES | NO | — | — | **NATIVE_AVAILABLE_NOT_USED** |
| `RunContext.disallow_interruptions()` | `voice/events.py` | YES | NO (intentional) | Documented policy: do not blanket on GPT-Live | Write safety via Transovo | **NATIVE_AVAILABLE_NOT_USED** |
| `AgentSession` lifecycle | `start`, shutdown callbacks | YES | YES | `ctx.add_shutdown_callback` → `backend.close()` after `start` | — | **PROVEN_NATIVE_USED** |
| Conversation context | GPT-Live + Agent chat context | YES | YES | Framework-owned | `commitCallerUtterance` sideband | **PROVEN_NATIVE_USED** |
| Dynamic / raw schemas | `function_tool(raw_schema=…)` | YES | YES | TS emits OpenAI function schemas per wizard | Catalog + intake builders | **PROVEN_NATIVE_USED** |
| `AgentTask` / prebuilt tasks | `GetNameTask`, `GetEmailTask`, … | YES | PARTIAL | `collect_intake_field` → `intake_active_collection.py` | Passive capture via `update_intake` | **PARTIAL** |
| `EndCallTool` | `livekit.agents.beta.tools.EndCallTool` | YES | YES | `ignore_on_enter=True`, `delete_room=True` | Not in Astra schemas | **PROVEN_NATIVE_USED** |
| SIP transfer | `JobContext.transfer_sip_participant` | YES | YES | After Transovo `transfer_call` OK (`tools.py`, 45s wait) | Destination auth in TS | **PROVEN_NATIVE_USED** |
| Tool errors to model | `ToolError` | YES | YES | Python adapter; JSON errors from TS | Business errors as structured `ok:false` | **PROVEN_NATIVE_USED** |
| Events / metrics | `session.on(...)`, `FunctionToolsExecutedEvent`, etc. | YES | PARTIAL | `user_input_transcribed` only | PR #448 observability not on master | **PARTIAL** |
| `tool_handling` options | `AgentSession(tool_handling=…)` | YES | NO | Defaults | — | **NATIVE_AVAILABLE_NOT_USED** |
| Separate STT/TTS/VAD pipeline | `AgentSession(stt=, vad=, tts=)` | YES | NO on V3 | GPT-Live only | — | **NOT_APPLICABLE** |
| Transovo tool-loop coordinator | — | — | NO | — | — | **NOT_APPLICABLE** (do not build) |

### `max_tool_steps` semantics (installed 1.8.2)

| Question | Evidence |
|----------|----------|
| What counts as a step? | `speech_handle.num_steps` incremented after each tool execution batch; compared to `max_tool_steps + 1` (`agent_activity.py` ~3921). |
| Applies to GPT-Live Responses delegation? | **YES** — same `AgentSession` tool loop executes delegated backend function calls. |
| When limit reached? | Warning log; continuation with `tool_choice='none'` for final response (~3924–3927). |
| Fresh loop on new caller turn? | **YES** — new turn / speech handle cycle (framework turn model). |
| Transovo extra loop limiter needed? | **NO** for system bound; provider retries / idempotency remain Transovo. |

**ACTION:** **KEEP** `max_tool_steps=5`. **DO NOT IMPLEMENT** a second coordinator.

---

## D. Tool-by-tool matrix (cert agent `+15717491060`, Microsoft 365)

**Session startup count:** 16 Transovo-built `FunctionTool`s + 1 `EndCallTool` = **17** (`session.py` log `toolCount`).  
**Effective Astra-visible tools during turns:** 16 delegated + **2** framework tools (`lk_agents_get_running_tasks`, `lk_agents_cancel_task`) when cancellable reads present → **18** backend tools (not reflected in startup `toolCount`). `end_call` is **not** delegated to Responses (`VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES`).

| NAME | SOURCE | LIVEKIT / TRANSOVO | AMY? | ASTRA? | TYPE | CANCELLABLE | on_duplicate | duplicate_scope | ASYNC | TRANSOVO HTTP | CLASS |
|------|--------|-------------------|------|-------|------|-------------|--------------|-----------------|-------|---------------|-------|
| `update_intake` | TS schema → PY | TRANSOVO exec | No | Yes | FunctionTool raw | No | reject | name_and_args | No | Yes | FACT |
| `set_scheduling_preference` | TS → PY | TRANSOVO | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | PREFERENCE |
| `find_availability` | TS → PY | TRANSOVO | No | Yes | FunctionTool | **Yes** | **replace** | name_and_args | No | Yes | READ |
| `book_appointment` | TS → PY | TRANSOVO | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | WRITE |
| `find_appointment` | TS → PY | TRANSOVO | No | Yes | FunctionTool | **Yes** | **replace** | name_and_args | No | Yes | READ |
| `reschedule_appointment` | TS → PY | TRANSOVO | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | WRITE |
| `cancel_appointment` | TS → PY | TRANSOVO | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | WRITE |
| `transfer_call` | TS → PY | TRANSOVO + LK SIP | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes + `transfer_sip_participant` | WRITE/TERMINAL |
| `request_callback` | TS → PY | TRANSOVO | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | WRITE |
| `send_booking_link` | TS catalog | **Disabled** for cert Microsoft agent | — | — | — | — | — | — | — | — | — |
| `set_intake_name` … `mother_s_name` | TS `livekit-intake-tool-schemas` | PY routes → `update_intake` | No | Yes | FunctionTool | No | reject | name_and_args | No | Yes | FACT |
| `collect_intake_field` | TS | PY → LiveKit **AgentTask** then `update_intake` | No | Yes | FunctionTool + Task | No | reject | name_and_args | No | Yes | FACT |
| `end_call` | LiveKit `EndCallTool` | LIVEKIT native | Yes (session) | **No** (excluded from delegation schemas) | Native toolset | No | — | — | No | No | TERMINAL |
| `lk_agents_get_running_tasks` | LiveKit | LIVEKIT | No | Yes* | Auto-injected | — | — | — | — | No | SESSION |
| `lk_agents_cancel_task` | LiveKit | LIVEKIT | No | Yes* | Auto-injected | — | — | — | — | No | SESSION |

\*Injected when `has_cancellable_tool(session_tools)` — verify on next PSTN capture that Responses tool list includes them.

**Why 16 delegated schemas:** 9 capability tools enabled for config (catalog includes `end_call` but filtered for LiveKit merge) + 7 intake tools (6 `set_intake_*` + `collect_intake_field`). Intake field count = 6 for cert wizard.

---

## E. State ownership matrix (selected fields)

| Field / concept | Primary category | Owner | Notes |
|-----------------|------------------|-------|-------|
| `intake.values.*` | FACT | TRANSOVO | Authoritative via `update_intake` |
| `scheduling.normalized`, `generation` | PREFERENCE | TRANSOVO | `set_scheduling_preference` |
| `dialog.activeGoal` | CONVERSATIONAL_OBJECTIVE | TRANSOVO | Set by tools (e.g. FIND → BOOK) |
| `availability.activeOfferSet` | PROVIDER_TRUTH (presentation) | TRANSOVO | FIND dispatch |
| `booking.phase`, `confirmed` | PROVIDER_TRUTH | TRANSOVO | Graph commit |
| `allowedClaims` / planner snapshot | PRESENTATION_CLAIM_STATE | TRANSOVO | `evaluate-claims.ts` |
| LiveKit running tasks / speech handles | SESSION_FRAMEWORK | LIVEKIT | `tool_executor` |
| `conversationRevision` | BUSINESS_FRESHNESS | TRANSOVO | Stale read suppression |
| `scheduling.generation` | BUSINESS_FRESHNESS | TRANSOVO | `find-dispatch.ts` STALE ignore |

**Coupling note:** `dialog.activeGoal` affects intake objective projection (`operation-requirements.ts`) while FIND intentionally sets BOOK goal before intake complete — contributed to probe-book; PR #449 adds `book_appointment.missing_fields` independent of goal (branch not on master).

---

## F. Cancellation / duplicate / concurrency

### Cancellation

| Tool | NATIVE AVAILABLE | ENABLED | SAFE TO ENABLE | WHY | AFTER CANCEL | TRANSOVO STILL REQUIRED |
|------|------------------|---------|----------------|-----|--------------|-------------------------|
| `find_availability` | YES | YES | YES (read) | `ToolFlag.CANCELLABLE` | `asyncio.CancelledError` in PY; logged | Generation / `STALE_READ_RESULT_IGNORED` |
| `find_appointment` | YES | YES | YES | Same | Same | Same |
| `update_intake` | YES | NO | **Risky** if mid-HTTP | Fast but mutating | Partial persist possible | Prefer reject duplicate |
| Writes | YES | NO | **No** | Policy doc | Must reconcile provider | Idempotency, OUTCOME_UNKNOWN |

**Gap:** LiveKit cancellation stops the **Python asyncio task**; `httpx` call in `TransovoV3ToolClient` is **not** aborted on cancel (no `AbortSignal` wiring). Provider request may still complete → Transovo stale/generation protection **still required**.

**VERDICT:** **PARTIAL** — framework used correctly; HTTP cancel propagation is **MISSING** (future minimal wiring, not a new registry).

### Duplicate policy (recommended eventual — **DO NOT CONFIGURE YET**)

| Scenario | LIVEKIT | TRANSOVO IDEMPOTENCY |
|----------|---------|----------------------|
| FIND A while FIND A running | `replace` (same name+args) | N/A |
| FIND Tue vs FIND Wed | Different args → concurrent unless cancel | Generation stale |
| Duplicate BOOK same slot | `reject` | `bookingAttemptId` |
| `request_callback` duplicate | `reject` | Callback idempotency |

---

## G. Timeout and commit-boundary matrix

| BOUNDARY | TIMEOUT | WHERE | ON TIMEOUT | PROVIDER MAY STILL COMPLETE |
|----------|---------|-------|------------|------------------------------|
| Python → Transovo HTTP | **60s** | `backend_client.py` `httpx.AsyncClient(timeout=60.0)` | Exception → `ToolError` generic | TS may have committed |
| Microsoft FIND | **12s** default | `microsoft-find-availability.ts` | Structured failure / retryable codes | Possible in-flight Graph |
| Microsoft BOOK create | **15s** | `microsoft-create-booking.ts` | `PROVIDER_TIMEOUT` / `OUTCOME_UNKNOWN` paths in dispatch | **Yes** — reconciliation |
| LiveKit transfer | **45s** | `tools.py` `asyncio.wait_for` | `ToolError` | Transfer may complete |
| LiveKit SIP participant wait | **20s** | `session.py` | Session fail | — |

**Booking commit boundary (existing):** `book-dispatch.ts` — `BOOKING_COMMIT_SENT` → Graph → `MICROSOFT_EVENT_CREATED` → `BOOKING_CONFIRMED`; stale attempt / conversation revision checks around commit.

---

## H. Shutdown / recovery (summary)

| Scenario | LIVEKIT | TRANSOVO | OUTSTANDING TOOL |
|----------|---------|----------|------------------|
| Caller hangup | `close_on_disconnect=True` | Runtime may orphan until TTL | In-flight HTTP may complete |
| Worker shutdown | `shutdown_callback` → `backend.close()` | In-memory runtime lost | Same |
| Mid-BOOK hangup post-commit | Session ends | DB/provider truth may show booked | OUTCOME_UNKNOWN rules |

**Do not reopen** fixed `backend.close()` immediately after `start()` — current code registers shutdown correctly.

---

## I. Error taxonomy (inventory)

Structured Transovo results (`ok` / `status` / `code`) dominate. Representative codes: `MISSING_REQUIRED_INFORMATION`, `STALE_OFFER_SET`, `INVALID_SLOT`, `NOT_READY`, `INTAKE_UPDATED`, `confirmed`, `OUTCOME_UNKNOWN`, `PROVIDER_TIMEOUT`, `UNAUTHORIZED_OPERATION`, catalog in `tool-result-codes.ts`.

**Python `ToolError`:** transfer failures, intake task failures, unexpected exceptions — framework recovery semantics.

**Rule evaluation:** Business outcomes stay structured JSON; `ToolError` for adapter/invocation — **mostly consistent**. **PARTIAL** on mapping all Microsoft failures to stable semantic categories.

---

## J. Intake — native framework verdict

| Question | Answer |
|----------|--------|
| Dynamic wizard fields | **YES** — `buildUpdateIntakeZodSchema` / `buildLiveKitIntakeFunctionTools` |
| Multi-field one utterance | **YES** — `update_intake` (Astra must choose it) |
| Prebuilt Get* tasks | **YES** — used only for `collect_intake_field` |
| Custom `AgentTask` per arbitrary field | **PARTIAL** — 1.8.2 supports `AgentTask`; no dynamic multi-field task generator in repo |
| 6× `set_intake_*` helpers | Working; inflate tool count (16 + 2 lk + end_call) |
| **RECOMMENDATION** | **HYBRID / KEEP CURRENT** for PSTN cert; **LATER MIGRATE** toward fewer tools (prefer `update_intake` + optional `collect_intake_field` only) after measurement |

---

## K. Observability gap matrix

| REQUIRED EVENT | NATIVE LIVEKIT | SUBSCRIBED? | TRANSOVO EVENT | GAP |
|----------------|----------------|-------------|----------------|-----|
| User transcript final | `user_input_transcribed` | YES | `commit_caller_utterance` | No turn_id in log extras historically |
| Function tool execution | `FunctionToolsExecutedEvent` | NO | `VOICE_TOOL_*` on web | Correlate fc_id across layers |
| Delegation | GPT-Live events | NO on master | PR #448 proposed | **NATIVE_AVAILABLE_NOT_USED** |
| Metrics / usage | LLM metrics | NO | Contract version logs | Partial |

**Why earlier forensics lacked turn correlation:** LiveKit path only logged `utterance_chars`; revision/advanced only inside TS on tool execute.

---

## L. Torture-test plan (do not run yet)

See appendix at end of this document — matrix covers interrupt READ/WRITE, hangup per tool, duplicate tools, `max_tool_steps` overflow, stale READ after generation bump, claim grounding, etc. Each case lists LIVEKIT vs TRANSOVO expected behavior and log evidence.

---

## M. Actual gaps only (post-LiveKit accounting)

| GAP | WHY LIVEKIT DOESN’T SOLVE | WHY TRANSOVO NEEDS IT | MINIMAL FUTURE CHANGE | RISK |
|-----|---------------------------|----------------------|------------------------|------|
| HTTP cancel doesn’t abort TS work | Cancellation is asyncio-local | Stale FIND results | Propagate cancel to httpx or ignore via generation | Low |
| Business intake projection on LiveKit | No thinking.append wired | Astra tool-loop state | PR #449-style tool payloads (or native context API if exists) | Medium — probe-book |
| `allowed_claims` not injected on LiveKit | `sendContext` noop | Amy claim safety | Tool results + instructions; optional supported context hook | Medium |
| Cross-layer telemetry correlation | LiveKit doesn’t know `liveSessionId` | Ops | Subscribe `function_tools_executed` + map fc_id | Low |
| Confirm `lk_agents_*` in delegation tool list | Auto-inject at activity layer | Astra cancel UX | PSTN capture of Responses tool manifest | Low |

---

## N. Things we should NOT build

- `TransovoRunningToolRegistry`, `cancelCurrentFind()`, `activeFindId`
- Custom tool-loop executor / `max_steps` duplicate
- Caller-transcript → forced Responses bridge
- Manual `response.create` / function-output injection orchestrator
- Separate STT/TTS/VAD/Silero stack for V3 GPT-Live
- Custom barge-in / microphone freeze controller
- Generic duplicate-operation framework replacing `on_duplicate` / `duplicate_scope`
- Replacing Transovo idempotency / OfferSet / scheduling generation with LiveKit alone

---

## Section 16 — PR #449 intake projection (audit)

On branch `cursor/voice-v3-livekit-intake-state-trace-2304`:

| Check | Result |
|-------|--------|
| Attached to `update_intake`, `set_scheduling_preference`, `find_availability` success | **YES** (code) |
| From `VoiceV3CallRuntime` | **YES** — `buildToolIntakeProjection` |
| `book_appointment.ready` independent of `activeGoal` | **YES** — uses `getMissingFieldsForOperation("book_appointment", …)` |
| Replaces LiveKit conversation state | **NO** — business projection only |
| Correct channel for Astra under delegation | **YES** — FunctionTool JSON is native continuation contract |
| `LiveContextPublisher` / thinking.append on LiveKit | **NO** — still noop; optional future if GPT-Live exposes equivalent |

---

## Section 17 — Claim grounding (cert call)

| Path | Enforcement |
|------|-------------|
| Failed first BOOK | Structured `MISSING_REQUIRED_INFORMATION` → Astra → intake → no Graph write |
| Confirmed BOOK | `BOOKING_CONFIRMED` in TS → `toolOk("confirmed")` → Astra → Amy |
| LiveKit | Does not know Microsoft truth |
| Transovo | `evaluateAllowedClaims`, booking phase, tool results |
| Amy | GPT-Live + backend delegation; **no** separate claim engine in Python |

**Invariant:** External mutation claims require provider/tool success — **enforced in Transovo + Astra discipline**, not LiveKit.

---

## Section 19 — Transfer / end_call

| Tool | Implementation |
|------|----------------|
| `end_call` | `EndCallTool(ignore_on_enter=True, delete_room=True)` — native |
| `transfer_call` | Transovo authorizes destination → `job_ctx.transfer_sip_participant` — **LiveKit PSTN**, not legacy Telnyx CC on this path |

---

## Section 20 — Concurrency ownership (sample)

| Scenario | LIVEKIT | TRANSOVO | BOTH |
|----------|---------|----------|------|
| Interrupt FIND | Cancel task | Stale generation | **BOTH** |
| FIND + BOOK overlap | duplicate reject on BOOK? | auth rules | BOTH |
| Stale FIND result after Wed change | Cancel Tue task | `STALE_READ_RESULT_IGNORED` | **BOTH** |
| Duplicate BOOK | reject concurrent | idempotency | **BOTH** |
| Probe book | — | readiness check | TRANSOVO |

---

## Section 21 — Freshness

| Mechanism | Protects |
|-----------|----------|
| `scheduling.generation` | Wrong calendar window / OfferSet |
| `conversationRevision` | Commit vs newer caller speech |
| LiveKit cancel | Stop waiting on obsolete READ |
| OfferSet id binding | BOOK args must match active offer |

---

## Appendix — Torture test matrix (abbreviated; execute later)

For each test: **PRECONDITION** → **CALLER ACTION** → **LIVEKIT EXPECTED** → **TRANSOVO EXPECTED** → **ALLOWED AMY CLAIM** → **PASS CRITERIA** → **LOG EVIDENCE**.

1. **Interrupt FIND (speech during Graph)** — Cancellable cancel or replace; TS may still complete Graph; slots must not present if generation stale.  
2. **Interrupt BOOK pre-commit** — Non-cancellable; book completes or fails authoritatively.  
3. **Hangup during FIND** — Session close; no orphan claims.  
4. **Duplicate FIND same args** — `replace` per policy.  
5. **FIND Tue → FIND Wed** — Cancel/replace + generation  bump.  
6. **Multi-field utterance** — single `update_intake` preferred.  
7. **Chain > 5 tools** — `max_tool_steps` final no-tools response.  
8. **Provider success / HTTP lost** — OUTCOME_UNKNOWN + reconciliation.  
9. **Premature “you’re booked”** — forbidden without `CLAIM_BOOKED` / confirmed tool.  
10. **Stale READ returns after new revision** — `STALE_READ_RESULT_IGNORED`.

(Full 30+ case expansion to be executed pre-next-cert campaign.)

---

## Source references (installed 1.8.2)

| API | Location |
|-----|----------|
| `ToolFlag.CANCELLABLE` | `livekit/agents/llm/tool_context.py` |
| `duplicate_scope` `name` \| `name_and_args` | same |
| `on_duplicate` allow/reject/replace/confirm | `tool_executor.py` |
| `lk_agents_cancel_task` | `tool_executor.py` |
| `max_tool_steps` | `agent_session.py`, enforced `agent_activity.py` |
| `GPTLiveModel` delegation | `livekit/plugins/openai/realtime/gpt_live_model.py` |
| `disallow_interruptions` | `livekit/agents/voice/events.py` (RunContext) |

**Transovo production:** `voice-runtime-python/transovo_voice/voice_v3/session.py`, `tools.py`, `docs/VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md`.

---

**END OF AUDIT — STOP (no implementation, no deploy, no PSTN).**
