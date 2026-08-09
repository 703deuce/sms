# Coolify env for LiveKit voice (+18663464256)

## LiveKit Cloud project: **Sms** (Settings → General)

| Field | Value |
|-------|--------|
| Project name | `Sms` |
| Project URL | `wss://sms-6w01zoya.livekit.cloud` |
| **SIP URI** | `sms-6w01zoya.sip.livekit.cloud` |

Telnyx must send PSTN to your LiveKit **SIP URI** (may differ from project URL, e.g. `2tzwfcliuex.sip.livekit.cloud`).

## Required in Coolify (main app)

| Variable | What to put |
|----------|-------------|
| `VOICE_RUNTIME_PROVIDER` | `livekit` |
| `LIVEKIT_URL` | `wss://sms-6w01zoya.livekit.cloud` (project URL — for API) |
| `LIVEKIT_SIP_URI` | Your **SIP URI** from LiveKit Settings (may differ from project URL, e.g. `2tzwfcliuex.sip.livekit.cloud`) |
| `LIVEKIT_API_KEY` | API key from **Sms** project (Settings → API keys) |
| `LIVEKIT_API_SECRET` | API secret from **Sms** project |
| `OPENAI_API_KEY` | OpenAI key (Amy LLM) |
| `TELNYX_API_KEY` | Telnyx (number routing) |
| `DATABASE_URL` | Postgres |

`LIVEKIT_URL`, `LIVEKIT_SIP_URI`, and API keys must all be from the **same** LiveKit project (your **Sms** project).

## Voice pipeline (LiveKit Inference)

| Variable | Default |
|----------|---------|
| `VOICE_STT_PROVIDER` | `inference` |
| `VOICE_STT_MODEL` | `deepgram/nova-3` |
| `VOICE_TTS_PROVIDER` | `elevenlabs` |
| `VOICE_TTS_MODEL` | `elevenlabs/eleven_flash_v2_5` |
| `VOICE_TTS_PRESET` | `elevenlabs` (default when unset) |
| `VOICE_LLM_PROVIDER` | `openai` |
| `VOICE_LLM_MODEL` | `gpt-5-nano` (`gpt-5-mini` for higher quality) |
| `VOICE_LLM_PRESET` | Optional shortcut — see LLM A/B below |

## Latency and audio (LiveKit)

### Bring your own keys (no LiveKit Inference credits)

Use your own OpenAI, Deepgram, and ElevenLabs accounts — no LiveKit Inference billing required:

```bash
# LLM — OpenAI direct
VOICE_LLM_PRESET=gpt-5-nano
OPENAI_API_KEY=sk-...

# STT — Deepgram direct (keep flux_eager for Flux turn-taking)
VOICE_STT_PROVIDER=deepgram-plugin
VOICE_STT_MODEL=deepgram/flux-general-en
DEEPGRAM_API_KEY=...

# TTS — ElevenLabs direct
VOICE_TTS_PROVIDER=elevenlabs-plugin
VOICE_TTS_MODEL=eleven_flash_v2_5
VOICE_TTS_VOICE=cgSgspJ2msm6clMCkdW9
ELEVENLABS_API_KEY=...

# Turn handling (required with BYO Deepgram Flux — avoids inference TurnDetector)
VOICE_TURN_PRESET=flux_eager
VOICE_PREEMPTIVE_TTS=true
```

Unset inference-only LLM presets (`VOICE_LLM_PRESET=gemma-4-31b`, etc.).

After deploy, `pipeline_config` in call logs should show:
```json
"stt": { "via": "deepgram_plugin_flux" }
"llm": { "via": "openai_plugin" }
"tts": { "via": "elevenlabs_plugin" }
```

### Endpointing (tune fast → natural)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VOICE_TURN_PRESET` | `ultra_low` | `ultra_low` (100/400ms dynamic), `test_a` (150/800), `test_b` (200/1000), `test_c` (250/1200), `receptionist_legacy` (300/2500 fixed) |
| `VOICE_ENDPOINTING_MIN_MS` | preset default | Override min endpointing delay (ms) |
| `VOICE_ENDPOINTING_MAX_MS` | preset default | Override max endpointing delay (ms) |
| `VOICE_ENDPOINTING_MODE` | preset default | `dynamic` (adaptive) or `fixed` |
| `VOICE_PREEMPTIVE_TTS` | `true` | Speculative TTS before turn confirmed |
| `VOICE_AGENT_OUTPUT_GAIN_DB` | `-4` | Agent playback gain |

If Amy clips mid-sentence pauses, raise preset to `test_a` or `test_b`.

### Deepgram Flux EOT (Telnyx-class turn-taking)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VOICE_TURN_PRESET` | `ultra_low` | Set to `flux_eager` for Flux STT+EOT (no LiveKit TurnDetector) |
| `VOICE_STT_MODEL` | `deepgram/flux-general-en` | Only when `flux_eager` (else `deepgram/nova-3`) |
| `VOICE_FLUX_EAGER_EOT_THRESHOLD` | `0.3` | Eager EOT — starts preemptive LLM early |
| `VOICE_FLUX_EOT_THRESHOLD` | `0.7` | Confirmed end-of-turn |
| `VOICE_FLUX_EOT_TIMEOUT_MS` | `5000` | Flux EOT timeout ceiling |

**A/B Flux vs TurnDetector:**
```
# A — current (Nova-3 + TurnDetector)
VOICE_TURN_PRESET=ultra_low

# B — Flux eager EOT (closer to Telnyx Flux profile)
VOICE_TURN_PRESET=flux_eager
```

### Recommended low-latency stack (defaults in code)

```
VOICE_LLM_PRESET=gemma-4-31b
VOICE_TTS_PRESET=elevenlabs
VOICE_TURN_PRESET=flux_eager
VOICE_PREEMPTIVE_TTS=true
```

Use `gpt-5-mini` instead of nano if tool-call accuracy drops.

### LLM A/B (Gemma 4 31B vs GPT-4.1 mini)

Keep Flux EOT + preemptive on; only change the LLM between test calls.

**Test A — Gemma 4 31B (LiveKit Inference, latency-optimized):**
```
VOICE_LLM_PRESET=gemma-4-31b
```

**Test B — GPT-4.1 mini (LiveKit Inference):**
```
VOICE_LLM_PRESET=gpt-4.1-mini
```

Equivalent explicit vars (if you prefer not to use presets):
```
# Gemma
VOICE_LLM_PROVIDER=inference
VOICE_LLM_MODEL=google/gemma-4-31b-it

# GPT-4.1 mini
VOICE_LLM_PROVIDER=inference
VOICE_LLM_MODEL=openai/gpt-4.1-mini
```

Verify in call logs — `pipeline_config` should show:
```json
"llm": { "preset": "gemma-4-31b", "model": "google/gemma-4-31b-it", "via": "livekit_inference" }
```
or
```json
"llm": { "preset": "gpt-4.1-mini", "model": "openai/gpt-4.1-mini", "via": "livekit_inference" }
```

Compare `llmTtftMs` in `turn_latency_breakdown` lines across the two calls.

### Booking test (LiveKit + Gemma + Flux)

Keep the latency stack above, then place a test call and walk through booking:

1. Amy collects required fields (`record_field`)
2. Amy calls `check_availability` (Calendly must be connected on the workspace)
3. Caller picks a slot → `select_slot`
4. Caller confirms → `confirm_booking`

Verify in logs:

- `amy_agent_sync` events as workflow advances (tools swap per phase)
- `tool_executed` with `check_availability`, `select_slot`, `confirm_booking`
- `workflow_state` reaches `COMPLETE`

Required workspace setup: published appointment-booking agent, Calendly OAuth connected, email in field manifest when Calendly is active.

| Variable | Example | Purpose |
|----------|---------|---------|
| `VOICE_TTS_PRESET` | `cartesia` | `baseline`, `cartesia`, `rime`, `inworld2`, `elevenlabs` |
| `VOICE_TTS_PROVIDER` | `cartesia` | Override provider (optional if preset set) |
| `VOICE_TTS_MODEL` | `cartesia/sonic-3.5` | Override model |
| `VOICE_TTS_VOICE` | `9626c31c-...` | Voice ID / speaker name |

**ElevenLabs Flash (default):**
```
VOICE_TTS_PRESET=elevenlabs
VOICE_TURN_PRESET=ultra_low
```

### TTS A/B comparison (LiveKit Inference only)

## LiveKit agent worker (required for Amy to answer calls)

The main Coolify app provisions trunks and publishes Amy. A **worker** must also run to join LiveKit rooms and speak.

### Default: in-process (no second Coolify service)

When `VOICE_RUNTIME_PROVIDER=livekit`, the main Next.js app **automatically spawns** `transovo-voice-runtime` on boot (same pattern as the in-process job worker). You only need to **redeploy the existing Coolify app** — no second service, no manual start command.

Requirements (same env as above):

| Variable | Required |
|----------|----------|
| `LIVEKIT_URL` | yes |
| `LIVEKIT_API_KEY` | yes |
| `LIVEKIT_API_SECRET` | yes |
| `DATABASE_URL` | yes |
| `OPENAI_API_KEY` | yes |

Optional: `LIVEKIT_AGENT_NAME=transovo-voice-runtime` (default), `ELEVENLABS_KEY`, voice pipeline vars.

After deploy, logs should show:

```
[voice-runtime] spawning transovo-voice-runtime via tsx (wss://...)
```

Disable in-process auto-start (if you run the worker elsewhere):

```
DISABLE_INPROCESS_VOICE_RUNTIME=1
```

### Alternative: second Coolify service

Only if you want voice isolated from the web container:

| Coolify field | Value |
|---------------|-------|
| Repository | `703deuce/sms` |
| Branch | `master` |
| Build command | `npm ci && npx prisma generate` |
| **Start command** | `npm run voice-runtime:start` |
| Port | none (worker, not HTTP) |

Set `DISABLE_INPROCESS_VOICE_RUNTIME=1` on the **main** app to avoid two workers registering.

### Alternative: LiveKit Cloud Agents (`lk agent deploy`)

```bash
lk cloud auth          # pick Sms project
lk agent create        # first time, from repo root
lk agent update-secrets --secrets "DATABASE_URL=..."
lk agent update-secrets --secrets "OPENAI_API_KEY=..."
lk agent deploy
```

Set `DISABLE_INPROCESS_VOICE_RUNTIME=1` on Coolify when using LiveKit Cloud agents.

---

## After updating Coolify

1. Redeploy the main app (in-process worker starts automatically)
2. **Publish Amy** once (or run `node scripts/fix-amy-livekit-sip-host.mjs` then full reset via API)
3. Call +18663464256
