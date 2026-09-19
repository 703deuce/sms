# Voice V3 — OpenAI Live audio controls evidence (openai@7.17)

**Package:** `openai` (installed `^7.17.0`)  
**Types:** `node_modules/openai/resources/live/sessions.d.ts`  
**API:** [OpenAI Live TypeScript API reference](https://platform.openai.com/docs/api-reference/live)

## Session accept (startup) — supported fields

`SessionAcceptParams.Session` includes:

- `model` (`gpt-live-1`)
- `type` (`live`)
- `instructions` (immutable after startup)
- `audio.output.voice` — built-in voice name or custom voice id (**cannot change after startup**)
- `delegation` — backend Responses configuration

SIP accept omits `audio.format` (negotiated by carrier).

There are **no** typed startup fields in `SessionAcceptParams` for:

- speaking rate / speed
- responsiveness
- interruption sensitivity
- turn-detection tuning exposed as wizard sliders

## Active session updates

Live session updates after accept are limited (delegation backend settings per API docs). Wizard sliders are compiled to:

`VoiceV3AgentConfig.telephony.liveAudioControls` with `executionSupport: UNSUPPORTED_BY_CURRENT_LIVE_API`

Values are **retained** for future provider support — not discarded.

## Production mapping today

| Wizard control | V3 config path | Live accept |
|----------------|----------------|-------------|
| `voiceId` | `telephony.liveVoiceId` | `session.audio.output.voice` |
| `speakingSpeed` | `telephony.liveAudioControls.speakingSpeed` | stored only |
| `responsiveness` | `telephony.liveAudioControls.responsiveness` | stored only |
| `interruptionSensitivity` | `telephony.liveAudioControls.interruptionSensitivity` | stored only |

Implementation: `src/lib/voice-v3-basic/live-session-config.ts` (`buildBasicLiveSession`).
