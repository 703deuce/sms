# MCTB SIP Adapter (Asterisk — separate Coolify app)

Minimal SIP/RTP terminator for Telnyx FQDN ingress. Deploys as **`transovo-mctb-sip`** — a third Coolify application, **not** bundled into `transovo-voice`.

> **Why separate?** `asterisk` is available on `debian:bookworm-slim` but **not** on `python:3.12-slim-bookworm`. Bundling Asterisk into the voice Dockerfile breaks Coolify builds.

## Architecture

```
AT&T conditional forward
        ↓
Telnyx FQDN (PRACK / 3PCC / ringback)
        ↓
voice.transovo.ai:5070  ← transovo-mctb-sip (Asterisk)
        ↓
POST /api/internal/voice-runtime → consent → SMS
```

LiveKit SIP stays on **voice.transovo.ai:5060** via `transovo-voice`. Asterisk uses **5070** on the same host — **no new DNS A record**.

## Coolify setup

Full steps: **`docs/deployment-mctb-sip-adapter.md`**

Summary:

| App | Dockerfile | Purpose |
|-----|------------|---------|
| `transovo-mctb-sip` | `mctb-sip-adapter/Dockerfile` | Asterisk press-1 SIP |
| `transovo-voice` | `voice-runtime-python/Dockerfile` | LiveKit worker only |

**Network mode: `host`** on `transovo-mctb-sip` (critical for UDP SIP/RTP).

## Automated verification (no phone call)

```bash
npm run test:mctb-sip-adapter-e2e
```

Checks Telnyx FQDN, voice-runtime HTTP, and SIP OPTIONS to `voice.transovo.ai:5070`.

## Telnyx cutover

```bash
npx tsx scripts/mctb-deploy-sip-adapter-production.ts --apply
```

Ensures PRACK/3PCC/ringback, points FQDN to `voice.transovo.ai:5070`, assigns **866** to the FQDN connection.

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

Then set `MCTB_SIP_ADAPTER_HOST=mctb-sip.transovo.ai` on `transovo-mctb-sip` and re-run the deploy script.

## Rollback

```bash
npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply   # Call Control
# or
npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts --apply   # LiveKit :5060
```

Stop the `transovo-mctb-sip` Coolify app.

## Standalone compose (reference only)

`docker-compose.mctb-sip-adapter.yml` — local debugging with host networking. Production uses Coolify `transovo-mctb-sip`.
