# Telnyx Assistant optimization surface (Amy 866 production)

This document defines what Transovo **can** tune on the managed **Telnyx AI Assistant** path (+18663464256, TeXML direct). It also lists controls that exist only on our **LiveKit/custom realtime** path so we do not confuse the two.

**Rule:** Optimize the managed assistant with Telnyx-exposed knobs first. Do not assume we control generation cancellation, custom audio queues, ElevenLabs WebSocket lifecycle, or TTS chunk scheduling on Telnyx.

---

## Two buckets

### Bucket A — Telnyx Assistant (production 866)

| Layer | What we control | Where |
|-------|-----------------|-------|
| Prompt / context | System prompt, business knowledge, tool playbook | `build-agent-config.ts`, `caller-constitution.ts`, `assistant-sync.ts` |
| Tool surface | Which webhooks are published | `tool-publish.ts`, `assistant-tools.ts` |
| Flux STT | `transcription.model`, `transcription.settings` | `latency-profiles.ts`, `assistant-sync.ts` |
| Start Speaking Plan | `interruption_settings.start_speaking_plan` | `buildStartSpeakingPlanFromConfig()` |
| TTS | Voice ID, stability, style, pronunciation dictionary | `amy-production-voice-tuning.ts`, `assistant-sync.ts` |
| Barge-in enable | `interruption_settings` (Telnyx-managed StartOfTurn) | Telnyx + Flux — we enable barge-in; vendor handles stop-playback |
| Post-call | Transcript sync, CallFactStore merge, CRM workers | `post-call.ts` |

### Bucket B — LiveKit / custom realtime only

Not available on Telnyx Assistant unless we move the call back to our worker:

- Custom generation IDs and stale-chunk cancellation
- SpeechCompiler / semantic→speech text pipeline
- Phrase buffer / custom TTS chunk scheduling
- ElevenLabs `previous_text` / multi-stream context lifecycle
- Custom jitter buffers, codec pipeline, playback queue depth
- `runtime_turn` gateway orchestration on our HTTP worker during audio

See `docs/VOICE_AGENT_AUDIT.md` Sections 23–24 for LiveKit hybrid engineering (in-repo, not 866).

---

## Barge-in vs endpointing (not the same knob)

| Concern | What it means | Primary control on Telnyx + Flux |
|---------|---------------|----------------------------------|
| **Barge-in** | Caller starts talking while the agent is speaking → agent should stop quickly | Flux **StartOfTurn** (transcribed speech signal). Telnyx interruption stack. **Do not** tune `eot_threshold` to fix barge-in. |
| **Endpointing** | Caller stops talking → when should the agent start responding? | Flux **EndOfTurn**: `eot_threshold`, `eager_eot_threshold`, `eot_timeout_ms` |
| **Start delay floor** | Extra wait after turn-end before TTS plays | `start_speaking_plan.wait_seconds` |

Deepgram recommends Flux **StartOfTurn** as the barge-in signal (speech-linked, not generic VAD noise).

Telnyx **eager end-of-turn** (default ~0.3 eager threshold) lets the LLM start preparing a response before the turn is fully confirmed. Audio is not played until the turn is confirmed — good latency without talking over the caller.

---

## Flux transcription.settings (EndOfTurn)

Sent only when `transcription.model === "deepgram/flux"`.

| Field | Role | Telnyx default (approx.) | Our production profile (`flux_b_balanced`) |
|-------|------|--------------------------|---------------------------------------------|
| `eot_threshold` | Confidence required that caller finished | ~0.7 | **0.80** (slightly patient) |
| `eager_eot_threshold` | Start LLM prep early | ~0.3 | **0.40** |
| `eot_timeout_ms` | Hard fallback if never confident | varies | **5000** |

**Profiles in repo:**

| Profile ID | EOT / eager | Use |
|------------|-------------|-----|
| `flux_b_balanced` | 0.80 / 0.40 | **Amy 866 default** — production candidate |
| `flux_b_fast` | 0.75 / 0.35 | Lab / A-B only — do not tune EOT aggressively for barge-in |
| `flux_b_patient` | 0.85 / 0.45 | Long intake answers |

Implementation: `buildFluxTranscriptionSettings()` in `src/lib/voice/latency-profiles.ts`.

---

## Start Speaking Plan

Controls how quickly the agent **starts speaking after the caller stops** (separate from Flux EOT).

### Flux (Amy production)

For Flux, Telnyx turn-taking is driven by `transcription.settings` EOT — **not** the legacy `transcription_endpointing_plan` punctuation timers.

We send:

```json
{
  "start_speaking_plan": {
    "wait_seconds": 0.1,
    "transcription_endpointing_plan": null
  }
}
```

Do **not** copy Nova-style `on_no_punctuation_seconds: 1.0` onto Flux — that fights Flux EOT.

### Legacy Nova / non-Flux (reference only)

For non-Flux models, Telnyx documents separate waits for punctuation, no-punctuation, and number sequences. Example **test** configuration (not Amy production):

```json
{
  "start_speaking_plan": {
    "wait_seconds": 0.3,
    "transcription_endpointing_plan": {
      "on_punctuation_seconds": 0.1,
      "on_no_punctuation_seconds": 0.8,
      "on_number_seconds": 0.8
    }
  }
}
```

Tune these only on legacy STT paths. Validate on real calls before promoting.

Implementation: `buildStartSpeakingPlanFromConfig()` in `src/lib/voice/latency-profiles.ts`.

---

## Realistic optimization order (Telnyx 866)

1. **Prompt / business knowledge** — answer FAQ without tools (zero latency, zero failure surface)
2. **Minimum-side-effect tools** — narrow live surface (`send_sms`, `record_call_fact`, …)
3. **Flux profile** — `flux_b_balanced` unless A/B data supports faster
4. **Start Speaking Plan** — `wait_seconds` floor only on Flux
5. **TTS voice + pronunciation** — stability, dictionary, speak-text normalization on tool egress
6. **Post-call processing** — structured extraction, CRM, retries (eventual consistency)

---

## What we cannot assume on Telnyx

- Custom audio buffer depth or playback cancellation APIs
- Per-chunk generation IDs across TTS frames
- ElevenLabs socket open/close per turn
- LiveKit `cancelActiveGeneration` on barge-in
- Owning the full codec → jitter → playout pipeline

Telnyx owns most of the managed voice loop. Our job is to configure it well and keep live side effects small.

---

## Verification

```bash
# Publish surface + Flux config (requires DB + Telnyx)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/amy-minimum-side-effect-republish.ts

# Live tool catalog
BASE_URL=... OWNER_EMAIL=... node scripts/audit-caller-amy-published-tools.mjs
```

After republish, confirm live assistant payload includes:

- `model`: `openai/gpt-5.4-mini`
- `transcription.model`: `deepgram/flux`
- `transcription.settings`: `eot_threshold`, `eager_eot_threshold`, `eot_timeout_ms`
- `interruption_settings.start_speaking_plan.wait_seconds` (~0.1 on Flux)
- No legacy punctuation endpointing plan on Flux
