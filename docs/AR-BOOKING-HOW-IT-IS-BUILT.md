# How public booking is built (what you must create first)

Customers use **one link**: `/book/{workspace-slug}`. That page does not define services by itself — it reads data you create in the workspace.

## The chain (in order)

```
1. Workspace slug          →  /settings/business
2. Booking page ON         →  Appointment Reminders → Booking (toggle)
3. Appointment type(s)     →  voiceService rows (“services” / “events”)
4. (Optional) Hours/staff  →  /appointments/availability or type editor
5. Customer books          →  POST /api/public/book/{slug}
6. Reminders (AR product)  →  uses the appointment + phone from step 5
```

### 1. Workspace slug

Without a slug, there is no `/book/...` URL.

### 2. Booking enabled

`AppointmentPlatformConfig.bookingEnabled` must be `true`. AR Booking turns this on when you enable the public page.

### 3. Appointment types (this is what shows on “Pick a service”)

Each bookable offering is an **appointment type** stored as a `voiceService` row:

| Field | Meaning |
|--------|---------|
| `name` | Label on the public list |
| `durationMinutes` | Length of the appointment |
| `config.enabled` | `false` hides the type |
| `config.bookingTypeKind` | `MEETING` or `SERVICE` for AR simple profile; `CLASS` is filtered off the main simple list |
| `config.visibility` | `public` (default) vs `unlisted` / `secret` |

**AR simple profile** only lists **MEETING** and **SERVICE** types that are **enabled**.

Create types (same editors as Appointments, under AR shell):

- **Appointment Reminders → Booking → Services** — `/appointment-reminders/booking/services`
- **Appointment Reminders → Booking → Meetings** — `/appointment-reminders/booking/meetings`

Legacy Appointments URLs (`/appointments/services`, `/appointments/meetings`) still work and edit the same data.

### 4. Time slots

Slots come from the **availability engine** (`generateNativeSlots`):

- Platform **weekly hours** (default Mon–Fri 9:00–17:00 if you never set hours), and/or
- Per-type **booking hours**, staff calendars, locations, notice windows, etc.

If the service list works but **no times** appear, open **Availability** (`/appointments/availability`) or edit the type’s hours — not the AR Booking branding page.

### 5. Checkout / subscriptions

- **Pay at booking** is configured on the **appointment type** (`config.payment`), plus merchant setup under Pricing & payments.
- **Packages / memberships / store** use other routes (`/book/{slug}/store`, etc.) and stay in the full Appointments product; AR **simple** profile hides most of that UI on the main flow but does not delete the backend.

## Quick “nothing shows” checklist

| Symptom | Likely cause |
|---------|----------------|
| 403 / “Booking page disabled” | Turn on booking in AR → Booking |
| Empty service list | No enabled MEETING/SERVICE types — create one |
| Services but no times | Hours, staff assignment, or notice rules — check Availability / type |
| Wrong items (classes, store) | Types still CLASS or full profile / deep links |

## APIs (for engineers)

| Action | API |
|--------|-----|
| Load public page data | `GET /api/public/book/[slug]` |
| Create type from AR | `POST /api/appointment-reminders/booking/types` |
| Create type (full product) | `POST /api/appointments/types` |
| AR page settings | `GET/PATCH /api/appointment-reminders/booking` |
