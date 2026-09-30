# MCTB data durability and recovery runbook

**Last updated:** 2026-09-29  
**Scope:** Production MCTB + shared Transovo Postgres (Supabase), BullMQ Redis, Supabase Storage.

## Sources of truth

| Layer | Role | Recovery |
|-------|------|----------|
| **Supabase Postgres** | Permanent customer config, calls, messages, consent, `job_queue` | Supabase managed backups/PITR (when enabled) + **independent logical dumps** |
| **Supabase Storage** | Voicemail greetings, call recordings (`supabase:bucket:path` URLs) | **Not** inside Postgres dumps — bucket-level backup required |
| **BullMQ Redis** | Queue transport, delayed jobs | AOF/RDB volume + local tarball; **rebuild work** from Postgres `job_queue` outbox |
| **Coolify containers** | Disposable compute | Redeploy image; env from Coolify |

## Backup schedule

| Job | Schedule | Location | Retention |
|-----|----------|----------|-----------|
| Logical Postgres (`pg_dump -Fc`) | **03:15 UTC daily** (`/etc/crontab` on Coolify host) | `/data/backups/transovo-postgres/` | 7 daily dumps (script default) |
| Redis AOF tarball | Manual / existing host script | `/data/backups/transovo-redis/` | Operator-defined |
| Supabase managed backups | Supabase platform (verify via Management API) | Supabase infrastructure | Plan-dependent |

**Status files (no secrets):**

- `/data/backups/transovo-postgres/status/latest.json`
- `/data/backups/transovo-postgres/status/restore-drill-latest.json`
- `/data/backups/transovo-postgres/status/supabase-managed-backups.json`

**Run backup manually:**

```bash
ssh coolify-server 'bash /root/transovo-ops-scripts/backup-production-postgres.sh'
```

**Check last backup:**

```bash
ssh coolify-server 'cat /data/backups/transovo-postgres/status/latest.json'
```

## PITR

Point-in-time recovery is **Supabase-managed**. Automation requires `SUPABASE_ACCESS_TOKEN` on the Coolify app (personal access token, not service role). Until configured:

- Read managed backup/PITR state: `bash /root/transovo-ops-scripts/fetch-supabase-backup-config.sh`
- Target (not claimed achieved): RPO ≤ 15 minutes, RTO ≤ 60 minutes with PITR + runbook

## Restore Postgres (production)

**Never** `pg_restore` into production Supabase from this runbook without an explicit incident command.

1. Provision empty target (new Supabase project or local Postgres).
2. Use latest `transovo-*.dump` from `/data/backups/transovo-postgres/` (or off-host copy).
3. `pg_restore -d <target> --no-owner --no-acl transovo-*.dump`
4. Point staging app `DATABASE_URL` at target; run Prisma migrate status.
5. Verify counts (workspaces, missed calls, messages, consent events, job_queue).

**Restore drill (safe):** `bash /root/transovo-ops-scripts/postgres-restore-drill.sh` (ephemeral Docker Postgres only).

## Restore / recover objects (Storage)

| Bucket | MCTB use | Notes |
|--------|----------|-------|
| `voicemail-greetings` | Active greeting MP3 per token (public) | Also local disk fallback under `public/voicemail` when Supabase unset |
| `call-recordings` | Voicemail/call audio (`supabase:bucket:path`) | Private bucket |
| `ui-references` | Internal UI agent refs | Not customer MCTB |

Postgres rows may reference `supabase:…` URLs — restoring DB without Storage objects yields missing audio.

## Redis recovery

### Path A — Restore Redis volume

1. Stop workers/web enqueue (pause MCTB or scale workers to 0).
2. Restore `transovo-bullmq-redis-data` volume from latest `/data/backups/transovo-redis/*.tar.gz` to a **new** volume (see `docs/operations/MCTB-REDIS-BULLMQ-RUNBOOK.md`).
3. Start Redis + workers; verify queue depth.

### Path B — Rebuild from Postgres outbox

1. Start fresh Redis (empty).
2. Ensure `job_queue` rows for pending work exist in Postgres.
3. Workers call `syncDbOutboxToBullmq` on interval — republishes durable rows.
4. Smoke: `npx tsx scripts/operations/postgres-outbox-redis-rebuild-smoke.ts` (disposable job).

Customer configuration **does not** live in Redis.

## Bad deployment rollback (Coolify)

1. Note current SHA: `GET /api/health` → `commitSha`.
2. In Coolify → application → deploy previous image tag (local tags include prior SHAs, e.g. `638e0ae…`, `b48ae37…`).
3. **Do not** roll back database schema with app code — migrations are forward-only (`scripts/deploy-db-migrations.sh`).
4. Redis volume and Supabase persist across redeploys.

## Failed migration procedure

- Deploy runs `npx prisma migrate deploy` on container start when `DATABASE_URL` is set.
- On failure, script attempts known recovery paths for specific failed migrations, then retries.
- **Rule:** expand schema → deploy compatible code → backfill → contract later. Never `migrate reset` on production.

## Lost Coolify host procedure

**Survives (if configured):**

- Supabase Postgres (all customer data)
- Supabase Storage objects
- Off-host logical Postgres dumps (if `OFF_HOST_BACKUP_DESTINATION` configured)
- Git repository + Docker images in registry (GitHub)

**Lost without off-host copy:**

- Local `/data/backups/*` on old disk
- Redis queue state (recoverable from Postgres outbox for unfinished jobs)
- Coolify env secrets unless exported elsewhere

**Rebuild sequence:**

1. New VPS + Coolify (or alternate orchestrator).
2. Restore Coolify app env from secret store (DATABASE_URL, REDIS_URL, Telnyx, Stripe, Supabase keys).
3. Deploy `ds8s3hjin60qs6g7s0iqkixs` image from registry.
4. Recreate `transovo-bullmq-redis` with persistent volume (empty OK).
5. Run outbox sync / start `worker:all`.
6. Re-point Telnyx webhooks to new FQDN if DNS changed.
7. Verify `/api/health`, matrix smokes, one MCTB test call.

## Lost Redis volume procedure

See **Path B** above. Completed jobs in Postgres remain; in-flight BullMQ state is rebuilt from `job_queue`.

## Lost web container procedure

Coolify restarts container (`unless-stopped`). No customer data in container filesystem except ephemeral cache.

## Verification commands

```bash
npm run test:mctb-consolidated-nonhuman-matrix
bash scripts/run-mctb-commercial-launch-guards.sh
npx tsx scripts/bullmq-redis-hardening-smoke.ts
npx tsx scripts/operations/postgres-outbox-redis-rebuild-smoke.ts
npm run test:mctb-redis-stats
```

## Never delete (production host)

- `/data/coolify/` application `.env` and persistent volumes
- `transovo-bullmq-redis-data` Docker volume
- `/data/backups/transovo-postgres/*.dump` (until off-host verified)
- `/data/backups/transovo-redis/` tarballs
- Supabase project data

**Safe to prune:** Docker **build cache** (`docker builder prune`), unused images **after** confirming rollback tags retained.

## Disk thresholds

- **Warning:** root filesystem ≥ 75%
- **Critical:** ≥ 85%
- Monitor: `df -h /`, Redis `used_memory` vs 768MB cap
