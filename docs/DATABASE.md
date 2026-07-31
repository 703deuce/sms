# Database control (Prisma + Supabase)

## Goal

Cursor (and you) can create/update tables by editing `prisma/schema.prisma` and running:

```bash
npm run db:push
```

You should **not** need the Supabase SQL editor for day-to-day schema work.

## Two different connections

| Purpose | Env var | Supabase UI |
|---|---|---|
| App reads/writes data at runtime | `NEXT_PUBLIC_SUPABASE_URL` + anon + **service_role** | Project Settings → API |
| Schema push / Prisma | `DATABASE_URL` | Connect → **Session pooler** URI |

Runtime still uses the Supabase JS client. Schema management uses Prisma → Postgres.

## One-time setup (new project)

1. Create the Supabase project.
2. Copy API keys into env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Copy the **Session pooler** connection string into `DATABASE_URL`.
4. URL-encode password special characters (`!` → `%21`, `@` → `%40`, `#` → `%23`).
5. From the repo:

```bash
npm run db:push
```

That creates every table/enum/index from `prisma/schema.prisma`.

6. Optional seed:

```bash
npm run db:seed
```

## Day-to-day schema changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push`
3. Commit the schema change

For production deploys with migration history later:

```bash
npm run db:migrate   # local / create migration
npm run db:deploy    # CI / production
```

## Where to put secrets

### Coolify (Hetzner) — production app

In your Coolify service → **Environment Variables**, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Session pooler URI — needed if any deploy/start script runs `db:push`; also useful for one-off Prisma tasks)
- `APP_URL` / `NEXT_PUBLIC_APP_URL` (your public Coolify domain, e.g. `https://transovo.ai`)

Redeploy after saving env vars so the container picks them up.

### Cursor Cloud — so the agent can push schema

Add the same vars (especially `DATABASE_URL`) in the Cursor Cloud **environment / secrets** for this repo. That is what lets Cursor run `npm run db:push` without you using the Supabase SQL editor.

Do **not** commit passwords. Do **not** paste live DB passwords into chat.

## Why not only Project URL + publishable key?

Those talk to Supabase’s HTTP API. They cannot run `CREATE TABLE`. Prisma needs a real Postgres URI (`DATABASE_URL`).
