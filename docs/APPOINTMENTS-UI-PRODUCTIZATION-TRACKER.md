# Appointments UI Productization Tracker

**Authority:** Transovo UX standards pack + UI directives (features 1–48) + zero-gap addendum (49–176) + functional activation directive.  
**Rule:** Backend/API existence ≠ feature complete. Each row needs discoverable UI, full functional chain, and browser evidence.

**Functional chain:** UI → API → domain → DB → provider/job → authoritative state → UI refresh → browser UAT

## Worksheet template (required before each feature)

| Field | |
|-------|---|
| Feature | |
| Primary user | |
| Primary user goal | |
| Canonical home | |
| Existing backend/runtime | |
| Existing UI | |
| Missing UI | |
| Business-owner workflow | |
| Staff workflow | |
| Customer workflow | |
| Important states | |
| Inheritance/override rules | |
| Dependencies | |
| Browser UAT | |
| Files/components to reuse | |

## Priority waves

| Wave | Features | Focus |
|------|----------|--------|
| **A** | 1–4, 8–13, 20, 33, 46 | Shipped: scheduling rules UI, locations nav, invoices, branding hub |
| **B (active)** | 5–7, 15–19, 49–58 | Availability platform, contracts, type editor gaps |
| **C** | 24–32, 35–44, 59–94 | Commerce, classes, portal, appointments ops |
| **D** | 95–176 | Workflows, analytics, integrations depth, cross-links |
| **E** | 48, 145–146, AK–AL | Provider-blocked honest UI only |

## Status ledger

| # | Feature | Canonical home | UI status | Notes |
|---|---------|----------------|-----------|-------|
| 1 | Fixed start times | Availability → Schedules | PARTIAL → **IN PROGRESS** | List editor replacing raw comma field |
| 2 | Custom start interval | Availability → Advanced | PARTIAL → **IN PROGRESS** | Preset + custom + example copy |
| 3 | Visible availability density | Availability → Advanced | PARTIAL → **IN PROGRESS** | Business-language toggle + % select |
| 4 | Minimize gaps | Availability → Advanced | PARTIAL → **IN PROGRESS** | Radio + helper text |
| 5 | Service phases | Booking Types → Duration | PARTIAL | Type editor exists; DELETE + timeline pending |
| 6 | Multi-service booking | Public scheduler | PARTIAL | Summary wired; per-line staff pending |
| 7 | Multi-staff per line | Public + appointment detail | PARTIAL | |
| 8 | Locations management | Availability → Locations | PARTIAL → **IN PROGRESS** | Nav discoverability |
| 9 | Location hours | Location editor | PARTIAL | Single window/day; overrides pending |
| 10 | Location timezone | Location editor | GOOD | |
| 11 | Location staff | Location editor | PARTIAL | Checkbox list exists |
| 12 | Location resources | Location editor | PARTIAL | Checkbox list exists |
| 13 | Resource quantity | Booking → Resources | PARTIAL | Editor added in commerce tab |
| 14 | Resource pools | Booking → Resources | THIN | |
| 15 | Add-ons | Booking Types / Commerce | PARTIAL | |
| 16 | Intake forms | Booking config | PARTIAL | Builder exists; public assign pending |
| 17 | Intake file upload | Public checkout | PARTIAL | Routes exist |
| 18 | Terms & conditions | Booking type policies | THIN | |
| 19 | Contracts + e-sign | Booking → Contracts | PARTIAL → **IN PROGRESS** | Admin templates + public sign page |
| 20 | Booking QR | Booking → Share | GOOD | GET image fix deployed |
| 21 | Custom domain | Booking Pages → Appearance | THIN | Backend field; UI pending wave A |
| 22 | Custom CSS | Booking Pages → Advanced | THIN | |
| 23 | Custom terminology | Booking Pages → Language | THIN | |
| 24–32 | Commerce / POS | Payments / Booking commerce | PARTIAL | POS needs contact picker |
| 33 | Invoices | Payments → Invoices | PARTIAL | Admin page + public pay; Stripe link when appointment linked |
| 34 | Refunds | Payments → Transaction detail | PARTIAL | Refund modal exists |
| 35–41 | Classes / waitlist / tickets | Appointments / Classes | PARTIAL | |
| 42–44 | Portal / manage / recurring | Public | PARTIAL | Manage link core exists |
| 45 | Calendar colors | Calendar settings + type editor | THIN | |
| 46 | Booking brand hub | Booking Pages unified | PARTIAL | Cross-links in progress |
| 47 | Commerce cross-links | Contextual | PARTIAL | |
| 48 | Provider-blocked channels | Integrations | THIN | Honest disconnected states |

**UI status:** NONE | THIN | PARTIAL | GOOD | IN PROGRESS

## Addendum ledger (49–176) — summary

| Range | Domain | Typical status | Canonical home |
|-------|--------|----------------|----------------|
| 49–55 | Weekly hours, notice, horizon, overrides, blackouts, holidays, limits | **GOOD/PARTIAL** | `/appointments/availability` — Kimi weekly hours + booking rules + limits panels exist |
| 56 | External calendar blocking | **PARTIAL** | Integrations → Calendars + availability context card |
| 57 | Slot diagnostics | **PARTIAL → IN PROGRESS** | Availability → Diagnose panel wired to `/api/appointments/diagnostics/slots` |
| 58 | Dynamic pricing | **THIN** | Booking type → Payments advanced |
| 59–62 | Staff, assignment modes, round robin, groups | **PARTIAL** | `/appointments/types` TypeEditorPanel + staff routes |
| 63–71 | Categories, images, visibility, order, durations, questions, confirmation, booking pages | **PARTIAL** | `/appointments/types`, `/appointments/booking` |
| 72–74 | Single-use links, direct links, embed | **PARTIAL** | `/appointments/booking/share` + advanced panel |
| 75 | UTM attribution | **THIN** | Appointment detail + analytics |
| 76 | Named schedules | **PARTIAL** | Availability → named schedule section |
| 77–78 | Client restrictions, segments | **PARTIAL** | `/appointments/client-restrictions`, `/appointments/segments` |
| 79–80 | Booking approval + queue | **PARTIAL** | Type editor + appointments list filter |
| 81–82 | OTP, returning customer | **PARTIAL/STUB** | Public book API paths exist; UI depth varies |
| 83–89 | Payments (Stripe/Square/modes/PWYW/card/deposit/balance) | **PARTIAL** | Integrations + type editor + manage link |
| 90–92 | Edit intake, ICS, book again | **PARTIAL** | Manage appointment client |
| 93–100 | Appointments list/new/detail/reschedule/cancel/notes/status | **PARTIAL** | `/appointments/*` Kimi surfaces |
| 101–102 | Policy snapshot, calendar sync status | **THIN** | Appointment detail sections needed |
| 103–105 | Portal history sections | **PARTIAL** | `/portal/[token]` |
| 106–110 | Coupons, programs, plans, wallet, loyalty | **PARTIAL** | Commerce admin + POS |
| 111–116 | Classes series/occurrence/enrollment/seats/capacity | **PARTIAL** | `/appointments/classes` |
| 117 | Waitlist priority | **PARTIAL** | `/appointments/waitlist` |
| 118–120 | Recalls, campaigns, no-show recovery | **PARTIAL** | `/appointments/recalls`, automations |
| 121–127 | Reminders + SMS consent | **PARTIAL** | `/appointments/reminders` |
| 128–134 | Workflows | **PARTIAL** | `/appointments/workflows` |
| 135–141 | Analytics + exports + scheduled reports | **PARTIAL** | `/appointments/analytics` |
| 142 | Global search | **PARTIAL** | Overview search |
| 143–146 | Calendar + payment integrations + diagnostics | **PARTIAL** | `/integrations/*` |
| 147 | Roles/permissions | **PARTIAL** | Settings → Team |
| 148–152 | Contacts, fields, household, merge, import | **PARTIAL** | `/contacts` |
| 153 | Conversations | **GOOD** | `/conversations` |
| 154–155 | Webhooks | **THIN** | Commerce webhooks tab |
| 156–159 | Overview, mobile nav, setup wizard, modules | **PARTIAL** | Shell + `/appointments/setup` |
| 160–164 | Polls, team pages, routing | **PARTIAL** | Booking nav children |
| 165–168 | Policies, ordering, domain consistency, policy fees | **PARTIAL** | Type editor + share hub |
| 169–170 | Transaction ledger, SMS payment links | **PARTIAL** | `/payments/transactions` |
| 171–173 | Recurring + legacy token UX | **PARTIAL** | Public book + manage |
| 174–176 | Audit timeline, identity, global states | **PARTIAL** | Appointment detail + cross-cutting |

## Zero-gap audit rule

Before closing this phase, every Master Feature Inventory row must be tagged:

`FUNCTIONAL_PASS` | `UI_GAP` | `RUNTIME_GAP` | `PROVIDER_BLOCKED` | `UAT_PENDING`

No `UI_GAP` or `RUNTIME_GAP` on user-facing rows at ship.
