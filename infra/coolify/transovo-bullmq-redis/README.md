# transovo-bullmq-redis (Coolify)

Production Redis for BullMQ only. Not a BullMQ worker — workers run in the web container (`EMBEDDED_JOB_WORKER=1` → `worker:all`).

Operator runbook: `docs/operations/MCTB-REDIS-BULLMQ-RUNBOOK.md`

## On-server layout

- Compose: `/data/coolify/services/transovo-bullmq-redis/docker-compose.yml`
- Password: `/data/coolify/services/transovo-bullmq-redis/.redis-password` (chmod 600)
- Volume: Docker named volume `transovo-bullmq-redis_transovo-bullmq-redis-data`

Sync changes from this repo directory when updating Redis infrastructure (no secrets in Git).

**Cloud Agent / CI:** `127.0.0.1:63790` on the Coolify host is loopback-only for SSH tunneling (`scripts/cloud-agent/ensure-self-hosted-redis-env.sh`). It is not exposed on the public internet.
