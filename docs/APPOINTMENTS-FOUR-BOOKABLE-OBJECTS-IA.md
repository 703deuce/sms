# Appointments — Four Bookable Objects IA

**Status:** Active (2026-09-10)  
**Scope:** Customer-facing Booking navigation and admin surfaces

## Customer mental model

Users manage **Meetings**, **Services**, **Classes**, and **Workshops** directly — not a generic "Booking Types" hub or archetype chooser.

## Final Booking nav (admin)

Under **Booking**:

1. Meetings → `/appointments/meetings`
2. Services → `/appointments/services`
3. Classes → `/appointments/classes`
4. Workshops → `/appointments/workshops`
5. Booking Pages → `/appointments/booking`
6. Share & embed → `/appointments/booking/share`
7. Commerce / routing / polls (unchanged supporting items)

**Removed from normal nav:** Booking Types (`/appointments/types` — redirect only)

## Backend mapping

| Customer object | Internal storage | List route | Editor |
|-----------------|------------------|------------|--------|
| Meeting | `VoiceService` + `config.bookingTypeKind: MEETING` | `/appointments/meetings` | Locked `AppointmentTypesConnected` |
| Service | `VoiceService` + `config.bookingTypeKind: SERVICE` | `/appointments/services` | Locked `AppointmentTypesConnected` |
| Class | `ClassSeries` (`metadata.kind: class`) | `/appointments/classes` | `ClassSeriesAdminConnected` |
| Workshop | `ClassSeries` (`metadata.kind: workshop`) | `/appointments/workshops` | `ClassSeriesAdminConnected` |

Public booking URLs are unchanged (`/book/[slug]`, `/book/[slug]/classes`, etc.).

## Core rules

- No generic type chooser inside Meetings/Services/Classes/Workshops create flows
- No customer-facing "archetype" language on canonical pages
- Shared backend abstractions preserved (`VoiceService`, `ClassSeries`, eligibility runtime)
- Workshop is the customer label; internal `event` metadata values remain valid

## Legacy hub

`/appointments/types` → redirects to `/appointments/services` or canonical route when `?id=` is present.
