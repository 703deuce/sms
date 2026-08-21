# LiveKit Python Rebuild — Section 57 Audit

> Generated: 2026-08-21. This document satisfies the mandatory pre-implementation audit.

## A. Legacy runtime audit

### Active runtime files (before cleanup)

| Path | Role | Action |
|------|------|--------|
| `voice-runtime-python/` | **Production inbound** LiveKit worker (Coolify `transovo-voice`) | **KEEP & REBUILD** from official examples |
| `voice-runtime/` (TypeScript) | Duplicate inbound + outbound worker | **Remove from inbound dispatch**; outbound-only agent name |
| `src/lib/voice/inprocess-voice-runtime.ts` | Spawns TS or Python child from Next.js | **Python only**; no TS spawn |
| `src/lib/voice/workflow-engine/` | Telnyx Caller Amy `runtime_turn` | **Not on LiveKit path** — retire |
| `src/lib/voice/workflow-runtime/` | Home-service dispatcher compiler | **Not on LiveKit inbound path** |
| `voice-runtime/src/amy-receptionist-agent.ts` | Legacy Amy + workflow compile | **Delete from active path** |
| `voice-runtime/src/inbound-session-pipeline.ts` | TS inbound composition | **Disable** — Python only for inbound |
| `voice-runtime-python/transovo_voice/agent/amy.py` | Phased Amy orchestration | **Replace** with template `transovo_receptionist_v1` |

### Active workers (before cleanup)

| Service | Command | Answers inbound? |
|---------|---------|------------------|
| `transovo-voice` (Coolify) | `python -m transovo_voice.main start` | **YES** — sole inbound worker |
| `transovo-web` | Next.js + job worker | No voice |
| `voice-runtime` TS (dev/in-process) | `tsx voice-runtime/src/main.ts start` | **REMOVED** from inbound |
| `npm run worker:all` | Telnyx webhook jobs | Telnyx-assistant path only |

### Dispatch path (target — single path)

```
PSTN → Telnyx FQDN → LiveKit shared inbound trunk
  → dispatch rule `transovo-inbound-dispatch`
  → room prefix `transovo-call-*`
  → agent `transovo-voice-runtime` (Python ONLY)
  → bootstrap `/api/internal/voice-runtime`
  → template router → AgentSession (gpt-realtime-2)
```

### Dual-runtime flags removed

- `VOICE_RUNTIME_IMPL=typescript` — **no longer used for inbound**
- In-process TS worker spawn — **disabled**
- TS worker registers **`transovo-outbound-runtime`** (outbound only; secondary per spec §53)

---

## B. Existing UI / configuration to preserve

### Pages (unchanged)

- `/voice/receptionist`, `/voice/agents/*` (about, capabilities, voice-test, integrations, advanced)
- `/voice/calls`, `/voice/knowledge`, `/voice/numbers`, `/voice/inbound-routing`
- `/voice/analytics`, `/voice/settings`, `/voice/testing`

### Database models (unchanged)

- `VoiceAgent`, `VoiceAgentVersion`, `VoiceAgentPhoneNumber`, `PhoneNumber`
- `VoiceKnowledgeBase`, `VoiceKnowledgeSource`, `VoiceAgentKnowledgeBase`
- `VoiceCall`, `VoiceTransferDestination`, `VoiceRoutingRule`

### Config → prompt pipeline (unchanged)

```
ReceptionistWizardState + AdvancedSettings
  → compileReceptionistConfig()
  → ReceptionistCompiledSnapshot
  → buildReceptionistCompiledPrompt()
  → VoiceAgentVersion.config.advanced.receptionistCompiled
  → bootstrap_inbound → Python agent instructions
```

---

## C. Official LiveKit Python example inventory

Source: https://github.com/livekit/agents/tree/main/examples (main branch, 2026)

| Official example | Voice/phone relevant? | Notes |
|------------------|----------------------|-------|
| `voice_agents/basic_agent.py` | **YES** | Basic AgentSession + tools + interruption |
| `voice_agents/llamaindex-rag/` | **YES** | RAG knowledge pattern |
| `voice_agents/mcp/` | Partial | MCP tools — not P0 for receptionist |
| `voice_agents/grok/` | Partial | Provider-specific realtime |
| `voice_agents/otel_trace.py` | Partial | Observability only |
| `frontdesk/` | **YES** | Booking + calendar tools (primary booking reference) |
| `warm-transfer/warm_transfer.py` | **YES** | SIP warm transfer |
| `telephony/basic_dtmf_agent.py` | Partial | DTMF — optional later |
| `telephony/amd.py` | Partial | Answering-machine detection |
| `telephony/bank-ivr/` | **NO** | IVR tree, not conversational receptionist |
| `hotel_receptionist/` | **YES** | Receptionist-style agent |
| `survey/` | Partial | Structured intake |
| `data_capture_sim/` | **YES** | Structured data collection |
| `browser_agent.py` | Partial | Browser test surface |
| `drive_thru/` | **NO** | Ordering domain |
| `expressive_agent/` | **NO** | Expressive TTS demo |
| `healthcare/` | Partial | Domain-specific |
| `homepage/` | Partial | Markdown knowledge + tools |
| `primitives/` | Partial | Low-level SDK demos |
| `inference/` | Partial | Model inference demos |
| `other/` | Varies | Text-only, TTS utilities |
| `avatar/` | **NO** | Video avatar |

---

## D. Proposed Transovo template inventory

| Official example | Transovo template ID | Purpose | Status |
|------------------|---------------------|---------|--------|
| `voice_agents/basic_agent.py` | `livekit_basic_voice` | Layer 1 — realtime conversation + interrupt | **IMPLEMENTED** |
| `frontdesk/agent.py` | `livekit_frontdesk_booking` | Official booking/calendar pattern | **IMPLEMENTED** (FakeCalendar first) |
| `warm-transfer/warm_transfer.py` | `livekit_warm_transfer` | Official SIP warm transfer | **IMPLEMENTED** |
| `hotel_receptionist/` | `livekit_hotel_receptionist` | Receptionist reference | FOUND |
| `data_capture_sim/` | `livekit_structured_intake` | Dynamic field collection | FOUND |
| `voice_agents/llamaindex-rag/` | `livekit_knowledge_rag` | RAG knowledge | FOUND |
| `survey/` | `livekit_survey_intake` | Survey-style intake | FOUND |
| `telephony/basic_dtmf_agent.py` | `livekit_dtmf` | DTMF input | FOUND (optional) |
| *(composed)* | `transovo_receptionist_v1` | Production customer receptionist | **IMPLEMENTED** |
| `drive_thru/` | — | NOT APPLICABLE | N/A |
| `expressive_agent/` | — | NOT APPLICABLE | N/A |
| `avatar/` | — | NOT APPLICABLE | N/A |
| `telephony/bank-ivr/` | — | NOT APPLICABLE (IVR not AI receptionist) | N/A |

SDK: `livekit-agents[openai]>=1.2,<2` · Realtime: **gpt-realtime-2** (OpenAI plugin)

---

## E. Clean new runtime architecture

```
voice-runtime-python/transovo_voice/
  main.py                    # AgentServer entry (single worker)
  session/
    inbound.py               # SIP wait → bootstrap → template router
    realtime_config.py       # gpt-realtime-2 (unchanged)
    telephony_audio.py       # Room audio options
  templates/
    registry.py              # Template metadata + lookup
    session_factory.py       # AgentSession + RealtimeModel
    basic_voice.py           # livekit_basic_voice
    frontdesk_booking.py     # livekit_frontdesk_booking
    warm_transfer.py         # livekit_warm_transfer (lab)
    transovo_receptionist.py # transovo_receptionist_v1 (production)
  integrations/
    backend_client.py        # HTTP → /api/internal/voice-runtime
  userdata.py                # SessionUserData (config carrier)
```

**Principles:** one worker, one dispatch agent name, templates stay close to official examples, customer config changes **data** not architecture.

---

## F. Migration plan — guarantee only Python answers inbound

1. **Dispatch rule** unchanged: `transovo-voice-runtime` on shared inbound rule.
2. **Rename TS worker** agent to `transovo-outbound-runtime`; outbound dispatch uses that name only.
3. **Remove** in-process TS worker spawn; Coolify runs **one** voice container.
4. **Remove** TS inbound pipeline from active path (`inbound-session-pipeline` not registered for inbound agent name).
5. **Bootstrap** always returns `agentTemplate: transovo_receptionist_v1` for customer agents.
6. **Log** on every call: `runtime=livekit_python`, `agent_template`, `agent_template_version`, `receptionist_id`.
7. **Verify** with trace: DID → trunk → dispatch → Python job → single AgentSession.
8. **Layer testing** (§40): basic → business info → knowledge → message → fields → transfer → booking → calendar adapter.
