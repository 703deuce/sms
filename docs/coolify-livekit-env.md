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

## Latency and audio (LiveKit)

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

### Recommended low-latency stack (defaults in code)

```
VOICE_LLM_MODEL=gpt-5-nano
VOICE_TTS_PRESET=elevenlabs
VOICE_TURN_PRESET=ultra_low
VOICE_PREEMPTIVE_TTS=true
```

Use `gpt-5-mini` instead of nano if tool-call accuracy drops.

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
