# CRM database push — single handoff

This repo does **not** use a stack of numbered Prisma migration folders for CRM.
All CRM schema lives in **one place**: `prisma/schema.prisma`.

Pushing the database is **one command**.

## Preferred (agent with `DATABASE_URL`)

```bash
# 1) Use the CRM branch
git fetch origin cursor/crm-integration-framework-b56f
git checkout cursor/crm-integration-framework-b56f
git pull origin cursor/crm-integration-framework-b56f

# 2) Confirm Session pooler URI is present (do not print the secret)
test -n "$DATABASE_URL" || { echo "DATABASE_URL missing"; exit 1; }

# 3) Install if needed, then push entire schema (CRM + everything else)
npm ci
npm run db:push

# 4) Prove CRM tables exist
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'crm_%'
ORDER BY table_name;
SQL
```

Expected tables:

- `crm_object_mappings`
- `crm_field_mappings`
- `crm_sync_runs`
- `crm_sync_events`
- `crm_audit_logs`
- `crm_webhook_events`
- `crm_dead_letters`

Also applied by the same push:

- `integration_connections.connectedUserId`
- `integration_connections.connectedAccountName`
- `integration_connections.syncStatus`
- `job_queue.priority` (+ priority index)

## Fallback (SQL file only)

If `db:push` cannot run but Postgres SQL can:

```bash
npx prisma db execute --schema prisma/schema.prisma --file supabase/crm-integration.sql
```

Or paste `supabase/crm-integration.sql` into the Supabase SQL editor.

## What this environment must have

| Env var | Purpose |
|--------|---------|
| `DATABASE_URL` | Supabase **Session pooler** URI (port 5432). Required for Prisma. |

Do **not** use only `NEXT_PUBLIC_SUPABASE_URL` + anon/service keys for schema push — those cannot `CREATE TABLE`.

See [DATABASE.md](./DATABASE.md).

## After push

No seed is required for CRM tables (they start empty).
Workers/app that enqueue `crm_*` jobs need a redeploy that includes this branch.

## Copy/paste prompt for the DB-capable agent

```
Checkout branch cursor/crm-integration-framework-b56f, ensure DATABASE_URL
(Session pooler) is set, run `npm run db:push`, then verify public tables
matching crm_% exist. If db:push fails, run
`npx prisma db execute --schema prisma/schema.prisma --file supabase/crm-integration.sql`
and report the exact command output.
```
