# Voice V3 recording — media path decision

## Requirement

Record the **full** conversation: PSTN caller + Amy (GPT-Live), without changing the certified Telnyx → LiveKit SIP ingress.

## Architecture (frozen)

```
PSTN → Telnyx → SIP → LiveKit inbound trunk → Room → Agent session (Amy)
```

## Telnyx recording evaluation (Option A)

- Voice V3 does **not** use Telnyx Call Control for the conversation path.
- Inbound audio is forwarded to LiveKit; synthesis and agent audio are produced **inside** the LiveKit room.
- Telnyx-side recording on the SIP trunk captures the **carrier leg**, not the mixed agent+caller conversation in the room.
- **Conclusion:** Do **not** force Telnyx `record` / Call Control for Voice V3. No second leg, no bridge.

## LiveKit Egress (Option B) — selected

- Installed SDK: `livekit-server-sdk` `EgressClient` (`startRoomCompositeEgress`, `audioOnly`, `audioMixing`).
- Start egress when the Voice V3 room session starts (non-blocking).
- Stop/finalize on room end; handle `egress_ended` webhook → persist `VoiceRecording` → enqueue transcription.
- Storage: LiveKit Cloud file output and/or configured S3 upload (env-driven). Playback via existing signed Transovo stream route.

## Operational notes

- Egress must not add realtime latency to Amy (start async after join).
- Failures are isolated: call record remains valid; recording status `FAILED` with retry path.
- Proof required before “done”: listen to file — caller and Amy both present.
