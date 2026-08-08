# Coolify env for LiveKit Amy (+18663464256)

The code reads your **existing** Coolify variables. No separate `LIVEKIT_SIP_HOST` is required if `LIVEKIT_URL` is already your `sms-*.sip.livekit.cloud` endpoint.

## Required in Coolify (main app)

| Variable | What to put |
|----------|-------------|
| `VOICE_RUNTIME_PROVIDER` | `livekit` |
| `LIVEKIT_URL` | Your `sms-xxxxx.sip.livekit.cloud` value **or** `wss://sms-xxxxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | LiveKit project API key |
| `LIVEKIT_API_SECRET` | LiveKit project API secret |
| `OPENAI_API_KEY` | OpenAI key (LiveKit LLM) |
| `ELEVENLABS_KEY` | ElevenLabs TTS (already used elsewhere) |
| `TELNYX_API_KEY` | Telnyx (number routing) |
| `DATABASE_URL` | Postgres |

## Not required (auto-handled)

- `LIVEKIT_SIP_HOST` — only if you want a duplicate; code reads SIP from `LIVEKIT_URL`
- `LIVEKIT_INBOUND_TRUNK_ID` / `LIVEKIT_DISPATCH_RULE_ID` — created via API on publish
- Running `scripts/provision-amy-866-livekit.mjs` — **Publish Amy** in the app does the same thing

## What happens when you Publish Amy

1. Saves number → agent in DB
2. Telnyx API: routes +18663464256 to shared FQDN → LiveKit SIP
3. LiveKit API: adds number to shared inbound trunk + dispatch rule
4. Runtime resolves `toE164` → Amy (no per-agent LiveKit objects)

## LiveKit agent worker (separate deploy)

The `transovo-voice-runtime` worker needs the same `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, plus `OPENAI_API_KEY` and `ELEVENLABS_KEY`.

## Only change in Coolify if calls still hit old Telnyx assistant

Set `VOICE_RUNTIME_PROVIDER=livekit` on the **main Transovo app** and redeploy, then **Publish** Amy once from the dashboard.
