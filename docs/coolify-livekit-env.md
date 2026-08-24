# LiveKit media backend selector

The app supports two LiveKit configurations side by side. **Existing Cloud env vars are unchanged.**

## Cloud (default — existing production)

Already in Coolify; do not rename or repurpose:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_SIP_URI` / trunk / dispatch vars as today

## Self-hosted (add alongside Cloud)

- `LIVEKIT_SELF_HOSTED_URL`
- `LIVEKIT_SELF_HOSTED_API_KEY`
- `LIVEKIT_SELF_HOSTED_API_SECRET`
- `LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID`
- `LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID`
- `LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID`
- `LIVEKIT_SELF_HOSTED_SIP_HOST` (optional; derived from URL if omitted)

## Selector (both `transovo-web` and `transovo-voice`)

```
MEDIA_BACKEND_MODE=livekit_cloud   # default — existing behavior
MEDIA_BACKEND_MODE=self_hosted   # use self-hosted LiveKit server
```

Rollback: set `MEDIA_BACKEND_MODE=livekit_cloud` and redeploy. No other config changes.

## After deploy

1. Redeploy `transovo-web` and `transovo-voice`
2. Confirm logs show `mediaBackend=self_hosted` when mode is set
3. Call your existing 571-407 business number
