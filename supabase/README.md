# Supabase setup (LSE-style)

This app talks to Supabase the same way Local SEO Express does — via `@supabase/supabase-js` with URL + keys. **No `DATABASE_URL` / Prisma runtime.**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 1. Apply the schema

In the Supabase SQL editor, run:

**[`bootstrap.sql`](./bootstrap.sql)** ← use this (idempotent, safe if you already ran part of the schema)

If you hit `relation "…" already exists`, you started with `schema.sql` (non-idempotent). Switch to `bootstrap.sql` and re-run — it skips existing enums/tables/indexes/constraints.

Fresh empty project either file works; prefer `bootstrap.sql`.

To regenerate:

```bash
npm run db:schema
npm run db:bootstrap
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

// Idiomatic Supabase (preferred for new code)
const sb = getSupabaseAdmin();
const { data, error } = await sb
  .from("messaging_registrations")
  .select("*")
  .eq("workspaceId", id)
  .maybeSingle();

// Existing call sites keep Prisma-shaped helpers backed by Supabase
const reg = await getPrisma().messagingRegistration.findUnique({ where: { workspaceId: id } });
```

- `getSupabaseAdmin()` — service role, server only  
- `createBrowserSupabase()` — anon key, client components  
- `getPrisma()` — Supabase-backed facade for migrated Prisma call sites  

## 4. Seed

```bash
npm run db:seed
```
