# transovo-bullmq-redis (Coolify)

Production Redis for BullMQ only. Not a BullMQ worker — workers run in the web container (`EMBEDDED_JOB_WORKER=1` → `worker:all`).

Operator runbook: `docs/operations/MCTB-REDIS-BULLMQ-RUNBOOK.md`

## On-server layout

- Compose: `/data/coolify/services/transovo-bullmq-redis/docker-compose.yml`
- Password: `/data/coolify/services/transovo-bullmq-redis/.redis-password` (chmod 600)
- Volume: Docker named volume `transovo-bullmq-redis_transovo-bullmq-redis-data`

Sync changes from this repo directory when updating Redis infrastructure (no secrets in Git).
