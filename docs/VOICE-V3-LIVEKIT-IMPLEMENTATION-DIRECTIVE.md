# Transovo Voice V3 → existing LiveKit Cloud — complete implementation directive

**Status:** Authoritative implementation spec (supersedes earlier LiveKit migration instructions).  
**Supersedes:** informal migration notes; complements `docs/VOICE-V3-LIVEKIT-INFRA-DISCOVERY.md` (discovery complete).  
**Phase 0 rollback record:** `docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md`

---

## Five official-doc boundaries — do not improvise

1. **GPT-Live:** Use LiveKit’s **`GPTLiveModel`** (`from livekit.plugins.openai.realtime import GPTLiveModel`), not `RealtimeModel`. Native params: `model="gpt-live-1"`, `voice` (e.g. marin from wizard), `delegation="responses"`, `responses_options={...}`. **Amy** instructions on **`Agent`**. **Astra** instructions/model/tool policy in **`responses_options`**.

2. **Tools / delegation:** With `delegation="responses"`, backend Responses (Astra) selects tools; LiveKit executes `@function_tool` in the worker, returns results, continues delegated response. **Eliminate** manual `response.item.create` / bare `response.create` orchestration on the LiveKit path.

3. **Concurrency:** Use LiveKit tool policies: normal vs async (`ctx.update`), cancellable reads, `on_duplicate` / `duplicate_scope`, `ctx.disallow_interruptions()` for consequential writes, `max_tool_steps` bound. Transovo retains scheduling generations, idempotency, reconciliation.

4. **Telephony context:** Authoritative SIP participant attributes: `sip.phoneNumber` (ANI), `sip.trunkPhoneNumber` (dialed DID), `sip.callID`, `sip.callIDFull`, `sip.trunkID`, `sip.ruleID`. Pass `participant.identity` for transfer — not the same as E.164.

5. **Transfer:** `TransferSIPParticipant` with `room_name`, `participant_identity`, `transfer_to` (e.g. `tel:+1...`). SIP REFER; successful cold transfer ends AgentSession. Semantic tool remains `transfer_call`; Transovo authorizes destination.

**Authoritative references during implementation:** LiveKit GPT-Live plugin guide, Python `GPTLiveModel` reference, async tools & concurrency guide, tool-loop design guide, SIP API reference, SIP participant attributes, call forwarding/transfer guide.

---

## Core rule

**REPLACE PLUMBING. KEEP TRANSOVO.**

This is **not** a new LiveKit build, spike, second voice product, or Transovo rewrite.

We already have: LiveKit Cloud project, credentials, SIP URI, Telnyx ↔ LiveKit infrastructure, trunks, dispatch, Python `transovo-voice` worker, worker → backend bridge, provisioning libs, media-backend abstraction, production V3 business/tools, certified Microsoft/callback/SEND_LINK.

**Target stack:**

```
Telnyx PSTN
→ existing LiveKit Cloud SIP
→ existing transovo-voice Python worker
→ LiveKit AgentSession
→ OpenAI GPTLiveModel
→ GPT-Live-1 / Amy
→ native responses delegation
→ existing Astra backend model/instructions
→ LiveKit function tools
→ ONE thin authenticated Transovo V3 adapter
→ EXISTING Transovo V3 tool execution/business layer
→ Microsoft / Telnyx / DB / SMS
```

| Layer | Owns |
|--------|------|
| LiveKit | Realtime orchestration |
| GPT-Live / Amy | Caller-facing conversation |
| Astra | Semantic reasoning / tool selection |
| Transovo | Authorization / business state / provider execution |
| Providers | External truth |

---

## PHASE 0 — Freeze the rollback boundary

Before modifying runtime behavior, record in `docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md`:

- current master SHA  
- current production SHA  
- current Voice V3 known-good SHA (direct path)  
- `+15717491060` Telnyx routing state  
- production deployment identity  

**Do not** delete direct-OpenAI V3 runtime yet. **Do not** run old and LiveKit paths on the **same DID**. Git + Telnyx routing = rollback.

---

## PHASE 1 — Dependency correction

**Current:** `voice-runtime-python` declares `livekit-agents[openai] >=1.2,<2`.

**Required:** Pin to current GPT-Live-capable line, approximately:

```text
livekit-agents[openai]~=1.8
```

- Do **not** install a separate OpenAI websocket package for GPT-Live.  
- Do **not** use TS worker or resurrect `voice-runtime/src/main.ts`.  
- Active runtime: `voice-runtime-python/` only.

After update: resolve exact installed version, record it, verify imports, run Python worker tests, verify non-V3 bootstrap still starts, do not alter Cloud credentials.

**Imports (1.8):**

```python
from livekit.plugins.openai.realtime import GPTLiveModel
from livekit.agents import (
    Agent,
    AgentSession,
    AgentServer,
    JobContext,
    RunContext,
    function_tool,
)
```

Use installed 1.8 signatures; do not backport old APIs.

---

## PHASE 2 — Preserve existing LiveKit infrastructure

Reuse: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SIP_URI`, `LIVEKIT_AGENT_NAME`, `MEDIA_BACKEND_MODE`, resolver, SIP helpers, worker deployment, `TRANSOVO_BACKEND_URL`, `TRANSOVO_INTERNAL_API_KEY`.

Cloud selected. **Do not** create another project/credentials/server or second media-backend abstraction. V3 business code must not depend on cloud vs self-host.

---

## PHASE 3 — Verify +15717491060 before modifying SIP

Run (read-only first):

```bash
PHONE_E164=+15717491060 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-571-livekit-callable.ts
```

Also `inspectLiveKitSipRouting(e164)`.

Determine: trunk membership, trunk ID, dispatch rule, agent name, SIP host, current Telnyx connection (OpenAI vs LiveKit), exact cutover change.

**Do not create/modify resources yet.** Prefer updating existing trunk number list over duplicate trunk. Prefer reuse/update dispatch over duplicate rule. **No second `transovo-telnyx-inbound` trunk.**

---

## PHASE 4 — Do not port the custom OpenAI Live coordinator

On the **LiveKit path**, bypass (do not delete yet):

- `src/lib/voice-v3/live-sideband-session.ts`  
- delegation coordinator / function-output / manual continuation  

**Do not manually:** GPT-Live websocket lifecycle, `session.start` audio transport, delegation event parsing, nested `response.event` correlation, `response.item.create` injection, bare `response.create`, pending FC batching, ambient/overlap delegation correlation, custom OpenAI reconnect, custom protocol continuation.

With `delegation="responses"`, LiveKit manages tool loop. **Two orchestration systems = failure.**

---

## PHASE 5 — V3 profile inside existing Python AgentServer

One `AgentServer`; explicit dispatch `agent_name` for V3:

```python
server = AgentServer()

@server.rtc_session(agent_name=VOICE_V3_AGENT_NAME)
async def voice_v3_entrypoint(ctx: JobContext):
    ...
```

Separate: dispatch `agent_name`, participant display name, Transovo `agent_id`. Do not hijack non-V3 dispatch without a dedicated V3 profile/name in the **same** worker/deployment.

---

## PHASE 6 — Resolve V3 call before GPT-Live

Use authenticated worker → backend pattern. Resolve workspace, agent, DID, runtime config from SIP/job metadata (backend authoritative).

**SIP participant (inbound):**

```python
caller_e164 = participant.attributes.get("sip.phoneNumber")
dialed_e164 = participant.attributes.get("sip.trunkPhoneNumber")
sip_call_id = participant.attributes.get("sip.callID")
provider_call_id = participant.attributes.get("sip.callIDFull")
trunk_id = participant.attributes.get("sip.trunkID")
rule_id = participant.attributes.get("sip.ruleID")
```

- `sip.phoneNumber` = ANI  
- `sip.trunkPhoneNumber` = number dialed  
- Do **not** derive ANI from LLM, room name, or identity alone  
- Persist **`sip_participant.identity`** for transfer  

Conceptual `VoiceV3CallContext`: room, sip participant identity, E.164 fields, SIP IDs, workspace_id, agent_id, runtime_config ref — from **existing** Transovo compile/resolve endpoints, not duplicated in Python.

---

## PHASE 7 — Start AgentSession with GPT-Live

```python
gpt_live = GPTLiveModel(
    model="gpt-live-1",
    voice=resolved_voice,
    delegation="responses",
    responses_options={
        "model": resolved_astra_model,
        "instructions": resolved_astra_instructions,
        "tool_choice": "auto",
        "parallel_tool_calls": False,
    },
)
session = AgentSession(
    llm=gpt_live,
    tools=resolved_v3_tools,
    max_tool_steps=5,  # bounded; revisit only with evidence
)
agent = Agent(instructions=resolved_amy_instructions)
await session.start(agent=agent, room=ctx.room, ...)
```

**Rules:**

- `delegation="responses"` only — **not** `delegation="client"`.  
- Astra **model** = trace production config; do not invent slugs.  
- `parallel_tool_calls: False` initially unless certified otherwise.  
- Map `reasoning`, `text.verbosity`, `service_tier`, `max_output_tokens` only if production sets them.  
- Do **not** reintroduce unsupported `text.format` (400 risk).  
- Voice from wizard `liveVoiceId`; cannot change after session start.

---

## PHASE 8 — Amy on Agent, Astra in responses_options

**Wrong:** `GPTLiveModel(instructions=amy_prompt)`  

**Right:**

- `Agent(instructions=resolved_amy_instructions)`  
- `responses_options["instructions"]` = Astra  

Amy: caller-facing behavior, delegation etiquette, one question at a time — **not** full function schemas.  
Astra: reasoning, tool choice, dates, operation switching.  
Remove instructions that only existed for manual delegation protocol.

---

## PHASE 9 — No manual GPT-Live barge-in like Realtime

Full duplex; server-driven turns. Do **not** port `response.cancel`, manual truncation, Realtime VAD assumptions, custom “create response now.”

---

## PHASE 10 — One generic Transovo V3 tool adapter

No Microsoft/callback/SMS logic in Python. Use `TRANSOVO_BACKEND_URL` + `TRANSOVO_INTERNAL_API_KEY`.

`TransovoV3ToolClient.execute(tool_name, arguments, call_context)` → prefer existing **`handle-delegated-voice-tools` / `execute-voice-tool`** boundary; adapt, do not fork.

Authenticate, pass authoritative identity, preserve validation, operation IDs, idempotency, structured results, tool-class timeouts, correlation logging (no secrets).

---

## PHASE 11 — Raw/exact tool schemas

Use `function_tool(..., raw_schema={name, description, parameters})` from **existing certified JSON schema source**. Do not rewrite eleven tools from memory.

`on_duplicate`, `duplicate_scope`, `flags` per phase 13.

---

## PHASE 12 — Dynamic tool gating

Initial tool set from backend for tenant/strategy (Microsoft vs SEND_LINK vs callback vs transfer). Runtime `update_tools` only for legitimate capability changes — **not** for booking→callback intent (Astra picks tool).

---

## PHASE 13 — Tool classification policies

| Class | Tools | Policy |
|--------|--------|--------|
| A Shared fact | `update_intake` | Normal; `on_duplicate="reject"`, `duplicate_scope="name_and_args"`; different args ≠ duplicate |
| B Preference | `set_scheduling_preference` | Same duplicate policy; backend generation authoritative |
| C Read | `find_availability`, `find_appointment` | Cancellable where HTTP can cancel; duplicate scope **name_and_args**; backend stale OfferSet/generation still authoritative |
| D Write | book/reschedule/cancel/callback/send_link | Not blindly cancellable; `disallow_interruptions()` before commit boundary; backend idempotency final |
| E Telephony | `transfer_call`, `end_call` | LiveKit SIP transfer / room lifecycle — not plain HTTP |

---

## PHASE 14 — Async tools (`ctx.update`) sparingly

Delegation already allows conversation during backend work. Use `ctx.update` only for meaningful progress — no spam. Understand non-blocking semantics.

---

## PHASE 15 — `max_tool_steps`

Explicit bound (initial **5**). Not a substitute for operation logic.

---

## PHASE 16 — Astra remains intent decider

No keyword/regex routers, no CallerMeaning classifier, no extra LLM before Astra, no BookingAgent/CallbackAgent split.

---

## PHASE 17 — Conversation freshness

Do **not** blindly port custom `conversationRevision` coordinator to LiveKit. Keep business invariants: scheduling generations, stale OfferSet, idempotency, reconciliation, OUTCOME_UNKNOWN. Test LiveKit natural behavior first; isolate gaps.

---

## PHASE 18 — GPT-Live context

Append-only history. Use instructions/thinking/commentary channels only for legitimate runtime context — not to recreate manual delegation. Tool results via LiveKit tool mechanism.

---

## PHASE 19 — Authoritative ANI

LiveKit path: `sip.phoneNumber` → same semantic as `telephony.inboundCallerE164`. Model args ≠ ANI.

---

## PHASE 20 — Dialed DID / tenant

`sip.trunkPhoneNumber` + existing number ownership resolution. Backend validates DID/workspace/agent.

---

## PHASE 21 — `transfer_call` via LiveKit SIP

```python
await ctx.api.sip.transfer_sip_participant(
    api.TransferSIPParticipantRequest(
        room_name=ctx.room.name,
        participant_identity=sip_participant.identity,
        transfer_to=f"tel:{authorized_e164}",
        play_dialtone=False,
    )
)
```

Destination from Transovo config only. No Telnyx Call Control on LiveKit-owned call unless documented exception.

---

## PHASE 22 — `end_call`

Validate → final language if required → terminate SIP participant/session via existing LiveKit-safe mechanism → flush telemetry. Do not claim hangup without actual termination.

---

## PHASE 23 — Room options

Audio in/out, SIP linked participant, `close_on_disconnect`, no STT+TTS cascade with GPT-Live. Use `room_io.RoomOptions` per installed 1.8 API.

---

## PHASE 24 — No unnecessary prewarm

V3 GPT-Live path does not load legacy STT/TTS/VAD for cascade. Do not break other worker profiles.

---

## PHASE 25 — Wizard remains authoritative

No LiveKit wizard, no second settings table, no Python-owned config. Resolve existing V3 wizard compile output.

---

## PHASE 26–28 — Frozen executors

**Microsoft, callback, SEND_LINK:** unchanged at Transovo boundary. LiveKit calls in; Python does not implement provider/DB/SMS persistence. Run existing regression matrices.

---

## PHASE 29 — Tool result contract

Serialize structured JSON faithfully (`SUCCESS`, `NEEDS_INFORMATION`, `STALE`, `OUTCOME_UNKNOWN`, etc.) — not vague prose.

---

## PHASE 30 — HTTP timeouts

Per tool class; long enough for reconciliation; no blind retry of consequential writes from Python.

---

## PHASE 31–35 — Observability

LiveKit events: `user_input_transcribed`, `conversation_item_added`, `function_tools_executed`, `agent_state_changed`, `user_state_changed`, `session_usage_updated`, `close`, errors.  
Final caller transcripts with call id, timestamp, room, participant, final flag.  
Latency timeline (SIP join → session → first audio → tool → provider).  
`session_usage_updated` for cost.  
Shutdown: READ cancel vs WRITE reconcile per backend state.

---

## PHASE 36–39 — Architecture constraints

Single AgentSession (no subagents). Preserve business knowledge compiler. One greeting owner; test silence after greeting. Recording parity — no accidental dual Telnyx+LiveKit record.

---

## PHASE 40 — Initial tool order

Adapter once, then expose: `update_intake`, `set_scheduling_preference`, `find_availability`, `request_callback` — then certify concurrency before full catalog.

---

## PHASE 41 — Mandatory pre-cutover automated tests

Straight callback; straight availability; **booking → callback during FIND**; callback → booking; Monday → Tuesday during FIND; rapid corrections. No keyword router.

---

## PHASE 42 — Failure classification

First failing boundary only: A SIP → L spoken behavior (see directive full list). No compensating routers.

---

## PHASE 43–48 — Remaining tools, transfer cert, Microsoft/callback/SEND_LINK regression, torture matrix

Expose remaining tools through same adapter after initial set passes. LiveKit duplicate/cancel **supplements** Transovo idempotency/reconciliation — never replaces.

---

## PHASE 49–51 — Idempotency, reconciliation, activeGoal

Keep both framework and business layers. Do not use `activeGoal` as Python speech router.

---

## PHASE 52 — Deployment

Update **existing** `transovo-voice` worker; verify registration, dispatch profile, non-V3 routing, `+15717491060` SIP prerequisites. **STOP — do not route real DID yet.**

---

## PHASE 53 — Required pre-PSTN report

Before Telnyx cutover, report: Git SHAs, dependency versions, LiveKit reuse (no secrets), GPT-Live config, Transovo reuse list, **bypassed** (not deleted) old components, per-test results, exact routing change for `+15717491060`. **STOP for approval.**

---

## PHASE 54 — Real PSTN certification (after approval)

Route `+15717491060` to LiveKit. Calls A–J (callback, booking↔callback, Monday/Tuesday, Microsoft book/find/reschedule/cancel, SEND_LINK, transfer, greeting/silence). Full timeline each.

---

## PHASE 55 — Success criteria

`VOICE_V3_LIVEKIT_PSTN_CERTIFIED = PASS` only when all criteria in directive met (no manual coordinator on LiveKit path, no duplicate project/wizard/Microsoft implementation, operation switching, observability, latency).

---

## PHASE 56 — Cleanup (separate change after cert)

Deprecate direct OpenAI SIP ingress, sideband, coordinator, obsolete freshness **protocol** only after proof. Keep business invariants. Git preserves pre-LiveKit runtime.

---

## Final architectural invariant

```
TELNYX          → PSTN/carrier truth
LIVEKIT         → SIP/media/session/framework lifecycle
GPT-LIVE / AMY  → Caller-facing full-duplex conversation
RESPONSES/ASTRA → Semantic reasoning + tool selection
TRANSOVO        → Authorization + business state + tool execution
MICROSOFT/TELNYX/DB/SMS → External truth
```

Migration succeeds when Transovo is **no longer its own realtime voice framework** and **all** existing business behavior remains intact.

---

*End of directive.*
