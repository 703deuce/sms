# Transovo Python LiveKit Voice Runtime

Independent **`transovo-voice`** service — not spawned from Next.js.

## Production

```bash
docker build -f voice-runtime-python/Dockerfile -t transovo-voice .
docker run --env-file .env voice-runtime-python
```

Start command: `python -m transovo_voice.main start`

See `docs/deployment-transovo-web-voice-split.md` for Coolify two-application setup.

## Local dev

```bash
export TRANSOVO_BACKEND_URL=http://127.0.0.1:3000
export TRANSOVO_INTERNAL_API_KEY=...
export LIVEKIT_URL=...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export OPENAI_API_KEY=...
npm run voice-python:start
```

## Pre-push

```bash
npm run build:voice-python
```
