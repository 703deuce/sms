# Voice V3 → LiveKit: why this boundary

**Authoritative implementation:** `docs/VOICE-V3-LIVEKIT-IMPLEMENTATION-DIRECTIVE.md` (Phases 0–56).  
**Rollback record:** `docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md`.  
**Current diagnostic gate (no behavior changes until boundary proven):** `docs/VOICE-V3-GPT-LIVE-DELEGATION-OBSERVABILITY.md` · PR #448.

---

## What we are not debating

Transovo already proved the **product** layer: booking, cancel, reschedule, callback, delegation, Microsoft writes, SEND_LINK, idempotency, and conversation-freshness **business** invariants. The pain is not “can we build a voice agent?” It is maintaining an ever-growing **realtime-agent framework** on top of that product.

Evidence that **LiveKit as infrastructure** is viable (Retell-style platforms, LiveKit Cloud SIP, production AgentServer workers) supports using LiveKit for the framework layer—not for replacing Transovo business logic.

---

## Target layering (product boundary)

```
                    TRANSOVO
Wizard / Configuration
          │
          ▼
    GPT-Live Amy          ← caller-facing duplex conversation
          │
          ▼
      GPT-6 Astra         ← Responses delegation: reasoning + tool selection
          │
          ▼
Transovo Business Tools   ← authorization, state, executors
          │
   ┌──────┼────────┐
   ▼      ▼        ▼
Microsoft SMS     DB
          ▲
          │
═══════════════════════════
     product boundary
═══════════════════════════
          │
       LiveKit            ← SIP/media/session, tool lifecycle, delegation plumbing
          │
        Telnyx
```

**If LiveKit disappeared tomorrow**, we still own: booking validity, stale appointments, correct Microsoft event, callback sufficiency, SMS consent, provider commit truth. We give LiveKit what a mature framework should own: audio, SIP participant lifecycle, sessions, interruptions, tool execution lifecycle, async/concurrency mechanics, GPT-Live integration, delegation plumbing, worker lifecycle, tracing.

---

## What the callback / concurrency work exposed

Fixing callback selection revealed a deeper class of problems: valid **old** delegation could still win while the **conversation** had moved on. Solving that “properly” in-house leads to conversation revisions, operation lifecycle, cancellable vs protected writes, stale reads, duplicate-call policy, session termination, tool-loop bounds, backpressure, recovery, tracing—i.e. **building LiveKit**, not an AI receptionist.

The migration **replaces that accidental framework** with a production-proven one. Engineering response to upstream issues becomes: reproduce → identify LiveKit boundary → upstream fix or narrow workaround → remove workaround—not design and maintain eleven-tool realtime semantics forever.

---

## Locked LiveKit GPT-Live shape (do not improvise)

- `GPTLiveModel(model="gpt-live-1", voice=wizard, delegation="responses", responses_options={...})`
- **Amy** → `Agent(instructions=...)`
- **Astra** → `responses_options` (model, instructions, `tool_choice`, `parallel_tool_calls`, reasoning/text as in production)
- **Tools** on `AgentSession`; LiveKit flattens them into `ResponsesConfig.tools` via `_build_delegation()`—not a second orchestration layer in Transovo
- **No** manual `response.item.create` / bare `response.create` for normal tool loops on the LiveKit path
- **No** transcript → forced Astra bridge; **no** keyword router; Amy describes **when** to delegate, not tool names

Python worker dependency line: `livekit-agents[openai]~=1.8` (verify installed version at deploy).

---

## Where we are now (honest)

| Area | Status |
|------|--------|
| Phases 1–2, 5–7, 10–11, 19–23, 25–30 (conceptually) | Implemented on LiveKit path (`voice-runtime-python/transovo_voice/voice_v3/`, web bridge) |
| Direct OpenAI coordinator | Bypassed, not deleted (rollback via Git + Telnyx) |
| First LiveKit PSTN traces | Proven: Amy/audio/transcripts; **not** proven: delegation vs Astra tool selection (insufficient wire observability) |
| Next step | **Observability-only** deploy → one diagnostic PSTN call → classify first failed boundary A–F → **STOP** before prompt/orchestration fixes |

Unproven failure mode example: “Amy never delegated” vs “delegated but Astra chose zero tools” vs “tools missing from delegated payload” require `session.delegation.created` and nested `response.event` logs—not `CALLER_TURN_COMMITTED` or `toolCount: 17` alone.

---

## Official references (implementation)

LiveKit GPT-Live plugin guide, Python `GPTLiveModel` reference, async tools & concurrency, tool-loop design, SIP API, SIP participant attributes, call forwarding/transfer guide—always cross-check **installed** 1.8.x source when docs and code differ.
