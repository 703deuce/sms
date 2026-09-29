# Cloud Agent — self-hosted BullMQ Redis

Production BullMQ uses Coolify `transovo-bullmq-redis`. Cloud Agents reach it via **SSH tunnel** to host loopback `127.0.0.1:63790` (not public).

## Automatic (every agent)

`.cursor/environment.json`:

- **`install`** — `npm ci` then `bootstrap-on-start.sh` (tunnel + `/workspace/.env` on every fresh install)
- **`start`** — same bootstrap (re-run after snapshot boot)
- **`terminals`** — `redis-tunnel-keeper.sh` (reopens tunnel if it drops)
- **`scripts/preload-server-only.mjs`** — overrides dashboard `REDIS_URL` (e.g. legacy Upstash) when `.env` points at the tunnel

Remove the **`REDIS_URL`** environment secret in the Cloud Agent dashboard if it still points at Upstash — bootstrap + preload are authoritative.

## Manual debug

```bash
bash scripts/cloud-agent/bootstrap-on-start.sh
```
