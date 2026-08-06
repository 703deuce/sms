<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Standard commands live in `README.md` and `package.json` scripts (`dev`, `lint`, `db:push`, `db:seed`, `worker:all`). Notes below are only the non-obvious caveats for this VM.

### The app requires a live Supabase (PostgREST) backend
Despite what `README.md` says, the app does **not** run on mock data. Every dashboard/admin page and `login`/`signup` reads/writes through `getPrisma()` (a PostgREST-backed shim in `src/lib/supabase/prisma-compat.ts`) and throws if Supabase env is missing. Only the marketing/legal pages and the `/login` form render without a DB.

Local dev uses a **local Supabase stack** (Docker) instead of a hosted project. Config is committed at `supabase/config.toml`; local credentials live in `.env` (gitignored, already created on this VM). The local anon/service keys are the standard Supabase demo keys and are stable across restarts — regenerate `.env` from `supabase status -o env` if they ever change.

### Fresh-VM startup sequence (services are NOT auto-started)
1. Start the Docker daemon — there is no systemd/init here, so it will not be running on boot:
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`
2. Start local Supabase from the repo root: `supabase start` (Postgres :54322, API/PostgREST :54321, Studio :54323).
3. Start the app: `npm run dev` (serves on port 3000). Optional job worker: `npm run worker:all`.

### After applying schema, PostgREST needs grants + a cache reload
`npm run db:push` creates tables as the `postgres` role **without** Supabase role grants, so PostgREST returns `permission denied for table ...`. After any `db:push`, run against the DB container (`docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres`):
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
```

### Demo login
`npm run db:seed` inserts the `alex@harborhome.co` user/workspace but does **not** set a password hash, so login fails out of the box. Set one to log in as the demo user:
`node -e "console.log(require('bcryptjs').hashSync('demo1234',10))"` then `UPDATE "User" SET "passwordHash"='<hash>' WHERE email='alex@harborhome.co';`

### Known pre-existing bug: writes fail on tables without `updatedAt`
`prepareData()` in `src/lib/supabase/prisma-compat.ts` sets `updatedAt` on **every** insert/update, but most tables in `prisma/schema.prisma` (e.g. `User`, `Workspace`, `Contact`, `Campaign`, `Message`) have no `updatedAt` column. PostgREST then rejects the write with `Could not find the 'updatedAt' column ... in the schema cache`. This breaks signup and most create/update flows. Writes currently succeed only on tables that do have `updatedAt`: `Conversation`, `AutomationFlow`, `job_queue`, `campaign_recipients`, `campaign_messages`, `messaging_registrations`, `integration_webhook_events`. This is application/schema debt, not an environment problem.

### Lint / build caveats
`npm run lint` scans `supabase/.temp/` after `supabase start` and reports ~150 spurious errors from generated edge-runtime code; lint the app itself with `npx eslint src`. The source has pre-existing lint debt (mostly `@typescript-eslint/no-explicit-any`), so `npm run build` (which runs eslint + type checks) fails on committed code — use `npm run dev` for development.
