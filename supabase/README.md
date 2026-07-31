# Supabase setup (LSE-style)

This app talks to Supabase the same way Local SEO Express does — via `@supabase/supabase-js` with URL + keys for **runtime**.

**Preferred schema path (no SQL editor):** set `DATABASE_URL` (Session pooler) and run `npm run db:push`. See [docs/DATABASE.md](../docs/DATABASE.md).

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=   # Session pooler — for Prisma db push
```

## 1. Apply the schema (fallback: SQL editor)

Prefer `npm run db:push` first. If you must use the SQL editor:

### [`fresh-install.sql`](./fresh-install.sql) ← use this if you hit errors

This **drops** Transovo app tables (partial/wrong-shaped leftovers) and recreates them correctly.

Use it when you saw:
- `relation "messaging_registrations" already exists`
- `column "workspaceId" does not exist`

Those happen when an older/partial table was left behind; `CREATE TABLE IF NOT EXISTS` will not fix missing columns.

### Alternatives
- [`bootstrap.sql`](./bootstrap.sql) — idempotent create (only works if existing tables already have the right columns)
- [`schema.sql`](./schema.sql) — raw Prisma diff (fails if anything already exists)
- [`diagnose.sql`](./diagnose.sql) — list columns on key tables

Fresh empty project: `fresh-install.sql` or `bootstrap.sql` both work.

To regenerate:

```bash
npm run db:schema
npm run db:bootstrap
# then rebuild fresh-install from bootstrap (see scripts if added)
```

## 2. Env vars

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / RLS-aware client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin client (API, workers, webhooks) |

## 3. Clients in code

```ts
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPrisma } from "@/lib/db";

const sb = getSupabaseAdmin();
const { data, error } = await sb
  .from("messaging_registrations")
  .select("*")
  .eq("workspaceId", id)
  .maybeSingle();

const reg = await getPrisma().messagingRegistration.findUnique({ where: { workspaceId: id } });
```

## 4. Seed

```bash
npm run db:seed
```
