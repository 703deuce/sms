# Voice V3 — LiveKit Migration Directive (Authoritative)

**Status:** SPECIFICATION — implement on implementation branch; **STOP BEFORE DEPLOYMENT** until implementation report is reviewed.  
**Installed reference:** `livekit-agents==1.8.2` (verify every API against installed source, not docs alone).  
**Tool catalog reference:** `docs/VOICE-V3-TOOL-CATALOG-REFERENCE.md`  
**Prior audit:** `docs/VOICE-V3-LIVEKIT-GPT-LIVE-SOURCE-AUDIT.md`

---

## Governing rule

**LIVEKIT OWNS:** agent/session/tool/workflow/telephony plumbing, iterative tool loop, GPT-Live integration, SIP transfer, EndCallTool, prebuilt collection tasks where applicable, RunContext, cancellation/duplicate/async tool semantics.

**TRANSOVO OWNS:** wizard configuration, business rules, authorization, persistence, providers (Microsoft, SMS), idempotency, reconciliation, scheduling generations, OfferSets, structured business result contracts.

**Do not** port the old direct-OpenAI/Telnyx tool coordinator into Python.

**Do not add** for GPT-Live path: STT, TTS, VAD, Silero, external turn detector, manual Live websocket, `response.create`, `response.cancel`, manual tool-result continuation.

---

## Architecture (locked)

```
Telnyx PSTN
  → LiveKit SIP / Room
  → AgentSession
  → GPTLiveModel(model="gpt-live-1", delegation="responses")
  → Amy (voice front — full duplex)
  → Responses delegation
  → Astra (reasoning backend)
  → LiveKit tool/workflow execution (iterative loop)
  → Transovo business layer (where applicable)
  → structured result → Astra → Amy → caller
```

Official references (verify + installed 1.8.2):

- Tool Loop Design
- Async Tools and Cancellation
- Function Tools (raw_schema, programmatic tools)
- GPT-Live Plugin Guide
- Workflows / Tasks (GetNameTask, GetEmailTask, …)
- SIP Transfer (`TransferSIPParticipant`)
- EndCallTool (`livekit.agents.beta.tools`)

Record for every API: **DOCUMENTED API | INSTALLED 1.8.2 API | DIFFERENCE | DECISION**

---

## The 11 capabilities — target classification

| # | Capability | Class | LiveKit | Transovo |
|---|------------|-------|---------|----------|
| 1 | Intake (was `update_intake`) | **A + B hybrid** | Prebuilt Tasks + programmatic FunctionTools + optional bulk raw-schema tool | Persistence, validation, wizard fields |
| 2 | `set_scheduling_preference` | **B** | FunctionTool + `raw_schema` | Semantics, generation, normalization |
| 3 | `find_availability` | **B** | FunctionTool, `ToolFlag.CANCELLABLE` | Microsoft READ, OfferSets |
| 4 | `book_appointment` | **B** | FunctionTool; idempotency at commit (no blanket `disallow_interruptions` on GPT-Live) | Microsoft WRITE |
| 5 | `find_appointment` | **B** | FunctionTool, cancellable READ if safe | Lookup, selection |
| 6 | `reschedule_appointment` | **B** | FunctionTool + interruption guard | Microsoft WRITE |
| 7 | `cancel_appointment` | **B** | FunctionTool + interruption guard | Microsoft WRITE |
| 8 | `transfer_call` | **C** | `TransferSIPParticipant` (cold); future `WarmTransferTask` | Authorize destination id → E.164 |
| 9 | `end_call` | **C** | `EndCallTool` + hooks | Audit/disposition only |
| 10 | `send_booking_link` | **B** | FunctionTool + mutation guard | SMS, consent, URL |
| 11 | `request_callback` | **B** | FunctionTool + mutation guard | Callback persistence |

---

## CRITICAL — Implement LiveKit tool loop, not Transovo tool loop

LiveKit owns:

```
LLM reasons → tool selected → LiveKit executes → result to model context
→ LLM reasons again → another tool OR final answer
```

With GPT-Live + `delegation="responses"`: **Astra** selects tools; **LiveKit** executes Python handlers; **LiveKit** returns results to Responses; **no** manual continuation.

**Do not:** `response.create`, function-output injection, delegation correlation maps, custom coordinator.

**Return** structured JSON from handlers; **do not** have Python speak outcomes (Amy does).

**`max_tool_steps=5`:** bounds chained tool work per delegation, not “only five tools exist.”

---

## Intake — NOT a questionnaire

### Required behavior (preserve)

- Capture facts **whenever** the caller volunteers them, **any time** in the call.
- **Reuse** across booking, callback, reschedule, Q&A → later booking.
- **Never re-ask** satisfied fields unless correction needed.
- **Multi-field utterances** in one sentence must persist all clear values.
- **Required-for-booking** ≠ ask at call start.
- **Corrections** supersede prior values; no duplicate competing truths.
- **No invented** uncertain values.

### Two modes

1. **Passive capture** — caller volunteers → Astra invokes LiveKit FunctionTool(s) → Transovo persistence (throughout call, not only during “intake phase”).
2. **Active collection** — missing value blocks an action → use LiveKit prebuilt Task **only then** (e.g. `GetEmailTask` when email required for book and missing).

**Do NOT** force sequential `GetNameTask → GetEmailTask → …` on every caller.

### Standard field mapping (conceptual — map from real wizard metadata)

| Wizard semantic type | LiveKit mechanism (when actively collecting) |
|---------------------|-----------------------------------------------|
| name | `GetNameTask` |
| email | `GetEmailTask` |
| phone | `GetPhoneNumberTask` |
| address | `GetAddressTask` |
| dob | `GetDOBTask` |
| other / custom | Programmatic `function_tool` from wizard field def |

Verify each Task with **GPTLiveModel** in 1.8.2 — if a Task pulls in STT/TTS/VAD/extra LLM, **do not** use it; use programmatic FunctionTool instead.

### Custom wizard fields

- LiveKit docs: programmatic tools from runtime field definitions (pattern: `set_*` per field).
- Stable field id (`custom_dino_173`) for persistence; human label only in descriptions.
- Enums/constraints from wizard preserved.
- `raw_schema` when certified JSON is better for a field.

### Future of model-facing `update_intake`

After native collection:

- **Preferred hybrid:** wizard-generated **bulk** raw-schema FunctionTool (e.g. `record_intake_information`) for multi-field passive capture **plus** field-specific tools/tasks for active collection.
- Keep bulk tool only if **tested** better than sequential field tools with `parallel_tool_calls=False`.
- **Test Approach A vs B** (see § Multi-field capture) before finalizing.

### Persistence

```
Wizard → compiler → LiveKit collection/tool → validated value
  → thin Transovo persistence adapter (reuse TS executors via HTTP)
  → authoritative VoiceV3CallRuntime / DB
```

- **Transovo authoritative**; userdata is session cache only; Transovo wins on conflict.
- Hydrate session from authoritative state + policy for ANI at start.
- One shared call-level intake (not separate booking vs callback stores).

### Tasks share session context

No persona reset, second greeting, or forgotten prior facts when a Task runs.

---

## Multi-field capture — test before choosing

**Approach A:** Sequential field tools (`set_name`, `set_phone`, …) in one delegation.

**Approach B:** One wizard-generated bulk FunctionTool with dynamic raw schema.

Choose by: extraction accuracy, latency, delegations, corrections, custom fields, GPT-Live reliability — **not** “which sounds more native.”

---

## Business tools (2–7, 10–11) — FunctionTool pattern

```python
# Conceptual — VERIFY signature order in livekit-agents 1.8.2
async def handler(raw_arguments: dict[str, object], ctx: RunContext):
    result = await execute_transovo_business_tool(ctx, tool_name, raw_arguments)
    return result  # structured dict — NOT ToolError for NEEDS_INFORMATION, STALE, etc.

livekit_tool = function_tool(
    handler,
    raw_schema=certified_schema_from_wizard,
    flags=...,
    on_duplicate=...,
    duplicate_scope="name_and_args",  # verify vs async duplicate docs in 1.8.2
)
```

**One generic adapter** to `/api/internal/voice-runtime` `execute_voice_v3_livekit_tool` — no eight HTTP clients.

**HTTP:** Prefer `utils.http_context.http_session()` if job-scoped session works with auth; else bind custom client to **JobContext shutdown only** (never `finally` after `session.start()`).

**RunContext required** on all custom handlers: userdata refresh, optional `ctx.update()` for long READs. **GPT-Live write safety:** idempotency/reconciliation — not blanket `disallow_interruptions()` (see `VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md`).

### Per-tool notes

| Tool | Cancellable | on_duplicate | Interruption |
|------|-------------|--------------|--------------|
| `set_scheduling_preference` | No | conservative | N/A |
| `find_availability` | Yes (if HTTP cancel safe) | consider `replace` for READ | N/A |
| `find_appointment` | Yes if safe | conservative | N/A |
| `book_appointment` | No | idempotency + reconciliation | No blanket `disallow_interruptions` on GPT-Live |
| `reschedule_appointment` | No | conservative | before commit |
| `cancel_appointment` | No | conservative | before commit |
| `send_booking_link` | No | conservative | before send |
| `request_callback` | No | conservative | before persist |

**ToolError:** only genuine recoverable framework failures — not `NEEDS_INFORMATION`, `STALE`, `OUTCOME_UNKNOWN`, etc.

---

## `transfer_call` — LiveKit telephony (cold)

**Flow:**

```
Astra: transfer_call(destination=<wizard id only>)
  → Transovo authorize + resolve E.164
  → Python: TransferSIPParticipant(room, sip_participant_identity, transfer_to="tel:+...")
```

- Never model-facing arbitrary E.164.
- Use **SIP participant identity** from room attributes — not ANI as identity.
- Successful transfer ends LiveKit session (per LiveKit SIP docs).
- **Warm:** `WarmTransferTask` later if wizard supports warm transfer — do not build custom warm transfer now.

---

## `end_call` — LiveKit EndCallTool

- Use `livekit.agents.beta.tools` EndCallTool for physical hangup, room delete, job shutdown.
- Transovo: optional audit hook (reason, disposition) — not `end_requested` as sole hangup mechanism.
- `ignore_on_enter` (or 1.8.2 equivalent) so model cannot end during greeting.
- Review `delete_room` behavior for PSTN disconnect.

---

## Tool gating

Remove permanent **4-tool cert filter** after loop is certified.

Authoritative names: `listVoiceV3AstraToolNamesForConfig(config)` → build matching LiveKit tools/tasks.

`agent.update_tools(...)` only for **capability** changes — **not** intent routing (booking vs callback).

---

## Caller objective switching — NO custom router

**Do not build:** `activeGoal`, `CallerMeaning`, `IntentRouter`, keyword switches.

**Architecture:** GPT-Live conversation + Astra semantics + LiveKit cancellable READs + mutation guards + Transovo generations.

Examples:

- Booking → callback during FIND: cancel READ (`ToolFlag.CANCELLABLE` + LiveKit cancel tools); `request_callback`.
- Tuesday → Wednesday during FIND: new `set_scheduling_preference` (generation++); new FIND; stale OfferSet ignored.
- Callback → booking: reuse intake; scheduling tools when authorized.
- During BOOK: write non-cancellable; reconcile; Astra reasons over **actual** book outcome + new callback ask (GPT-Live stays duplex).

**Layers:** LiveKit cancellation = efficiency; Transovo generation = correctness.

---

## Duplicate handling (verify 1.8.2)

- Modes: `allow` | `reject` | `replace` | `confirm` — configure per tool.
- `duplicate_scope="name_and_args"` where installed (Tuesday FIND ≠ Wednesday FIND).
- Writable in-flight: **never** `replace` that cancels commit.

---

## Async / progress

- Long READ (`find_availability`): consider `await ctx.update("Checking …")` — meaningful only, no spam.
- Test `ctx.with_filler` with GPT-Live before use.
- GPT-Live: delegated work does not block voice; caller can speak during FIND.

---

## Responsibility split

| Layer | Owns |
|-------|------|
| LiveKit | Tool registration, execution loop, RunContext, cancel/duplicate/async, transfer/end transport, dynamic tools |
| Astra | Intent, tool choice, args, reaction to results, multi-step chains |
| Amy / GPT-Live | Voice UX, delegation trigger, speak outcomes |
| Transovo | Wizard, persistence, Microsoft/SMS/callback, generations, idempotency, authorization |

---

## Do not rewrite (preserve)

`compileVoiceV3AgentConfig`, wizard manifest, `astra-tool-contracts.ts` descriptions (audit for old coordinator assumptions), Microsoft executors, scheduling meaning, OfferSets, appointment selection, callback/SEND_LINK, provider integrations, structured result contracts.

## Bypass on LiveKit path (after proven)

Direct OpenAI orchestration, Telnyx Call Control for LiveKit-owned calls, manual continuation, custom hangup/transfer transport, duplicated email/phone normalization where LiveKit Task owns it, per-tool HTTP clients, early `backend.close()`.

**Do not delete** rollback code paths yet.

---

## Required implementation report (before deploy)

1. **LiveKit version** — APIs verified in 1.8.2  
2. **Tool architecture** — all 11 + generated intake tools  
3. **Intake** — passive vs active; Tasks vs bulk tool; custom fields; multi-field test winner  
4. **Transfer** — cold implementation; warm future note  
5. **End call** — EndCallTool config  
6. **Transovo FunctionTools** — list + raw schema source  
7. **RunContext** — usage matrix  
8. **HTTP** — job session vs custom client  
9. **Wizard map** — field → LiveKit destination → Transovo destination  
10. **Removed/bypassed** — files/functions  
11. **Preserved** — files/functions  
12. **Test results** — matrices below  
13. **Exact diff** — files changed  
14. **Per-tool table** — for each capability: class, schema, flags, cancellable, on_duplicate, duplicate_scope, async, ctx.update, interruption, Transovo call, return statuses, ToolError cases, switch-while-running behavior  

---

## Test matrices (mandatory)

### Intake continuous (Tests A–J)

A. All fields one utterance  
B. Name early, book later  
C. Partial early, book later — only missing asked  
D. Custom field early, required later — satisfied  
E. Email correction  
F. Multi-field correction  
G. Booking → callback reuse  
H. Callback → booking reuse  
I. Missing email — active collection only then  
J. Q&A only — no interrogation  

### Microsoft flows

New book; find existing; cancel; reschedule; correction during FIND; stale OfferSet; OUTCOME_UNKNOWN.

### Callback, SEND_LINK, transfer, end_call

As specified in user directive §§42–45 (ANI, consent, cold transfer, EndCallTool lifecycle, backend close once).

### Tool-loop switching (§36)

BOOKING↔CALLBACK at each phase; TUESDAY↔WEDNESDAY before/during/after FIND; FIND_APPOINTMENT→CALLBACK; etc.

### Certification per tool

Wizard enabled? Exposed? Astra selected? LiveKit invoked? Args valid? RunContext? Transovo called? Provider action? Structured result? Amy phrasing? Duplicate? Interruption? Latency?

---

## Logging (tool-loop diagnostics)

Per invocation: delegation id, function call id, tool name, args (sanitized), start/finish, cancelled, duplicate, HTTP timing, Transovo status, result to Astra, next action, Amy speech (if available).

---

## GPT-Live media ownership (invariant)

| Component | Required |
|-----------|----------|
| Voice model | GPTLiveModel / gpt-live-1 |
| Separate STT | NONE |
| Separate TTS | NONE |
| LiveKit VAD | NONE |
| External turn detector | NONE |

Interruption: test **GPT-Live native** behavior on PSTN; do not fix with VAD.

---

## Branch and deployment gate

- Implement on **`cursor/voice-v3-livekit-implementation-2304`** (or successor), aligned with Coolify App 2 build branch.  
- Merge `master` lifecycle fixes (`shutdown_callback`, `duplicate_scope` literal) before production.  
- **STOP BEFORE DEPLOYMENT** until implementation report + tests reviewed.

---

## Source files (starting points)

| Area | Path |
|------|------|
| LiveKit session | `voice-runtime-python/transovo_voice/voice_v3/session.py` |
| Tool wrapper | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| Bridge | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` |
| Catalog | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| Descriptions | `src/lib/voice-v3/tools/astra-tool-contracts.ts` |
| Executors | `src/lib/voice-v3/tools/*-tool.ts` |
| Wizard compile | `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` |
| Intake schema | `src/lib/voice-v3/intake-objective/build-intake-tool-schema.ts` |

---

*This document consolidates the product/architecture directive for migrating Voice V3 to current LiveKit Agents (1.8.2) + GPT-Live while preserving Transovo business logic. It supersedes informal “adapt all eleven the same way” guidance.*
