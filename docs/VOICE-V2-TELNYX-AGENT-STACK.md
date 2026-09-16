# Telnyx stack — 571 / wizard Voice Agent (live + code defaults)

**Live snapshot date:** 2026-09-16 UTC  
**Source:** Telnyx Assistants API (`GET /ai/assistants/{id}`) via `scripts/fetch-telnyx-assistant-snapshot.mjs`  
**Assistant on the 571 line:** `assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6`  
**Wizard agent id:** `cmshz2lc25c622c4i58303501`  
**Display name (Telnyx):** `After-Hours Voice Agent UI CERT TEST 2304 (ws_1)`

Refresh live values:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/fetch-telnyx-assistant-snapshot.mjs assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6
```

---

## End-to-end hookup (caller → Amy → tools)

```
PSTN caller
  → Business DID (571 test line, ws_1)
  → Inbound handling: VOICE_AGENT (not MCTB TeXML press-1 pipeline)
  → TeXML Application: 3049047658506225103 (assistant default_texml_app_id)
  → Telnyx starts AI Assistant on the call leg (Call Control + Assistant runtime)
  → STT: Deepgram (see below) → text
  → LLM: OpenAI GPT-5.4 mini (via Telnyx + openai_key ref) → tool calls / reply
  → TTS: Telnyx NaturalHD voice “astra” → audio to caller
  → Tools: HTTPS webhooks to Transovo `/api/telnyx/voice-v2/*` and `/api/telnyx/voice/tools`
  → Transovo: Voice V2 CallContext, Microsoft Graph booking, intake, etc.
```

**Not in this path:** LiveKit worker, legacy `/api/telnyx/voice/tools` “Caller Amy” workflow-only booking (replaced on PSTN by Voice V2 webhooks when One-Amy + live booking is published).

**Warm transfer / after-hours tools:** Implemented in app code (`voice_v2_transfer_call`, etc.) but **not** on the live assistant tool list at snapshot time (10 tools — see below). Publish/agent sync adds them when wizard enables those capabilities.

---

## What is live on Telnyx right now

### LLM (reasoning / dialogue)

| Field | Live value |
|--------|------------|
| **Model** | `openai/gpt-5.4-mini` |
| **Provider** | Telnyx-hosted model route |
| **API key** | `llm_api_key_ref: "openai_key"` (Telnyx Mission Control integration secret — your OpenAI key stored in Telnyx, not in the assistant JSON) |
| **external_llm** | `null` (not a custom base URL) |

**Code defaults (if not overridden on publish):**

- `assistant-sync.ts` fallback when `config.model.modelId` is empty: **`moonshotai/Kimi-K2.6`** (Telnyx-native, no key ref).
- Generic `VoiceAgentConfig` template in `voice/types.ts`: **`anthropic/claude-haiku-4-5`**.
- **Your published wizard agent overrides** to **GPT-5.4 mini + OpenAI key ref** — that is what the 571 assistant is actually running.

### Speech-to-text (STT)

| Field | Live value |
|--------|------------|
| **Model** | **`deepgram/flux`** |
| **Language** | `en` |
| **Flux / endpointing** | `eot_threshold: 0.8`, `eager_eot_threshold: 0.4`, `eot_timeout_ms: 5000` |
| **Keyterms** | `Harbor Drain Pros`, `Amy`, `Dispatch — Marina`, `Service Visit` |

**Wizard compile default** (`build-agent-config.ts`): `deepgram/nova-3` — publish/latency profile can upgrade to **Flux** on the assistant (as live).

STT is **Deepgram via Telnyx** (not a separate Deepgram API key in the assistant; `transcription.api_key_ref` is null).

`enabled_features` on the assistant lists **`telephony`** only; transcription is still configured on the **`transcription`** object (Telnyx attaches STT when the model is not “native audio”).

### Text-to-speech (TTS) / voice

| Field | Live value |
|--------|------------|
| **Engine** | **Telnyx NaturalHD** (not ElevenLabs, not Ultra on this assistant) |
| **Provider voice string** | **`Telnyx.NaturalHD.astra`** |
| **Wizard catalog id** | `ava-warm-us` → display name **Astra** |
| **Speed** | `voice_speed: 1.08` |
| **Expressive mode** | `false` |
| **Background** | predefined `silence` |

ElevenLabs is supported in code (`buildAssistantVoiceSettings`) but **not** selected on this assistant.

### Telephony / audio processing

| Setting | Live value |
|---------|------------|
| **TeXML app** | `3049047658506225103` |
| **Noise suppression** | **Krisp** (`noise_suppression: "krisp"`) |
| **Recording** | **On**, dual-channel MP3 |
| **Call time limit** | 1800 s |
| **User idle prompt** | 10 s (`user_idle_reply_secs`) |
| **Web test calls** | `supports_unauthenticated_web_calls: true` |

### Interruption / “response speed” behavior

| Setting | Live value |
|---------|------------|
| **Barge-in** | `interruption_settings.enable: true` |
| **Greeting interruption** | **Disabled** (`disable_greeting_interruption: true`) |
| **Start speaking** | `wait_seconds: 0.1` after endpointing |

Wizard maps **interruption sensitivity** and **endpointing** into these fields on publish (`build-agent-config.ts` + `latency-profiles.ts`). Live assistant uses a **Flux-oriented** profile (`eager_eot_threshold` present).

### Greeting (live)

> Thank you for calling Harbor Drain Pros. This is Amy, the after-hours assistant. How can I help you?

**Instructions size:** ~34,562 characters (wizard + business knowledge + Voice V2 workflow prompts).

---

## Tools published on this assistant (live)

| # | Telnyx tool name | Type | Transovo endpoint |
|---|------------------|------|-------------------|
| 1 | `transovo-hangup` | hangup | (native) |
| 2 | `transovo-voice-v2-find-existing-appointment` | webhook | `/api/telnyx/voice-v2/find-existing-appointment` |
| 3 | `transovo-voice-v2-find-availability` | webhook | `/api/telnyx/voice-v2/find-availability` |
| 4 | `transovo-voice-v2-cancel-appointment` | webhook | `/api/telnyx/voice-v2/cancel-appointment` |
| 5 | `transovo-voice-v2-reschedule-appointment` | webhook | `/api/telnyx/voice-v2/reschedule-appointment` |
| 6 | `transovo-voice-v2-save-intake-fields` | webhook | `/api/telnyx/voice-v2/save-intake-fields` |
| 7 | `transovo-voice-v2-book-offered-slot` | webhook | `/api/telnyx/voice-v2/book-offered-slot` |
| 8 | `transovo-search-business-details` | webhook | `/api/telnyx/voice/tools` |
| 9 | `transovo-voice-v2-finalize-caller-request` | webhook | `/api/telnyx/voice-v2/finalize-caller-request` |
| 10 | `transovo-send-resource` | webhook | `/api/telnyx/voice/tools` |

**Not on assistant at this snapshot (may appear after next publish):**

- `transovo-voice-v2-send-booking-link`
- `transovo-voice-v2-search-knowledge`
- `transovo-voice-v2-transfer-call`
- `transovo-voice-v2-create-callback-request`
- Native **transfer** tool (legacy Amy transfer) — Voice V2 transfer uses webhook when enabled.

Webhooks send headers: `X-Transovo-Workspace-Id`, `X-Transovo-Agent-Id`, `X-Transovo-Tool-Type` (see `ensure-voice-v2-shared-tools.ts`).

Orchestration: **Telnyx Conversation Workflow** (synced in `workflow-sync.ts` / `conversation-workflow.ts`) — model chooses tools; Transovo enforces booking/intake/after-hours rules in tool handlers.

---

## Where each layer is defined in the repo

| Layer | Primary code |
|--------|----------------|
| Publish assistant | `src/lib/voice/telnyx/assistant-sync.ts` |
| Wizard → agent config | `src/lib/solutions/appointment-receptionist/build-agent-config.ts` |
| Voice catalog (Astra, Ultra, ElevenLabs) | `src/lib/voice/telnyx/voices.ts` |
| LLM model + key refs | `src/lib/voice/telnyx/official-baseline.ts` (`assistantModelFields`) |
| STT Flux settings | `src/lib/voice/latency-profiles.ts` |
| V2 shared tools | `src/lib/voice/telnyx/ensure-voice-v2-shared-tools.ts` |
| 571 routing | `PATCH /api/mctb/inbound-handling` → `VOICE_AGENT` + `voiceAgentId` |

---

## Quick reference card

| Question | Answer (571 assistant, live) |
|----------|-------------------------------|
| **LLM** | `openai/gpt-5.4-mini` via Telnyx (`openai_key`) |
| **STT** | `deepgram/flux` (English + keyterms; target EOT **0.7 / 0.4 / 3000**) |
| **TTS** | **ElevenLabs** (wizard catalog) — was NaturalHD Astra before this pass |
| **Ingress** | TeXML app **3049047658506225103** → this assistant |
| **Booking** | Voice V2 **find-availability** + **book-offered-slot** → Microsoft Graph |
| **Noise** | Krisp on telephony leg |

---

## Related reports

- Last PSTN call metrics: `docs/VOICE-V2-LAST-PSTN-CALL-REPORT.md`
- Pre-manual regression: `docs/VOICE-V2-PRE-MANUAL-REGRESSION.md`
