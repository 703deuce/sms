# MCTB booking simplification audit

Supersedes the earlier MCTB light-calendar plan. MCTB is **not** a scheduling product; booking is contextual only (booking links + AI Booking upgrade).

## Summary flags

```
FULL_SCHEDULER_BACKEND_DELETED = NO
MCTB_INTERNAL_CALENDAR_UI = 0
MCTB_INTERNAL_APPOINTMENT_UI = 0
MCTB_APPOINTMENT_REMINDER_UI = 0
```

| Flag | Value |
|------|-------|
| `FULL_SCHEDULER_BACKEND_DELETED` | **NO** |
| `MCTB_INTERNAL_CALENDAR_UI` | **0** (no nav; legacy routes redirect) |
| `MCTB_INTERNAL_APPOINTMENT_UI` | **0** (no nav; legacy routes redirect) |
| `MCTB_APPOINTMENT_REMINDER_UI` | **0** (reminders removed from MCTB) |

## Removed MCTB surfaces

| Old nav item | Old route prefix | Shared backend preserved? | Booking-link replacement | AI Booking replacement | Route behavior |
|--------------|------------------|---------------------------|--------------------------|-------------------------|----------------|
| Calendar | `/mctb/calendar` | Yes — `/appointments`, `/api/calendar/*` | Send Booking Link in Conversations; links in Setup → Recovery | Calendly / Microsoft when upgrade enabled | Redirect → `/mctb/conversations` |
| Appointments | `/mctb/appointments` | Yes — full appointments product | Same | Provider-backed conversational book (future runtime) | Redirect → `/mctb/conversations` |
| Booking Setup | `/mctb/booking` | Yes — appointments booking setup | `MctbBookingLink` CRUD under Setup → Recovery | AI Booking config stub under Recovery | Redirect → `/mctb/setup/recovery` |
| Reminders | `/mctb/reminders` | Yes — appointments reminders engine | None in MCTB (provider handles notifications) | N/A | Redirect → `/mctb/setup/recovery` |

## Current MCTB navigation

- Overview, Missed Calls, Conversations, Voicemail, Analytics, Setup
- Shared: Payments (`/payments`), Integrations (`/integrations`)

## Booking capabilities (in product)

1. **Booking link** — `MctbBookingLink` (`/api/mctb/booking-links`), managed in Setup → Recovery, sent from Conversations via `send_booking_link`.
2. **Optional recovery link** — `MissedCallTextConfig.defaultLinkUrl` + `{{link}}` template variable; toggled from Recovery booking section.
3. **AI Booking** — upgrade-gated UI placeholder; must use real Calendly/Microsoft integrations (see provider matrix). Never invent availability; fallback to booking link.

## Canonical scheduler (unchanged)

Do not delete or narrow:

- `/appointments/*`, meetings, classes, packages, memberships
- Calendar integrations (Google, Microsoft, Calendly adapters)
- Appointment reminders and workflows outside MCTB shell

## Legacy route pages

Redirect-only Next.js pages remain for bookmark compatibility:

- `src/app/(app)/mctb/calendar/page.tsx`
- `src/app/(app)/mctb/appointments/**/page.tsx`
- `src/app/(app)/mctb/booking/**/page.tsx`
- `src/app/(app)/mctb/reminders/page.tsx`

Helper: `src/lib/mctb/removed-scheduling-routes.ts`

## Feature modules (not mounted by MCTB routes)

Legacy UI under `src/features/mctb/booking/**` may remain for reference; MCTB routes no longer import them.

## Tests

- `scripts/test-mctb-booking-simplification.ts`
- `scripts/test-mctb-nav-ia.ts`
- `scripts/test-mctb-product-chrome.ts`
- `scripts/test-cross-surface-ownership-audit.ts`
