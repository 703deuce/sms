# Service-Booking Competitive Parity Matrix

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Benchmarks:** Acuity · SimplyBook.me · Square Appointments · Vagaro · Fresha · Cal.com (UX only)  
**Last updated:** 2026-09-08

## How to use

| Benchmark type | Question |
|----------------|----------|
| **UX (Cal.com / Calendly)** | Is the basic booking workflow as easy or easier? |
| **Capability (service platforms)** | Can the business run without a second scheduler? |

Status: PASS · FAIL · PROVIDER_BLOCKED · NOT_APPLICABLE — **no UNKNOWN**.

---

## UX benchmark — Cal.com / Calendly

| Capability | Transovo | Route | UA test | Status |
|------------|----------|-------|---------|--------|
| Create event/booking type quickly | AppointmentType editor | `/appointments/types` | CMP-UX-001 | FAIL |
| Set availability | Availability editor | `/appointments/availability` | CMP-UX-002 | FAIL |
| Public booking page | Booking page | `/book/[slug]` | CMP-UX-003 | FAIL |
| Reschedule flow | Manage link + staff | TBD | CMP-UX-004 | FAIL |
| Share/embed link | Booking links | TBD | CMP-UX-005 | FAIL |
| Calendar sync | Integrations | `/integrations/calendars` | CMP-UX-006 | FAIL |

---

## Acuity — floor (see ACUITY-PARITY-MATRIX.md)

Full enumeration in `docs/ACUITY-PARITY-MATRIX.md`. **Acuity parity is required minimum.**

---

## SimplyBook.me

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Package: multiple service types in one product | Mixed-entitlement package (AP) | CMP-SB-001 | FAIL |
| Package: classes + add-ons in package | Program rules engine | CMP-SB-002 | FAIL |
| Membership restricts eligible services/classes | Membership benefit rules (BD) | CMP-SB-003 | FAIL |
| Membership booking limits | Membership policy | CMP-SB-004 | FAIL |
| Member-only classes | Access flag on type/class | CMP-SB-005 | FAIL |

---

## Square Appointments

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Package auto-redemption at checkout | Entitlement engine | CMP-SQ-001 | FAIL |
| Recurring classes + capacity | Class series | CMP-SQ-002 | FAIL |
| Waitlist | Waitlist module | CMP-SQ-003 | FAIL |
| Resource management | Scheduling resources (J) | CMP-SQ-004 | FAIL |
| Deposits + no-show fees | Payment policy (K) | CMP-SQ-005 | FAIL |
| **Processing time** (staff/resource phases) | Service phase model (BB) | CMP-SQ-006 | FAIL |
| **Multi-staff single visit** | Multi-service appointment (BA) | CMP-SQ-007 | FAIL |
| Multi-location | Locations | CMP-SQ-008 | FAIL |
| Gift cards | Gift certificates (P) | CMP-SQ-009 | FAIL |
| Coupons | Coupon engine (R) | CMP-SQ-010 | FAIL |

---

## Vagaro

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Membership: services + classes + products benefits | Membership benefit matrix (BD) | CMP-VG-001 | FAIL |
| Membership: % and fixed discounts | Benefit rules | CMP-VG-002 | FAIL |
| Membership: family/household sharing | Household policy (BE) | CMP-VG-003 | FAIL |
| Multi-location membership | Location scope on membership | CMP-VG-004 | FAIL |

---

## Fresha

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Repeat appointments | Recurring booking (I) | CMP-FR-001 | FAIL |
| Manage series together or individually | Series admin (AO, C) | CMP-FR-002 | FAIL |

---

## Transovo differentiation (must preserve while reaching parity)

| Advantage | Must not regress | UA test | Status |
|-----------|------------------|---------|--------|
| SMS/voice reminders | Reminder engine | CMP-TV-001 | FAIL |
| Workflows | Appointment workflows | CMP-TV-002 | FAIL |
| Two-way messaging | Conversations + MCTB | CMP-TV-003 | FAIL |
| AI booking | `/book/**/ai` | CMP-TV-004 | FAIL |
| Notetaker / meetings | Meetings recaps | CMP-TV-005 | FAIL |
| MCTB cross-product | Contact + conversation link | CMP-TV-006 | FAIL |

---

## Release gate

Ship decision requires:

1. All **Acuity floor** rows at PASS or documented exception.
2. All **SimplyBook + Square** rows marked critical for service-business launch at PASS or PROVIDER_BLOCKED.
3. All **Beyond-Acuity** complaint-gap rows at PASS.
4. **Cal.com UX** rows at PASS for basic booking path.
