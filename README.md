# Transovo AI SMS

Multi-tenant business texting SaaS — campaigns, shared inbox, automations, compliance, AI voice, softphone, and reporting.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (Postgres via Prisma / `@supabase/supabase-js`)
- **Telnyx** messaging + voice (A2P 10DLC, Messaging Profile, Call Control). Legacy Twilio ISV path retained for rollback.

## Quick start

Configure the database before running:

```bash
npm install
cp .env.example .env
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL (Session pooler)
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seeded login (after `npm run db:seed`):**
- Email: `alex@harborhome.co`
- Password: `demo1234`

## Database

Prefer Prisma schema push (no SQL editor):

```bash
npm run db:push
npm run db:seed
```

See **[docs/DATABASE.md](docs/DATABASE.md)**. SQL under `supabase/` (including `finish-everything-fields.sql`) is a manual fallback.

## Scripts

| Command | Description |
| ------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run worker:all` | Job worker (campaigns, recurrence, digests, voice) |
| `npm run db:push` | Apply Prisma schema to Postgres |
| `npm run db:seed` | Seed starter workspace |
| `npm run test:messaging-wiring` | Messaging wiring checks |

## Messaging / voice providers

**Telnyx-first.** Set `MESSAGING_PROVIDER=telnyx` with `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_MODE=live`, `APP_URL`, `CRON_SECRET`. Voice also needs `TELNYX_CONNECTION_ID`.

Optional: `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, VAPID keys for web push, calendar OAuth for bookings.

See **[docs/TELNYX_MIGRATION.md](docs/TELNYX_MIGRATION.md)** and **[docs/VOICE_WORKER.md](docs/VOICE_WORKER.md)**.

Legacy Twilio ISV: **[docs/TWILIO_ISV_MESSAGING.md](docs/TWILIO_ISV_MESSAGING.md)**.

Always-on: web app + `npm run worker:all` + minute cron → `POST /api/jobs/process`.

## Application areas

### Customer app (`/dashboard`)

- **Send** — Campaign wizard, quick text, AI composer
- **Inbox** — Shared inbox, saved replies, MMS, presence
- **Contacts** — Lists, segments, tags, imports, cleanup
- **Campaigns** — Sequences, recurrence, lifecycle controls
- **Automations** — Visual builder, keywords, templates
- **Grow** — Forms, popups, contests, QR, contact cards, surveys
- **Phone** — Softphone, call history, queues, IVR
- **AI Voice** — Agents, calendars, campaigns, recordings
- **Numbers** — Buy, port, assignments, sender pools
- **Compliance** — Brand/campaign registration, consent
- **Integrations** — Stripe, Google, HubSpot, Shopify, Salesforce, Calendly, webhooks, API keys
- **Settings** — Branding, billing, users/invites, 2FA, messaging keywords, limits

### Platform admin (`/admin`)

Customers, A2P queue, billing, support tickets, platform settings (plans, flags, maintenance, trial).

## Key API routes

| Route | Description |
|-------|-------------|
| `/api/auth/login` | Session login (password + optional TOTP) |
| `/api/auth/signup` | Create account + workspace (trial limits) |
| `/api/messaging/registration` | A2P brand/campaign registration |
| `/api/campaigns` | List/create/enroll campaigns |
| `/api/sms/send` | One-off SMS |
| `/api/telnyx/messaging` | Telnyx SMS webhook |
| `/api/telnyx/voice` | Telnyx Call Control webhook |
| `/api/webhooks/stripe` | Stripe billing, text-to-pay, premium number purchases |
| `/api/jobs/process` | Cron job drain |

## Project structure

```
src/
  app/
    (auth)/          Login, signup, invite accept
    (app)/           Customer dashboard
    (admin)/admin/   Platform admin
    (public)/        Maintenance, mock checkout
    api/             REST + webhooks
  components/        Feature UI
  lib/               Domain services (messaging, voice, billing, phone, …)
prisma/
  schema.prisma
  seed.ts
supabase/            SQL fallbacks
```

## Deploy notes (Coolify)

Set the same secrets in Coolify and any Cursor Cloud Environment. Apply schema with `npm run db:push` (or run the additive SQL files). Point Telnyx messaging + voice webhooks at your `APP_URL`.
