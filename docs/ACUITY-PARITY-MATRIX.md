# Acuity Parity Matrix

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Last audited:** 2026-09-08 (initial matrix — pre-certification)  
**Rule:** No `UNKNOWN`. PASS requires persistence + reload + UA test.

## Status legend

| Status | Meaning |
|--------|---------|
| PASS | End-to-end customer/admin action works |
| FAIL | Missing or non-functional |
| PROVIDER_BLOCKED | Internal ready; external approval/credential required |
| NOT_APPLICABLE | Documented exclusion |

---

## A. Public booking / scheduler

| Acuity capability | Transovo equivalent | UI route | API / runtime | Domain object | UA test | Status |
|-------------------|---------------------|----------|---------------|---------------|---------|--------|
| Individual services | AppointmentType / BookingType | `/appointments/types` | `/api/appointments/types` | `AppointmentType` | APT-PUB-001 | FAIL |
| Group classes | Class definition + occurrences | `/appointments/types` (partial) | TBD | TBD | APT-PUB-002 | FAIL |
| Appointment categories | BookingCategory | TBD | TBD | `BookingCategory` | APT-PUB-003 | FAIL |
| Collapsible categories | Category display config | TBD | TBD | `BookingCategory` | APT-PUB-004 | FAIL |
| Custom type/category order | Sort order fields | `/appointments/types` (partial) | TBD | `AppointmentType` | APT-PUB-005 | FAIL |
| Public types | `visibility=public` | `/book/[slug]` | `/api/public/book/[slug]` | `BookingPage` | APT-PUB-006 | FAIL |
| Unlisted/direct-link types | `visibility=unlisted` | `/book/[slug]/[serviceId]` | public book API | `AppointmentType` | APT-PUB-007 | FAIL |
| Direct link to type | Per-type slug URL | `/book/[slug]/[serviceId]` | public book API | `AppointmentType` | APT-PUB-008 | FAIL |
| Direct link to category | Category slug URL | TBD | TBD | `BookingCategory` | APT-PUB-009 | FAIL |
| Direct link to provider | Staff/calendar scoped URL | TBD | TBD | `Staff` | APT-PUB-010 | FAIL |
| Direct link to location | Location scoped URL | TBD | TBD | `Location` | APT-PUB-011 | FAIL |
| Package/store links | Package purchase URL | TBD | TBD | `PackageProduct` | APT-PUB-012 | FAIL |
| Embedded scheduler | Embed widget | `/embed/book/[slug]` | embed routes | `BookingPage` | APT-PUB-013 | FAIL |
| Full-page scheduler | Public booking page | `/book/[slug]` | public book API | `BookingPage` | APT-PUB-014 | FAIL |
| Scheduler branding | Theme tokens | TBD | TBD | `BookingPageTheme` | APT-PUB-015 | FAIL |
| Business logo on scheduler | Logo asset | TBD | TBD | workspace branding | APT-PUB-016 | FAIL |
| Type image | Cover image | type editor (partial) | type API | `AppointmentType` | APT-PUB-017 | FAIL |
| Type description | Description field | type editor | type API | `AppointmentType` | APT-PUB-018 | FAIL |
| Duration display | Duration on book flow | `/book/**` | public book API | `AppointmentType` | APT-PUB-019 | FAIL |
| Price display | Price on book flow | `/book/**` | checkout API | pricing config | APT-PUB-020 | FAIL |
| Confirmation message | Post-book message | confirm page | book API | `BookingPage` | APT-PUB-021 | FAIL |
| Timezone conversion | TZ on public book | `/book/**` (partial) | slot engine | timezone prefs | APT-PUB-022 | FAIL |
| SEO indexing suppression | `noindex` per page | TBD | TBD | `BookingPage` | APT-PUB-023 | FAIL |

---

## B. Manage Appointment link (core)

| Acuity capability | Transovo equivalent | UI route | API / runtime | Domain object | UA test | Status |
|-------------------|---------------------|----------|---------------|---------------|---------|--------|
| Secure manage URL per appointment | ManageAppointmentToken | TBD `/manage/[token]` | TBD | `ManageAppointmentToken` | APT-MGT-001 | FAIL |
| URL in confirmation email | Template variable | reminders/templates | notification jobs | template | APT-MGT-002 | FAIL |
| URL in confirmation SMS | Template variable | messaging | SMS pipeline | template | APT-MGT-003 | FAIL |
| URL in reminders | Template variable | reminders | reminder worker | template | APT-MGT-004 | FAIL |
| URL in calendar invite | ICS link | integrations | calendar export | appointment | APT-MGT-005 | FAIL |
| View / confirm / reschedule / cancel | Self-service actions | manage page | manage API | `Appointment` | APT-MGT-006 | FAIL |
| Pay outstanding balance | Payment on manage link | manage page | Stripe | `PaymentTransaction` | APT-MGT-007 | FAIL |
| Intake edit on manage link | Form edit w/ cutoff | manage page | intake API | form response | APT-MGT-008 | FAIL |
| Reschedule enable + cutoff | Policy engine | settings / type | policy API | scheduling policy | APT-MGT-009 | FAIL |
| Cancel enable + cutoff | Policy engine | settings / type | policy API | scheduling policy | APT-MGT-010 | FAIL |
| After-cutoff behaviors | Policy outcomes | manage page | policy API | policy | APT-MGT-011 | FAIL |
| Reschedule preserves payment/deposit | Transactional transfer | manage API | booking runtime | payment ledger | APT-MGT-012 | FAIL |
| Reschedule preserves package/membership | Entitlement transfer | manage API | entitlement engine | entitlement | APT-MGT-013 | FAIL |

---

## C–J. Scheduling engine (summary rows)

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| C | Recurring self-service one/future/all | APT-REC- | FAIL |
| D | Full scheduling limits matrix | APT-LIM- | FAIL |
| E | Minimize gaps ranking | APT-GAP- | FAIL |
| F | Complete booking type fields | APT-TYP- | FAIL |
| G | BookingCategory model | APT-CAT- | FAIL |
| H | Group class series enrollment | APT-CLS- | FAIL |
| I | Recurring series engine | APT-SER- | FAIL |
| J | Resource quantity engine | APT-RES- | FAIL |

---

## K–R. Commerce

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| K | Full payment modes (deposit, saved card, etc.) | APT-PAY- | FAIL |
| L | Pay-what-you-want | APT-PWY- | FAIL |
| M | Tipping | APT-TIP- | FAIL |
| N | Saved card (Stripe PM) | APT-CARD- | FAIL |
| O | Packages + ledger | APT-PKG- | FAIL |
| P | Gift certificates | APT-GFT- | FAIL |
| Q | Memberships/subscriptions | APT-MEM- | FAIL |
| R | Unified coupons | APT-CPN- | FAIL |

---

## S–X. Operations

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| S | Add-ons atomic checkout | APT-ADD- | FAIL |
| T | Intake forms (full types) | APT-INT- | FAIL |
| U | Staff-only notes/forms | APT-NOT- | FAIL |
| V | Client CRM + import/export | APT-CLI- | FAIL |
| W | Client ban/restrict | APT-BAN- | FAIL |
| X | Client portal (full) | APT-PRT- | FAIL |

---

## Y–AM. Platform

| Section | Key capability | UA test prefix | Status |
|---------|----------------|----------------|--------|
| Y | Staff-created = canonical pipeline | APT-STF- | FAIL |
| Z | Calendar sync + deterministic update | APT-SYN- | FAIL |
| AA | Scoped team permissions | APT-RBAC- | FAIL |
| AB | Waitlist templates + atomic claim | APT-WLT- | FAIL |
| AC | Full notification event coverage | APT-NOT- | FAIL |
| AD | Reminder editor coverage | APT-RMD- | FAIL |
| AE | Workflow builder (advanced) | APT-WFL- | FAIL |
| AF | Reporting parity + CSV | APT-RPT- | FAIL |
| AG | Import/export with preview | APT-IMP- | FAIL |
| AH | Booking source tracking | APT-SRC- | FAIL |
| AI | Embed/share link generator | APT-EMB- | FAIL |
| AJ | Integrations catalog | APT-INT- | FAIL |
| AK | API + webhooks | APT-DEV- | FAIL |
| AL | Brand customization | APT-BRD- | FAIL |
| AM | Responsive mobile (web) | APT-MOB- | FAIL |

---

## BA–BE. Service-booking competitive (see also SERVICE-BOOKING-COMPETITIVE-PARITY-MATRIX.md)

| Capability | UA test | Status |
|------------|---------|--------|
| Multi-service appointments (one checkout) | APT-MSA-001 | FAIL |
| Processing-time phases | APT-PRX-001 | FAIL |
| Mixed-entitlement packages | APT-MEP-001 | FAIL |
| Membership benefits beyond credits | APT-MBF-001 | FAIL |
| Family / dependent accounts | APT-FAM-001 | FAIL |

---

## Certification gate

Appointments product **must not** be declared production-complete until:

1. Every row in this matrix has a non-UNKNOWN status.
2. All rows required for target launch tier are PASS or documented PROVIDER_BLOCKED / NOT_APPLICABLE.
3. `docs/ACUITY-USER-COMPLAINT-GAP-MATRIX.md` beyond-Acuity rows are certified.
4. No PASS without linked UA test execution evidence.

**Next audit:** Re-run against Acuity 2026 help center before each major release.
