# MCTB SIP Adapter (Asterisk sidecar)

Minimal SIP/RTP terminator for Telnyx FQDN ingress. Replaces LiveKit as the **signaling endpoint** only — all MCTB business logic stays in `transovo-web`.

## Architecture

```
AT&T conditional forward (Diversion)
        ↓
Telnyx FQDN 3022029259041408870
  third_party_control_enabled: true
  prack_enabled: true
  generate_ringback_tone: true
        ↓
Asterisk sidecar on existing Hetzner host (this container)
  Progress() → 183 early dialog
  Answer → play consent URL → gather digit 1
        ↓
POST /api/internal/voice-runtime
  resolve_mctb_sip_session
  record_mctb_sip_press_1_consent
        ↓
existing consent → SMS pipeline
```

**Not** routed through Coolify's HTTP reverse proxy. SIP and RTP need direct host exposure.

## What this container does

| Does | Does not |
|------|----------|
| SIP UAS (100/180/183/PRACK/200/ACK) | Workspace resolution |
| RTP playback of consent audio URLs | SMS sending |
| DTMF gather (one digit) | Consent storage logic |
| HTTP calls to voice-runtime API | Contacts, analytics, Telnyx messaging |

## Deploy on Hetzner (same host as transovo-web)

### 1. DNS

Create an A record, e.g. `mctb-sip.transovo.ai` → Hetzner public IPv4.

### 2. Firewall

Open on the host (not via Coolify proxy):

- UDP/TCP **5060** (SIP)
- UDP **10000–10100** (RTP)

### 3. Environment

On the host (or Coolify env file for this compose only):

```bash
EXTERNAL_SIP_IP=203.0.113.10          # Hetzner public IPv4
TRANSOVO_BACKEND_URL=https://app.transovo.ai
TRANSOVO_INTERNAL_API_KEY=...         # same as transovo-voice
MCTB_SIP_ADAPTER_HOST=mctb-sip.transovo.ai
```

Optional:

```bash
MCTB_SIP_UDP_PORT=5060
MCTB_RTP_START_PORT=10000
MCTB_RTP_END_PORT=10100
TELNYX_SIP_IDENTIFY_IPS=0.0.0.0/0    # tighten to Telnyx signaling CIDRs in prod
```

### 4. Start container

```bash
docker compose -f docker-compose.mctb-sip-adapter.yml up -d --build
```

Uses `network_mode: host` so Asterisk advertises `EXTERNAL_SIP_IP` correctly.

### 5. Point Telnyx FQDN (866 first)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  MCTB_SIP_ADAPTER_HOST=mctb-sip.transovo.ai \
  EXTERNAL_SIP_IP=203.0.113.10 \
  npx tsx scripts/mctb-point-fqdn-to-sip-adapter.ts --e164 +18663464256 --apply
```

This:

1. Ensures PRACK/3PCC/ringback on the FQDN connection
2. Creates/sets primary FQDN destination to your SIP host
3. Assigns `+18663464256` to the FQDN connection (off Call Control)

**Do not touch 571 until 866 passes 10/10.**

## Certification

```bash
npx tsx scripts/mctb-certify-sip-adapter.ts --e164 +18663464256
```

### Gate 1 — SIP signaling

Capture pcap on the host during an AT&T conditional-forward test. Compare to a known-good LiveKit baseline:

- INVITE → 100 Trying → 183 Session Progress → PRACK/200 → 200 INVITE → ACK → RTP → DTMF → BYE

Enable Asterisk SIP logging:

```bash
docker exec -it <container> asterisk -rx 'pjsip set logger on'
```

**Do not assume default Asterisk behavior matches LiveKit.** The whole point of this spike is proving equivalence on real AT&T forwards.

### Gate 2 — MCTB backend

After press-1:

- `metadata.path = asterisk_sip_mctb`
- `missedCallEvent` + consent + SMS for ws_1

### Gate 3 — Repeatability

10 consecutive conditional-forward calls: CDR duration > 5s, no SIP 480, no `ORIGINATOR_CANCEL` at ~400ms.

## Rollback

1. Re-point 866 to Call Control or LiveKit FQDN:

   ```bash
   npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply   # Call Control path
   # or
   npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts --apply   # LiveKit path
   ```

2. Stop sidecar: `docker compose -f docker-compose.mctb-sip-adapter.yml down`

## Relationship to other paths

| Path | Status |
|------|--------|
| LiveKit FQDN → Python worker | Known-good SIP baseline |
| Call Control → mctb-event-only | May work for some routes; **not** equivalent to FQDN SIP UAS for AT&T 183/PRACK |
| TeXML mctb-consent | Deprecated for forwarded legs |
| **This adapter** | Target replacement for LiveKit SIP layer |

## Approved test phones

Only use workspace-approved test handsets (see internal MCTB runbook — not committed here).
