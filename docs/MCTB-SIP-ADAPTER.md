# MCTB SIP Adapter (Asterisk in transovo-voice)

Minimal SIP/RTP terminator for Telnyx FQDN ingress. **Deploys with `transovo-voice`** on git push — no separate Docker commands, no firewall work for the spike.

## Architecture

```
AT&T conditional forward
        ↓
Telnyx FQDN (PRACK / 3PCC / ringback)
        ↓
voice.transovo.ai:5070  ← Asterisk in transovo-voice container
        ↓
POST /api/internal/voice-runtime → consent → SMS
```

LiveKit SIP stays on **voice.transovo.ai:5060**. Asterisk uses **5070** on the same host — **no new DNS A record**.

## What you do NOT need to do

- Run `docker compose` manually
- Open new firewall rules for this spike (same host/IP as existing voice SIP)
- Create a new A record (uses existing `voice.transovo.ai`)
- Touch 571 until 866 passes 10/10

## What deploys automatically

| Piece | How |
|-------|-----|
| Asterisk + AGI | Bundled in `voice-runtime-python/Dockerfile` |
| Coolify rebuild | Git push to `master` → `transovo-voice` rebuilds |
| Telnyx FQDN + 866 | Cloud agent runs `scripts/mctb-deploy-sip-adapter-production.ts --apply` |

## One Coolify env var (transovo-voice)

Add on the existing **transovo-voice** app (same place as `LIVEKIT_URL`, etc.):

```
MCTB_SIP_ADAPTER_ENABLED=1
```

`TRANSOVO_BACKEND_URL` and `TRANSOVO_INTERNAL_API_KEY` are already set on voice.

`MCTB_SIP_ADAPTER_ENABLED` defaults to `1` in the voice Dockerfile for the current MCTB spike. Set `0` to disable without redeploying Asterisk bits.

Redeploy happens automatically after merge when Coolify picks up the new Dockerfile.

## Cloud agent cutover (Telnyx)

```bash
npx tsx scripts/mctb-deploy-sip-adapter-production.ts --apply
```

This ensures PRACK/3PCC/ringback, points FQDN to `voice.transovo.ai:5070`, assigns **866** to the FQDN connection.

## Certification

```bash
npx tsx scripts/mctb-certify-sip-adapter.ts --e164 +18663464256
```

Gate 1: SIP pcap (183/PRACK/200/ACK/RTP/DTMF) vs LiveKit baseline on AT&T forward.  
Gate 2: press-1 → `asterisk_sip_mctb` → SMS.  
Gate 3: 10/10 calls, no SIP 480.

## Optional: separate hostname later

Only if you want a dedicated SIP hostname (not required for the spike):

| Field | Value |
|-------|-------|
| **Type** | `A` |
| **Name / Host** | `mctb-sip` |
| **FQDN** | `mctb-sip.transovo.ai` |
| **Value / Points to** | Same IPv4 as `voice.transovo.ai` |
| **TTL** | `300` (or provider default) |
| **Proxy / CDN** | Off (DNS only — no Cloudflare proxy) |

Then set `MCTB_SIP_ADAPTER_HOST=mctb-sip.transovo.ai` on transovo-voice and re-run the deploy script.

## Rollback

```bash
npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply   # Call Control
# or
npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts --apply   # LiveKit :5060
```

Set `MCTB_SIP_ADAPTER_ENABLED=0` on transovo-voice.

## Standalone compose (reference only)

`docker-compose.mctb-sip-adapter.yml` remains for local debugging. Production uses transovo-voice bundle.
