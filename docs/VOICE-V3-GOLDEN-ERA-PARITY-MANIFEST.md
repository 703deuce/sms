# Voice V3 golden-era parity manifest

**Intent:** PSTN LiveKit calls behave like the September 2026 golden-era stress tests (booking ↔ callback ↔ booking on one call, shared intake facts), with **business identity from the published wizard** — not hardcoded company copy.

## Runtime invariants

| Invariant | Authority |
|-----------|-----------|
| Persisted intake (`VoiceV3CallContext.intake.values`) | `update_intake` + `mergeIntakeUpdate` |
| Amy sees saved facts after tools / delegation | `session.thinking.append` + `session.commentary.append` |
| Sideband PSTN | `live-sideband-session.ts` → `pushDelegatedRuntimeContextToLive` on `session.delegation.created` |
| LiveKit PSTN | Node `executeVoiceV3ToolForLiveKit` returns `liveContextEvents`; Python worker applies via `GPTLiveSession.append_*`; delegation uses `resolve_voice_v3_delegated_runtime_context` |

## Verification

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-voice-v3-golden-era-parity.ts
cd voice-runtime-python && python3 -m pytest tests/test_live_context_hydration.py
```

Post-deploy: PSTN on wizard DID — book → callback → book; name must not be re-asked after `update_intake`.
