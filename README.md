# Transovo SMS

Multi-tenant business texting SaaS — campaigns, shared inbox, automations, compliance, and reporting.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (Postgres via `@supabase/supabase-js`, same env style as Local SEO Express)
- **Telnyx messaging** (A2P 10DLC brand/campaign registration, Messaging Profile sends) with a legacy Twilio ISV path kept for rollback + optional BullMQ worker

## Quick start

The app is backed by Supabase — configure the database (see below) before running.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a seeded account.

**Seeded account defaults on login page:**
- Email: `alex@harborhome.co`
- Password: `demo1234`

## Database setup (Supabase + Prisma schema push)

```powershell
cp .env.example .env
# Set:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   DATABASE_URL   ← Session pooler URI (lets Cursor push schema)
```

Apply / update all tables from `prisma/schema.prisma` (no SQL editor):

```powershell
npm run db:push
npm run db:seed
```

See **[docs/DATABASE.md](docs/DATABASE.md)**. SQL files under `supabase/` remain as a fallback only.

## Scripts

| Command | Description |
| ------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run worker:all` | Job worker (A2P advance + campaign sends) |
| `npm run db:push` | Apply Prisma schema to Postgres (preferred) |
| `npm run db:seed` | Seed a starter workspace into Supabase |
| `npm run db:schema` | Regenerate `supabase/schema.sql` from Prisma schema (dev only) |
| `npm run test:messaging-wiring` | Messaging wiring checks (needs Supabase env) |


## SMS / messaging providers

**Telnyx migration (in progress):** see **[docs/TELNYX_MIGRATION.md](docs/TELNYX_MIGRATION.md)**.

Set `MESSAGING_PROVIDER=mock|twilio|telnyx`. New customers should use Telnyx once Phase 2–3 are complete.

Telnyx env essentials: `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_MODE=live`, `APP_URL`, `CRON_SECRET`.

### Legacy Twilio ISV

See **[docs/TWILIO_ISV_MESSAGING.md](docs/TWILIO_ISV_MESSAGING.md)** (kept for rollback until Telnyx is verified).

Live Twilio env: `TWILIO_ACCOUNT_SID`, `TWILIO_ACCOUNT_AUTH_TOKEN`, `TWILIO_PRIMARY_PROFILE_SID`, `TWILIO_MODE=live`, `INTEGRATION_SECRET_KEY`.

Always-on: web app + `npm run worker:all` + minute cron → `POST /api/jobs/process`. Default without live credentials is the mock adapter.

## Application areas

### Customer app (`/dashboard`)

- **Send** — Multi-step campaign wizard, quick text, test message
- **Inbox** — Three-column shared inbox with assignment, status, notes
- **Contacts** — Lists, segments, tags, imports, consent views
- **Campaigns** — Status tabs, calendar, detail analytics
- **Automations** — Flow list, visual builder, templates, logs
- **Templates** — Campaign/inbox/compliance templates + AI generator
- **Grow** — Keywords, opt-in forms, QR codes, signup pages
- **Reports** — Overview, campaigns, messages, contacts, inbox, usage, audit log
- **Phone Numbers** — Buy, port, detail, sender pools
- **Compliance** — A2P registration, business profile, consent, suppression
- **Integrations** — API keys, webhooks, developer logs
- **Settings** — Business, messaging, users, billing, security, branding

### Platform admin (`/admin`)

Separate shell for customer management, A2P queue, message monitoring, billing, support, and platform settings.

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Demo session login |
| `/api/auth/signup` | POST | Create account + workspace |
| `/api/auth/logout` | POST | Clear session |
| `/api/workspace` | POST | Switch active workspace |
| `/api/messaging/registration` | GET/POST | A2P brand/campaign registration actions (Telnyx + legacy Twilio ISV) |
| `/api/messaging/numbers` | GET | Search available numbers |
| `/api/campaigns` | GET/POST | List/create campaigns (sequence + enroll) |
| `/api/campaigns/{id}/enroll` | POST | Enroll contacts into a campaign |
| `/api/contacts` | GET | List contacts |
| `/api/inbox` | GET | List conversations |
| `/api/sms/send` | POST | One-off SMS (ready gate on ISV path) |
| `/api/jobs/process` | POST | Minute cron drain |
| `/api/twilio/inbound` | POST | Inbound SMS webhook |
| `/api/twilio/message-status` | POST | Delivery receipts |
| `/api/twilio/compliance-status` | POST | TrustHub / Brand callbacks |
| `/r/{token}` | GET | Click tracking redirect |

## SMS provider

`src/lib/sms/provider.ts` exposes a `SmsProvider` interface. With Twilio ISV configured (`TWILIO_MODE=live` or account SID present), sends go through the workspace Messaging Service once registration is `ready`. Otherwise `StubSmsProvider` queues locally.

## Project structure

```
src/
  app/
    (auth)/          Login, signup
    (app)/           Customer dashboard (sidebar + header)
    (admin)/admin/   Platform admin
    api/             Auth, campaigns, contacts, inbox, SMS
  components/
    layout/          Sidebar, header, mobile nav, admin shell
    ui/              Buttons, tables, cards, status chips
    send/, inbox/    Feature components
  lib/
    nav.ts           Sidebar navigation config
    sms/provider.ts  SMS provider interface
prisma/
  schema.prisma      Multi-tenant data model
  seed.ts            Demo seed script
```

## Design notes

- **Send** is always visible (sidebar CTA + mobile compose FAB)
- Campaigns and Inbox are separate surfaces
- Compliance is a first-class menu item with registration status
- Bulk send always shows recipient count, SMS segments, and estimated cost
- Review step required before sending campaigns

## License

Private — Transovo SMS
