# Voice V3 — delegated backend model (GPT-Live)

Live PSTN voice uses **`gpt-live-1`**. Tool/reasoning delegation uses a separate Responses model via `VOICE_V3_ASTRA_MODEL` / `delegation.responses.model`.

## API model IDs (OpenAI)

| Product name | API `model` string | Notes |
|--------------|-------------------|--------|
| **GPT-6 Luna** (current default) | **`gpt-6-luna`** | Production default |
| GPT-6 Sol | `gpt-6-sol` | Override / A-B |
| GPT-6 Astra | `gpt-6-astra` | Historical forensics |
| GPT-5.6 Sol (legacy) | `gpt-5.6-sol` | Rollback |

Code default: `VOICE_V3_ASTRA_MODEL_DEFAULT` in `src/lib/voice-v3/intake/delegation-config.ts`.

## Production (Coolify transovo-web)

When **`VOICE_V3_ASTRA_MODEL` is unset**, deploy uses code default **`gpt-6-luna`**. Logs: `VOICE_V3_ASTRA_MODEL_RESOLVED` with `source: default`.

Optional explicit override (same result as default):

```bash
VOICE_V3_ASTRA_MODEL=gpt-6-luna
```

Recreate the web container after changing `.env`. Forensics: `VOICE_V3_SESSION_BOOTSTRAP_START` → `detail.backend_model`.

### Rollback / A-B

```bash
VOICE_V3_ASTRA_MODEL=gpt-6-sol
# or legacy
VOICE_V3_ASTRA_MODEL=gpt-5.6-sol
```

## Verify on a call

`VoiceCall.metadata.voiceV3Forensics` → `VOICE_V3_SESSION_BOOTSTRAP_START` → `detail.backend_model`.
