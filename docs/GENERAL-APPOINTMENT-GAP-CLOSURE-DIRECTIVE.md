# GENERAL APPOINTMENT GAP-CLOSURE DIRECTIVE

**Status:** Authoritative implementation order  
**Supersedes:** Ad-hoc vertical competitor expansion; does NOT replace `docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md` (inventory)  
**Date:** 2026-09-08  
**Target product:** Deepest **general-purpose** appointment/service scheduling platform — Acuity + SimplyBook.me + Square Appointments + preserved Cal.com/Calendly strengths  

---

## Executive framing

The audit (`docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md`) is accepted as the current source-of-truth **inventory**, but the project is **NOT complete**.

A surprisingly large percentage of differentiation sits in **PARTIAL** or **EXISTS_BUT_NOT_WIRED**. Do not pursue another giant redesign. Execute **gap-closure** that turns existing architecture into one complete general-purpose product.

The recurring failure mode to eliminate:

```
model → library → API   ✓ (often done)
real business configures it → customer uses it → system enforces it → reload still correct   ✗ (often missing)
```

**An existing model/helper does NOT count as implemented.**

We are NOT 60–70% away despite scary audit percentages. Hard architectural work exists. Finish the customer journeys.

---

## Critical scope correction

### KEEP — general features (do NOT discard because vertical competitors also use them)

These are **not** inherently salon/spa/medical features:

- Packages
- Memberships
- **Programs** (structured mixed-service engagements)
- **Payment plans** (installments separate from membership)
- Recurring appointments
- Classes / groups
- Group bookings
- **Multiple bookings in one session** (SimplyBook-style)
- **Multi-service appointments** (Square-style)
- Resources
- Service phases
- Account-holder / attendee (household) relationships
- Client wallet
- Loyalty
- Invoices
- Add-ons
- Generic checkout / POS (service-business checkout, not salon retail)
- Waitlists
- Customer segmentation
- Client communication (including appointment-derived mass messaging)
- Forms
- Agreements
- Booking approval
- Fixed-time appointments
- Custom client fields

### DE-EMPHASIZE / HIDE — vertical-specific (do not build for checkbox parity)

- SOAP-specific notes
- Body charts
- Patch tests
- Treatment records / treatment diagrams
- Salon formulas
- Booth rental
- Salon payroll / commission systems
- Medspa-specific treatment logic
- Retail inventory / product consumption as core nav
- Gym equipment-layout UI as core product

**Rule:** Do not remove safe reusable backend work. Generalize useful concepts. Hide advanced functionality until activated.

---

## Twelve major systems (remaining work grouped)

### 1. Finish the core Booking Type model

**Gap:** No first-class archetype/kind today. Meeting, Service, and Class exist as disconnected systems.

**Required:** `bookingTypeKind` (or equivalent):

| Kind | Progressive disclosure |
|------|------------------------|
| `MEETING` | Minimal: name → duration → location → availability → create |
| `SERVICE` | + payments, packages, recurrence, resources |
| `CLASS` | + capacity, roster, series, enrollment |

One coherent booking model — not separate scheduling products.

---

### 2. Wire everything already built

**Highest-value work** — engineering cost already paid.

Backend exists for: resources, add-ons, multi-service, service phases, custom fields, intake, global search, seat selection, entitlements — but customers cannot fully use them.

**Mandatory wiring sequence for each capability:**

```
Booking Type editor → configure it
Public booking       → customer sees it
Availability         → respects it
Checkout             → prices it
Appointment          → persists it
Manage Appointment   → preserves it
Client Portal        → shows it
```

**Immediate wiring targets:** categories/images, resources, add-ons, multi-service, service phases, custom fields, intake forms, package entitlements, membership entitlements.

---

### 3. Recurring scheduling — serious completion pass

**Critical for trainers/tutors/coaches** — key reason to pick Transovo over basic schedulers.

**Frequencies required:**

- Daily
- Weekly
- Every 2 / 3 / 4 / N weeks
- Selected weekdays
- Monthly by date
- Monthly by weekday
- Occurrence count
- End date
- Open-ended (admin series)

**Before creation:**

- Preview all generated dates
- Identify conflicts
- Replace individual conflict
- Skip occurrence
- Change provider/time where allowed

**After booking — edit:**

- This occurrence
- This + future
- Entire series

**After booking — cancel:**

- This
- Future
- All

Customer Manage Appointment must expose permitted recurring-series actions.

---

### 4. Package / membership / program / payment plan relationship

**Single most important paid differentiator.** Four **separate** objects:

| Object | Definition | Example |
|--------|------------|---------|
| **Package** | Finite appointment/service credits | Buy 10 appointments |
| **Membership** | Recurring billing + renewing entitlement | $240/mo → 8 sessions/month |
| **Program** | Structured mixed-service engagement | 12-week coaching: onboarding ×1, coaching ×10, final review ×1 |
| **Payment plan** | Installments **≠ membership** | $2,400 program: $800 today + $800/30d + $800/60d — one program entitlement, Stripe collects on schedule |

**Automatic relationships (no package codes for identified customers):**

- Customer buys 10 sessions → Transovo knows
- Customer books → one credit consumed
- Cancel inside policy → credit returned
- Late cancel → credit may remain consumed

Also finish: expiry, rollover, usage limits, future-booking limits, failed payment, grace period, pause/resume (Stripe), cancellation, credit return/consumption policy.

---

### 5. Multiple bookings + multi-service (both required)

| Capability | Definition | Benchmark |
|------------|------------|-----------|
| **Multiple bookings** | Several **independent** appointments, one session/checkout | SimplyBook |
| **Multi-service appointment** | **One visit**, multiple service lines, optional different providers | Square |

Example multiple bookings: Tue 9 AM + Thu 2 PM + next Mon 11 AM → one checkout.

Example multi-service: Consultation 30m + Analysis 30m + Follow-up 45m → one visit.

**Both are currently unfinished.**

---

### 6. Customer self-service

**Manage Appointment link** (no login required — UX differentiator):

- View, confirm, reschedule, cancel, pay, complete forms
- View policies, location, join video, add to calendar, book again
- Recurring: this / future / whole series (where policy permits)

**Client portal** (optional account):

- Future + history appointments, recurring series, classes
- Packages, remaining credits, memberships, gifts
- Invoices, payments/history, forms, rebook

---

### 7. Policy + money enforcement

Policy **types** exist; **money behavior** does not. Dangerous gap.

**Must actually execute:**

| Scenario | Behaviors |
|----------|-----------|
| Before cutoff | Free cancel, refund deposit, return package credit, self reschedule |
| After cutoff | Block, request approval, keep deposit, charge fee, consume package credit, keep payment |
| No-show | Charge card-on-file fee, consume credit, keep deposit/payment, manual waiver |

**Policy snapshot on booking** — editing business policy tomorrow must not rewrite historical booking terms.

Complete Stripe SetupIntent / card-on-file and authorized charge paths.

---

### 8. Availability as a major strength

Finish:

- Blackouts UI
- Holidays
- Fixed start times
- Configurable intervals
- Resources
- Service phases
- Multi-service constraints
- Recurring conflicts
- Minimize gaps
- Display density (honest — never fake appointments)

**Why unavailable?** (admin diagnostic):

> 11:00 AM unavailable  
> John's Google Calendar blocks 10:30–11:30  
> 15-minute service buffer applies  
> Room A is also occupied  

---

### 9. Classes/groups — public product

Backend exists; **public enrollment does not.**

Required:

- One-time class, recurring class, finite series
- Capacity, provider, location, price
- Package + membership eligibility
- Drop-in vs full-series enrollment
- Roster, waitlist, **public enrollment page**, remaining seats

Seat/resource selection: **optional** module, not core.

---

### 10. Communication — beat all three benchmarks

**Transactional (complete coverage):**

- Confirmation, confirmation request, reminder, cancellation, reschedule
- Waitlist opening, payment failure, membership renewal, package low balance

**Two-way inbound actions (must update canonical appointment):**

- Reply YES → confirmed
- Links: Reschedule, Cancel

**Appointment-native messaging** (reuse mass SMS infra — NOT a third product in switcher):

Segments under Contacts/Messaging:

- All active clients
- Booked tomorrow
- Membership customers
- Customers with &lt;2 credits
- Not seen in 60 days
- Customers of Booking Type X
- Selected provider

→ Send compliant message.

---

### 11. General commerce (keep, optional modules)

| Module | Status |
|--------|--------|
| Client wallet | Keep — balances, gifts, saved cards, outstanding |
| Loyalty | Keep — optional general module |
| Invoices | Keep — general-purpose |
| Products / retail inventory | Optional, hidden by default |
| Generic checkout | Keep — appointment, package, membership, gift, add-on, tip |
| Payment plans | Add — see Phase 4 |

Do **not** prioritize: retail inventory management, payroll, vertical POS.

---

### 12. UX progressive disclosure — AFTER engine complete

**Do not polish incomplete architecture.**

Default visible hierarchy:

```
Booking · Calendar · Availability · Contacts · Reminders
```

Deeper modules appear when activated or relevant:

```
Workflows · Meetings · Payments · Analytics · Integrations · Settings
```

---

# IMPLEMENTATION PHASES (execution order)

## PHASE 1 — UNIFY THE BOOKING DOMAIN

Create/finish first-class booking archetypes:

- `MEETING`
- `SERVICE`
- `CLASS`

Do not build separate disconnected scheduling products.

| Kind | Creation flow |
|------|----------------|
| Meeting | Name → Duration → Location → Availability → Create |
| Service | Name → Duration → Price → Location → Availability → Create |
| Class | Name → Duration → Provider → Capacity → Schedule → Create |

Advanced settings appear progressively **after** creation.

---

## PHASE 2 — WIRE EVERYTHING ALREADY BUILT

Complete end-to-end path for:

- Categories / images
- Resources
- Add-ons
- Multi-service
- Service phases
- Custom fields
- Intake forms
- Package entitlements
- Membership entitlements

Path: **Editor → Public book → Availability → Checkout → Persistence → Detail → Manage → Portal**

---

## PHASE 3 — COMPLETE RECURRING APPOINTMENTS

See §3 above. Customer Manage Appointment must expose permitted recurring-series actions.

---

## PHASE 4 — COMPLETE SERVICE COMMERCE

Finish separate: **Package**, **Membership**, **Program**, **Payment Plan**.

Automatic identity-linked entitlements. No redemption-code dependency for identified customers.

Finish: expiry, rollover, usage limits, future-booking limits, failed payment, grace, pause/resume, cancellation, credit return/consumption.

---

## PHASE 5 — MULTIPLE AND COMPLEX BOOKINGS

- **Multiple bookings** — several independent appointments, one checkout
- **Multi-service appointment** — one visit, multiple lines, optional different providers/resources
- Service phases in **actual** availability calculation

---

## PHASE 6 — CUSTOMER SELF-SERVICE

Manage link + portal — see §6 above.

---

## PHASE 7 — POLICY + MONEY ENFORCEMENT

See §7 above. Policy snapshot on appointment. Stripe card-on-file + authorized charges.

---

## PHASE 8 — AVAILABILITY ENGINE

See §8 above. Explainable **Why unavailable?**

---

## PHASE 9 — CLASSES / GROUPS

Public booking for classes — see §9 above.

---

## PHASE 10 — WAITLIST / OPENING RECOVERY

Complete: service, provider, location, preferred dates/times, manual add, public join, opening detection, customizable notification, temporary offer, expiration, atomic claim, next eligible, withdraw.

Add **Book Soon / Open Availability watch** as related distinct capability.

---

## PHASE 11 — CONTACTS + COMMUNICATION

Appointment-native: tags, custom fields, segments, history, communication history, source, duplicate merge.

Reuse Transovo messaging. Appointment-derived segments. True two-way Confirm / Cancel / Reschedule.

---

## PHASE 12 — GENERAL COMMERCE

Keep: client wallet, loyalty (optional), invoices, tips, coupons, add-ons, service checkout.

Do NOT prioritize vertical retail inventory / payroll / treatment-product systems.

---

## PHASE 13 — CALENDAR OPERATIONS

- Click empty slot → prefilled create
- Compact appointment overlay/drawer
- Complete filters
- Confirmation / payment / capacity state
- Recurring indicators
- Waitlist/opening indicators

Drag/drop only if deterministic and safe.

---

## PHASE 14 — SHARE / DISTRIBUTION

**Booking Share hub:**

- Main booking link
- Booking-type link
- Category link
- Provider link
- Location link
- Package/membership store link
- QR code
- Embed
- Copy link

Also: custom-domain architecture, hide-branding rules, ICS/webcal feed where practical.

---

## PHASE 15 — STAFF / TEAMS

Profile, permissions **independent of profile**, own/manager/owner scope, provider pools, Any Provider, round robin, collective/team appointment, multi-provider booking.

---

## PHASE 16 — GENERAL PRODUCTIVITY

Global search UI, settings search, audit/activity log, business/staff notifications, customer rebook, imports/exports, reporting/CSV, webhook dispatcher + retries/replay, API parity.

---

## PHASE 17 — PROGRESSIVE DISCLOSURE

**AFTER** capability wiring is complete. Reorganize UI. Do not expose every capability by default.

---

## PHASE 18 — CERTIFICATION

Create: `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md`

**Columns:**

| Column |
|--------|
| capability |
| Acuity |
| SimplyBook.me |
| Square Appointments |
| Transovo implementation |
| UI route |
| API/runtime |
| DB/domain object |
| UA test ID |
| status |

**Status values:** `PASS` · `FAIL` · `PROVIDER_BLOCKED` · `NOT_APPLICABLE` — **no UNKNOWN**.

`COMPLETE` / `CODE` is **NOT** `PASS`.

**PASS requires:**

1. Real browser action  
2. Persistence  
3. Downstream effect  
4. Page reload  
5. Same correct state  

Do not certify fixture/API-only actions as user journeys.

Fix FAIL rows until all general-purpose competitor capabilities are PASS or legitimately PROVIDER_BLOCKED.

---

## MUST-FINISH differentiators (trainer/coach/consultant ceiling)

These make Transovo dramatically better than "another booking link":

1. **Programs** + **Payment plans** (not just packages/memberships)
2. **Multiple bookings** in one session
3. **Multi-service** appointments
4. **Full recurring** management (customer + admin)
5. **Two-way SMS** actions (confirm/cancel/reschedule)
6. **Mass messaging** from appointment-derived segments (inside Contacts/Messaging, not a separate product)

---

## FINAL DEFINITION

We are **NOT** trying to become the deepest salon, spa, fitness, medical, or vertical-management platform.

We **ARE** trying to become:

> **The deepest general-purpose appointment/service platform available.**

**Target blend:**

| Source | Contribution |
|--------|----------------|
| Cal.com / Calendly | Simplicity |
| Acuity | Recurring / service-business depth |
| SimplyBook.me | Flexibility (multiple bookings, approval, classes) |
| Square Appointments | Operational / payment / multi-service depth |
| Transovo | Reminders, workflows, SMS, voice, AI booking, video, notetaker, MCTB |

**Stop condition:** Do not stop when models/pages exist. Stop when general-purpose customer journeys work end-to-end and are certified.

---

## Execution rules (code pass — updated 2026-09-08)

**Phases are sequencing, not checkpoints.** Continue automatically through Phases 1–17 in one continuous run. Do not stop after a phase or ask what to do next.

### Archetype correction (Phase 1)

`MEETING`, `SERVICE`, and `CLASS` control **default UX and progressive disclosure only**. They do **not** hard-disable general-purpose capabilities. Payment, intake, resources, add-ons, packages, and memberships remain available in Advanced settings for all archetypes.

### Primary goal (this pass)

**CODE_COMPLETE + WIRED IN SOURCE** — full-stack (admin UI + API + persistence + public/customer UI + manage/portal where applicable).

### Status vocabulary

| Status | Meaning |
|--------|---------|
| `CODE_COMPLETE` | Full source path implemented |
| `CODE_COMPLETE + UA_PENDING` | Wired in source; browser certification deferred |
| `PARTIAL` | Some layers missing |
| `EXISTS_BUT_NOT_WIRED` | Backend only |
| `MISSING` | Not implemented |
| `PROVIDER_BLOCKED` | External dependency |
| `UA_PENDING` | Awaiting runtime/browser certification |

### Deferred (Phase 18)

Do **not** run `next dev`, `next build`, Playwright, browser automation, or full UA certification in this environment. Certification runs later on stable preview/staging.

### Allowed

- Edit source, models, APIs, components, migrations (without running app)
- Narrow unit scripts that do not boot Next.js (`npx tsx scripts/test-*.ts`)
- Update `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md`

---

## Related documents

| Document | Role |
|----------|------|
| `docs/GENERAL-APPOINTMENT-PARITY-AUDIT.md` | Current inventory (PARTIAL/MISSING audit) |
| `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` | Certification matrix (Phase 18 — to create) |
| `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md` | Prior governing spec (align, do not contradict without updating this directive) |
| `docs/ACUITY-PARITY-MATRIX.md` | Legacy section matrix |
