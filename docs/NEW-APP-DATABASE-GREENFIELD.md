# Greenfield database for `new-app` (schema mirror, no data copy)

**Decision:** Do **not** wipe the legacy production Postgres. Provision a **new** database that matches the **same Prisma schema** as today (empty tables, full migration history). Point **`new-app`** and future ported APIs at the greenfield URL. Keep the legacy DB online as read-only archive until you explicitly decommission it.

This is **not** `pg_dump` / `pg_restore` of rows. It is **`prisma migrate deploy`** against a fresh Postgres (new Supabase project or new database on your host).

---

## Two databases, two roles

| | Legacy | Greenfield |
|---|--------|------------|
| **Purpose** | Historical production data, old monolith if still needed | Clean slate for Transovo `new-app` + rewired workers |
| **Env (suggested)** | `LEGACY_DATABASE_URL` on Coolify (saved from old `DATABASE_URL`) | `DATABASE_URL` → `.../transovo_greenfield` (default name `transovo_greenfield`) |
| **Data** | Unchanged | Empty after provision (except `_prisma_migrations`) |
| **Schema** | Current production | Same migration chain from `prisma/migrations/` in this repo |
| **Supabase API** | Existing project keys | **New project** recommended (API + Storage isolated) |

Schema authority is always **`prisma/schema.prisma`** + **`prisma/migrations/`** in git — not “whatever legacy happens to have drifted.” After deploy, run parity check against legacy if legacy is still the reference runtime.

---

## What gets cloned vs what does not

| Cloned (structure) | Not copied |
|--------------------|------------|
| Tables, columns, indexes, enums, FKs via migrations | Workspaces, users, phone numbers, MCTB/AR rows |
| `_prisma_migrations` rows on greenfield (applied by deploy) | Redis / BullMQ queue payloads |
| | Supabase Storage objects (voicemail, media) |
| | Telnyx number inventory on carrier |

Optional later: **selective** data migration (e.g. one platform sender row) is a separate scripted step — not part of greenfield provision.

---

## Operator workflow

### 1. Create empty Postgres (same Supabase project)

**Preferred:** Second database on the **same** Supabase Postgres instance as legacy (legacy data stays in `postgres`, greenfield in `transovo_greenfield`).

```bash
# From Cloud Agent (uses Coolify app .env for credentials; does not print secrets)
bash scripts/operations/bootstrap-greenfield-on-coolify.sh

# Recreate from scratch after a failed attempt
GREENFIELD_RECREATE=1 bash scripts/operations/bootstrap-greenfield-on-coolify.sh
```

Manual equivalent on any host with `psql` + repo:

```bash
export COOLIFY_ENV_FILE=/path/to/coolify/.env   # or LEGACY_DATABASE_URL=...
bash scripts/operations/create-greenfield-database-same-instance.sh
export GREENFIELD_DATABASE_URL="$(cat /tmp/transovo-greenfield-database.url)"
GREENFIELD_ALLOW_LEGACY_HOST=1 npm run db:provision-greenfield
```

**Alternate:** New Supabase project → Session pooler URI → `GREENFIELD_DATABASE_URL` (only if `CREATE DATABASE` is not available on your plan).

### 2. Apply schema (no data)

From repo root, against the **greenfield** URL only:

```bash
export GREENFIELD_DATABASE_URL='postgresql://...same-host.../transovo_greenfield'
GREENFIELD_ALLOW_LEGACY_HOST=1 npm run db:provision-greenfield
```

Empty databases use **`prisma db push`** (full `schema.prisma`), then baseline `_prisma_migrations`, then `migrate deploy` — because migration files in this repo are incremental after the original baseline.

**Do not** point this at legacy production unless you intend to mutate that database.

### 3. Verify schema parity (read-only)

Compare `public` table/column definitions between legacy and greenfield:

```bash
export LEGACY_DATABASE_URL='postgresql://...'      # current prod / archive
export GREENFIELD_DATABASE_URL='postgresql://...'  # new empty DB
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/operations/verify-greenfield-schema-parity.ts
```

Exit code `0` = structural match. Fix drift by deploying latest `master` migrations to whichever side is behind.

### 4. Wire Coolify `new-app`

When `new-app` gains Prisma/server routes:

| Service | `DATABASE_URL` |
|---------|----------------|
| Legacy monolith (if still running) | `LEGACY_DATABASE_URL` |
| **`new-app` web** | `GREENFIELD_DATABASE_URL` |
| SMS/voice workers (after cutover) | `GREENFIELD_DATABASE_URL` |

Until cutover, **omit** `DATABASE_URL` on `new-app` (see `docs/COOLIFY-NEW-APP-WEB.md`) so deploy does not touch any database.

If greenfield uses a **new Supabase project**, also set new `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` on services that need Storage or Supabase client — do not mix old project keys with new `DATABASE_URL` unless you know they share one project.

### 5. Redis / workers

Greenfield DB does not clear Redis. When workers first use greenfield:

- Stop workers during cutover, or
- Run `scripts/operations/fresh-start-flush-bullmq-redis.mjs` with `EXECUTE=1` **only** when you accept losing queued jobs (does not delete legacy DB).

### 6. Bootstrap tenant data

Create workspaces, users, and platform sender through **provisioning code** or controlled seeds — not by copying legacy rows wholesale.

---

## npm shortcuts

```bash
# Apply migrations to GREENFIELD_DATABASE_URL
npm run db:provision-greenfield

# Parity check (requires both URLs)
npm run db:verify-greenfield-parity
```

---

## Deprecated approach: wipe legacy in place

In-place tenant wipe (`docs/NEW-APP-DATABASE-FRESH-START.md`, `fresh-start-wipe-tenant-data.ts`) is **not** the current plan. Use greenfield unless you explicitly choose wipe after backup.

---

## Safety

- `provision-greenfield-database.sh` refuses to run without `GREENFIELD_DATABASE_URL`.
- Set `GREENFIELD_ALLOW_LEGACY_HOST=1` only when you intentionally reuse the same hostname with a **different database name** (not same database as production).
- Parity script is **SELECT-only** on both URLs.
- Take a legacy **backup** before any cutover that changes worker `DATABASE_URL`, even if you do not wipe.
