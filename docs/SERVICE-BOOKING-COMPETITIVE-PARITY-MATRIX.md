# Service-Booking Competitive Parity Matrix

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Benchmarks:** Acuity · SimplyBook.me · Square Appointments · Vagaro · Fresha · Cal.com (UX only)  
**Last updated:** 2026-09-08 (service-booking parity build)

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
| Create event/booking type quickly | AppointmentType editor | `/appointments/types` | CMP-UX-001 | PASS |
| Set availability | Availability editor | `/appointments/availability` | CMP-UX-002 | PASS |
| Public booking page | Booking page | `/book/[slug]` | CMP-UX-003 | PASS |
| Reschedule flow | Manage link + staff | `/manage/[token]` | CMP-UX-004 | PASS |
| Share/embed link | Booking links | `/appointments/booking`, `/embed/book/[slug]` | CMP-UX-005 | PASS |
| Calendar sync | Integrations | `/integrations/calendars` | CMP-UX-006 | FAIL |

---

## Acuity — floor (see ACUITY-PARITY-MATRIX.md)

Full enumeration in `docs/ACUITY-PARITY-MATRIX.md`. **Acuity parity is required minimum.**

---

## SimplyBook.me

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Packages / memberships storefront | Public store checkout | `/book/[slug]/store` | CMP-SB-001 | PASS |
| Class series enrollment | Class admin + runtime | `/appointments/classes` | CMP-SB-002 | PASS |
| Client restrictions | Ban/restrict list | `/appointments/client-restrictions` | CMP-SB-003 | PASS |
| Multi-resource scheduling | Resource quantity engine | `/appointments/resources` | CMP-SB-004 | PASS |
| Coupons at checkout | Unified coupon engine | commerce admin | CMP-SB-005 | PASS |

---

## Square Appointments

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Deposits + tipping | Extended payment modes | checkout runtime | CMP-SQ-001 | PASS |
| Gift cards | Gift certificate products | `/book/[slug]/store` | CMP-SQ-002 | PASS |
| Client portal | Token portal | `/portal/[token]` | CMP-SQ-003 | PASS |

---

## Vagaro / Fresha (selected)

| Capability | Transovo target | UA test | Status |
|------------|-----------------|---------|--------|
| Service categories | BookingCategory | `/appointments/categories` | CMP-VF-001 | PASS |
| Household / family booking | Household accounts | commerce admin | CMP-VF-002 | PASS |
| Service phases / processing time | Phase templates | commerce admin | CMP-VF-003 | PASS |

---

## Certification gate

Competitive parity is **not** declared until Acuity floor matrix PASS rows have UA evidence and SimplyBook/Square differentiators above are exercised in browser certification.
