# Voice V3 PSTN call — follow-up forensics (evidence only)

**Call:** `live_u7_EPk6lp3oMdWQ5CilFbpLcfWnhc3ovPuq` · `v3:j8lDApIiI0HegFSEd6vubC3-hTcx7VDw2cAsUacS7n3OBfPlwi-jxg`  
**Deploy:** `59744238` · **UTC:** `2026-09-19T07:49:08.458Z` (~96s)  
**Sources:** Coolify container logs (`ds8s3hjin60qs6g7s0iqkixs-073532389098`), production DB via `docker exec`, `src/lib/voice-v3/**` code audit.

**Scope:** Investigation only. No changes to scheduling, FIND, BOOK, intake, tools, or Live/Astra orchestration.

**Prior report:** `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-19-live_u7.md`

---

## Executive alignment (frozen path)

The production call validates the intended architecture:

`GPT-Live/Amy → Astra → set_scheduling_preference → deterministic normalizer → find_availability → Microsoft → OfferSet → intake → book_appointment → revalidation → Microsoft event → BOOKING_CONFIRMED → confirmation authorized to Live.`

**Do not alter that path based on this investigation.** The sections below tighten **observability interpretation**, **delegation protocol evidence**, and **durability boundaries** only.

---

## 1. Caller-perceived response latency

### 1.1 What the first report actually measured

`VOICE_V3_CALL_SUMMARY` **`median_turn_latency_ms` / `max_turn_latency_ms`** come from `VoiceV3CallTrace.onAstraResponseEvent()` in `src/lib/voice-v3/telemetry/call-trace.ts`: time from **`astra.response.started`** to the next **`astra.response.completed`** (nested Live/Astra events). That is **backend Astra processing latency**, not caller-perceived latency.

This call recorded **16** such intervals (multiple nested completions per delegation) while **`delegation_count` = 8**. The raw list (`909 … 3412` ms) must **not** be reported as “per caller turn” or “Amy response time.”

### 1.2 Primary metric requested

**Caller speech end → Amy first audio** (first audible output for the reply to that turn).

### 1.3 What telemetry exists today

| Boundary | Logged during this call? | Where / how |
|----------|---------------------------|-------------|
| Live authoritative **input turn end** (VAD / `speech_stopped`) | **No** | Sideband logs `session.input_transcript.delta` and `session.input_audio.append`; no `speech_stopped` / turn-end event in logs. |
| **`caller.speech.ended`** (trace) | **Effectively no** | `live-sideband-session.ts` marks `caller.speech.ended` only on **`session.closed`** (once at hangup in the printed timeline). |
| **Caller speech end proxy** | **Partial** | `CALLER_TURN_COMMITTED` after **750ms quiet** following transcript fragments (`caller-turn-manager.ts`); 9 commits on this call with nearby pipeline `at` timestamps. |
| **Last transcript activity** | **Partial** | Trace marks `caller.transcript.activity` (from `session.input_transcript.delta`); not the same as acoustic end. |
| **Amy first audio (new utterance)** | **Not distinguishable** | Every `session.output_audio.delta` marks `agent.audio.started` in the trace — **per chunk**, not per spoken reply. |
| **`CALLER_TURN_TIMING` / `total_caller_stop_to_agent_audio_ms`** | **Not emitted** | `finalizeCallerTurnTiming()` exists in `caller-turn-timing.ts` but is **never called** anywhere else in the repo; **0** `CALLER_TURN_TIMING` lines on this call. |
| **`agentAudioStartedAt` on turn rows** | **Unreliable** | `noteSemanticTimingEvent(..., "agentAudioStartedAt")` runs on every output audio delta without turn correlation; no finalized turn report. |

**Conclusion:** This call **cannot** establish authoritative **caller speech end → Amy first audio** from stored telemetry alone. Any number derived from `agent.audio.started` immediately after `delegation.created` (~60–220 ms in the trace) measures **ongoing TTS chunks**, not a new reply boundary.

### 1.4 What can be reconstructed (approximate, labeled)

#### A. `CALLER_TURN_COMMITTED` → `session.delegation.created` (intake-heavy turns)

Useful as “quiet transcript commit → Live started Astra,” not full perceived latency.

| Turn seq | ~Commit (UTC) | Next `session.delegation.created` (UTC) | Δ (ms) |
|----------|-----------------|----------------------------------------|--------|
| 1 | 07:49:23.346 | 07:49:23.297* | *commit after deleg 2 start — overlapping lane |
| 2 | 07:49:39.783 | 07:49:39.893 | ~110 |
| 3 | 07:49:46.515 | 07:49:46.696 | ~181 |
| 4 | 07:49:55.514 | 07:49:56.687 | ~1173 |
| 5 | 07:49:04.115 | 07:50:04.689 | ~574 |
| 6–8 | … | … | (see logs; turn 7 shares seq 5 commit window) |

\*Turn 1 commit appears **after** delegation 2 begins — consistent with **overlap** (FIND lane while conversation continues).

#### B. Tool-internal breakdown (authoritative tool logs)

| Step | UTC (approx) | Duration |
|------|----------------|----------|
| `set_scheduling_preference` | 07:49:24.984 | 13 ms |
| `find_availability` (incl. Microsoft) | 07:49:27.7 → 07:49:29.806 | **2099 ms** |
| Each `update_intake` | spread 07:49:48 – 07:50:26 | 1–5 ms |
| `book_appointment` total | 07:50:31.468 | **2501 ms** |
| └ revalidation (log) | | ~554 ms |
| └ Microsoft create (log) | | ~1621 ms |

#### C. Scheduling turn — lower bound for “caller stopped → slots known”

Using trace ms (t0 ≈ `07:49:06.691Z`):

- Last `caller.transcript.activity` before delegation 2: **+15968 ms**
- `find_availability` completes: **+23115 ms**
- First `agent.audio.started` after FIND: **+23168 ms** (**+53 ms** after tool return — continuous audio, not a clean utterance start)

**Proxy (weak):** last transcript activity before scheduling deleg → first audio after FIND completes ≈ **7200 ms**, dominated by **Microsoft FIND (~2.1 s)** and **parallel speech/intake**, not Astra median 1.5 s.

#### D. BOOK turn — lower bound after tool

- Last `caller.transcript.activity` before delegation 8: trace **+77587 ms**
- `book_appointment` completes: **+82268 ms** (from `07:50:31.468Z`)
- First `agent.audio.started` after book: **+84883 ms** (**+106 ms** after tool — again chunk-level)

**Proxy (weak):** last transcript activity before book deleg → first audio after BOOK ≈ **7296 ms**, dominated by **BOOK path (~2.5 s)** and ongoing audio.

### 1.5 Turn classification (8 delegations)

| # | ~UTC `delegation.created` | Class | Tools / outcome |
|---|---------------------------|--------|-----------------|
| 1 | 07:49:12.013 | Conversational | No tools |
| 2 | 07:49:23.297 | Tool-dependent | `set_scheduling_preference` + `find_availability` |
| 3 | 07:49:39.893 | Conversational? | No tool success in this deleg window (between FIND and intake) |
| 4 | 07:49:46.696 | Tool-dependent | `update_intake` #1 |
| 5 | 07:49:56.687 | Tool-dependent | `update_intake` #2 |
| 6 | 07:50:04.689 | Tool-dependent | `update_intake` #3 |
| 7 | 07:50:16.307 | Tool-dependent | `update_intake` #4 |
| 8 | 07:50:25.715 | Tool-dependent | `update_intake` #5 → `INTAKE_OBJECTIVE_COMPLETED`; then `book_appointment` in deleg 8 window |

(Delegation indexing follows `session.delegation.created` count = 8; tool timestamps align with delegations 2, 4–8.)

### 1.6 Missing boundaries (do not instrument yet — report only)

To measure true **caller speech end → Amy first audio** on future calls, telemetry would need at least one of:

1. Live sideband **input turn boundary** (e.g. end-of-speech) with monotonic timestamp, or  
2. **Utterance-level** agent audio start (first `output_audio` after delegation/tool barrier), not per-delta, plus  
3. **`finalizeCallerTurnTiming`** (or equivalent) wired on delegation/tool completion with **`caller_turn_id`** populated (this call had **`caller_turn_id: null`** on all tool outputs).

---

## 2. Five `Unknown client delegation` errors

### 2.1 Summary

- **Count:** 5 (matches `VOICE_V3_CALL_SUMMARY.errors`)
- **Tools affected:** **`update_intake` only** (one error per intake tool output cycle)
- **Not observed after:** `set_scheduling_preference`, `find_availability`, or `book_appointment` continuations on this call
- **Call continued:** Yes; Amy spoke afterward; tools succeeded

### 2.2 Common protocol sequence (all five)

For each `update_intake` completion the outbound/inbound order is:

1. **`VOICE_TOOL_EXECUTION_SUCCEEDED`** (`INTAKE_UPDATED`)
2. **`response.item.create`** with `function_call_output` — `live-response-coordinator.ts` → `submitDelegatedFunctionCallOutput()` → `this.send(payload)`
3. **`DELEGATED_FUNCTION_OUTPUT_SUBMITTED`** / **`LIVE_FUNCTION_CALL_OUTPUT_SUBMITTED`**
4. **`DELEGATED_CONTINUATION_REQUESTED`** — `requestDelegatedProtocolContinuation()`
5. **`response.create`** (`reason: delegated_protocol_continuation`, `event_id: voice_v3_delegated_cont_*`)
6. Sideband **`response.event`** → nested **`response.completed`** on the **same** `delegation_id`
7. **`DELEGATED_CONTINUATION_COMPLETED`** (logs `continuation_event_id` matching step 5)
8. **~50–80 ms later:** sideband **`error`** → **`VOICE_V3_BASIC_SIDEBAND_ERROR`** `Error: Unknown client delegation.` (OpenAI client / WS; string not in repo)

**Immediately before the error:** always step **5** (`response.create`) already sent; error follows step **7** (delegation already marked completed).

### 2.3 Per-occurrence table

| # | UTC error | `delegation_id` | `function_call_id` | Tool | `continuation_event_id` (truncated) | `response_id` (Astra completed) |
|---|-----------|-----------------|--------------------|------|-------------------------------------|----------------------------------|
| 1 | 07:49:49.044 | `item_EPk7OasFVsiQ5sB7ddqUL` | `call_eTpcxh2G3NOZAKcuzXsSu3pz` | `update_intake` | `..._eTpcxh2G3NOZAKcuzXsSu3pz_1789804188798` | `resp_03fde501...e9a72a087d0926e3a26f9df5b6f` |
| 2 | 07:49:58.457 | `item_EPk7YygQyTlOMnTvexZJy` | `call_TLsNaEWMhiKFiBgJCio0XrHx` | `update_intake` | `..._TLsNaEWMhiKFiBgJCio0XrHx_1789804198210` | `resp_03fde501...ea471e087d09ee6b0333052227f` |
| 3 | 07:50:06.804 | `item_EPk7gb0a7Z2pA10Kt8heQ` | `call_0zLd30ogiXZoa6oyTkfua56K` | `update_intake` | `..._0zLd30ogiXZoa6oyTkfua56K_1789804206557` | `resp_03fde501...eac714c87d0a85534908c3cc82d` |
| 4 | 07:50:18.101 | `item_EPk7sAOH79BZVjlEh5ez5` | `call_nW8t64DNv2TdxBb54WEtZ1Lx` | `update_intake` | `..._nW8t64DNv2TdxBb54WEtZ1Lx_1789804217854` | `resp_03fde501...eb8110487d0b11191c71421db2b` |
| 5 | 07:50:27.223 | `item_EPk8123x3SU7ZwpP5fgGW` | `call_cAHZyqjBljOty3pm98vvuSlW` | `update_intake` | `..._cAHZyqjBljOty3pm98vvuSlW_1789804226975` | `resp_03fde501...ec177b887d0835a53d7b0c0b9ba` |

After each error: **`session.input_audio.append`** continues; further delegations and tools run normally.

### 2.4 Contrast: `find_availability` continuation (no error)

After FIND `response.create` at **07:49:29.808Z**, nested **`response.created`** arrives (**07:49:30.306Z**) — delegation **`item_EPk71vY07q8aGdlEBTyu7` stays streaming** (second tool round / continuation). **No** immediate `response.completed` + error pair.

### 2.5 Code path for the last outbound message before error

| Step | File | Function |
|------|------|----------|
| Tool output | `src/lib/voice-v3/delegation/live-response-coordinator.ts` | `submitDelegatedFunctionCallOutput()` → `this.send({ type: "response.item.create", item: { type: "function_call_output", ... }})` |
| Continuation | Same file | `requestDelegatedProtocolContinuation()` → `this.send({ type: "response.create", event_id })` |
| Sideband send | `src/lib/voice-v3/live-sideband-session.ts` | `send()` → `logVoiceV3SidebandOutbound` + `sideband.send(event)` |
| Error surface | Same file | `sideband.on("error")` → `VOICE_V3_BASIC_SIDEBAND_ERROR` + `trace.recordError(message)` |

### 2.6 Most likely failing protocol boundary (hypothesis — not a fix)

All five failures share:

`function_call_output` → **`response.create` (delegated_protocol_continuation)** → **immediate Astra `response.completed` on that `delegation_id`** → **OpenAI WS error `Unknown client delegation`**.

**Working hypothesis:** `response.create` is sent to continue a **client delegation that Live/Astra has already torn down** when the nested delegation completes synchronously after intake (single-shot delegations). Scheduling continuations often see **`response.created`** and further streaming instead of immediate completion, so no error.

**Not proven:** exact OpenAI-side rule. **Proven:** same app code path; error is **correlated** with intake continuations; **not** correlated with booking confirmation continuation on this call.

---

## 3. Intended Voice V3 persistence path

### 3.1 PSTN ingress (this call)

| Step | Implementation | Persists `voiceCall`? |
|------|----------------|---------------------|
| Telnyx `call.initiated` | `src/lib/voice-v3-basic/telnyx-webhook-handler.ts` | **No** — logs, binds wizard context in memory, SIP forward only |
| Wizard bind | `tryNotePstnWizardBindingFromToE164()` in `resolve-pstn-wizard-binding.ts` | **No** — comment: *“no VoiceCall row yet”*; sets `notePstnLegWizardContext({ callId: callControlId })` |
| Live accept | `openai-live-webhook.ts` | **No** — `createVoiceV3CallRuntime({ callId: pstnLeg?.callId \|\| event.data?.call_id })` uses **`v3:j8l…` Telnyx id**, not a Prisma `voiceCall.id` |
| Legacy Telnyx path | `ensureVoiceCallForTelnyxEvent()` in `ensure-call-from-event.ts` | **Yes** — used by main `webhook-handlers.ts`, **not** by v3-basic handler |

**First missing boundary for call records:** Voice V3 Basic PSTN **never invokes** `ensureVoiceCallForTelnyxEvent` / `voiceCall.create`. Runtime `callId` **is** the Telnyx call-control string.

Alternate entry `startAppointmentReceptionistVoiceV3OnPstn()` **updates** an existing `voiceCall` by id — irrelevant when no row was created.

### 3.2 BOOKING_CONFIRMED (this call)

| Artifact | Storage | Survives container restart? |
|----------|---------|------------------------------|
| Microsoft Graph event | Microsoft (`provider_event_id` in logs) | **Yes** |
| `BOOKING_CONFIRMED` log | Container logs | Only if logs retained |
| `bookingAttemptId` `bka_cmu8385m215094u0r6s3o325d` | `booking-attempt-registry.ts` — **in-memory `Map` per `liveSessionId`** | **No** |
| `ConfirmedBooking` / `providerEventId` | `markBookingConfirmed()` + `registerDurableBooking()` in `durable-booking-store.ts` — **in-memory `Map`** | **No** |
| Offer set / slots | Built in FIND; `recordPresentedOffer()` — **in runtime context**, not Prisma `VoiceV2OfferSet` in v3 calendar code | **No** |
| `voice_appointments` row | **Not written** by Voice V3 book path | **No** |

Voice V3 book execution: `src/lib/voice-v3/calendar/book-dispatch.ts` → Microsoft adapter → `registerDurableBooking()`.

**Legacy** path that **does** persist appointments: `src/lib/voice/calendar/booking.ts` → `prisma.voiceAppointment.create()` (Voice V2 / agent-tool-gateway style). Voice V3 **does not call** that module for this PSTN pipeline.

### 3.3 Are `voiceCall` / `voice_appointments` “for V3”?

| Model | Intended use (evidence) | Voice V3 Basic PSTN uses it? |
|-------|-------------------------|------------------------------|
| `VoiceCall` | Canonical call record for Telnyx/LiveKit/tool webhooks, transcripts, tool executions | **Bypassed** on v3-basic Telnyx route |
| `VoiceAppointment` | Durable ledger for reconciliation, busy intervals, CRM (`voice-appointment-reconcile.ts`) | **Bypassed**; V3 uses in-memory `durable-booking-store` |
| `VoiceV2OfferSet` (Prisma) | V2 FIND/BOOK persistence | **Not referenced** under `src/lib/voice-v3/calendar/` |

There is **no separate Prisma “Voice V3 call” model** — V3 was designed around **session runtime** (`VoiceV3CallRuntime` in `call-runtime.ts`, TTL 2h in-memory) plus **Microsoft as source of truth** for calendar events.

### 3.4 What would survive total log loss today

| Link | Survives? |
|------|-----------|
| Customer ↔ Microsoft appointment | **Yes** (Graph) |
| Customer ↔ Transovo `voice_appointments` | **No** (this call) |
| `callControlId` ↔ `live_session_id` ↔ `bookingAttemptId` | **No** (in-memory + logs only) |
| `providerEventId` in application DB | **No** (only in tool output JSON in logs) |

### 3.5 First missing / bypassed boundary (for a future durability design — not implemented here)

1. **Call ingress:** `handleVoiceV3BasicTelnyxWebhook` does not join the existing `ensureVoiceCallForTelnyxEvent` pipeline.  
2. **Booking success:** `BOOKING_CONFIRMED` stops at **`registerDurableBooking()` (process memory)** and never reaches `prisma.voiceAppointment.create()` or integration `product-persist` paths.

Any durability work should **trace which of these was intentional (MVP basic SIP)** vs **accidental omission** before adding inserts.

---

## 4. Explicit non-actions (per instruction)

- No scheduling / FIND / BOOK / intake / tool contract changes  
- No Live/Astra orchestration or `response.create` patches  
- No new instrumentation or DB writes in this pass  

---

## 5. Reference

```
live_session_id:     live_u7_EPk6lp3oMdWQ5CilFbpLcfWnhc3ovPuq
call_control_id:     v3:j8lDApIiI0HegFSEd6vubC3-hTcx7VDw2cAsUacS7n3OBfPlwi-jxg
booking_attempt_id:  bka_cmu8385m215094u0r6s3o325d
provider_event_id:   AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEiPQ9oAAAA=
```
