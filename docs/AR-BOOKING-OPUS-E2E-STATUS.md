# Appointment Reminders booking — Opus E2E status

**Branch / deploy target:** `master` @ commit `86ab5151` (`86ab5151d9517e97de4b29633660ec3c7f546150`)

---

## What’s done (on `master` @ `86ab5151`)

### End-to-end wiring

- **Admin (Appointment Reminders → Booking):** Opus page controls link on/off, business header, SMS consent/legal, protection, **page appearance** (accent color + logo URL), and **`publicBookingProfile: simple`** (meetings/services only).
- **Runtime:** Same platform config + `schedulerTheme` the public API already uses (`/api/public/book/[slug]`).
- **Customer link (`/book/{slug}`):** Service → date/time (calendar slots) → details → payment/checkout unchanged in behavior; **simple profile** turns off AI assistant, waitlist, multi-service cart, and package/gift entitlements UI, and **filters CLASS types on the server**.

### Opus / New UI 2

| Surface | Status |
|--------|--------|
| AR Booking admin | Full Opus (`booking-page-opus.tsx`) |
| Public booking shell | Opus: muted background, `OPUS_CARD`, step indicator, loading/error states, theme accent on avatar/logo |
| Public step content | Shared booking step components (Tailwind / design tokens)—**no** `reference.css`; not a second Kimi skin |

So the **customer journey is Opus-framed**; the heavy step UIs (slot grid, intake fields) are the existing shared steps, restyled to match tokens.

### Key routes & APIs

- Admin: `/appointment-reminders/booking`
- Customer: `/book/{workspace-slug}`
- AR API: `GET/PATCH /api/appointment-reminders/booking`
- Public API: `GET/POST /api/public/book/[slug]`

### Key code paths

- `src/newui-transplant/connected/appointment-reminders/booking-page-opus.tsx`
- `src/app/api/appointment-reminders/booking/route.ts`
- `src/lib/appointments/public-booking-profile.ts`
- `src/features/appointments/kimi/public/public-booking-connected.tsx`
- `src/features/appointments/kimi/public/public-booking-opus-view.tsx`
- `src/features/appointments/kimi/public/public-booking-service-flow-inner.tsx`
- `src/newui-transplant/components/public-booking/*`

---

## Deploy / SSH

- **`git push origin master`** succeeded (`86ab5151`).
- **Coolify could not finish a new deploy** when last checked: `coolify-db` was in **Postgres recovery**, so `scripts/coolify-queue-web-deploy.sh` could not queue a build. Production health was still **`94cac976`** (previous good deploy).
- When Coolify DB is healthy, run:

```bash
COMMIT=$(git rev-parse HEAD) bash scripts/coolify-queue-web-deploy.sh --wait
```

Confirm `/api/health` → `commitSha` starts with `86ab5151`.

Full workflow: `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`

---

## Screenshots (production `transovo.ai`)

Captured during agent run (paths on the agent VM; re-capture after deploy if needed):

1. **AR Booking admin** — `/appointment-reminders/booking`  
   `/opt/cursor/artifacts/screenshots/ar-booking-admin-production.png`

2. **Customer booking — pick a service** — `/book/harbor-home`  
   `/opt/cursor/artifacts/screenshots/public-booking-production.png`

3. **Customer booking — pick date & time**  
   `/opt/cursor/artifacts/screenshots/public-booking-datetime-production.png`

On **`86ab5151`**, after deploy, the datetime step on **simple** workspaces should **no longer** show “Add service” / “Ask the assistant” (those are hidden for `publicBookingProfile: simple`). Production was still on the prior commit until Coolify accepts a deploy.

---

## How to verify after deploy

1. **Admin:** Appointment Reminders → **More → Booking** → toggle on, set appearance, save → open/copy link.
2. **Customer:** Open `/book/{slug}` → choose a meeting/service → pick slot → complete details (and pay if the type requires it).
3. **Health:** `https://transovo.ai/api/health` → `commitSha` = `86ab5151…`.

---

## Desktop layout (public booking)

The customer page is **responsive**, not phone-only:

- **Desktop:** content uses up to `max-w-7xl` shell with `max-w-5xl` (services) / `max-w-6xl` (date & time) inner width; service cards use a 2-column grid from `md` breakpoint.
- **Mobile:** stacks to a single column (unchanged).

Prior issue: inner column was capped at `max-w-lg` (~512px), which looked like a phone column on a wide monitor.

## Optional follow-up

If you want the **inner** slot/details steps rebuilt as pure Opus components (not shared step modules), that’s a larger follow-up on top of this wiring.

---

## Tests (local / CI)

```bash
npm run test:appointment-reminders
```
