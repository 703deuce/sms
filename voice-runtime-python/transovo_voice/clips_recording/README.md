# Clips recording (LiveKit Cloud server-side)

**Container:** existing `transovo_voice` worker (`scripts/start-transovo-voice-worker.sh`).  
**SFU:** **LiveKit Cloud only** — `LIVEKIT_URL` (e.g. `wss://sms-6w01zoya.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

Do **not** use `LIVEKIT_SELF_HOSTED_*`, `voice.transovo.ai`, or `RECORDING_LIVEKIT_TARGET` for recording. Telephony `MEDIA_BACKEND_MODE` is unrelated.

**Primary path:** browser `MediaRecorder` + B2 (Next.js). This package is for optional Cloud-side:

- webhook / reconciliation helpers
- **TrackEgress** cloud backup to B2 (session `cloudBackupEnabled`, started from Next.js on take start)
- **Rooms captions agent** (`transovo-clips-transcription`): Deepgram STT when `CLIPS_RECORDING_WORKER_ENABLED=1` and `CLIPS_ROOMS_TRANSCRIPTION_ENABLED=1` on app; dispatches on take start
- server participant fallback when a guest browser upload fails

Wire agents behind `CLIPS_RECORDING_WORKER_ENABLED=1` when M15+ ships.
