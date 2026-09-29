# MCTB production data durability — final report

**Date:** 2026-09-29 (UTC)  
**Evidence:** Live Supabase + Coolify inspection, logical backup + restore drill executed on host (non-destructive).

---

## PRODUCTION SUPABASE

| Field | Value |
|-------|--------|
| **Project** | Ref `azurgysigroeizdrlxgx` (matches `NEXT_PUBLIC_SUPABASE_URL` on production web container) |
| **Plan** | **Not readable via API** — `SUPABASE_ACCESS_TOKEN` not present on Coolify app env (Management API blocked) |
| **Region** | `us-east-2` (inferred from pooler host `aws-0-us-east-2.pooler.supabase.com`) |
| **Postgres** | **17.6** (from `pg_dump` server version check) |
| **App connection** | Session pooler `:5432`, user `postgres.<ref>` — matches production web container `DATABASE_URL` |
| **Database size (logical dump)** | **~167 MiB** compressed custom dump (`174,650,889` bytes); **11** workspaces, **330k+** `job_queue` rows at backup time |
| **Backup frequency (managed)** | **Unknown** — requires Management API |
| **Retention (managed)** | **Unknown** |
| **Latest successful backup (managed)** | **Unknown** |
| **PITR** | **Unknown** — cannot enable/verify without `SUPABASE_ACCESS_TOKEN` |
| **Recovery window** | **Unknown** |
| **Current RPO (independent logical)** | **≤ 24 hours** (daily cron **03:15 UTC**); first manual backup completed **2026-09-29T23:26:02Z** |
| **Current RPO (managed)** | **Unknown** — do not assume |
| **Estimated RTO (independent logical)** | **~1 hour** operator time (retrieve dump + restore to new DB + reconfigure `DATABASE_URL`) — restore drill restore phase **~55s** for 167 MiB into empty local Postgres |
| **Target RPO/RTO** | ≤ 15 min / ≤ 60 min — **not achieved** without verified PITR + runbook practice |

**Cross-check:** Production web container uses the same pooler URL; restore drill row counts match live DB (`workspace` 11, `missed_call_events` 73, `job_queue` 330240, etc.).

---

## POSTGRES INDEPENDENT BACKUP

| Field | Value |
|-------|--------|
| **Configured** | **YES** — `scripts/operations/backup-production-postgres.sh` on Coolify at `/root/transovo-ops-scripts/` |
| **Schedule** | **Daily 03:15 UTC** (`install-coolify-backup-cron.sh` → `/etc/crontab`) |
| **Destination** | `/data/backups/transovo-postgres/` (on Coolify host) |
| **Retention** | 7 daily dumps (script default) |
| **Latest successful** | `transovo-20260929T232329Z.dump` — **167 MiB**, duration **153s**, `pg_restore -l` **OK** |
| **Verified** | **YES** — `postgres-restore-drill.sh` **PASS** |

**OFF_HOST_BACKUP_DESTINATION_REQUIRED** — no `OFF_HOST_BACKUP_DESTINATION`, S3, or rclone remote found in authorized env. **Do not** keep the only independent dump on the Coolify disk long term.

---

## POSTGRES RESTORE DRILL

| Field | Value |
|-------|--------|
| **Backup** | `transovo-20260929T232329Z.dump` |
| **Temporary destination** | Ephemeral Docker `postgres:17-alpine` (`transovo-pg-restore-drill`) |
| **Restore duration** | **~55 seconds** (excluding backup transfer) |
| **Tables/data classes verified** | `Workspace`, `missed_call_events`, `Conversation`, `ConversationMessage`, `job_queue`, `smart_routing_sms_consent_events` — counts only, no PII in logs |
| **Result** | **PASS** |

---

## OBJECT STORAGE

| Asset class | Provider | Bucket | DB reference | Backup in PG dump? | Restore strategy |
|-------------|----------|--------|--------------|-------------------|------------------|
| Voicemail greetings | Supabase Storage (+ optional local disk) | `voicemail-greetings` (public) | Greeting token paths / URLs | **No** | Re-upload or bucket replication |
| Voicemail/call recordings | Supabase Storage | `call-recordings` (private) | `supabase:bucket:path` in `recordingUrl` | **No** | Bucket backup / Supabase export |
| Consent audio | Smart routing audio assets + TeXML play URLs | DB + `/api/public/smart-routing-audio/` | `audioAssetId` in workspace/MCTB config JSON | **Metadata only** | Regenerate/publish from config |
| MCTB uploads (non-VM) | Mostly Postgres JSON | — | `customFieldsConfig`, setup tables | **Yes** (in dump) | Restore with Postgres |
| UI references | Supabase Storage | `ui-references` | Internal | **No** | Low priority for MCTB |

**Supabase Storage versioning:** not enabled by default — treat buckets as needing **independent** object backup for disaster recovery.

---

## REDIS

| Field | Value |
|-------|--------|
| **Local backup** | `/data/backups/transovo-redis/redis-aof-snapshot-20260929T131522Z.tar.gz` (~34 KiB) |
| **Off-host backup** | **Not configured** |
| **AOF/RDB** | Enabled on `transovo-bullmq-redis`, 768MB cap, `noeviction` |
| **Total-loss rebuild from Postgres** | **PASS** — `postgres-outbox-redis-rebuild-smoke.ts` (`syncDbOutboxToBullmq` republish → job `completed`) |
| **Paths** | **A:** restore volume tarball · **B:** empty Redis + outbox sync |

---

## STRAY CONTAINER

| Field | Value |
|-------|--------|
| **compassionate_lalande** | One-off Cloud Agent retry container (old image `638e0ae…`), **bridge** network, **no** Traefik/Coolify labels |
| **Purpose** | Ad-hoc `npx tsx` retry script (not production web) |
| **Traffic** | **None** (not on `coolify` network) |
| **Worker** | **No** `worker:all` — single-shot script |
| **Action taken** | **Stopped and removed** |

---

## DISK

| Field | Value |
|-------|--------|
| **Before** | **~70–73%** used on `/` (~101G / 150G) |
| **After** | **~73%** (build cache prune reported 0B reclaimable in this pass) |
| **Largest consumers** | Docker images ~34GB, build cache ~56GB (monitor) |
| **Cleanup** | `docker builder prune` attempted; **no** volume/image deletion |
| **Alerts** | Documented: warn **75%**, critical **85%** |

---

## DEPLOYMENT ROLLBACK

| Field | Value |
|-------|--------|
| **Current SHA** | `ad7ca4aa7271…` (`/api/health`) |
| **Known-good SHA** | Prior local images on host include `638e0ae`, `b48ae37`, `3b945c1`, etc. |
| **Rollback method** | Coolify → deploy previous image tag for app `ds8s3hjin60qs6g7s0iqkixs` |
| **DB compatibility** | Migrations forward-only; rollback app **without** reversing schema |

---

## LOST-HOST RECOVERY

| Question | Answer |
|----------|--------|
| **Can we rebuild MCTB on a clean host?** | **YES**, if Supabase + secrets + DNS/Telnyx are intact |
| **Expected data loss** | **None** for Postgres/Storage (cloud); **queue in-flight state** rebuildable from `job_queue`; **local-only backups** lost without off-host |
| **Expected recovery time** | **Hours** (new VPS, Coolify, redeploy, Redis recreate, webhook verification) |
| **Remaining dependencies** | Coolify env secrets export, off-host dumps, Telnyx ingress URLs, Stripe, Brevo |

---

## OPERATOR ACTIONS REQUIRED

1. **SUPABASE_OWNER_ACTION_REQUIRED** — Add `SUPABASE_ACCESS_TOKEN` (personal access token) to Coolify app env → run `fetch-supabase-backup-config.sh` → enable/verify **PITR** if included in plan; document managed backup timestamps.
2. **OFF_HOST_BACKUP_DESTINATION_REQUIRED** — Provide S3/R2/B2/SFTP or rclone remote for:
   - `transovo-*.dump` (Postgres logical)
   - `redis-aof-snapshot-*.tar.gz` (secondary)
3. **Deploy `master`** — includes ops scripts in repo; sync `/root/transovo-ops-scripts/` from repo on deploy or copy after merge.

---

## PRODUCTION-DATA-DURABILITY READY

**NO** — Blockers:

- Managed Supabase backup/PITR state **not verified** (missing `SUPABASE_ACCESS_TOKEN`).
- Independent Postgres backup **not off-host**.
- Object storage **not** independently backed up.

**Progress:** Proven **logical backup + restore drill** on production data snapshot.

---

## READY FOR PAYING CUSTOMER DATA

**YES with conditions** — Postgres can be recovered via proven logical dump; Supabase platform + Storage still need owner token and off-host copies for full disaster tier.

---

## READY FOR MCTB GOLDEN PATH

**YES** — `npm run test:mctb-consolidated-nonhuman-matrix` **61/61 PASS** (functional layer unchanged).
