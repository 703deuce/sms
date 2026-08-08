# Coolify env for LiveKit voice (+18663464256)

## LiveKit Cloud project: **Sms** (Settings → General)

| Field | Value |
|-------|--------|
| Project name | `Sms` |
| Project URL | `wss://sms-6w01zoya.livekit.cloud` |
| **SIP URI** | `sms-6w01zoya.sip.livekit.cloud` |

Telnyx must send PSTN to **`sms-6w01zoya.sip.livekit.cloud`**.

## Required in Coolify (main app)

| Variable | What to put |
|----------|-------------|
| `VOICE_RUNTIME_PROVIDER` | `livekit` |
| `LIVEKIT_URL` | `wss://sms-6w01zoya.livekit.cloud` |
| `LIVEKIT_SIP_URI` | `sms-6w01zoya.sip.livekit.cloud` |
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
| `VOICE_TTS_PROVIDER` | `inference` |
| `VOICE_TTS_MODEL` | `inworld/inworld-tts-1.5-mini` |
| `VOICE_LLM_PROVIDER` | `openai` |
| `VOICE_LLM_MODEL` | `gpt-4.1-mini` |

## LiveKit agent worker (separate deploy)

Deploy `transovo-voice-runtime` on LiveKit Cloud **Sms** project with the same `LIVEKIT_*` values plus `OPENAI_API_KEY` and `DATABASE_URL`.

## After updating Coolify

1. Redeploy the main app
2. **Publish Amy** once (or run `node scripts/fix-amy-livekit-sip-host.mjs` then full reset via API)
3. Call +18663464256
