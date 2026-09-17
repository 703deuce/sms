# Voice V2 — Telnyx media transport + OpenAI Realtime (audio brain)

**Scope:** Replace live PSTN **Deepgram → text LLM → NaturalHD/ElevenLabs** with **Telnyx bidirectional media streaming → OpenAI Realtime mini (voice `marin`)**. Business tools, FIND/BOOK, intake, CallContext, and wizard config are unchanged.

This is **not** Telnyx Custom LLM (`/v1/chat/completions`) and **not** setting `openai/gpt-realtime-*` on the Telnyx AI Assistant (Telnyx error 10027 on many accounts).

## Architecture

```
PSTN → Telnyx Call Control → streaming_start (PCMU RTP) → Transovo WSS bridge
     → OpenAI Realtime WebSocket (g711_ulaw in/out, VAD, one session)
     → function calls → existing Voice V2 executors → result → Amy continues
```

Telnyx AI Assistant STT/TTS/LLM are **not** on the active audio path when the bridge is enabled.

## Pre-implementation report (summary)

1. **Ingress today (571 / Flux):** PSTN → TeXML → Telnyx AI Assistant → Deepgram Flux → GPT-5.4 mini → NaturalHD → HTTPS tools (`docs/VOICE-V2-TELNYX-AGENT-STACK.md`). Call Control path answers and `startAiAssistantOnCall` when `inboundRoutingMode` is `call_control`.
2. **Bridge mechanism:** Telnyx Call Control `POST /calls/:id/actions/streaming_start` with `stream_bidirectional_mode: rtp`, `stream_bidirectional_codec: PCMU`, `stream_url` → signed Transovo WSS (`/telnyx/media`).
3. **Removed from live path (bridge on):** Deepgram/Flux STT, Telnyx cascade LLM, Telnyx/ElevenLabs TTS, Telnyx Assistant inference for that call.
4. **Code:** `src/lib/voice/telnyx/openai-realtime-bridge/*`, `inbound.ts`, `webhook-handlers.ts`, `amy-minimum-side-effect.ts`, `node-web-boot.ts` (WS listener).
5. **Microsoft 365 certified pipeline:** **no changes** under `src/lib/voice-v2/pipelines/microsoft-365-certified/`.

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Server-side Realtime session |
| `VOICE_REALTIME_MODEL` | OpenAI Realtime mini model id (see `flags.ts` default) |
| `VOICE_REALTIME_VOICE` | Default `marin` |
| `VOICE_V2_OPENAI_REALTIME_BRIDGE` | Set `0` to disable bridge (Flux assistant path) |
| `VOICE_REALTIME_BRIDGE_PORT` | Optional override for **internal** WS listener (default `3108`, bind `0.0.0.0`) |
| `VOICE_REALTIME_BRIDGE_SIGNING_SECRET` | Optional HMAC for stream tokens (defaults to `TRANSOVO_INTERNAL_API_KEY` / `NEXTAUTH_SECRET`) |

### Public WSS URL (hardcoded — no env)

Production Telnyx `stream_url` uses **`wss://voice.transovo.ai`** (`OPENAI_REALTIME_BRIDGE_PUBLIC_WSS_URL` in `openai-realtime-bridge/config.ts` — Telnyx media edge only, not LiveKit). Path: `/telnyx/media?token=…`.

### Coolify / TLS (do not expose raw `:3108` publicly)

Traefik on **`voice.transovo.ai`** must proxy WebSocket upgrades to the container’s bridge port (`3108`):

- Coolify: domain `voice.transovo.ai` → `http://<container>:3108` with **WebSocket** enabled.
- Telnyx must reach valid **TLS** `wss://` from the public internet — not `wss://server-ip:3108` without a certificate.

Republish wizard agent after enable so `inboundRoutingMode` is `call_control` (bridge apply sets this).

## Session lifecycle (locked)

One PSTN call = one Telnyx media WebSocket + **one** OpenAI Realtime WebSocket until hangup. No reconnect per utterance or tool.

## Intake on the hot path

`voice_v2_save_intake_fields` persistence runs **async** in the bridge: Amy gets an immediate function result and keeps talking; canonical CallContext updates in the background. FIND/BOOK/transfer remain awaited (truth actions).

## PSTN test — log grep (operator)

During your test call, grep container logs for `source":"realtime_bridge"`:

| Event | Meaning |
|-------|---------|
| `telnyx_media_ws_connected` | Telnyx media WS up |
| `openai_realtime_session_connected` | Model + voice + `g711_ulaw` |
| `first_amy_audio_delta` | Caller stop → first Amy audio |
| `tool_function_call` / `tool_result` | Tool names + FIND/BOOK outcomes |
| `legacySttTtsPath: false` | No Assistant STT/TTS on this path |

## Tool adapter

OpenAI Realtime **function** tools mirror Voice V2 webhook tool names/schemas (`voice_v2_find_availability`, `voice_v2_book_offered_slot`, …). `dispatchOpenAiRealtimeVoiceV2Tool` calls the **same executors** as `/api/telnyx/voice-v2/*`. Capability gating uses `buildVoiceV2CallCapabilitySnapshot`. OpenAI `call_id` maps to `tool_invocation_id` when omitted. FIND date changes bump a generation counter to supersede stale results in the bridge layer only.

## Verification

```bash
npx tsx scripts/test-openai-realtime-media-bridge.ts
```

Live: PSTN smoke with bridge enabled, confirm no Assistant audio path, FIND/BOOK via function calls, transcript/CallContext still populated post-call.
