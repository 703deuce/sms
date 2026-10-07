# Appointment Reminders — what controls the public booking page?

Use this with `docs/AR-BOOKING-OPUS-E2E-STATUS.md`.

---

## Short answers

| Question | Answer |
|----------|--------|
| Does booking still **work end-to-end**? | **Yes** — same runtime as before (`/api/public/book/[slug]`, availability, hold, book, Stripe/Square checkout). AR did not replace that engine. |
| Is everything **Opus** components? | **Not yet.** AR admin = Opus. Public page = **Opus shell** (header, footer, card, steps, loading) + **shared step modules** (`ServiceStep`, `DateTimeStep`, `InfoStep`) — Tailwind/design tokens, not Kimi `reference.css`. Full Opus rewrite of every step is a separate project. |
| Does **AR → Booking** control everything customers see? | **No.** It controls **page-level** settings (on/off, branding, business info, consent, protection, simple vs full profile). **Services, prices, slots, staff, locations, intake, add-ons** are controlled elsewhere (mostly Appointments). |
| Do we need 4–5 new pages? | **No.** Keep one AR **Booking** page + use existing Appointments editors via links, **or** add **one** future AR page: “Bookable services” (simple list/edit for meeting/service types only). |

---

## What customers see on `/book/{slug}` (and what runs it)

| Customer UI | Still works? | Controlled by (canonical) | On AR Booking page today? |
|-------------|--------------|---------------------------|---------------------------|
| List of services | Yes | **Appointment types** (enabled, name, duration, description, `bookingTypeKind`, payment on type) | **No** — only preview list |
| Price / deposit / checkout | Yes | **Type `config.payment`** + merchant/Stripe setup | **No** |
| Pick location | Yes | **Locations** on platform config + type `locationIds` | **No** |
| Pick staff | Yes | **Staff** + type `staffAssignment` | **No** |
| Calendar / time slots | Yes | **Availability** (weekly hours, calendars linked to types, scheduling rules) | **No** |
| Contact form + SMS consent | Yes | **Consent/legal** on platform config | **Yes** |
| Terms checkbox | Yes | **termsText / termsVersion** | **Yes** (consent panel) |
| Intake questions / forms | Yes | **Intake forms** + type `intakeFormIds` | **No** |
| Add-ons | Yes (full profile) | **Booking add-ons** | **No** |
| Package / gift / wallet / loyalty | Yes (full profile) | **Commerce entitlements** lookup at checkout | **Hidden** when `publicBookingProfile: simple` (AR default) |
| Recurring series | Yes (full profile) | **Type recurring config** | **No** |
| Multi-service / cart / AI / waitlist | Yes (full profile) | Flow features | **Hidden** in **simple** profile |
| Class / group schedules | Yes (if types exist) | **CLASS** types + `/book/{slug}/classes` | **CLASS hidden** from list in **simple**; deep URLs may still exist |
| Store / memberships | Yes | `/book/{slug}/store` etc. | **Not** on AR Booking page |

**Simple profile (AR default):** meeting + service types only on the main list; checkout can still charge **card** when payment is set on the type — you do **not** lose paid booking.

---

## Screens that actually control booking (today)

### Inside Appointment Reminders (Opus)

| Route | Controls |
|-------|----------|
| `/appointment-reminders/booking` | Booking on/off, public link, business display, consent/legal, protection, accent/logo, `publicBookingProfile: simple` |

### Still in full Appointments product (routes work; may be outside AR sidebar)

| Route | Controls |
|-------|----------|
| `/appointments/types` (and type editor) | **Services** — name, duration, price, payment, staff, locations, intake, recurring, enabled |
| `/appointments/booking` | Legacy Kimi booking hub (link, hub cards, advanced) — overlaps AR Booking |
| `/appointments/booking/branding` | Theme/CSS (AR Booking now has basic appearance) |
| `/appointments/booking/forms` | Intake forms |
| `/appointments/booking/share` | Share/embed links |
| Availability / calendars (Appointments setup) | **When** slots appear (not the same as AR **Calendars** import for SMS reminders) |

### Shared / Settings

| Route | Controls |
|-------|----------|
| `/settings/business` | Workspace **slug** (required for `/book/{slug}`) |
| Payments / merchant integration | Whether checkout succeeds |

---

## Opus vs “old” components (accurate)

| Layer | Status |
|-------|--------|
| AR Booking admin | **Opus** (`booking-page-opus.tsx`) |
| Public `BookingShell` header/footer | Shared component, **widened** (`max-w-7xl`), Opus-aligned styling |
| Public step indicator + states | **Opus** (`newui-transplant/components/public-booking/*`) |
| Service / date-time / details steps | **Shared** `kimi-ui/public-booking-service` step files — **not** Kimi page CSS; functionally the same booking engine |
| Target if you want “100% Opus” | Rebuild `ServiceStep`, `DateTimeStep`, `InfoStep`, `DoneStep` under `newui-transplant/` and swap imports — **no API changes** |

---

## Recommendation (no disconnect, minimal new IA)

1. **Keep** all existing booking/commerce APIs and type config — do not rip out packages/payments.
2. **AR Booking** = customer-facing **page** settings + simple profile (what you have).
3. **Add links** on AR Booking (not new products): “Manage bookable services” → `/appointments/types` (filter meeting/service), optional “Advanced booking” → `/appointments/booking` for power users.
4. **Optional one AR page later:** “Bookable services” — single table + drawer (name, duration, price, on/off) writing the same APIs — avoids 4–5 pages.

---

## Verification checklist

1. Type exists, **enabled**, kind **MEETING** or **SERVICE**, payment configured if you expect charge.
2. AR Booking: **enabled**, slug set, save appearance.
3. Open `/book/{slug}` → pick service → slot → submit → confirm appointment (and payment if required).
4. If something still shows that you do not want (yoga class, store): check type kind (CLASS), or switch workspace to **simple** profile and disable/remove that type.
