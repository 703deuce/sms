# MCTB SIP adapter — Coolify deployment (`transovo-mctb-sip`)

Third Coolify application for the Asterisk MCTB press-1 SIP path. **Separate from `transovo-voice`** — Asterisk is not in Debian 12 (`bookworm`) apt repos; the SIP image uses `debian:bullseye-slim`.

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

LiveKit SIP stays on **voice.transovo.ai:5060** via `transovo-voice`. MCTB uses **5070** on the same host IP.

---

## Coolify application settings

| Setting | Value |
|---------|--------|
| Name | `transovo-mctb-sip` |
| Repo / branch | Same as `transovo-web` / `master` |
| Build pack | **Dockerfile** |
| Base directory | Repository root (`.`) |
| Dockerfile location | `mctb-sip-adapter/Dockerfile` |
| Public domain | **None** — SIP/RTP only |
| Network mode | **`host`** (required for reliable SIP/RTP) |

### Why host networking?

Coolify’s default bridge networking does not reliably publish UDP SIP/RTP to the host. Without host mode, Telnyx hits the Hetzner IP but Asterisk inside the container is unreachable → carrier hears “disconnected” (SIP 408/404).

If host mode is unavailable on your Coolify version, publish these ports explicitly:

| Port | Protocol | Purpose |
|------|----------|---------|
| `5070` | UDP | Telnyx SIP signaling |
| `10000-10100` | UDP | RTP media for consent audio |

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `TRANSOVO_BACKEND_URL` | Yes | e.g. `https://app.transovo.ai` |
| `TRANSOVO_INTERNAL_API_KEY` | Yes | Same value as `transovo-web` / `transovo-voice` |
| `EXTERNAL_SIP_IP` | Recommended | Public IPv4 of the Hetzner host (Telnyx signals/media here) |
| `MCTB_SIP_ADAPTER_HOST` | Optional | DNS name to resolve for `EXTERNAL_SIP_IP` (default `voice.transovo.ai`) |
| `MCTB_SIP_UDP_PORT` | Optional | Default `5070` (avoids LiveKit on `5060`) |
| `RTP_START_PORT` / `RTP_END_PORT` | Optional | Default `10000`–`10100` |

**Do not copy** LiveKit, OpenAI, or full web env vars — this container only runs Asterisk + AGI.

---

## Deploy checklist

1. Create Coolify app `transovo-mctb-sip` with settings above.
2. Set env vars (`TRANSOVO_BACKEND_URL`, `TRANSOVO_INTERNAL_API_KEY`, `EXTERNAL_SIP_IP`).
3. Enable **host** network mode; redeploy.
4. Redeploy **`transovo-voice`** from latest `master` (LiveKit-only Dockerfile — no Asterisk).
5. Run Telnyx cutover:

   ```bash
   npx tsx scripts/mctb-deploy-sip-adapter-production.ts --apply
   ```

6. Verify (no phone call):

   ```bash
   npm run test:mctb-sip-adapter-e2e
   ```

   Must pass `sip_options_reachable` and `sip_server_is_asterisk`.

7. AT&T forward test on **866** (`+18663464256`).

---

## Failure isolation

| Scenario | Expected |
|----------|----------|
| Kill `transovo-mctb-sip` | MCTB press-1 path down; LiveKit / web unaffected |
| Kill `transovo-voice` | AI receptionist down; MCTB SIP path unaffected |
| Redeploy `transovo-voice` | No Asterisk build — fast, reliable |

---

## Rollback

```bash
npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply   # Call Control (wrong for AT&T forwards)
# or
npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts --apply   # LiveKit :5060
```

Stop or disable the `transovo-mctb-sip` Coolify app.

---

## Local reference

`docker-compose.mctb-sip-adapter.yml` — host networking for local/Hetzner debugging. Production uses Coolify app above.

See also: `docs/MCTB-SIP-ADAPTER.md`
