# Production operations scripts

Run on the **Coolify host** (or CI with equivalent secrets). Never commit credentials.

| Script | Purpose |
|--------|---------|
| `backup-production-postgres.sh` | Logical `pg_dump -Fc` → `/data/backups/transovo-postgres/` |
| `postgres-restore-drill.sh` | Restore latest dump into ephemeral Postgres; verify counts |
| `fetch-supabase-backup-config.sh` | Supabase managed backup/PITR via Management API (`SUPABASE_ACCESS_TOKEN`) |
| `install-coolify-backup-cron.sh` | Daily 03:15 UTC backup cron |
| `redis-offhost-sync.sh` | Copy Redis tarball when `OFF_HOST_BACKUP_DESTINATION` is set |

**Production host install path:** `/root/transovo-ops-scripts/` (copy from repo after deploy).

**Status:** `docs/MCTB-PRODUCTION-DATA-DURABILITY-FINAL-REPORT.md`
