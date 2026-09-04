# Appointments Core Scheduling Parity — Implementation Status

Updated: 2026-09-04 (customer-facing implementation pass)

## Customer-Facing Surfaces — Implemented

| Area | Status | Location |
|------|--------|----------|
| Staff management UI | IMPLEMENTED | `/appointments/staff` — `staff-connected.tsx` |
| Round robin / assignment UI | IMPLEMENTED | Appointment Types → Advanced → Staff assignment |
| Staff-specific availability UI | IMPLEMENTED | Staff page weekly hours editor with time inputs |
| Locations UI | IMPLEMENTED | `/appointments/locations` |
| Routing UI | IMPLEMENTED | `/appointments/routing` |
| Recurring booking (public) | IMPLEMENTED | `public-booking-client.tsx` + book API |
| Group/capacity (public) | IMPLEMENTED | Slot remaining display + seat picker |
| Waitlist join (public) | IMPLEMENTED | Waitlist step + `/api/public/book/[slug]/waitlist` |
| Payment/deposit checkout | IMPLEMENTED | Stripe checkout session + webhook routing |
| Custom booking questions | IMPLEMENTED | Type editor + `BookingQuestionField` on public booking |
| Cancellation/reschedule policies | IMPLEMENTED | Appointment Types → Advanced → Policies |
| Internal notes | IMPLEMENTED | Appointment detail + PATCH API |
| Booking limits | IMPLEMENTED | Availability page + per-type limits in type editor |
| Google Calendar connection UI | IMPLEMENTED | `/appointments/integrations` + availability embed |
| Workflow UI | IMPLEMENTED | `/appointments/workflows` with conditions + staff actions |
| AI booking UI | IMPLEMENTED | Public booking AI step + `/api/public/book/[slug]/ai` |
| Staff notifications | IMPLEMENTED | Workflow actions `send_sms_staff` / `send_email_staff` |

## Domain Foundations (prior pass — preserved)

- Appointment workflows (isolated), 7 prebuilt templates, job queue execution
- AI parsing architecture with deterministic fallback
- Scheduling domain: round robin, routing, limits, capacity, recurring, waitlist
- External busy-time / calendar provider abstraction

## Requires Runtime/Browser Certification Only

- End-to-end Stripe checkout with live `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- Google Calendar OAuth with live `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`
- Microsoft Outlook OAuth with live credentials
- Visual QA of all appointment admin pages and public booking flows

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Appointment payment checkout sessions |
| `STRIPE_WEBHOOK_SECRET` | Payment completion webhook (routes via `/api/webhooks/stripe`) |
| `GOOGLE_CALENDAR_CLIENT_ID` | Google Calendar OAuth connect |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google Calendar OAuth connect |
| `OPENAI_API_KEY` | Live AI natural-language booking (fallback parser works without it) |
| `BREVO_API_KEY` | Workflow email actions (`BREVO_FROM_EMAIL` also required when set) |

## Explicitly Preserved

- SMS Playbooks, Drips, Flow Builder, Mass SMS, MCTB
- Existing reminder worker, booking APIs, double-booking locks
- Subscription billing architecture (appointment checkout is separate)
