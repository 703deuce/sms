# GPT-Live turn latency instrumentation

**Scope:** Normal conversational turns (no FIND/BOOK changes). Booking engine frozen per `docs/GPT-LIVE-PSTN-BOOKING-KNOWN-GOOD.md`.

## Log grep

```bash
docker logs <web-container> 2>&1 | grep -E 'LIVE_TURN_|LIVE_TURN_SUMMARY|LIVE_MEDIA_SAMPLE|LIVE_BRIDGE_OBS' | grep -F '<callId>'
```

## Per-turn events

For turn `n`:

- `TURN_n_CALLER_AUDIO_FIRST` / `LAST` / `CALLER_AUDIO_ENDED_ESTIMATE` — bridge PCMU activity detector (not Telnyx transcription)
- `TURN_n_LIVE_INPUT_TRANSCRIPT_FIRST` / `LAST_SEEN` — streaming fragments only
- `TURN_n_DELEGATION_CREATED`
- `TURN_n_FIRST_RESPONSE_EVENT`
- `TURN_n_FIRST_OUTPUT_TRANSCRIPT`
- `TURN_n_FIRST_OUTPUT_AUDIO_DELTA`
- `TURN_n_FIRST_AUDIO_SENT_TO_TELNYX`

`LIVE_TURN_SUMMARY` includes:

- `live_turn_latency_ms` = first output audio − caller audio end estimate
- `delegated` / `tool_called`
- segment deltas for delegation and OpenAI→Telnyx

## Controlled tests

| Test | Caller | Expect |
|------|--------|--------|
| A | Hello / How are you? | `delegated: false`, `tool_called: false` |
| B | I need to book an appointment. | Conversational reply; note if `delegated: true` without tool |
| C | Day/time until FIND | Tool turn; measure FIND segment separately |

## Targets (no-tool)

`live_turn_latency_ms` ≈ **800–1500 ms** after fixes; multi-second no-tool latency warrants checking unnecessary delegation or bridge buffering (`LIVE_MEDIA_SAMPLE` forward_delay_ms).
