# General Appointment Platform — Clean Parity Gaps

**Compared against:** Acuity Scheduling · SimplyBook.me · Square Appointments (general-purpose only)  
**Excludes:** MCTB, medical verticals, payroll, warehouse inventory, Square hardware ecosystem  
**Updated:** 2026-09-08  
**Implementation branch:** `cursor/appt-full-parity-build-709b`

## Status legend

| Status | Meaning |
|--------|---------|
| `HAVE` | Implemented and wired |
| `CODE_COMPLETE` | Code landed; UA/browser certification pending |
| `PARTIAL` | Foundation exists; parity depth in progress |
| `MISSING` | New capability required |
| `PROVIDER_BLOCKED` | Requires external OAuth / partner program |

---

## High-confidence additions (17)

| # | Capability | Status | Implementation |
|---|------------|--------|----------------|
| 1 | Multi-staff / multi-service orchestration (staff per line) | CODE_COMPLETE | `multi-service.ts` + public flow `staffId` per line |
| 2 | Provider-release processing time (phased occupancy) | CODE_COMPLETE | `staffRequired` on phases + `staff-phase-occupancy.ts` |
| 3 | Fixed appointment start times | CODE_COMPLETE | `fixed-start-times.ts` + availability engine |
| 4 | Formal contracts + e-signature | CODE_COMPLETE | `booking-contracts.ts` + Prisma models + API |
| 5 | Intake file/image uploads | CODE_COMPLETE | `file` intake field + upload API |
| 6 | Booking QR-code generator | CODE_COMPLETE | Share hub + `/api/appointments/booking/qr` |
| 7 | Reserve with Google / GBP booking | PROVIDER_BLOCKED | `booking-channel-integrations.ts` stub + settings UI |
| 8 | Facebook direct booking | PROVIDER_BLOCKED | Channel stub |
| 9 | Instagram direct booking | PROVIDER_BLOCKED | Channel stub |
| 10 | Custom booking-page domain | CODE_COMPLETE | `SchedulerThemeConfig.customDomain` |
| 11 | Advanced custom CSS | CODE_COMPLETE | `SchedulerThemeConfig.customCss` |
| 12 | Proper invoice system | CODE_COMPLETE | `booking-invoices.ts` + Prisma + API |
| 13 | Simple products-for-sale catalog | CODE_COMPLETE | `booking-products.ts` + Prisma + API |
| 14 | iCloud / Apple Calendar sync | PROVIDER_BLOCKED | Channel stub (ICS download ≠ sync) |
| 15 | Event ticket issuance + QR admission | CODE_COMPLETE | `event-tickets.ts` + `ClassAdmissionTicket` model |
| 16 | “Make Me Look Busy” availability control | CODE_COMPLETE | `availability-density.ts` |
| 17 | Referral/reward (if not in loyalty) | CODE_COMPLETE | `loyalty.ts` referral codes + POS checkout attribution |

---

## Existing systems — depth confirmation (18)

| # | Capability | Status | Notes |
|---|------------|--------|-------|
| 18 | Full package lifecycle | CODE_COMPLETE | `package-lifecycle.ts` |
| 19 | Full membership/subscription lifecycle | CODE_COMPLETE | `membership-lifecycle.ts` |
| 20 | Unified client account history | CODE_COMPLETE | Portal API + UI sections |
| 21 | Refunds (full/partial/wallet/credit) | CODE_COMPLETE | `appointment-refunds.ts` |
| 22 | Terms & conditions versioned acceptance | CODE_COMPLETE | Public book + metadata snapshot |
| 23 | Location-specific hours/services/staff | CODE_COMPLETE | Locations admin + `location-scheduling.ts` + availability engine |
| 24 | Resource pools / quantity resources | HAVE | `quantity` on resources + `resource-pools.ts` groups |
| 25 | Add-ons alter price/duration/resources | HAVE | `durationDeltaMinutes`, `resourceIds` on add-ons |
| 26 | Waitlist preferences | HAVE | `AppointmentWaitlistEntry` preference fields |
| 27 | Public remaining class-space display | CODE_COMPLETE | `classCapacityDisplay` config + public UI |
| 28 | Staff/service calendar color coding | CODE_COMPLETE | `calendarColors` on platform config |
| 29 | Mixed-content package entitlements | CODE_COMPLETE | `PackageCreditRule` supports types + classes |
| 30 | Custom terminology / localization | CODE_COMPLETE | `bookingTerminology` on scheduler theme |
| 31 | POS checkout breadth | CODE_COMPLETE | `checkoutPosSession` fulfills mixed line kinds + POS admin catalog UI |
| 32 | Class waitlist behavior | HAVE | Existing waitlist + class enrollment |
| 33 | Customer-visible package/membership/gift balances | CODE_COMPLETE | Portal entitlements panel |
| 34 | Failed-payment → entitlement suspension | CODE_COMPLETE | `membership-lifecycle.ts` |
| 35 | Late cancel/no-show → package credit behavior | CODE_COMPLETE | `package-lifecycle.ts` restore rules |

---

## Confirmed no gap

- Any Employee / round-robin staff (`scheduling-domain.ts`)
- Booking limits (daily/weekly/per-type)
- Flexible notification templates
- Follow-up / recalls / workflows
- Native video meetings + notetaker
- Client rescheduling
- Booking approval
- Group/family booking (attendee count)
- Public booking page as standalone site (minus custom domain/CSS)

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/APPOINTMENTS-PLATFORM-FEATURE-INVENTORY.md` | Full feature inventory |
| `docs/GENERAL-APPOINTMENT-PARITY-MATRIX.md` | Phase 1–17 matrix |
| `docs/GENERAL-APPOINTMENT-GAP-CLOSURE-DIRECTIVE.md` | Build order |
