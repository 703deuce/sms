# Supabase project rebuild manifest (delete → recreate)

Use this when you **delete the paused Supabase project** and create a **new** free-tier project. It records what Transovo production expects so you can restore **schema + storage layout** (not necessarily old row data).

**Related scripts**

| Step | Script |
|------|--------|
| Snapshot before delete (no secrets in output) | `scripts/operations/capture-supabase-rebuild-inventory.sh` |
| Empty DB schema | `scripts/operations/provision-fresh-supabase-project.sh` (uses Coolify’s `DATABASE_URL` + Supabase keys) |
| Storage buckets | `scripts/operations/ensure-all-supabase-storage-buckets.ts` |
| Optional data restore | `scripts/operations/backup-production-postgres.sh` + `postgres-restore-drill.sh` pattern |

---

## Account-level access (for Cloud Agent / automation)

The agent **does not** have your Supabase dashboard login. It can SSH to **Coolify** and call **HTTPS APIs** only.

To manage **all projects** (reset DB password, reveal API keys, pooler host, wire Coolify) from the server, add one secret to Coolify (or pass once for a run):

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) — create a **scoped** token with **Projects**, **Database config (read/write)**, and **API keys (read)** for org/projects you use, or a classic PAT for the same account |

Then on the host (or Cloud Agent with token in env):

```bash
export SUPABASE_ACCESS_TOKEN='sbp_...'
export SUPABASE_PROJECT_REF='ztccppxodhgdyejkuuax'
export SUPABASE_DB_PASSWORD='your-chosen-db-password'
bash scripts/operations/supabase-wire-project-via-management-api.sh
# feed output into coolify-update-supabase-env.sh + redeploy
```

**Publishable key + guessed DB password are not enough** — they cannot reset Postgres or reveal the **secret** key. That requires the account PAT or manual copy from the dashboard.

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

**Same variable names as production** — update **values** in Coolify (or export the same names when running a one-shot on the server). Do not add new env keys.

1. In Coolify, set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the **new** project (from Supabase dashboard).

2. One-shot schema + buckets (from repo root, env loaded from Coolify web container or your shell):

```bash
# Same names the app already uses:
export DATABASE_URL='postgresql://postgres.<NEW_REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
export NEXT_PUBLIC_SUPABASE_URL='https://<NEW_REF>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'
cd /path/to/sms
bash scripts/operations/provision-fresh-supabase-project.sh
```

3. **Redeploy** the web container (deploy also runs `scripts/deploy-db-migrations.sh` when `DATABASE_URL` is set).

For an empty database, run step 2 once before or right after the first deploy so `db push` / migration baseline is applied cleanly.

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

## 4. Coolify environment variables (values only — names unchanged)

Update **values** on web app `ds8s3hjin60qs6g7s0iqkixs` (and any worker using DB/Storage). Keep the exact same keys the app already reads:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Session pooler URI from Supabase → Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<NEW_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API → **anon** or **publishable** key (paste either into this slot — do not add a new Coolify key unless you also set publishable for other tools) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API → **service_role** / **secret** key (server only) |

Copy **`DATABASE_URL`** from Supabase → **Connect** → **Session pooler** (do not hand-assemble the URI; password special characters must match the dashboard string exactly).

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

5. **Update Coolify** env (section 4) — same keys, new Supabase values.

6. **Apply schema + buckets**: on the host with the same `DATABASE_URL` / Supabase env as Coolify, run `provision-fresh-supabase-project.sh`; then **redeploy** web + workers (deploy runs migrations too).

7. **Optional:** `pg_restore` logical dump into the new `DATABASE_URL` if you need production data.

8. **Smoke:** login, Agent Settings (`voiceAgent`), MCTB setup, one test call.

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
