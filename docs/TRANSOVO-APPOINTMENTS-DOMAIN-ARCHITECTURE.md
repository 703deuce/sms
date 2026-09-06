# Transovo Appointments Platform — Domain Architecture

**Status:** Active domain reference for Mode 4 (appointments platform only)  
**Supersedes for Mode 4:** `docs/PRODUCT_ARCHITECTURE.md` (legacy mass-SMS campaign catalog — **not** included in Mode 4 standards pack)

---

## Core domain objects

| Object | Purpose | Primary UI surfaces |
|--------|---------|---------------------|
| **Appointment** | Scheduled occurrence | Calendar, list, detail, create |
| **AppointmentType / BookingType** | Reusable service configuration | Booking Types, type editor |
| **BookingPage** | Public booking surface | Booking Pages, `/book/[slug]` |
| **Availability** | Schedules, hours, buffers | Availability, per-type rules |
| **Contact** | Customer/person record | Contacts, detail, picker in forms |
| **ReminderSequence** | SMS reminder configuration | Reminder Sequences |
| **AppointmentWorkflow** | Lifecycle automation | Workflows list, builder, setup wizard |
| **Conversation** | SMS thread with context | Messages inbox |
| **MeetingRecap** | Notetaker output | Meetings recaps |
| **PaymentTransaction** | Appointment-related payment | Payments transactions |

---

## Product areas → routes

| Area | Routes | Engine / lib |
|------|--------|--------------|
| Home | `/appointments/overview` | Dashboard metrics APIs |
| Appointments | `/appointments/calendar`, `/appointments`, waitlist, recalls, `[id]`, `new` | Appointment booking runtime |
| Booking | `/appointments/types`, `booking`, `availability`, `ai-booking`, `routing-forms`, `polls` | Booking config + public book |
| Contacts | `/contacts`, `[id]`, lists, segments, fields, imports | Contacts CRUD |
| Messages | `/conversations`, saved-replies | `src/lib/messaging/**`, inbox |
| Automations | `/appointments/reminders`, `workflows/**`, `automations/templates`, `activity` | Reminders + `appointment-workflows` |
| Meetings | `/video`, `/meetings`, `[id]` | Video/notetaker |
| Payments | `/payments/transactions` | Stripe/payments lib |
| Analytics | `/appointments/analytics/**` | Operational metrics |
| Integrations | `/integrations/calendars`, `payments` | OAuth connections |
| Settings | `/settings/**` | Workspace config |
| Public | `/book/**`, confirm/cancel/reschedule tokens, waitlist accept | Public booking client |

---

## Explicitly not appointments-platform UI

The following are **separate legacy products** preserved in repo but excluded from Mode 4:

- Mass SMS campaigns (`/campaigns`, 14-category catalog in `src/lib/campaigns/catalog.ts`)
- Grow tools (`/grow/**`)
- MCTB / voice telephony (`/voice/**`, `src/lib/mctb/**`)
- Legacy SMS automation builder (`/automations` drip/marketing flows)

Mode 4 Kimi jobs must not reference or rebuild these surfaces.
