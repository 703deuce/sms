<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Next.js 16 SMS SaaS. Node 22 + npm. Standard commands live in `package.json`/`README.md` (`npm run dev` on :3000, `npm run lint`, `npm run build`). The UI runs on seeded mock data with no DB — log in with `alex@harborhome.co` / `demo1234`.

Database (non-obvious):
- Runtime DB is **hosted Supabase** via `@supabase/supabase-js` (env `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). There is **no `DATABASE_URL`, no `psql`, and no direct Postgres access from the VM** — DDL cannot be applied from here. Apply schema by pasting SQL into the **Supabase SQL editor**: `supabase/fresh-install.sql` (fresh/drops) or `supabase/add-timestamps.sql` (idempotent patch).
- The data layer `src/lib/supabase/prisma-compat.ts` (`prepareData`) stamps `createdAt`+`updatedAt` on **every** insert/update for **all** models, so every table must have both columns or writes fail with `PGRST205/PGRST204`. If you add a table/model, add both columns in the SQL.
- Seed demo workspace `ws_1`: `npm run db:seed`.

Messaging modes (`src/lib/messaging/twilio-config.ts` → `getMessagingMode()`):
- `live` (`MESSAGING_ADAPTER=twilio` or truthy `TWILIO_MODE`): real Twilio ISV — needs full A2P to reach "ready".
- `mock` (both unset): no Twilio calls; registration reaches "ready" after submit + number purchase.
- `test` (`TWILIO_MODE=test` **and** `MESSAGING_ADAPTER=test`): mock A2P for "ready", but real Twilio Messages API sends using **test credentials** (`TWILIO_TEST_ACCOUNT_SID`/`TWILIO_TEST_AUTH_TOKEN`) + magic sender `+15005550006` (simulated success, no delivery/charge). Magic destination numbers simulate failures.

Backend tests (both need the DB schema applied):
- `npm run test:messaging-wiring` — full mock pipeline (registration → send → campaign → STOP → webhooks).
- `npm run test:backend-send` — send pipeline in **test mode** (needs `TWILIO_TEST_*` creds); proves ready gate → real Twilio test-credential send → DB status.

Worker/cron: `npm run worker:all` (BullMQ when `QUEUE_DRIVER=bullmq`+`REDIS_URL`, else DB `job_queue`); minute cron is `POST /api/jobs/process` with `Authorization: Bearer $CRON_SECRET`.
