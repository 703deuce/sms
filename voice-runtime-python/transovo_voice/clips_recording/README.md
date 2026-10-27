# Clips recording (LiveKit server-side)

**Container:** same Coolify app as `transovo_voice` (`scripts/start-transovo-voice-worker.sh`).  
**Env:** `RECORDING_LIVEKIT_TARGET=cloud|self_hosted` (default `cloud`).

| Target | Vars (already in Coolify) |
|--------|---------------------------|
| `cloud` | `LIVEKIT_URL` (e.g. `wss://sms-6w01zoya.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| `self_hosted` | `LIVEKIT_SELF_HOSTED_URL`, `LIVEKIT_SELF_HOSTED_API_KEY`, `LIVEKIT_SELF_HOSTED_API_SECRET` (`voice.transovo.ai`) |

**Primary path:** browser `MediaRecorder` + B2 upload (Next.js). This package is for:

- webhook-driven session reconciliation (optional worker consumer)
- RoomComposite **egress** safety recording (off by default)
- server participant fallback when a guest’s browser upload fails

**Do not** remove or rename SIP-related env (`LIVEKIT_SIP_*`, trunks) — telephony is deprecated but vars stay for infra compatibility.

Wire new agents behind `CLIPS_RECORDING_WORKER_ENABLED=1` when M15+ ships; until then only `config.py` is shared.
