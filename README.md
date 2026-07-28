# Transovo SMS

Multi-tenant business texting SaaS — campaigns, shared inbox, automations, compliance, and reporting.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Prisma 6** + PostgreSQL (schema + seed; UI uses mock data by default)
- **Stub SMS provider** (Twilio adapter placeholder behind env vars)

## Quick start (demo UI)

The app runs with seeded mock data — no database required for browsing.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with any email/password (demo mode).

**Demo account defaults on login page:**
- Email: `alex@harborhome.co`
- Password: `demo1234`

## Database setup (optional)

When you're ready to wire up Postgres:

```powershell
cp .env.example .env
# Edit DATABASE_URL in .env

npm run db:push
npm run db:seed
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema to DB |
| `npm run db:seed` | Seed demo workspace |

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

## API routes (stub)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Demo session login |
| `/api/auth/signup` | POST | Create account + workspace |
| `/api/auth/logout` | POST | Clear session |
| `/api/workspace` | POST | Switch active workspace |
| `/api/campaigns` | GET/POST | List/create campaigns |
| `/api/contacts` | GET | List contacts |
| `/api/inbox` | GET | List conversations |
| `/api/sms/send` | POST | Send via stub/Twilio provider |

## SMS provider

`src/lib/sms/provider.ts` exposes a `SmsProvider` interface. By default, `StubSmsProvider` queues messages without sending. Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` to enable the Twilio adapter stub.

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
    mock/data.ts     Demo workspace data
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
