# Voice V2 Amy — OpenAI GPT-Realtime-2.1 Mini on Telnyx (transport only)

**Scope:** Replace the managed-assistant **Deepgram STT → text LLM → NaturalHD/ElevenLabs TTS** cascade with **native OpenAI Realtime speech** on Telnyx AI Assistants for Voice V2 PSTN agents (Microsoft 365 / Calendly live booking). Prompts, tools, FIND/BOOK, intake, and wizard configuration are unchanged.

## Model and voice

| Setting | Value |
|--------|--------|
| OpenAI Realtime model id | `VOICE_REALTIME_MODEL` (default mini) |
| Telnyx Assistants `model` | `VOICE_REALTIME_TELNYX_MODEL` (default Telnyx mini) |
| Native voice | `marin` (wizard legacy catalog ids map to marin) |
| Latency profile id | `openai_realtime_gpt_21_mini` |

## Environment (optional overrides)

| Variable | Purpose |
|----------|---------|
| `VOICE_REALTIME_MODEL` | OpenAI-side model id (default `VOICE_REALTIME_MODEL` (default mini)) |
| `VOICE_REALTIME_TELNYX_MODEL` | Telnyx Assistants model string (default `VOICE_REALTIME_TELNYX_MODEL` (default Telnyx mini)) |
| `VOICE_REALTIME_VOICE` | Fallback native voice when not on agent config (default `marin`) |
| `VOICE_V2_OPENAI_REALTIME_TELNYX` | Set `0` to disable this transport for Voice V2 PSTN and keep Flux cascade |

OpenAI credentials continue to use Telnyx integration secret `openai_key` (`llm_api_key_ref`).

## What is removed from the live path

For Voice V2 PSTN publish (`bookingStrategy` Microsoft 365 or Calendly):

- Deepgram / Flux STT (`transcription` not sent to Telnyx)
- Cascade text LLM (`openai/gpt-5.4-mini` on the assistant)
- Telnyx NaturalHD / ElevenLabs TTS for Amy’s speech

Turn detection uses **Telnyx + realtime model server VAD** (no Deepgram EOT on this path).

## Code touchpoints

- `src/lib/voice/telnyx/openai-realtime-telnyx-transport.ts` — gating + apply transport
- `src/lib/voice/telnyx/amy-minimum-side-effect.ts` — Voice V2 → realtime profile
- `src/lib/solutions/appointment-receptionist/build-agent-config.ts` — marin voice + STT off at compile
- `src/lib/voice/latency-profiles.ts` — `openai_realtime_gpt_21_mini` profile + `isNativeAudioModel`
- `src/lib/voice/telnyx/voices.ts` — pass-through OpenAI native voice ids to Telnyx

## Telnyx account requirement (blocker until enabled)

`PATCH /v2/ai/assistants/{id}` with `VOICE_REALTIME_TELNYX_MODEL` (default Telnyx mini) returns **error 10027** (“Model … is not available for inference”) on accounts where `/v2/ai/models` does not list realtime speech models.

Until Telnyx enables `VOICE_REALTIME_TELNYX_MODEL` (default Telnyx mini) for your account:

1. Publish/sync will request the realtime model and may surface `coreError` on assistant sync.
2. PSTN will **not** use GPT-Realtime audio even though Transovo config is correct.

**Action:** Request OpenAI Realtime speech model access for AI Assistants from Telnyx, then republish the wizard agent and run the single PSTN smoke in the product runbook.

## Verification

```bash
npx tsx scripts/test-openai-realtime-telnyx-transport.ts
npx tsx scripts/test-voice-latency-profiles.ts
```

After Telnyx enables the model: one live PSTN call on the cert line — confirm marin audio, no cascade STT/TTS, interrupt, booking intent without blocking tool, FIND/BOOK unchanged, transcript persisted.
