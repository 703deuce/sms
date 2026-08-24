# Coolify env — self-hosted LiveKit primary

Production uses **self-hosted LiveKit** at your production WebSocket URL. LiveKit Cloud credentials stay in `LIVEKIT_CLOUD_*` for rollback.

## Primary (set on `transovo-web` and `transovo-voice`)

| Variable | Value |
|----------|--------|
| `LIVEKIT_URL` | Self-hosted WebSocket URL |
| `LIVEKIT_API_KEY` | Self-hosted API key (from Hetzner server env) |
| `LIVEKIT_API_SECRET` | Self-hosted API secret |
| `LIVEKIT_SIP_URI` | Self-hosted SIP ingress hostname |
| `LIVEKIT_SIP_HOST` | Same as SIP URI |
| `LIVEKIT_INBOUND_TRUNK_ID` | Self-hosted inbound trunk id |
| `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` | Self-hosted outbound trunk id |
| `LIVEKIT_DISPATCH_RULE_ID` | Self-hosted dispatch rule id |

## Cloud fallback (keep for rollback — do not delete)

| Variable | Value |
|----------|--------|
| `LIVEKIT_CLOUD_URL` | Previous Cloud WebSocket URL |
| `LIVEKIT_CLOUD_API_KEY` | Previous Cloud API key |
| `LIVEKIT_CLOUD_API_SECRET` | Previous Cloud API secret |
| `LIVEKIT_CLOUD_SIP_URI` | Previous `*.sip.livekit.cloud` SIP URI |
| `LIVEKIT_CLOUD_INBOUND_TRUNK_ID` | Cloud inbound trunk id |
| `LIVEKIT_CLOUD_OUTBOUND_TRUNK_ID` | Cloud outbound trunk id |
| `LIVEKIT_CLOUD_DISPATCH_RULE_ID` | Cloud dispatch rule id |

## Swap helper

```bash
node scripts/switch-livekit-primary-to-self-hosted.mjs print   # env checklist (redacted)
node scripts/switch-livekit-primary-to-self-hosted.mjs verify  # API auth to self-hosted server
```

## After updating Coolify

1. Redeploy **transovo-web** and **transovo-voice**
2. Run `verify` — expect TLS 200 and no auth errors in logs
3. Call your existing **571-407** business number
4. Confirm voice worker logs show self-hosted host, not livekit.cloud

## Rollback to Cloud

Restore `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` from `LIVEKIT_CLOUD_*` values and redeploy.
