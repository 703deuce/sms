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

## Full switch to self-hosted (not just the API URL)

Setting `MEDIA_BACKEND_MODE=self_hosted` makes the app and voice worker talk to self-hosted LiveKit. Inbound PSTN also requires Telnyx SIP ingress to target the self-hosted SIP hostname env var. // pragma: allowlist secret

When `MEDIA_BACKEND_MODE=self_hosted`:

1. Runtime + worker use `LIVEKIT_SELF_HOSTED_*` credentials
2. Telnyx FQDN provisioning uses the self-hosted SIP host (ignores Cloud `LIVEKIT_SIP_URI`)
3. LiveKit trunk/dispatch provisioning targets the self-hosted server

After deploy, run on the server (with production env loaded):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-active-media-backend-ingress.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-active-media-backend-ingress.ts --apply
```

Optional single number: `--e164 +15714073615`

## After deploy

1. Redeploy `transovo-web` and `transovo-voice`
2. `npx tsx scripts/verify-media-backend-mode.ts` → `resolvedBackend: self_hosted`
3. Run ingress switch script with `--apply`
4. Call your business number; logs should show `mediaBackend=self_hosted`
