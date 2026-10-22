# Supabase project rebuild manifest (delete → recreate)

Use this when you **delete the paused Supabase project** and create a **new** free-tier project. It records what Transovo production expects so you can restore **schema + storage layout** (not necessarily old row data).

**Related scripts**

| Step | Script |
|------|--------|
| Snapshot before delete (no secrets in output) | `scripts/operations/capture-supabase-rebuild-inventory.sh` |
| Empty DB schema | `scripts/operations/provision-greenfield-database.sh` with `GREENFIELD_DATABASE_URL` |
| Storage buckets | `scripts/operations/ensure-all-supabase-storage-buckets.ts` |
| Optional data restore | `scripts/operations/backup-production-postgres.sh` + `postgres-restore-drill.sh` pattern |

---

## 1. What production used (last known)

| Item | Value |
|------|--------|
| Supabase project ref | `azurgysigroeizdrlxgx` |
| Region (pooler) | `aws-0-us-east-2.pooler.supabase.com` |
| Postgres | 17.x (see durability report) |
| Coolify web app UUID | `ds8s3hjin60qs6g7s0iqkixs` |
| Independent logical backup | `/data/backups/transovo-postgres/` on Coolify host |
| Last documented dump | `transovo-20260929T232329Z.dump` (~167 MiB compressed) — see `docs/MCTB-PRODUCTION-DATA-DURABILITY-FINAL-REPORT.md` |

After delete, **DNS and pooler user for that ref stop working**. You must create a **new** project and update Coolify env (section 4).

---

## 2. Database schema (authority = git)

**Do not** hand-recreate tables in the SQL editor unless migration deploy fails.

| Source | Role |
|--------|------|
| `prisma/schema.prisma` | Full application schema (Prisma models) |
| `prisma/migrations/*` | Incremental migrations applied on deploy |
| `scripts/deploy-db-migrations.sh` | Production: `npx prisma migrate deploy` when `DATABASE_URL` is set |
| `scripts/operations/provision-greenfield-database.sh` | **Empty** database: `prisma db push` + baseline `_prisma_migrations` + `migrate deploy` |

**Supabase SQL folders** (`supabase/migrations/`, `supabase/*.sql`) are **legacy / supplemental** — production path is **Prisma**. Do not rely on them alone for a full rebuild.

**Counts (repo snapshot):** ~52 Prisma migration folders under `prisma/migrations/`.

### Apply schema to a new empty project

On a machine with the repo and network access to the new database:

```bash
export GREENFIELD_DATABASE_URL='postgresql://postgres.<NEW_REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
cd /path/to/sms
GREENFIELD_ALLOW_LEGACY_HOST=1 bash scripts/operations/provision-greenfield-database.sh
```

Or point Coolify `DATABASE_URL` at the new project and **redeploy** the web container (deploy runs `scripts/deploy-db-migrations.sh`). For a **totally empty** DB, prefer `provision-greenfield-database.sh` once, then normal deploys.

### Optional: restore **data** from Coolify backup

Only if you still have a `.dump` on the server and want workspaces/users/calls back (increases size again):

```bash
# See scripts/operations/postgres-restore-drill.sh — restore into NEW project's DATABASE_URL, not legacy ref.
```

For a **clean** relaunch with minimal size: **schema only**, then re-run setup / re-seed workspaces manually.

---

## 3. Storage buckets (Supabase Storage)

Default bucket **names** (overridable via env on Coolify). Production container today only sets URL + keys — **defaults below apply**.

| Bucket | Public | Created by code | Env override |
|--------|--------|-----------------|--------------|
| `voicemail-greetings` | yes | `ensureVoicemailGreetingBucket` | `SUPABASE_VOICEMAIL_GREETINGS_BUCKET` |
| `call-recordings` | no | `ensureCallRecordingsBucket` | `SUPABASE_CALL_RECORDINGS_BUCKET` |
| `mms-media` | yes | `ensureMmsMediaBucket` | `SUPABASE_MMS_MEDIA_BUCKET` |
| `fax-documents` | no | manual / ensure script | `SUPABASE_FAX_DOCUMENTS_BUCKET` |
| `ui-references` | no | `ensureUiReferencesBucket` | `SUPABASE_UI_REFERENCES_BUCKET` |
| `visualizer-media` | no | `ensureVisualizerBucket` | `SUPABASE_VISUALIZER_BUCKET` |
| `reports` | no | uploads only (no auto-create in app) | — |

**Not Supabase:** Telnyx Cloud Storage buckets for RAG (`transovo-kb-*`, `transovo-video-*`) — separate from Supabase; see `src/lib/voice/telnyx/storage.ts`.

### Create all Supabase buckets on new project

```bash
export NEXT_PUBLIC_SUPABASE_URL='https://<NEW_REF>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/operations/ensure-all-supabase-storage-buckets.ts
```

---

## 4. Coolify environment variables (update after new project)

Set on web app `ds8s3hjin60qs6g7s0iqkixs` (and any worker using DB/Storage):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Session pooler URI from Supabase → Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<NEW_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API → anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API → service_role (server only) |

Optional bucket overrides (only if you rename buckets): see table in section 3.

**Do not** mix old ref in URL with new `DATABASE_URL`.

Redeploy web + workers after changing env. Verify:

```bash
curl -sS https://<production-host>/api/health | jq .
```

---

## 5. What you lose vs keep when deleting the project

| Kept in git / Coolify host | Lost with project delete (unless restored from dump) |
|----------------------------|-----------------------------------------------------|
| Full schema definition | All Postgres rows (users, workspaces, MCTB, calls, messages) |
| Migration history in repo | All Storage objects (greetings, recordings, MMS media) |
| Logical `.dump` on Coolify disk (if still present) | Supabase dashboard settings, auth users in Supabase Auth (if used) |
| Telnyx numbers / carrier config (Coolify env) | Realtime/Edge functions deployed only in old project |

Transovo app auth is primarily in **your** `User` / workspace tables in Postgres — restoring the logical dump restores those rows **if** you choose to restore data.

---

## 6. Recommended operator sequence

1. **Capture inventory** (on Coolify):  
   `bash scripts/operations/capture-supabase-rebuild-inventory.sh`  
   Save output under `/data/backups/transovo-rebuild-inventory/`.

2. **Confirm backup** exists: `/data/backups/transovo-postgres/transovo-*.dump`.

3. **Delete** old Supabase project in dashboard (frees quota).

4. **Create** new Supabase project (same region preferred: `us-east-2`).

5. **Apply schema**: `provision-greenfield-database.sh` with new `GREENFIELD_DATABASE_URL`.

6. **Create buckets**: `ensure-all-supabase-storage-buckets.ts`.

7. **Update Coolify** env (section 4) → redeploy.

8. **Optional:** `pg_restore` logical dump into new DB if you need production data.

9. **Smoke:** login, Agent Settings (`voiceAgent`), MCTB setup, one test call.

---

## 7. Seed / bootstrap data

| Command | When |
|---------|------|
| `npm run db:seed` | Dev/demo workspaces (see `prisma/seed.ts`) — **not** full production clone |
| Manual setup | Preferred for “brand new” production: create workspace, connect Telnyx, MCTB wizard |

---

## 8. Inventory file format

`capture-supabase-rebuild-inventory.sh` writes JSON like:

```json
{
  "event": "supabase_rebuild_inventory",
  "capturedAt": "2026-10-22T...",
  "supabaseProjectHost": "....supabase.co",
  "coolifyAppUuid": "ds8s3hjin60qs6g7s0iqkixs",
  "envVarNamesPresent": ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", ...],
  "postgresReachable": false,
  "backupDumps": ["transovo-20260929T232329Z.dump"],
  "schemaAuthority": "prisma/schema.prisma + prisma/migrations"
}
```

Store that JSON somewhere safe (password manager attachment, ticket, or `/data/backups/` on Coolify).
