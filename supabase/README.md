# Supabase setup (LSE-style)

This app is moving to the same Supabase client pattern as Local SEO Express:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 1. Apply the schema

In the Supabase SQL editor, run:

[`schema.sql`](./schema.sql)

That creates the same tables/enums Prisma used (including messaging + campaigns).

## 2. Env vars

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / RLS-aware client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin client (API, workers, webhooks) |
| `DATABASE_URL` | **Temporary** — remaining Prisma call sites + `prisma db push` |

`DATABASE_URL` is the Supabase **Postgres** connection string (Settings → Database).  
The JS keys alone are enough for `getSupabaseAdmin()` / PostgREST; Prisma still needs the URI until those call sites are fully migrated.

## 3. Clients in code

```ts
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const sb = getSupabaseAdmin();
const { data, error } = await sb.from("MessagingRegistration").select("*").eq("workspaceId", id).maybeSingle();
```

- `getSupabaseAdmin()` — service role, server only  
- `createBrowserSupabase()` — anon key, client components  

## 4. Why both keys and DATABASE_URL right now?

- **Supabase JS** (`from('Table')`) uses the URL + service/anon key (same as LSE).
- **Prisma** (legacy paths) opens a Postgres connection and therefore needs `DATABASE_URL`.

Once every `getPrisma()` call is gone, `DATABASE_URL` can be dropped from runtime env (you may still keep it for one-off SQL/migrations).
