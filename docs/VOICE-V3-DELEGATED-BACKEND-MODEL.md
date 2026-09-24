# Voice V3 — delegated backend model (GPT-Live)

Live PSTN voice uses **`gpt-live-1`**. Tool/reasoning delegation uses a separate Responses model via `VOICE_V3_ASTRA_MODEL` / `delegation.responses.model`.

## API model IDs (OpenAI)

| Product name | API `model` string | Notes |
|--------------|-------------------|--------|
| **GPT-6 Sol** (current default) | **`gpt-6-sol`** | [Model docs](https://developers.openai.com/api/docs/models/gpt-6-sol) |
| GPT-6 Luna | `gpt-6-luna` | Cert / override only |
| GPT-6 Astra | `gpt-6-astra` | Historical forensics |
| GPT-5.6 Sol (legacy) | `gpt-5.6-sol` | Previous default; rollback |

Code default: `VOICE_V3_ASTRA_MODEL_DEFAULT` in `src/lib/voice-v3/intake/delegation-config.ts`.

## Production override (Coolify transovo-web)

```bash
VOICE_V3_ASTRA_MODEL=gpt-6-sol
```

Recreate the web container after changing `.env`. Forensics should show `backend_model: gpt-6-sol` and logs `VOICE_V3_ASTRA_MODEL_RESOLVED` with `source: env` (or `default` when unset after deploy).

### Rollback

```bash
# Legacy 5.6 Sol
VOICE_V3_ASTRA_MODEL=gpt-5.6-sol

# Luna test
VOICE_V3_ASTRA_MODEL=gpt-6-luna
```

## Verify on a call

`VoiceCall.metadata.voiceV3Forensics` → `VOICE_V3_SESSION_BOOTSTRAP_START` → `detail.backend_model`.
