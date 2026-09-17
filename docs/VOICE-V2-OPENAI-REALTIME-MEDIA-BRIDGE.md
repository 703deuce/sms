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
| `VOICE_REALTIME_BRIDGE_PORT` | WS listener (default `3108`) |
| `VOICE_REALTIME_BRIDGE_PUBLIC_WSS_URL` | Public `wss://` base Telnyx can reach |
| `VOICE_REALTIME_BRIDGE_SIGNING_SECRET` | HMAC for stream tokens |

Republish wizard agent after enable so `inboundRoutingMode` is `call_control` (bridge apply sets this).

## Tool adapter

OpenAI Realtime **function** tools mirror Voice V2 webhook tool names/schemas (`voice_v2_find_availability`, `voice_v2_book_offered_slot`, …). `dispatchOpenAiRealtimeVoiceV2Tool` calls the **same executors** as `/api/telnyx/voice-v2/*`. Capability gating uses `buildVoiceV2CallCapabilitySnapshot`. OpenAI `call_id` maps to `tool_invocation_id` when omitted. FIND date changes bump a generation counter to supersede stale results in the bridge layer only.

## Verification

```bash
npx tsx scripts/test-openai-realtime-media-bridge.ts
```

Live: PSTN smoke with bridge enabled, confirm no Assistant audio path, FIND/BOOK via function calls, transcript/CallContext still populated post-call.
