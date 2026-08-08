# Coolify env for LiveKit Amy (+18663464256)

## Amy LiveKit project (from LiveKit Cloud dashboard)

| Field | Value |
|-------|--------|
| Project name | `amy` |
| Project ID | `p-4hde63ww` |
| Project URL | `amy-4hde63ww.livekit.cloud` |
| **SIP URI** | `sip:amy-4hde63ww.sip.livekit.cloud` |

Telnyx must send PSTN to **`amy-4hde63ww.sip.livekit.cloud`** — not a different `sms-*.sip.livekit.cloud` host.

## Required in Coolify (main app)

| Variable | What to put |
|----------|-------------|
| `VOICE_RUNTIME_PROVIDER` | `livekit` |
| `LIVEKIT_URL` | `wss://amy-4hde63ww.livekit.cloud` |
| `LIVEKIT_SIP_URI` | `amy-4hde63ww.sip.livekit.cloud` (from Project Settings → SIP URI) |
| `LIVEKIT_API_KEY` | API key from **amy** project (Settings → Keys) |
| `LIVEKIT_API_SECRET` | API secret from **amy** project |
| `OPENAI_API_KEY` | OpenAI key (Amy LLM) |
| `TELNYX_API_KEY` | Telnyx (number routing) |
| `DATABASE_URL` | Postgres |

`LIVEKIT_URL` and `LIVEKIT_SIP_URI` must be from the **same** LiveKit project. Using a derived `sms-*` host while keys are for `amy` causes SIP 404 (“not in service”) even when provisioning reports success.

## Voice pipeline (LiveKit Inference)

| Variable | Default |
|----------|---------|
| `VOICE_STT_PROVIDER` | `inference` |
| `VOICE_STT_MODEL` | `deepgram/nova-3` |
| `VOICE_TTS_PROVIDER` | `inference` |
| `VOICE_TTS_MODEL` | `inworld/inworld-tts-1.5-mini` |
| `VOICE_LLM_PROVIDER` | `openai` |
| `VOICE_LLM_MODEL` | `gpt-4.1-mini` |

## LiveKit agent worker (separate deploy)

Deploy `transovo-voice-runtime` on LiveKit Cloud **amy** project with the same `LIVEKIT_*` values plus `OPENAI_API_KEY` and `DATABASE_URL`.

## After updating Coolify

1. Redeploy the main app
2. **Publish Amy** once (or run `node scripts/fix-amy-livekit-sip-host.mjs` then full reset via API)
3. Call +18663464256
