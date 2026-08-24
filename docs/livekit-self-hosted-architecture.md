# Self-Hosted LiveKit + Cloud Parity Architecture

Transovo supports two LiveKit media backends with automatic fallback:

| Backend | Role | Default endpoint |
|---------|------|------------------|
| `self_hosted` | Primary (Hetzner) | `wss://voice.transovo.ai` |
| `livekit_cloud` | Fallback / legacy | `wss://*.livekit.cloud` |

## Call flow

```
PSTN caller
  → Telnyx
  → Primary: voice.transovo.ai (self-hosted LiveKit SIP)
  → Self-hosted LiveKit Server
  → Python voice worker (LIVEKIT_AGENT_NAME)
  → Transovo web (/api/internal/voice-runtime)
  → Outbound via shared Telnyx SIP trunk on same backend
```

**Inbound failover (Telnyx FQDN):** when `TELNYX_LIVEKIT_FAILOVER_ENABLED=1`, the failover FQDN connection uses:

- Primary FQDN → `voice.transovo.ai`
- Secondary FQDN → `*.sip.livekit.cloud`

New inbound calls reach Cloud automatically when self-hosted SIP is unreachable.

**App-originated calls:** `resolveMediaBackend()` in `src/lib/voice/media-backend/resolver.ts` picks `self_hosted` when healthy, else `livekit_cloud`.

## Backend pinning

Every `VoiceCall` stores `metadata.mediaBackend` at session start. All room/SIP/transfer operations for that call use the pinned backend.

Never migrate an active call between backends.

## Configuration

### Admin override

```
MEDIA_BACKEND_MODE=auto            # production default
MEDIA_BACKEND_MODE=self_hosted     # force Hetzner for new app calls
MEDIA_BACKEND_MODE=livekit_cloud   # emergency manual override
```

### Self-hosted (Hetzner)

```
LIVEKIT_SELF_HOSTED_URL=wss://voice.transovo.ai
LIVEKIT_SELF_HOSTED_API_KEY=
LIVEKIT_SELF_HOSTED_API_SECRET=
LIVEKIT_SELF_HOSTED_SIP_HOST=voice.transovo.ai
LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=
LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID=
LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID=
```

### Cloud (existing vars still work)

```
LIVEKIT_URL=wss://….livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Optional explicit aliases: `LIVEKIT_CLOUD_URL`, `LIVEKIT_CLOUD_API_KEY`, etc.

### Telnyx

| Connection | Purpose |
|------------|---------|
| `Transovo LiveKit Inbound` | Production Cloud path |
| `Transovo Self-Hosted LiveKit TEST` | Single test DID only |
| `Transovo LiveKit Inbound Failover` | Primary self-hosted + secondary Cloud |

Test DID: `LIVEKIT_SELF_HOSTED_TEST_DID` (default `+18663221763`).

## Code locations

| Module | Path |
|--------|------|
| Backend config | `src/lib/voice/media-backend/config.ts` |
| Resolver + health | `src/lib/voice/media-backend/resolver.ts`, `health.ts` |
| SIP clients | `src/lib/voice/media-backend/client.ts` |
| Telnyx FQDN failover | `src/lib/voice/media-backend/telnyx-failover.ts` |
| Provisioning | `src/lib/telephony/provisioning/number-assignment.ts` |
| Health API | `GET /api/internal/media-backend/health` |

## Operations

### Audit both backends

```bash
node scripts/audit-livekit-backends.mjs
```

### Health check

```bash
curl -s "$APP_URL/api/internal/media-backend/health" | jq
```

### Self-hosted server logs (SSH)

```bash
ssh -i ~/.ssh/transovo_livekit root@$LIVEKIT_SERVER_HOST \
  'docker logs transovo-livekit-sip-1 --tail 100'
```

### Manual rollback to Cloud

1. Set `MEDIA_BACKEND_MODE=livekit_cloud` in deployment env.
2. For inbound: point Telnyx numbers to the Cloud FQDN connection, or disable failover primary.

### Server stack

- Path: `/opt/transovo-livekit/`
- Images: `livekit/livekit-server:v1.13.5`, `livekit/sip:v1.11.0`, `redis:7-alpine`, `livekit/caddyl4`
- TLS: Caddy L4 on `:443` → LiveKit `:7880`, TURN `:5349`
- SIP: UDP/TCP `:5060`, RTP `10000-20000`, WebRTC `50000-60000`

Do not expose Redis publicly.

## PSTN verification status (2026-08-24)

**Overall: `SELF-HOSTED READY FOR LIMITED TEST TRAFFIC`** — not PRIMARY until a real handset inbound PSTN call confirms Telnyx RTP.

| Test | Result | Notes |
|------|--------|-------|
| Config audit (`LIVEKIT_SELF_HOSTED_*`) | PASS | All keys present; secrets not logged |
| Test DID `+18663221763` → self-hosted FQDN | PASS | `Transovo Self-Hosted LiveKit TEST` |
| Inbound signaling (Telnyx → SIP → room → agent) | PASS | Room + agent join; `PCMU/8000` |
| Inbound two-way RTP (Telnyx Call Control API) | **FAIL** | 0 RTP packets; tcpdump confirms Telnyx sends no media on API-originated calls |
| Inbound two-way RTP (sipp loopback on server) | PASS | 747–749 RTP packets; agent audio mixed |
| Outbound PSTN (`createSipParticipant`) | PASS | 303+ RTP packets; `Outbound SIP call established` |
| Cloud PSTN retest (`+18663464256`) | PASS | New Cloud room, 2 participants |
| Telnyx FQDN failover config | PASS | Primary `voice.transovo.ai`, secondary Cloud SIP |
| Inbound failover drill (SIP stopped → Cloud) | PASS | Cloud room created with 2 participants |
| Failback / reboot persistence | PASS | Services auto-restore; post-reboot sipp loopback PASS |
| DTMF on real PSTN | NOT RUN | Blocked without handset-answered call |
| Smart Routing (Telnyx Call Control) | unchanged | Not forced through LiveKit |

### Remaining gate for PRIMARY

1. **Real inbound PSTN** from a handset to `+18663221763` (Call Control API is signaling-only).
2. Deploy PR #248 to production (pinning, health API, resolver on web + voice workers).
3. Set Coolify `LIVEKIT_SELF_HOSTED_*` on web and `transovo-voice` for test traffic.

### Suite commands

```bash
npx tsx scripts/livekit-self-hosted-pstn-suite.mjs audit
npx tsx scripts/livekit-self-hosted-pstn-suite.mjs route-test-did
npx tsx scripts/livekit-self-hosted-pstn-suite.mjs sip-loopback
MEDIA_BACKEND_MODE=self_hosted npx tsx scripts/livekit-self-hosted-pstn-suite.mjs outbound-sip-participant
npx tsx scripts/livekit-self-hosted-pstn-suite.mjs failover-drill-inbound
npx tsx scripts/livekit-self-hosted-pstn-suite.mjs final-status
```
