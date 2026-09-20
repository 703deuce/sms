# Voice V3 — GPT-Live interruption vs write safety (livekit-agents 1.8.2)

**Authority:** Installed package source under `livekit/agents` and `livekit/plugins/openai/realtime/gpt_live_model.py`.  
**Architecture:** `GPTLiveModel(delegation="responses")` — Amy/GPT-Live front, Astra/Responses backend tools via LiveKit executor.

## Governing rule

**Do not sacrifice GPT-Live continuous listening to protect a backend write.**

Write safety = Transovo idempotency, commit boundaries, reconciliation, `OUTCOME_UNKNOWN`.  
Read abandonment = `ToolFlag.CANCELLABLE` + Transovo scheduling generations / stale suppression.

**Do not** call `RunContext.disallow_interruptions()` on every Transovo mutation by default on the GPT-Live path.

## What `disallow_interruptions()` does (1.8.2)

From `livekit/agents/voice/events.py`:

> Disable interruptions for **this FunctionCall** … sets `speech_handle.allow_interruptions = False` and reconciles paused speech for that handle.

It targets the **function-call speech handle** (assistant audio tied to the tool step), not a global “mute caller” switch. Even so, on GPT-Live we avoid blanket use until a tool-specific need is proven; generic STT→LLM→TTS guidance does not map 1:1 to delegated Responses work.

## GPT-Live delegation (1.8.2)

- Backend function calls arrive via `response.output_item.done` on the Responses delegation stream (`gpt_live_model.py`).
- LiveKit executes Python `FunctionTool` handlers and returns results into the backend batch continuation (`_maybe_continue_response`).
- Non-`CANCELLABLE` tools are **not** cancelled on user speech; only `ToolFlag.CANCELLABLE` tools receive `asyncio.CancelledError` when explicitly cancelled via LiveKit’s cancel-task controls (`tool_executor.py`).

## Three separate concepts

| Concept | GPT-Live path policy |
|--------|----------------------|
| **A. Caller speech / duplex** | GPT-Live keeps ingesting audio; do not block listening because a write runs. |
| **B. Tool cancellation** | READs: `CANCELLABLE`. WRITES: default non-cancellable. |
| **C. Business rollback** | Transovo only; never pretend a committed Microsoft write did not happen. |

## Per-tool policy (Transovo LiveKit worker)

| Tool | Cancellable? | `disallow_interruptions()` | Write safety |
|------|----------------|---------------------------|--------------|
| `update_intake` | No | **No** (default) | Fast HTTP persist; corrections via newest authoritative state |
| `set_scheduling_preference` | No | **No** | Generation bump + stale FIND protection |
| `find_availability` | **Yes** (`replace` dupes) | N/A | Stale generation suppression |
| `find_appointment` | **Yes** | N/A | Same |
| `book_appointment` | No | **No** (use idempotency) | Commit boundary in TS executor; `OUTCOME_UNKNOWN` |
| `reschedule_appointment` | No | **No** | Same |
| `cancel_appointment` | No | **No** | Reconcile actual Microsoft outcome if caller says “wait” |
| `send_booking_link` | No | **No** | SMS idempotency / already_sent |
| `request_callback` | No | **No** | Callback persistence idempotency |
| `transfer_call` | No | **No** | Transovo auth then LiveKit SIP transfer lifecycle |
| `end_call` | No | LiveKit `EndCallTool` | Native hangup; `ignore_on_enter` |

`ABORTED_BEFORE_COMMIT` is only returned if a Transovo executor explicitly supports it — not invented in Python.

## Objective switching (no custom router)

Caller may change intent while FIND or BOOK runs. Architecture:

1. GPT-Live retains newer caller turns in conversation/delegation context.
2. Astra selects tools from **current** semantic intent.
3. LiveKit cancels obsolete **cancellable** READs when appropriate.
4. Non-cancellable writes run to authoritative Transovo result.
5. Astra reconciles **latest caller request + actual write outcome** (e.g. booked + “just call me back”).

## Required PSTN tests (GPT-Live)

See migration directive §23: speak during FIND/BOOK, stop after BOOK start, booking↔callback switches, intake correction during persist, SEND_LINK, cancel “wait”.

## Implementation

`voice-runtime-python/transovo_voice/voice_v3/tools.py` — writes use `ToolFlag.NONE` only; no blanket `disallow_interruptions()`.

Optional follow-up: `ctx.update()` on long READs after GPT-Live compatibility check (async tool pattern).
