# Supabase production cleanup (Coolify host)

Use when the Supabase **free plan** project is over the disk quota (~1 GB) and cannot resume. This keeps **schema and configuration**; it removes high-volume operational logs and terminal `job_queue` rows.

## Where to run

**Only on the Coolify server** (or any host that can read production `DATABASE_URL` from the web container or Coolify app `.env`). Cloud agents do not have those secrets.

```bash
ssh coolify-server
# Copy script from repo (or git pull in your ops checkout):
#   scripts/operations/supabase-production-cleanup.sh
chmod +x supabase-production-cleanup.sh
```

## Steps

1. **Optional but recommended:** logical backup first  
   `scripts/operations/backup-production-postgres.sh` (same host, same credential resolution).

2. **Report only (dry run):**
   ```bash
   ./supabase-production-cleanup.sh
   ```

3. **Apply safe cleanup** (default retention 14 days for logs; 7 days for dedup/probes):
   ```bash
   ./supabase-production-cleanup.sh --execute
   ```

4. **Brand-new product / maximum shrink** (drops all completed+failed jobs, all webhook/event logs listed in script — **not** workspaces, users, voice agents, MCTB config):
   ```bash
   ./supabase-production-cleanup.sh --execute --aggressive
   ```

5. If connection fails with **tenant not found** on the pooler, try direct DB host:
   ```bash
   TRANSOVO_PG_DUMP_USE_DIRECT=1 ./supabase-production-cleanup.sh
   ```

6. In **Supabase dashboard**: confirm **Database + Storage** usage under 1 GB, then **Resume** project. Reconcile `DATABASE_URL` in Coolify with the dashboard **Session pooler** string if the ref changed.

7. Redeploy web app; verify Prisma (e.g. Agent Settings loads).

## What is not deleted

- Migrations / tables / indexes (schema intact)
- `Workspace`, users, billing, `voice_agents`, MCTB setup tables, contacts, conversations (unless you add custom SQL)
- Pending `job_queue` work (`pending`, `processing`, `deferred`)

## Storage (files)

Supabase **object storage** (voicemail, recordings, `ui-references`) counts toward the same quota. This script does **not** empty buckets. After DB cleanup, delete unused objects in **Storage** in the dashboard or add a separate task with `SUPABASE_SERVICE_ROLE_KEY`.

## Project ref

Production has used ref `azurgysigroeizdrlxgx` (see `docs/MCTB-PRODUCTION-DATA-DURABILITY-FINAL-REPORT.md`). If the project was recreated, update Coolify `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` together.

## Paused project / DNS dead (current production state)

If `psql` reports `tenant/user postgres.<ref> not found` **and** `db.<ref>.supabase.co` does not resolve, the Supabase project is not accepting connections. SQL cleanup on Coolify **cannot run** until either:

1. **Dashboard:** reduce **Database** and **Storage** usage below the free tier limit and **Resume** (sometimes you can delete Storage objects while paused), or  
2. **Support:** ask Supabase to allow a one-time resume for cleanup, or  
3. **New project:** create a fresh Supabase project under 1 GB, restore the latest logical dump from `/data/backups/transovo-postgres/` (`backup-production-postgres.sh`), point Coolify `DATABASE_URL` + Supabase keys at the new project, redeploy.

Independent backup on Coolify (when it last succeeded) is documented in `docs/MCTB-PRODUCTION-DATA-DURABILITY-FINAL-REPORT.md`.

## Install on server

From a machine with the repo:

```bash
scp scripts/operations/supabase-production-cleanup.sh coolify-server:/tmp/
ssh coolify-server 'bash /path/to/install-coolify-supabase-cleanup.sh /tmp/supabase-production-cleanup.sh'
```
